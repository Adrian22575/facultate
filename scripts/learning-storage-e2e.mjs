import assert from "node:assert/strict";
import fs from "node:fs";

import {
  DOCX_MIME,
  PPTX_MIME,
  createDocxBuffer,
  createPdfBuffer,
  createPptxBuffer,
  sampleLearningText
} from "./learning-fixtures.mjs";

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
  getLearningStudySetForUser
} = await import("@/lib/learning/study-sets.js");
const {
  createLearningStudySetJob,
  processLearningStudySetJob
} = await import("@/lib/learning/study-set-pipeline.js");
const {
  uploadSourceDocument,
  deleteSourceDocumentObject
} = await import("@/lib/ai/storage.js");
const { createAdminClient } = await import("@/lib/supabase/admin.js");

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
  const email = `learning-storage-e2e-${suffix}@example.test`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password: `Learning-storage-e2e-${suffix}!`,
    email_confirm: true,
    user_metadata: {
      full_name: "Learning Storage E2E"
    }
  });

  if (error) throw error;
  if (!data?.user?.id) throw new Error("auth_test_user_missing");
  return { id: data.user.id, email };
}

async function grantUploads(admin, userId, count) {
  const { error } = await admin.from("ai_credit_ledger").insert({
    user_id: userId,
    source: "manual",
    reason: "manual_adjustment",
    delta: count,
    metadata: {
      source: "learning_storage_e2e",
      note: "temporary credits for automated storage verification"
    }
  });
  if (error) throw error;
}

async function createSourceDocument(admin, { userId, fixture, storageBucket, storagePath }) {
  const { data, error } = await admin
    .from("ai_source_documents")
    .insert({
      user_id: userId,
      source_kind: fixture.sourceKind,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      original_filename: fixture.originalFilename,
      mime_type: fixture.mimeType,
      size_bytes: fixture.buffer.length,
      extracted_text: null,
      extraction_status: "pending",
      extraction_error: null
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

async function buildFixtures() {
  const text = sampleLearningText();
  return [
    {
      label: "TXT",
      sourceKind: "txt",
      originalFilename: "learning-storage-e2e.txt",
      mimeType: "text/plain",
      buffer: Buffer.from(text, "utf8")
    },
    {
      label: "DOCX",
      sourceKind: "docx",
      originalFilename: "learning-storage-e2e.docx",
      mimeType: DOCX_MIME,
      buffer: await createDocxBuffer(text)
    },
    {
      label: "PDF",
      sourceKind: "pdf",
      originalFilename: "learning-storage-e2e.pdf",
      mimeType: "application/pdf",
      buffer: createPdfBuffer(text)
    },
    {
      label: "PPTX",
      sourceKind: "pptx",
      originalFilename: "learning-storage-e2e.pptx",
      mimeType: PPTX_MIME,
      buffer: await createPptxBuffer(text)
    }
  ];
}

async function processFixture({ admin, userId, academicContext, fixture, storageObjects }) {
  const storageInfo = await uploadSourceDocument({
    userId,
    originalFilename: fixture.originalFilename,
    mimeType: fixture.mimeType,
    buffer: fixture.buffer
  });
  storageObjects.push(storageInfo);

  const sourceDocumentId = await createSourceDocument(admin, {
    userId,
    fixture,
    storageBucket: storageInfo.storageBucket,
    storagePath: storageInfo.storagePath
  });

  const studySetId = await createPendingLearningStudySet({
    userId,
    academicContext,
    title: `Learning Storage E2E ${fixture.label}`,
    sourceDocumentId,
    sourceKind: fixture.sourceKind,
    originalFilename: fixture.originalFilename,
    extractionMetadata: {
      sourceDocumentId,
      liveStorageE2E: true,
      fixture: fixture.label
    },
    idempotencyKey: `learning-storage-e2e-${fixture.label.toLowerCase()}-${Date.now()}`,
    examDate: "2026-07-01",
    minutesPerDay: 30,
    objective: `verificare live storage ${fixture.label}`
  });

  const jobId = await createLearningStudySetJob({
    userId,
    sourceDocumentId,
    studySetId,
    title: `Learning Storage E2E ${fixture.label}`,
    sourceKind: fixture.sourceKind,
    originalFilename: fixture.originalFilename,
    metadata: {
      liveStorageE2E: true,
      fixture: fixture.label
    }
  });
  await attachLearningStudySetJob({ userId, studySetId, jobId });

  const snapshot = await processLearningStudySetJob({
    jobId,
    userId,
    academicContext
  });
  assert.equal(snapshot.status, "succeeded", `${fixture.label}: job succeeded`);

  const studySet = await getLearningStudySetForUser({
    studySetId,
    userId,
    academicContext
  });
  assert.ok(studySet, `${fixture.label}: study set readable`);
  assert.ok(["ready", "ready_with_warnings"].includes(studySet.status), `${fixture.label}: study set ready`);
  assert.ok(studySet.chapters.length >= 1, `${fixture.label}: chapters saved`);
  assert.ok(studySet.flashcards.length >= 1, `${fixture.label}: flashcards saved`);
  assert.ok(studySet.questions.length >= 1, `${fixture.label}: questions saved`);

  const { data: sourceDocument, error: sourceError } = await admin
    .from("ai_source_documents")
    .select("extraction_status, extracted_text, source_kind")
    .eq("id", sourceDocumentId)
    .eq("user_id", userId)
    .single();
  if (sourceError) throw sourceError;
  assert.equal(sourceDocument.extraction_status, "succeeded", `${fixture.label}: extraction saved`);
  assert.ok(String(sourceDocument.extracted_text || "").length >= 600, `${fixture.label}: extracted text persisted`);

  return {
    label: fixture.label,
    status: studySet.status,
    sourceKind: sourceDocument.source_kind,
    chapters: await countRows(admin, "learning_chapters", "study_set_id", studySetId),
    flashcards: await countRows(admin, "learning_flashcards", "study_set_id", studySetId),
    questions: await countRows(admin, "learning_questions", "study_set_id", studySetId)
  };
}

async function main() {
  const admin = createAdminClient();
  const storageObjects = [];
  let userId = null;

  try {
    const fixtures = await buildFixtures();
    const user = await createTestUser(admin);
    userId = user.id;
    await grantUploads(admin, user.id, fixtures.length);

    const academicContext = buildAcademicContext();
    const results = [];
    for (const fixture of fixtures) {
      results.push(await processFixture({
        admin,
        userId: user.id,
        academicContext,
        fixture,
        storageObjects
      }));
    }

    console.log("learning:storage:e2e ok");
    console.log(JSON.stringify({ results }, null, 2));
  } finally {
    for (const object of storageObjects.reverse()) {
      try {
        await deleteSourceDocumentObject({
          storageBucket: object.storageBucket,
          storagePath: object.storagePath
        });
      } catch (error) {
        console.error(`storage_cleanup_failed: ${error?.message || error}`);
        process.exitCode = 1;
      }
    }

    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) {
        console.error(`auth_cleanup_failed: ${error.message}`);
        process.exitCode = 1;
      }
    }
  }
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error?.stack || error?.message || error);
});
