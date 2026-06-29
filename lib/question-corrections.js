import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const QUESTION_CORRECTION_SOURCE_TYPES = new Set([
  "question_bank_item",
  "generated_test_question"
]);

const CORRECTION_LOOKUP_BATCH_SIZE = 100;

export function buildQuestionCorrectionMeta({ sourceType, sourceQuestionId, sourceDocumentId }) {
  if (!QUESTION_CORRECTION_SOURCE_TYPES.has(sourceType) || !sourceQuestionId) {
    return null;
  }

  return {
    sourceType,
    sourceQuestionId,
    sourceDocumentId: sourceDocumentId || null,
    sourceDocumentHref: sourceDocumentId ? `/api/source-documents/${sourceDocumentId}/open` : null
  };
}

function normalizeAnswers(value) {
  return Array.isArray(value)
    ? value.map((answer) => (typeof answer === "string" ? answer : String(answer ?? "")))
    : [];
}

export function applyCorrectionToQuestion(question, correction) {
  if (!question || !correction) {
    return question;
  }

  return {
    ...question,
    text: correction.question_text ?? question.text,
    question_text: correction.question_text ?? question.question_text,
    answers: normalizeAnswers(correction.answers),
    correctIndex: Number.isInteger(correction.correct_index)
      ? correction.correct_index
      : question.correctIndex,
    correct_index: Number.isInteger(correction.correct_index)
      ? correction.correct_index
      : question.correct_index,
    explanation: correction.explanation ?? question.explanation ?? "",
    correction: {
      ...(question.correction || {}),
      hasPersonalCorrection: true,
      correctionId: correction.id || null
    }
  };
}

export async function applyUserQuestionCorrections({ userId, questions }) {
  if (!userId || !Array.isArray(questions) || !questions.length) {
    return questions;
  }

  const correctionTargets = questions
    .map((question) => question?.correction)
    .filter((meta) => meta?.sourceType && meta?.sourceQuestionId);

  if (!correctionTargets.length) {
    return questions;
  }

  const admin = createAdminClient();
  const targetsByType = new Map();
  for (const meta of correctionTargets) {
    const ids = targetsByType.get(meta.sourceType) || new Set();
    ids.add(meta.sourceQuestionId);
    targetsByType.set(meta.sourceType, ids);
  }

  const corrections = [];
  for (const [sourceType, ids] of targetsByType.entries()) {
    const sourceQuestionIds = Array.from(ids);

    for (let index = 0; index < sourceQuestionIds.length; index += CORRECTION_LOOKUP_BATCH_SIZE) {
      const batch = sourceQuestionIds.slice(index, index + CORRECTION_LOOKUP_BATCH_SIZE);
      const { data, error } = await admin
        .from("user_question_corrections")
        .select("id, source_type, source_question_id, question_text, answers, correct_index, explanation")
        .eq("user_id", userId)
        .eq("source_type", sourceType)
        .in("source_question_id", batch);

      if (error) {
        if (error.code === "42P01" || String(error.message || "").includes("user_question_corrections")) {
          return questions;
        }

        throw error;
      }

      corrections.push(...(data || []));
    }
  }

  const correctionsByKey = new Map(
    corrections.map((correction) => [
      `${correction.source_type}:${correction.source_question_id}`,
      correction
    ])
  );

  return questions.map((question) => {
    const meta = question?.correction;
    const correction = correctionsByKey.get(`${meta?.sourceType}:${meta?.sourceQuestionId}`);
    return correction ? applyCorrectionToQuestion(question, correction) : question;
  });
}
