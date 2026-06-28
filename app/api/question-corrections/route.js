import { NextResponse } from "next/server";
import { z } from "zod";

import { getAccessibleQuestionSource } from "@/lib/question-access";
import { QUESTION_CORRECTION_SOURCE_TYPES } from "@/lib/question-corrections";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const CorrectionPayloadSchema = z.object({
  sourceType: z.string(),
  sourceQuestionId: z.string().uuid(),
  questionText: z.string().trim().min(3).max(12000),
  answers: z.array(z.string().trim().min(1).max(6000)).min(2).max(12),
  correctIndex: z.number().int().min(0),
  explanation: z.string().trim().max(12000).optional().default(""),
  note: z.string().trim().max(2000).optional().default("")
}).superRefine((value, ctx) => {
  if (!QUESTION_CORRECTION_SOURCE_TYPES.has(value.sourceType)) {
    ctx.addIssue({
      code: "custom",
      path: ["sourceType"],
      message: "Sursa intrebarii nu este valida."
    });
  }

  if (value.correctIndex >= value.answers.length) {
    ctx.addIssue({
      code: "custom",
      path: ["correctIndex"],
      message: "Raspunsul corect trebuie sa fie una dintre variante."
    });
  }
});

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user || null;
}

export async function POST(request) {
  const user = await requireUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = CorrectionPayloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "invalid_payload",
        message: parsed.error.issues[0]?.message || "Corectia nu este valida."
      },
      { status: 400 }
    );
  }

  let source = null;
  try {
    source = await getAccessibleQuestionSource({
      userId: user.id,
      sourceType: parsed.data.sourceType,
      sourceQuestionId: parsed.data.sourceQuestionId
    });
  } catch {
    return NextResponse.json({ error: "source_lookup_failed" }, { status: 500 });
  }

  if (!source) {
    return NextResponse.json({ error: "question_not_found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const row = {
    user_id: user.id,
    source_type: parsed.data.sourceType,
    source_question_id: parsed.data.sourceQuestionId,
    source_document_id: source.sourceDocumentId,
    question_text: parsed.data.questionText,
    answers: parsed.data.answers,
    correct_index: parsed.data.correctIndex,
    explanation: parsed.data.explanation,
    note: parsed.data.note
  };

  const { data, error } = await admin
    .from("user_question_corrections")
    .upsert(row, {
      onConflict: "user_id,source_type,source_question_id"
    })
    .select("id, source_type, source_question_id, question_text, answers, correct_index, explanation, source_document_id")
    .single();

  if (error) {
    return NextResponse.json(
      {
        error: "correction_save_failed",
        message: "Nu am putut salva corectia acum."
      },
      { status: 500 }
    );
  }

  return NextResponse.json({
    ok: true,
    correction: {
      id: data.id,
      sourceType: data.source_type,
      sourceQuestionId: data.source_question_id,
      text: data.question_text,
      answers: data.answers,
      correctIndex: data.correct_index,
      explanation: data.explanation || "",
      sourceDocumentId: data.source_document_id || null,
      sourceDocumentHref: data.source_document_id
        ? `/api/source-documents/${data.source_document_id}/open`
        : null,
      hasPersonalCorrection: true
    }
  });
}
