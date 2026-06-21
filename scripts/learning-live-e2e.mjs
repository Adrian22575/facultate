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
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

Object.assign(process.env, loadEnvFile(".env.local"), process.env);

const {
  createPendingLearningStudySet,
  attachLearningStudySetJob,
  getLearningStudySetForUser,
  saveLearningFlashcardRating,
  saveLearningQuizAttempt
} = await import("@/lib/learning/study-sets.js");
const {
  createLearningStudySetJob,
  processLearningStudySetJob
} = await import("@/lib/learning/study-set-pipeline.js");
const { createAdminClient } = await import("@/lib/supabase/admin.js");

function sampleLearningText() {
  return `
Capitolul 1 Introducere in management strategic
Managementul strategic stabileste directia pe termen lung a unei organizatii. Procesul include
analiza mediului intern si extern, formularea obiectivelor, alegerea strategiilor si alocarea
resurselor. Avantajul competitiv apare cand o organizatie este preferata datorita costului,
calitatii, vitezei de livrare, inovatiei sau diferentierii produselor.

Capitolul 2 Analiza mediului
Analiza externa identifica oportunitati si amenintari din piata, legislatie, tehnologie si
comportamentul clientilor. Analiza interna verifica resursele, competentele, cultura si procesele.
Un instrument simplu este SWOT, care separa punctele tari, punctele slabe, oportunitatile si
amenintarile pentru a ghida deciziile manageriale.

Capitolul 3 Implementarea strategiei
Implementarea transforma strategia in actiuni concrete. Sunt necesare responsabilitati clare,
termene, bugete, indicatori si comunicare. Controlul strategic compara rezultatele cu obiectivele.
Daca apar abateri, managerii pot ajusta resursele, prioritatile sau ritmul activitatilor.
`.repeat(6);
}

function buildAcademicContext() {
  return {
    membership: {
      institution_id: null,
      program_unit_id: null,
      cohort_id: null
    }
  };
}

async function createTestUser(admin) {
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `learning-e2e-${suffix}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Learning-e2e-${suffix}!`,
    email_confirm: true,
    user_metadata: {
      full_name: "Learning E2E"
    }
  });

  if (error) throw error;
  if (!data?.user?.id) throw new Error("auth_test_user_missing");
  return { id: data.user.id, email };
}

async function grantOneUpload(admin, userId) {
  const { error } = await admin.from("ai_credit_ledger").insert({
    user_id: userId,
    source: "manual",
    reason: "manual_adjustment",
    delta: 1,
    metadata: {
      source: "learning_live_e2e",
      note: "temporary credit for automated verification"
    }
  });
  if (error) throw error;
}

async function createManualSourceDocument(admin, { userId, text }) {
  const { data, error } = await admin
    .from("ai_source_documents")
    .insert({
      user_id: userId,
      source_kind: "manual",
      original_filename: "Learning E2E raw text",
      mime_type: "text/plain",
      size_bytes: Buffer.byteLength(text, "utf8"),
      extracted_text: text,
      extraction_status: "succeeded"
    })
    .select("id")
    .single();

  if (error) throw error;
  return data.id;
}

async function countRows(admin, table, column, value) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw error;
  return count || 0;
}

async function main() {
  const admin = createAdminClient();
  const created = {
    userId: null,
    studySetId: null
  };

  try {
    const user = await createTestUser(admin);
    created.userId = user.id;
    await grantOneUpload(admin, user.id);

    const text = sampleLearningText();
    const sourceDocumentId = await createManualSourceDocument(admin, {
      userId: user.id,
      text
    });

    const academicContext = buildAcademicContext();
    const studySetId = await createPendingLearningStudySet({
      userId: user.id,
      academicContext,
      title: "Learning E2E Management strategic",
      sourceDocumentId,
      sourceKind: "text",
      originalFilename: "learning-e2e.txt",
      extractionMetadata: {
        sourceDocumentId,
        liveE2E: true
      },
      idempotencyKey: `learning-e2e-${Date.now()}`,
      examDate: "2026-07-01",
      minutesPerDay: 30,
      objective: "verificare live e2e"
    });
    created.studySetId = studySetId;

    const jobId = await createLearningStudySetJob({
      userId: user.id,
      sourceDocumentId,
      studySetId,
      title: "Learning E2E Management strategic",
      sourceKind: "text",
      originalFilename: "learning-e2e.txt",
      metadata: {
        liveE2E: true
      }
    });
    await attachLearningStudySetJob({ userId: user.id, studySetId, jobId });

    const snapshot = await processLearningStudySetJob({
      jobId,
      userId: user.id,
      academicContext
    });
    assert.equal(snapshot.status, "succeeded", "job succeeded");
    assert.equal(snapshot.stage, "ready", "job ready stage");

    const studySet = await getLearningStudySetForUser({
      studySetId,
      userId: user.id,
      academicContext
    });
    assert.ok(studySet, "study set readable");
    assert.ok(["ready", "ready_with_warnings"].includes(studySet.status), "study set ready");
    assert.ok(studySet.chapters.length >= 2, "chapters saved");
    assert.ok(studySet.flashcards.length >= 2, "flashcards saved");
    assert.ok(studySet.questions.length >= 2, "questions saved");
    assert.ok(studySet.plan.length >= 1, "plan saved");

    const firstFlashcard = studySet.flashcards[0];
    const review = await saveLearningFlashcardRating({
      userId: user.id,
      studySetId,
      flashcardId: firstFlashcard.id,
      rating: "stiu",
      academicContext
    });
    assert.equal(review.rating, "stiu", "flashcard review saved");

    const answers = studySet.questions.slice(0, 3).map((question, index) => ({
      questionId: question.id,
      selectedIndex: index === 0 ? (Number(question.correctIndex || 0) === 0 ? 1 : 0) : question.correctIndex
    }));
    const quiz = await saveLearningQuizAttempt({
      userId: user.id,
      studySetId,
      chapterId: "all",
      answers,
      academicContext
    });
    assert.ok(quiz.attemptId, "quiz attempt saved");
    assert.ok(quiz.wrong.length >= 1, "mistake saved");

    const [chapters, flashcards, questions, attempts, reviews, ledgerRows] = await Promise.all([
      countRows(admin, "learning_chapters", "study_set_id", studySetId),
      countRows(admin, "learning_flashcards", "study_set_id", studySetId),
      countRows(admin, "learning_questions", "study_set_id", studySetId),
      countRows(admin, "learning_attempts", "study_set_id", studySetId),
      countRows(admin, "learning_flashcard_reviews", "study_set_id", studySetId),
      countRows(admin, "ai_credit_ledger", "user_id", user.id)
    ]);

    console.log("learning:live:e2e ok");
    console.log(
      JSON.stringify(
        {
          studySetStatus: studySet.status,
          jobStatus: snapshot.status,
          chapters,
          flashcards,
          questions,
          attempts,
          reviews,
          ledgerRows,
          wrongQuestions: quiz.wrong.length
        },
        null,
        2
      )
    );
  } finally {
    if (created.userId) {
      const { error } = await admin.auth.admin.deleteUser(created.userId);
      if (error) {
        console.error(`cleanup_failed: ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error?.stack || error?.message || error);
});
