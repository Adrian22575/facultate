import assert from "node:assert/strict";
import fs from "node:fs";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};

  const env = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

Object.assign(process.env, loadEnvFile(".env.local"), process.env);

const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) =>
  nativeFetch(input, {
    ...init,
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)])
      : AbortSignal.timeout(20_000)
  });

const { createAdminClient } = await import("@/lib/supabase/admin.js");

async function syncProgress(admin, params) {
  const { data, error } = await admin.rpc("sync_subject_progress", params);
  if (error) throw error;
  return data;
}

async function main() {
  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let userId = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `progress-attempts-e2e-${suffix}@example.test`,
      password: `Progress-attempts-e2e-${suffix}!`,
      email_confirm: true
    });
    if (createError) throw createError;
    userId = created?.user?.id;
    assert.ok(userId, "temporary auth user created");

    const { data: subject, error: subjectError } = await admin
      .from("subjects")
      .select("id")
      .limit(1)
      .single();
    if (subjectError) throw subjectError;

    const baseProgress = {
      p_user_id: userId,
      p_subject_id: subject.id,
      p_study_total_questions: null,
      p_study_viewed_indexes: [],
      p_interactive_total_questions: null,
      p_interactive_answered: null,
      p_interactive_correct: null,
      p_interactive_wrong: null,
      p_test_score_percent: null
    };

    await Promise.all([
      syncProgress(admin, {
        ...baseProgress,
        p_mode: "studiu",
        p_study_total_questions: 2,
        p_study_viewed_indexes: [0]
      }),
      syncProgress(admin, {
        ...baseProgress,
        p_mode: "studiu",
        p_study_total_questions: 2,
        p_study_viewed_indexes: [1]
      })
    ]);

    await Promise.all([
      syncProgress(admin, {
        ...baseProgress,
        p_mode: "interactiv",
        p_interactive_total_questions: 2,
        p_interactive_answered: 1,
        p_interactive_correct: 0,
        p_interactive_wrong: 1
      }),
      syncProgress(admin, {
        ...baseProgress,
        p_mode: "interactiv",
        p_interactive_total_questions: 2,
        p_interactive_answered: 2,
        p_interactive_correct: 2,
        p_interactive_wrong: 0
      })
    ]);

    await Promise.all([
      syncProgress(admin, { ...baseProgress, p_mode: "test", p_test_score_percent: 40 }),
      syncProgress(admin, { ...baseProgress, p_mode: "test", p_test_score_percent: 80 })
    ]);

    const { data: progress, error: progressError } = await admin
      .from("subject_progress")
      .select(
        "study_viewed_question_ids,study_viewed_count,interactive_answered,interactive_correct,interactive_wrong,test_best_score_percent"
      )
      .eq("user_id", userId)
      .eq("subject_id", subject.id)
      .single();
    if (progressError) throw progressError;
    assert.deepEqual(progress.study_viewed_question_ids, [0, 1], "concurrent study indexes are merged");
    assert.equal(progress.study_viewed_count, 2, "study count matches merged indexes");
    assert.equal(progress.interactive_answered, 2, "most complete interactive snapshot wins");
    assert.equal(progress.interactive_correct, 2, "interactive correct count stays coherent");
    assert.equal(progress.interactive_wrong, 0, "interactive wrong count stays coherent");
    assert.equal(progress.test_best_score_percent, 80, "best concurrent test score is preserved");

    const { data: studySet, error: studySetError } = await admin
      .from("learning_study_sets")
      .insert({
        user_id: userId,
        title: `Progress attempts E2E ${suffix}`,
        status: "ready",
        source_kind: "text",
        question_count: 2,
        metadata: { testRun: "progress-attempts-e2e" }
      })
      .select("id")
      .single();
    if (studySetError) throw studySetError;

    const { data: flashcard, error: flashcardError } = await admin
      .from("learning_flashcards")
      .insert({
        study_set_id: studySet.id,
        position: 1,
        front: "Flashcard temporar",
        back: "Raspuns temporar"
      })
      .select("id")
      .single();
    if (flashcardError) throw flashcardError;

    const nextReviewAt = new Date(Date.now() + 60_000).toISOString();
    const flashcardReviews = await Promise.all([
      admin.rpc("record_learning_flashcard_review", {
        p_user_id: userId,
        p_study_set_id: studySet.id,
        p_flashcard_id: flashcard.id,
        p_rating: "aproape",
        p_next_review_at: nextReviewAt
      }),
      admin.rpc("record_learning_flashcard_review", {
        p_user_id: userId,
        p_study_set_id: studySet.id,
        p_flashcard_id: flashcard.id,
        p_rating: "stiu",
        p_next_review_at: nextReviewAt
      })
    ]);
    for (const review of flashcardReviews) {
      if (review.error) throw review.error;
    }

    const { data: storedReview, error: storedReviewError } = await admin
      .from("learning_flashcard_reviews")
      .select("review_count")
      .eq("user_id", userId)
      .eq("flashcard_id", flashcard.id)
      .single();
    if (storedReviewError) throw storedReviewError;
    assert.equal(storedReview.review_count, 2, "concurrent flashcard reviews are both counted");

    const { data: questions, error: questionsError } = await admin
      .from("learning_questions")
      .insert([
        {
          study_set_id: studySet.id,
          position: 1,
          question_text: "Intrebarea temporara 1",
          answers: ["A", "B", "C", "D"],
          correct_index: 0
        },
        {
          study_set_id: studySet.id,
          position: 2,
          question_text: "Intrebarea temporara 2",
          answers: ["A", "B", "C", "D"],
          correct_index: 1
        }
      ])
      .select("id,correct_index");
    if (questionsError) throw questionsError;
    assert.equal(questions.length, 2, "temporary learning questions created");

    const attemptKey = `learning-test-${suffix}`;
    const attemptParams = {
      p_user_id: userId,
      p_study_set_id: studySet.id,
      p_mode: "quick_test",
      p_score_percent: 50,
      p_correct_count: 1,
      p_question_count: 2,
      p_wrong_count: 1,
      p_metadata: { testRun: "progress-attempts-e2e" },
      p_items: questions.map((question, index) => ({
        questionId: question.id,
        selectedIndex: index === 0 ? question.correct_index : 0,
        isCorrect: index === 0,
        correctIndex: question.correct_index
      })),
      p_idempotency_key: attemptKey
    };

    const attempts = await Promise.all([
      admin.rpc("save_learning_quiz_attempt", attemptParams),
      admin.rpc("save_learning_quiz_attempt", attemptParams)
    ]);
    for (const attempt of attempts) {
      if (attempt.error) throw attempt.error;
    }
    assert.equal(attempts[0].data.attemptId, attempts[1].data.attemptId, "retry returns the same attempt");

    const { count: attemptCount, error: attemptCountError } = await admin
      .from("learning_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("idempotency_key", attemptKey);
    if (attemptCountError) throw attemptCountError;
    assert.equal(attemptCount, 1, "one learning attempt is stored");

    const { count: itemCount, error: itemCountError } = await admin
      .from("learning_attempt_items")
      .select("id", { count: "exact", head: true })
      .eq("attempt_id", attempts[0].data.attemptId);
    if (itemCountError) throw itemCountError;
    assert.equal(itemCount, 2, "all learning attempt items are stored atomically");

    const recordLicentaAttempt = (key, wrongQuestionIds) =>
      admin.rpc("record_licenta_exam_attempt", {
        p_user_id: userId,
        p_membership_id: null,
        p_target_institution_id: null,
        p_target_unit_id: null,
        p_target_cohort_id: null,
        p_user_type: "student",
        p_mode: "quick",
        p_score_percent: 80,
        p_correct_count: 4,
        p_question_count: 5,
        p_wrong_count: 1,
        p_unanswered_count: 0,
        p_question_ids: ["1", "2", "3", "4", "5"],
        p_wrong_question_ids: wrongQuestionIds,
        p_duration_seconds: 30,
        p_metadata: { testRun: "progress-attempts-e2e" },
        p_idempotency_key: key
      });

    const licentaKey = `licenta-test-${suffix}`;
    const concurrentLicenta = await Promise.all([
      recordLicentaAttempt(licentaKey, ["5"]),
      recordLicentaAttempt(licentaKey, ["5"])
    ]);
    for (const attempt of concurrentLicenta) {
      if (attempt.error) throw attempt.error;
    }
    assert.equal(
      concurrentLicenta[0].data.attemptId,
      concurrentLicenta[1].data.attemptId,
      "concurrent licenta retry returns the same attempt"
    );

    const { count: licentaAttemptCount, error: licentaAttemptCountError } = await admin
      .from("licenta_exam_attempts")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("idempotency_key", licentaKey);
    if (licentaAttemptCountError) throw licentaAttemptCountError;
    assert.equal(licentaAttemptCount, 1, "one licenta attempt is stored");

    const { data: firstMistakes, error: firstMistakesError } = await admin
      .from("licenta_exam_mistakes")
      .select("question_id")
      .eq("user_id", userId);
    if (firstMistakesError) throw firstMistakesError;
    assert.deepEqual(
      firstMistakes.map((row) => row.question_id),
      ["5"],
      "wrong licenta question is stored in the account"
    );

    const recoveryAttempt = await recordLicentaAttempt(`licenta-recovery-${suffix}`, ["4"]);
    if (recoveryAttempt.error) throw recoveryAttempt.error;

    const { data: recoveredMistakes, error: recoveredMistakesError } = await admin
      .from("licenta_exam_mistakes")
      .select("question_id")
      .eq("user_id", userId)
      .order("question_id");
    if (recoveredMistakesError) throw recoveredMistakesError;
    assert.deepEqual(
      recoveredMistakes.map((row) => row.question_id),
      ["4"],
      "correct answers remove old mistakes while new mistakes persist"
    );

    console.log("progress:attempts:e2e ok");
  } finally {
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error("progress_attempts_e2e_cleanup_failed", error.message);
    }
  }
}

main().catch((error) => {
  console.error("progress:attempts:e2e failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
