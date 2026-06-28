import "server-only";

import { getAcademicContext } from "@/lib/academic/server";
import { createAdminClient } from "@/lib/supabase/admin";

export function canAccessPublishedBank(userId, membership, bank) {
  if (!bank) {
    return false;
  }

  if (bank.user_id === userId) {
    return true;
  }

  if (bank.status !== "published" || !membership) {
    return false;
  }

  if (bank.visibility_scope === "cohort") {
    return membership.cohort_id && membership.cohort_id === bank.target_cohort_id;
  }

  if (bank.visibility_scope === "program") {
    return membership.program_unit_id && membership.program_unit_id === bank.target_unit_id;
  }

  if (bank.visibility_scope === "institution") {
    return membership.institution_id && membership.institution_id === bank.target_institution_id;
  }

  return false;
}

export function canAccessGeneratedTest(userId, context, test) {
  if (!test) {
    return false;
  }

  if (test.user_id === userId) {
    return true;
  }

  if (test.status !== "active" || !context?.membership) {
    return false;
  }

  if (test.visibility_scope === "cohort") {
    return context.membership.cohort_id === test.target_cohort_id;
  }

  if (test.visibility_scope === "program") {
    return context.membership.program_unit_id === test.target_unit_id;
  }

  if (test.visibility_scope === "institution") {
    return context.membership.institution_id === test.target_institution_id;
  }

  return false;
}

export async function getAccessibleQuestionSource({ userId, sourceType, sourceQuestionId }) {
  if (!userId || !sourceQuestionId) {
    return null;
  }

  const admin = createAdminClient();
  const context = await getAcademicContext(userId);

  if (sourceType === "question_bank_item") {
    const { data: item, error: itemError } = await admin
      .from("ai_question_bank_items")
      .select("id, bank_id")
      .eq("id", sourceQuestionId)
      .maybeSingle();

    if (itemError) {
      throw itemError;
    }

    if (!item) {
      return null;
    }

    const { data: bank, error: bankError } = await admin
      .from("ai_question_banks")
      .select(
        "id, user_id, status, visibility_scope, target_cohort_id, target_unit_id, target_institution_id, source_document_id"
      )
      .eq("id", item.bank_id)
      .maybeSingle();

    if (bankError) {
      throw bankError;
    }

    if (!canAccessPublishedBank(userId, context?.membership, bank)) {
      return null;
    }

    return {
      sourceDocumentId: bank.source_document_id || null
    };
  }

  if (sourceType === "generated_test_question") {
    const { data: question, error: questionError } = await admin
      .from("user_generated_test_questions")
      .select("id, test_id")
      .eq("id", sourceQuestionId)
      .maybeSingle();

    if (questionError) {
      throw questionError;
    }

    if (!question) {
      return null;
    }

    const { data: test, error: testError } = await admin
      .from("user_generated_tests")
      .select(
        "id, user_id, status, visibility_scope, target_cohort_id, target_unit_id, target_institution_id, source_document_id"
      )
      .eq("id", question.test_id)
      .maybeSingle();

    if (testError) {
      throw testError;
    }

    if (!canAccessGeneratedTest(userId, context, test)) {
      return null;
    }

    return {
      sourceDocumentId: test.source_document_id || null
    };
  }

  return null;
}

export async function canAccessSourceDocument({ userId, documentId }) {
  if (!userId || !documentId) {
    return false;
  }

  const admin = createAdminClient();
  const context = await getAcademicContext(userId);

  const { data: document, error: documentError } = await admin
    .from("ai_source_documents")
    .select("id, user_id")
    .eq("id", documentId)
    .maybeSingle();

  if (documentError) {
    throw documentError;
  }

  if (!document) {
    return false;
  }

  if (document.user_id === userId) {
    return true;
  }

  const { data: bankRows, error: bankError } = await admin
    .from("ai_question_banks")
    .select("id, user_id, status, visibility_scope, target_cohort_id, target_unit_id, target_institution_id")
    .eq("source_document_id", documentId)
    .limit(25);

  if (bankError) {
    throw bankError;
  }

  if ((bankRows || []).some((bank) => canAccessPublishedBank(userId, context?.membership, bank))) {
    return true;
  }

  const { data: testRows, error: testError } = await admin
    .from("user_generated_tests")
    .select("id, user_id, status, visibility_scope, target_cohort_id, target_unit_id, target_institution_id")
    .eq("source_document_id", documentId)
    .limit(25);

  if (testError) {
    throw testError;
  }

  return (testRows || []).some((test) => canAccessGeneratedTest(userId, context, test));
}
