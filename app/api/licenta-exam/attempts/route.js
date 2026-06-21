import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAcademicContext,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { getAllExamQuestions } from "@/lib/data";
import { buildLicentaExamCommunityStats } from "@/lib/licenta-exam-community-stats";
import { getActiveLicentaMistakeIds } from "@/lib/licenta-exam-mistakes";
import { buildLicentaQuestionKey } from "@/lib/licenta-exam-question-key";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";

const AttemptPayloadSchema = z
  .object({
    idempotencyKey: z.string().trim().min(8).max(160),
    mode: z.enum(["quick", "custom", "mistakes", "verify"]),
    score: z.number().int().min(0),
    total: z.number().int().min(1).max(500),
    percentage: z.number().int().min(0).max(100),
    wrongCount: z.number().int().min(0).max(500),
    unansweredCount: z.number().int().min(0).max(500).default(0),
    questionIds: z.array(z.string().trim().min(1)).max(500).default([]),
    wrongQuestionIds: z.array(z.string().trim().min(1)).max(500).default([]),
    subjectBreakdown: z
      .array(
        z.object({
          subjectId: z.string().trim().min(1).max(120),
          title: z.string().trim().min(1).max(180),
          total: z.number().int().min(0).max(500),
          correct: z.number().int().min(0).max(500),
          wrong: z.number().int().min(0).max(500)
        })
      )
      .max(100)
      .default([]),
    durationSeconds: z.number().int().min(0).max(24 * 60 * 60).nullable().optional()
  })
  .superRefine((value, context) => {
    if (value.score > value.total) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["score"],
        message: "Scorul nu poate fi mai mare decat numarul de intrebari."
      });
    }

    if (value.wrongCount > value.total) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["wrongCount"],
        message: "Numarul de greseli nu este valid."
      });
    }

    if (value.unansweredCount > value.total) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["unansweredCount"],
        message: "Numarul de intrebari fara raspuns nu este valid."
      });
    }

    if (value.score + value.wrongCount + value.unansweredCount !== value.total) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["total"],
        message: "Rezultatul nu acopera toate intrebarile."
      });
    }

    if (value.percentage !== Math.round((value.score / value.total) * 100)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["percentage"],
        message: "Procentul rezultatului nu este valid."
      });
    }

    const uniqueQuestionIds = new Set(value.questionIds);
    const uniqueWrongQuestionIds = new Set(value.wrongQuestionIds);
    if (
      value.questionIds.length !== value.total ||
      uniqueQuestionIds.size !== value.questionIds.length ||
      value.wrongQuestionIds.length !== value.wrongCount ||
      uniqueWrongQuestionIds.size !== value.wrongQuestionIds.length ||
      value.wrongQuestionIds.some((questionId) => !uniqueQuestionIds.has(questionId))
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["questionIds"],
        message: "Lista intrebarilor din rezultat nu este valida."
      });
    }

    const breakdownTotals = value.subjectBreakdown.reduce(
      (totals, row) => ({
        total: totals.total + row.total,
        correct: totals.correct + row.correct,
        wrong: totals.wrong + row.wrong
      }),
      { total: 0, correct: 0, wrong: 0 }
    );
    if (
      breakdownTotals.total !== value.total ||
      breakdownTotals.correct !== value.score ||
      breakdownTotals.wrong !== value.wrongCount ||
      value.subjectBreakdown.some((row) => row.correct + row.wrong !== row.total)
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["subjectBreakdown"],
        message: "Rezultatul pe materii nu este valid."
      });
    }
  });

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
    payload = AttemptPayloadSchema.parse(await request.json());
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message || "Rezultatul nu este valid."
        : "Rezultatul nu este valid.";

    return NextResponse.json({ error: message }, { status: 400 });
  }

  try {
    const academicContext = await getAcademicContext(user.id);
    if (!isAcademicContextComplete(academicContext)) {
      return NextResponse.json(
        { error: "Completeaza comunitatea academica pentru comparatii." },
        { status: 409 }
      );
    }

    await assertRateLimit({
      action: "licenta_attempt_save",
      subject: user.id,
      windowSeconds: 5 * 60,
      maxRequests: 30
    });

    const { questions } = await getAllExamQuestions({
      userId: user.id,
      membership: academicContext.membership
    });
    const availableQuestionIds = new Set(
      questions.map((question, index) => buildLicentaQuestionKey(question, index))
    );
    if (payload.questionIds.some((questionId) => !availableQuestionIds.has(questionId))) {
      return NextResponse.json(
        { error: "Setul de intrebari s-a schimbat. Porneste o runda noua." },
        { status: 409 }
      );
    }

    const admin = createAdminClient();
    const { data: attemptResult, error: attemptError } = await admin.rpc(
      "record_licenta_exam_attempt",
      {
        p_user_id: user.id,
        p_membership_id: academicContext.membership.id,
        p_target_institution_id: academicContext.membership.institution_id,
        p_target_unit_id: academicContext.membership.program_unit_id,
        p_target_cohort_id: academicContext.membership.cohort_id,
        p_user_type: academicContext.profile.user_type === "elev" ? "elev" : "student",
        p_mode: payload.mode,
        p_score_percent: payload.percentage,
        p_correct_count: payload.score,
        p_question_count: payload.total,
        p_wrong_count: payload.wrongCount,
        p_unanswered_count: payload.unansweredCount,
        p_question_ids: payload.questionIds,
        p_wrong_question_ids: payload.wrongQuestionIds,
        p_duration_seconds: payload.durationSeconds ?? null,
        p_metadata: {
          source: "licenta_exam",
          subjectBreakdown: payload.subjectBreakdown
        },
        p_idempotency_key: payload.idempotencyKey
      }
    );
    if (attemptError || !attemptResult?.attemptId) {
      throw attemptError || new Error("licenta_attempt_missing_after_insert");
    }

    const [communityStats, mistakeQuestionIds] = await Promise.all([
      buildLicentaExamCommunityStats({
        admin,
        academicContext,
        userId: user.id,
        scorePercent: payload.percentage,
        mode: payload.mode
      }),
      getActiveLicentaMistakeIds(user.id)
    ]);

    return NextResponse.json({
      ok: true,
      attemptId: attemptResult.attemptId,
      communityStats,
      mistakeQuestionIds
    });
  } catch (error) {
    if (error?.code === "RATE_LIMITED") {
      return NextResponse.json(
        { error: error.message },
        {
          status: 429,
          headers: { "Retry-After": String(error.retryAfterSeconds || 300) }
        }
      );
    }

    if (isSupabaseSetupIncompleteError(error)) {
      return NextResponse.json(
        {
          error: "Comparatiile pentru licenta nu sunt active inca. Ruleaza ultima migrare."
        },
        { status: 503 }
      );
    }

    console.error("licenta_exam_attempt_save_failed", error);
    return NextResponse.json(
      { error: "Nu am putut salva rezultatul pentru comparatie acum." },
      { status: 500 }
    );
  }
}
