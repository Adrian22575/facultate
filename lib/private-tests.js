import "server-only";

import { getAcademicContext } from "@/lib/academic/server";
import { canAccessGeneratedTest } from "@/lib/question-access";
import { applyUserQuestionCorrections, buildQuestionCorrectionMeta } from "@/lib/question-corrections";
import { createAdminClient } from "@/lib/supabase/admin";

async function getSharedActiveTests(context, userId) {
  const supabase = createAdminClient();
  const collected = new Map();

  async function collect(query) {
    const { data, error } = await query;
    if (error) throw error;

    (data || []).forEach((test) => {
      if (test.user_id !== userId) {
        collected.set(test.id, {
          ...test,
          isCommunityShared: true
        });
      }
    });
  }

  if (context?.membership?.cohort_id) {
    await collect(
      supabase
        .from("user_generated_tests")
        .select(
          "id, user_id, title, status, total_questions, created_at, published_at, visibility_scope"
        )
        .eq("status", "active")
        .eq("visibility_scope", "cohort")
        .eq("target_cohort_id", context.membership.cohort_id)
        .order("published_at", { ascending: false })
    );
  }

  if (context?.membership?.program_unit_id) {
    await collect(
      supabase
        .from("user_generated_tests")
        .select(
          "id, user_id, title, status, total_questions, created_at, published_at, visibility_scope"
        )
        .eq("status", "active")
        .eq("visibility_scope", "program")
        .eq("target_unit_id", context.membership.program_unit_id)
        .order("published_at", { ascending: false })
    );
  }

  if (context?.membership?.institution_id) {
    await collect(
      supabase
        .from("user_generated_tests")
        .select(
          "id, user_id, title, status, total_questions, created_at, published_at, visibility_scope"
        )
        .eq("status", "active")
        .eq("visibility_scope", "institution")
        .eq("target_institution_id", context.membership.institution_id)
        .order("published_at", { ascending: false })
    );
  }

  return Array.from(collected.values()).sort((left, right) => {
    return new Date(right.published_at || right.created_at) - new Date(left.published_at || left.created_at);
  });
}

export async function getPrivateGeneratedTests(userId) {
  const supabase = createAdminClient();
  const context = await getAcademicContext(userId);
  const { data, error } = await supabase
    .from("user_generated_tests")
    .select(
      "id, user_id, title, status, total_questions, created_at, published_at, visibility_scope, target_cohort_id, target_unit_id, target_institution_id"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  if (error) throw error;

  const own = data || [];
  const communityActive = await getSharedActiveTests(context, userId);

  return {
    drafts: own.filter((test) => test.status === "draft"),
    active: own.filter((test) => test.status === "active"),
    communityActive,
    archived: own.filter((test) => test.status === "archived")
  };
}

export async function getPrivateGeneratedTestById(userId, testId) {
  const supabase = createAdminClient();
  const context = await getAcademicContext(userId);
  const { data: test, error: testError } = await supabase
    .from("user_generated_tests")
    .select(
      "id, user_id, source_document_id, title, status, total_questions, created_at, published_at, visibility_scope, target_cohort_id, target_unit_id, target_institution_id"
    )
    .eq("id", testId)
    .maybeSingle();

  if (testError) throw testError;
  if (!test || !canAccessGeneratedTest(userId, context, test)) {
    return null;
  }

  const { data: questions, error: questionsError } = await supabase
    .from("user_generated_test_questions")
    .select("id, position, question_text, answers, correct_index, explanation")
    .eq("test_id", test.id)
    .order("position", { ascending: true });

  if (questionsError) throw questionsError;
  const mappedQuestions = (questions || []).map((question) => ({
    ...question,
    correction: buildQuestionCorrectionMeta({
      sourceType: "generated_test_question",
      sourceQuestionId: question.id,
      sourceDocumentId: test.source_document_id || null
    })
  }));

  return {
    test: {
      ...test,
      isCommunityShared: test.user_id !== userId
    },
    questions: await applyUserQuestionCorrections({
      userId,
      questions: mappedQuestions
    })
  };
}
