import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getAcademicContext,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { buildLicentaExamCommunityStats } from "@/lib/licenta-exam-community-stats";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";

const AttemptPayloadSchema = z
  .object({
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

    const admin = createAdminClient();
    const insertRow = {
      user_id: user.id,
      membership_id: academicContext.membership.id,
      target_institution_id: academicContext.membership.institution_id,
      target_unit_id: academicContext.membership.program_unit_id,
      target_cohort_id: academicContext.membership.cohort_id,
      user_type: academicContext.profile.user_type === "elev" ? "elev" : "student",
      mode: payload.mode,
      score_percent: payload.percentage,
      correct_count: payload.score,
      question_count: payload.total,
      wrong_count: payload.wrongCount,
      unanswered_count: payload.unansweredCount,
      question_ids: payload.questionIds,
      wrong_question_ids: payload.wrongQuestionIds,
      duration_seconds: payload.durationSeconds ?? null,
      metadata: {
        source: "licenta_exam",
        subjectBreakdown: payload.subjectBreakdown
      }
    };

    const { data: insertedAttempt, error: insertError } = await admin
      .from("licenta_exam_attempts")
      .insert(insertRow)
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    const communityStats = await buildLicentaExamCommunityStats({
      admin,
      academicContext,
      userId: user.id,
      scorePercent: payload.percentage
    });

    return NextResponse.json({
      ok: true,
      attemptId: insertedAttempt.id,
      communityStats
    });
  } catch (error) {
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
