import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAcademicContext,
  isAcademicContextComplete
} from "@/lib/academic/server";
import {
  awardGamificationPoints,
  calculateGamificationAward
} from "@/lib/gamification";
import { getStatsScopeCandidates } from "@/lib/licenta-exam-community-stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";

const ProgressPayloadSchema = z
  .object({
    subjectId: z.string().trim().min(1),
    mode: z.enum(["studiu", "interactiv", "test"]),
    studyTotalQuestions: z.number().int().min(0).optional(),
    studyViewedIndexes: z.array(z.number().int().min(0)).max(5000).optional(),
    interactiveTotalQuestions: z.number().int().min(0).optional(),
    interactiveAnswered: z.number().int().min(0).optional(),
    interactiveCorrect: z.number().int().min(0).optional(),
    interactiveWrong: z.number().int().min(0).optional(),
    testScorePercent: z.number().int().min(0).max(100).optional(),
    testQuestionCount: z.number().int().min(1).max(500).optional(),
    testCorrectCount: z.number().int().min(0).max(500).optional(),
    testQuestionIds: z.array(z.string().trim().min(1).max(200)).max(500).optional(),
    wrongQuestionIds: z.array(z.string().trim().min(1).max(200)).max(500).optional(),
    idempotencyKey: z.string().trim().min(8).max(180).optional()
  })
  .superRefine((value, context) => {
    if (value.mode === "studiu") {
      if (typeof value.studyTotalQuestions !== "number") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["studyTotalQuestions"],
          message: "Lipseste numarul de intrebari pentru Studiu."
        });
      }

      if (!Array.isArray(value.studyViewedIndexes)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["studyViewedIndexes"],
          message: "Lipsesc intrebarile vazute pentru Studiu."
        });
      }
    }

    if (value.mode === "interactiv") {
      for (const key of [
        "interactiveTotalQuestions",
        "interactiveAnswered",
        "interactiveCorrect",
        "interactiveWrong"
      ]) {
        if (typeof value[key] !== "number") {
          context.addIssue({
            code: z.ZodIssueCode.custom,
            path: [key],
            message: "Lipsesc date pentru progresul Interactiv."
          });
        }
      }

      const total = value.interactiveTotalQuestions;
      const answered = value.interactiveAnswered;
      const correct = value.interactiveCorrect;
      const wrong = value.interactiveWrong;

      if (
        [total, answered, correct, wrong].every((item) => typeof item === "number") &&
        (answered > total || correct + wrong !== answered)
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["interactiveAnswered"],
          message: "Datele progresului Interactiv nu sunt coerente."
        });
      }
    }

    if (value.mode === "test") {
      if (typeof value.testScorePercent !== "number") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["testScorePercent"],
          message: "Lipseste scorul testului."
        });
      }

      if (
        typeof value.testQuestionCount === "number" &&
        typeof value.testCorrectCount === "number" &&
        value.testCorrectCount > value.testQuestionCount
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["testCorrectCount"],
          message: "Datele testului nu sunt coerente."
        });
      }

      if (Array.isArray(value.testQuestionIds) !== Array.isArray(value.wrongQuestionIds)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["testQuestionIds"],
          message: "Datele pentru greselile testului nu sunt complete."
        });
      }

      if (
        Array.isArray(value.testQuestionIds) &&
        Array.isArray(value.wrongQuestionIds) &&
        value.wrongQuestionIds.some((questionId) => !value.testQuestionIds.includes(questionId))
      ) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["wrongQuestionIds"],
          message: "O intrebare gresita trebuie sa faca parte din test."
        });
      }
    }
  });

function average(values) {
  if (!values.length) return 0;
  return Math.round(values.reduce((total, value) => total + value, 0) / values.length);
}

function pickReachedThreshold(value, thresholds) {
  const safeValue = Number(value || 0);
  return thresholds.filter((threshold) => safeValue >= threshold).pop() || 0;
}

function normalizeQuestionIds(questionIds) {
  return Array.from(
    new Set(
      (Array.isArray(questionIds) ? questionIds : [])
        .map((questionId) => String(questionId || "").trim())
        .filter(Boolean)
    )
  ).slice(0, 500);
}

async function syncSubjectMistakes({ admin, userId, subjectId, testQuestionIds, wrongQuestionIds }) {
  if (!Array.isArray(testQuestionIds) || !Array.isArray(wrongQuestionIds)) {
    return null;
  }

  const testedIds = normalizeQuestionIds(testQuestionIds);
  const wrongIds = normalizeQuestionIds(wrongQuestionIds);
  const testedSet = new Set(testedIds);

  const { data: progress, error: progressError } = await admin
    .from("subject_progress")
    .select("mistake_question_ids")
    .eq("user_id", userId)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (progressError && progressError.code !== "PGRST116") {
    throw progressError;
  }

  const retainedIds = normalizeQuestionIds(progress?.mistake_question_ids).filter(
    (questionId) => !testedSet.has(questionId)
  );
  const nextMistakeIds = normalizeQuestionIds([...retainedIds, ...wrongIds]);

  const { error: updateError } = await admin
    .from("subject_progress")
    .update({ mistake_question_ids: nextMistakeIds })
    .eq("user_id", userId)
    .eq("subject_id", subjectId);

  if (updateError) {
    throw updateError;
  }

  return nextMistakeIds;
}

function membershipColumnForScope(scope) {
  if (scope.key === "program") return "program_unit_id";
  if (scope.key === "cohort") return "cohort_id";
  return "institution_id";
}

async function fetchSubjectCommunityUserIds(admin, academicContext) {
  const scopes = getStatsScopeCandidates(academicContext);
  let fallback = null;

  for (const scope of scopes) {
    const { data, error } = await admin
      .from("memberships")
      .select("user_id")
      .eq(membershipColumnForScope(scope), scope.id)
      .eq("status", "active")
      .limit(1000);

    if (error) throw error;

    const userIds = Array.from(new Set((data || []).map((row) => row.user_id).filter(Boolean)));
    const candidate = { scope, userIds };

    if (!fallback) {
      fallback = candidate;
    }

    if (userIds.length >= 3) {
      return candidate;
    }
  }

  return fallback;
}

async function buildSubjectTestStats({ admin, user, subjectId, currentScore, previousBestScore }) {
  const { data: personalRow, error: personalError } = await admin
    .from("subject_progress")
    .select("test_best_score_percent, test_last_score_percent")
    .eq("user_id", user.id)
    .eq("subject_id", subjectId)
    .maybeSingle();

  if (personalError && personalError.code !== "PGRST116") {
    throw personalError;
  }

  let community = null;

  try {
    const academicContext = await getAcademicContext(user.id);
    if (isAcademicContextComplete(academicContext)) {
      const pickedScope = await fetchSubjectCommunityUserIds(admin, academicContext);
      const userIds = pickedScope?.userIds || [];

      if (pickedScope?.scope && userIds.length) {
        const { data: rows, error } = await admin
          .from("subject_progress")
          .select("user_id, test_best_score_percent, test_last_score_percent")
          .eq("subject_id", subjectId)
          .in("user_id", userIds.slice(0, 1000))
          .limit(1000);

        if (error) throw error;

        const scoredRows = (rows || [])
          .map((row) => ({
            userId: row.user_id,
            score: Number(row.test_best_score_percent || row.test_last_score_percent || 0)
          }))
          .filter((row) => row.score > 0);
        const scores = scoredRows.map((row) => row.score);
        const participantCount = new Set(scoredRows.map((row) => row.userId).filter(Boolean)).size;
        const peers = scoredRows.filter((row) => row.userId !== user.id);
        const peerScores = peers.map((row) => row.score);
        const rankedScores = [...scores].sort((left, right) => right - left);
        const currentUserScore = Number(personalRow?.test_best_score_percent || currentScore || 0);
        const rankIndex = rankedScores.findIndex((score) => currentUserScore >= score);

        community = {
          scopeLabel: pickedScope.scope.label,
          participantCount,
          averageScore: average(peerScores.length ? peerScores : scores),
          percentile:
            scores.length > 1
              ? Math.round((scores.filter((score) => score <= currentScore).length / scores.length) * 100)
              : null,
          userRank: participantCount > 1 && rankIndex >= 0 ? rankIndex + 1 : null
        };
      }
    }
  } catch (error) {
    console.error("subject_test_community_stats_failed", error);
  }

  const previousBest = Number.isFinite(previousBestScore) && previousBestScore > 0 ? previousBestScore : null;
  const personalBest = Number(personalRow?.test_best_score_percent || currentScore || 0);

  return {
    currentScore,
    personalBest,
    previousBest,
    deltaFromPreviousBest: previousBest !== null ? currentScore - previousBest : null,
    community
  };
}

export async function POST(request) {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Trebuie sa fii logat." }, { status: 401 });
  }

  let payload;
  try {
    payload = ProgressPayloadSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Datele de progres nu sunt valide."
        : "Datele de progres nu sunt valide.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const admin = createAdminClient();
    const { data: syncResult, error: syncError } = await admin.rpc("sync_subject_progress", {
      p_user_id: user.id,
      p_subject_id: payload.subjectId,
      p_mode: payload.mode,
      p_study_total_questions: payload.studyTotalQuestions ?? null,
      p_study_viewed_indexes: payload.studyViewedIndexes || [],
      p_interactive_total_questions: payload.interactiveTotalQuestions ?? null,
      p_interactive_answered: payload.interactiveAnswered ?? null,
      p_interactive_correct: payload.interactiveCorrect ?? null,
      p_interactive_wrong: payload.interactiveWrong ?? null,
      p_test_score_percent: payload.testScorePercent ?? null
    });

    if (syncError) {
      throw syncError;
    }

    const mistakeQuestionIds =
      payload.mode === "test"
        ? await syncSubjectMistakes({
            admin,
            userId: user.id,
            subjectId: payload.subjectId,
            testQuestionIds: payload.testQuestionIds,
            wrongQuestionIds: payload.wrongQuestionIds
          })
        : null;

    const subjectTestStats =
      payload.mode === "test"
        ? await buildSubjectTestStats({
            admin,
            user,
            subjectId: payload.subjectId,
            currentScore: payload.testScorePercent || 0,
            previousBestScore: Number(syncResult?.previousBestScore || 0)
          })
        : null;
    let gamification = null;

    if (payload.mode === "test" && payload.idempotencyKey) {
      gamification = await awardGamificationPoints({
        userId: user.id,
        actionType: "subject_test_completed",
        points: calculateGamificationAward({
          actionType: "subject_test_completed",
          correctCount: payload.testCorrectCount ?? 0,
          questionCount: payload.testQuestionCount ?? 0,
          scorePercent: payload.testScorePercent ?? 0
        }),
        referenceType: "subject",
        referenceId: payload.subjectId,
        idempotencyKey: `subject-test:${payload.idempotencyKey}`,
        metadata: {
          subjectId: payload.subjectId,
          scorePercent: payload.testScorePercent ?? 0,
          correctCount: payload.testCorrectCount ?? null,
          questionCount: payload.testQuestionCount ?? null
        }
      });
    } else if (payload.mode === "interactiv") {
      const threshold = pickReachedThreshold(payload.interactiveAnswered, [5, 10, 20, 50, 100, 200, 500]);
      if (threshold) {
        gamification = await awardGamificationPoints({
          userId: user.id,
          actionType: "subject_interactive_session",
          points: Math.min(120, 10 + threshold),
          referenceType: "subject",
          referenceId: payload.subjectId,
          idempotencyKey: `subject-interactive:${payload.subjectId}:${threshold}`,
          metadata: {
            subjectId: payload.subjectId,
            threshold,
            correctCount: payload.interactiveCorrect ?? 0,
            questionCount: threshold,
            answeredCount: payload.interactiveAnswered ?? 0
          }
        });
      }
    } else if (payload.mode === "studiu") {
      const viewedCount = Array.isArray(payload.studyViewedIndexes)
        ? payload.studyViewedIndexes.length
        : 0;
      const threshold = pickReachedThreshold(viewedCount, [10, 25, 50, 100, 200, 500]);
      if (threshold) {
        gamification = await awardGamificationPoints({
          userId: user.id,
          actionType: "subject_study_session",
          points: Math.min(100, 8 + Math.round(threshold / 2)),
          referenceType: "subject",
          referenceId: payload.subjectId,
          idempotencyKey: `subject-study:${payload.subjectId}:${threshold}`,
          metadata: {
            subjectId: payload.subjectId,
            threshold,
            viewedCount
          }
        });
      }
    }

    return NextResponse.json({ ok: true, subjectTestStats, gamification, mistakeQuestionIds });
  } catch (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      return NextResponse.json(
        {
          error: "Salvarea progresului nu este disponibila momentan. Incearca din nou putin mai tarziu."
        },
        { status: 503 }
      );
    }

    console.error("subject_progress_sync_failed", error);
    return NextResponse.json(
      { error: "Nu am putut salva progresul acum. Incearca din nou." },
      { status: 500 }
    );
  }
}
