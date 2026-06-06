import { NextResponse } from "next/server";
import { z } from "zod";

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
    testScorePercent: z.number().int().min(0).max(100).optional()
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
    }

    if (value.mode === "test" && typeof value.testScorePercent !== "number") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["testScorePercent"],
        message: "Lipseste scorul testului."
      });
    }
  });

function uniqueSortedIndexes(values) {
  return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value >= 0))).sort(
    (left, right) => left - right
  );
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
    const { data: existing, error: existingError } = await admin
      .from("subject_progress")
      .select(
        "study_total_questions, study_viewed_question_ids, study_viewed_count, interactive_total_questions, interactive_answered, interactive_correct, interactive_wrong, test_best_score_percent, test_last_score_percent"
      )
      .eq("user_id", user.id)
      .eq("subject_id", payload.subjectId)
      .maybeSingle();

    if (existingError && existingError.code !== "PGRST116") {
      throw existingError;
    }

    const nextRow = {
      user_id: user.id,
      subject_id: payload.subjectId,
      study_total_questions: existing?.study_total_questions || 0,
      study_viewed_question_ids: existing?.study_viewed_question_ids || [],
      study_viewed_count: existing?.study_viewed_count || 0,
      interactive_total_questions: existing?.interactive_total_questions || 0,
      interactive_answered: existing?.interactive_answered || 0,
      interactive_correct: existing?.interactive_correct || 0,
      interactive_wrong: existing?.interactive_wrong || 0,
      test_best_score_percent: existing?.test_best_score_percent || 0,
      test_last_score_percent: existing?.test_last_score_percent || 0,
      last_mode: payload.mode,
      last_activity_at: new Date().toISOString()
    };

    if (payload.mode === "studiu") {
      const previousIndexes = Array.isArray(existing?.study_viewed_question_ids)
        ? existing.study_viewed_question_ids
        : [];
      const mergedIndexes = uniqueSortedIndexes([
        ...previousIndexes,
        ...(payload.studyViewedIndexes || [])
      ]);

      nextRow.study_total_questions = Math.max(
        nextRow.study_total_questions,
        payload.studyTotalQuestions || 0
      );
      nextRow.study_viewed_question_ids = mergedIndexes;
      nextRow.study_viewed_count = mergedIndexes.length;
    }

    if (payload.mode === "interactiv") {
      nextRow.interactive_total_questions = Math.max(
        nextRow.interactive_total_questions,
        payload.interactiveTotalQuestions || 0
      );
      nextRow.interactive_answered = Math.max(
        nextRow.interactive_answered,
        payload.interactiveAnswered || 0
      );
      nextRow.interactive_correct = Math.max(
        nextRow.interactive_correct,
        payload.interactiveCorrect || 0
      );
      nextRow.interactive_wrong = Math.max(nextRow.interactive_wrong, payload.interactiveWrong || 0);
    }

    if (payload.mode === "test") {
      nextRow.test_last_score_percent = payload.testScorePercent || 0;
      nextRow.test_best_score_percent = Math.max(
        nextRow.test_best_score_percent,
        payload.testScorePercent || 0
      );
    }

    const { error: upsertError } = await admin.from("subject_progress").upsert(nextRow, {
      onConflict: "user_id,subject_id"
    });

    if (upsertError) {
      throw upsertError;
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      return NextResponse.json(
        {
          error: "Progresul real nu este activ inca. Ruleaza migrarea `0009_subject_progress.sql`."
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
