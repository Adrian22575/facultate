import { NextResponse } from "next/server";

import {
  getAcademicContext,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { validateUpload } from "@/lib/ai/extract-text";
import { cleanupUnusedSourceDocumentsForUser } from "@/lib/ai/source-document-cleanup";
import { getBillingSnapshot } from "@/lib/billing";
import { DEMO_USER_ID } from "@/lib/demo-user";
import {
  attachLearningStudySetJob,
  createPendingLearningStudySet
} from "@/lib/learning/study-sets";
import { createLearningStudySetJob } from "@/lib/learning/study-set-pipeline";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getLearningSetupErrorMessage } from "@/lib/supabase/setup-status";

export const runtime = "nodejs";
export const maxDuration = 60;

function jsonError(message, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

function parseMinutes(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 30;
  return Math.max(10, Math.min(240, Math.round(parsed)));
}

function trimErrorMessage(error) {
  if (!(error instanceof Error)) return "unknown_learning_upload_error";
  return error.message.slice(0, 2000);
}

function normalizeIdempotencyKey(value) {
  const key = String(value || "").trim();
  if (!key || key.length < 12 || key.length > 120) return null;
  return /^[a-z0-9_.:-]+$/i.test(key) ? key : null;
}

function toUserSafeLearningError(error) {
  if (!(error instanceof Error)) {
    return "Materialul nu a putut fi procesat.";
  }

  const setupMessage = getLearningSetupErrorMessage(error);
  if (setupMessage) return setupMessage;

  if ("studySetId" in error && error.studySetId) {
    return "Procesarea s-a oprit inainte sa termine toate capitolele. Materialul partial a fost salvat pentru verificare.";
  }

  const normalized = error.message.toLowerCase();
  const safeContentErrors = [
    "fisierul selectat pare gol",
    "fisierul depaseste limita",
    "sunt acceptate doar fisiere",
    "incarca un fisier acceptat",
    "documentul urcat nu a fost gasit",
    "uploadul fisierului nu a fost finalizat",
    "documentul sursa nu are text",
    "textul extras este prea scurt",
    "textul lipit depaseste limita",
    "fisierul docx nu contine text",
    "fisierul pptx nu contine",
    "fisierul txt este gol",
    "pdf-ul pare scanat",
    "nu ai suficiente incarcari disponibile pentru o alta procesare activa"
  ];

  if (error.code === "RATE_LIMITED" || safeContentErrors.some((part) => normalized.includes(part))) {
    return error.message;
  }

  if (
    normalized.includes("bucket not found") ||
    normalized.includes("private-source-documents") ||
    normalized.includes("storage bucket")
  ) {
    return "Spatiul privat pentru fisiere nu este configurat complet.";
  }

  return "Materialul nu a putut fi pregatit acum. Incearca din nou, iar daca problema continua trimite-ne feedback din pagina curenta.";
}

async function findExistingStudySetByIdempotencyKey({ admin, userId, idempotencyKey }) {
  if (!idempotencyKey) return null;

  const { data, error } = await admin
    .from("learning_study_sets")
    .select("id, status, job_id, source_document_id, title, source_kind, created_at")
    .eq("user_id", userId)
    .eq("metadata->>idempotencyKey", idempotencyKey)
    .neq("status", "archived")
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function findExistingJobForStudySet({ admin, userId, studySetId }) {
  const { data, error } = await admin
    .from("ai_generation_jobs")
    .select("id")
    .eq("user_id", userId)
    .eq("result_learning_study_set_id", studySetId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data || null;
}

async function recordLearningUsageEvent(admin, { userId, eventName, routePath, metadata = {} }) {
  try {
    await admin.from("user_usage_events").insert({
      user_id: userId,
      event_name: eventName,
      feature: "Invatare",
      route_path: routePath,
      device_type: "unknown",
      metadata
    });
  } catch {
    // Usage analytics must not block learning material processing.
  }
}

async function getUploadedSourceDocument({ admin, sourceDocumentId, userId, allowManual = false }) {
  const { data, error } = await admin
    .from("ai_source_documents")
    .select("id, user_id, source_kind, storage_bucket, storage_path, original_filename, mime_type, size_bytes, extracted_text")
    .eq("id", sourceDocumentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  if (!data) {
    throw new Error("Documentul urcat nu a fost gasit. Incarca fisierul din nou.");
  }

  if ((!data.storage_bucket || !data.storage_path) && !(allowManual && data.source_kind === "manual")) {
    throw new Error("Uploadul fisierului nu a fost finalizat. Incearca din nou.");
  }

  return data;
}

async function createManualSourceDocument({ admin, userId, title, manualText }) {
  const normalizedText = String(manualText || "").trim();
  const { data, error } = await admin
    .from("ai_source_documents")
    .insert({
      user_id: userId,
      source_kind: "manual",
      storage_bucket: null,
      storage_path: null,
      original_filename: title || "Text lipit",
      mime_type: "text/plain",
      size_bytes: Buffer.byteLength(normalizedText, "utf8"),
      extracted_text: normalizedText,
      extraction_status: "succeeded",
      extraction_error: null
    })
    .select("id, source_kind, original_filename, mime_type, size_bytes, extracted_text")
    .single();

  if (error) throw error;
  return data;
}

export async function POST(request) {
  const startedAt = Date.now();
  const supabaseAuth = await createClient();
  const {
    data: { user }
  } = await supabaseAuth.auth.getUser();

  if (!user) {
    return jsonError("Trebuie sa fii autentificat ca sa procesezi materiale.", 401);
  }

  if (user.id === DEMO_USER_ID) {
    return jsonError("Procesarea reala este dezactivata in modul demo.", 403);
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    return jsonError("Finalizeaza onboarding-ul inainte sa procesezi materiale.", 403);
  }

  let formData = null;
  try {
    formData = await request.formData();
  } catch {
    return jsonError("Datele trimise nu au putut fi citite.");
  }

  const manualText =
    typeof formData.get("manualText") === "string" ? formData.get("manualText") : "";
  const uploadedSourceDocumentId =
    typeof formData.get("uploadedSourceDocumentId") === "string"
      ? formData.get("uploadedSourceDocumentId").trim()
      : "";
  const rawTitle = String(formData.get("title") || "").trim();
  const title = rawTitle || "Materia mea";
  const objective = String(formData.get("objective") || "").trim();
  const examDate = String(formData.get("examDate") || "").trim() || null;
  const minutesPerDay = parseMinutes(formData.get("minutesPerDay"));
  const idempotencyKey = normalizeIdempotencyKey(formData.get("idempotencyKey"));

  if (rawTitle.length > 120) {
    return jsonError("Titlul poate avea cel mult 120 de caractere.");
  }

  if (objective.length > 500) {
    return jsonError("Obiectivul poate avea cel mult 500 de caractere.");
  }

  if (examDate && (!/^\d{4}-\d{2}-\d{2}$/.test(examDate) || Number.isNaN(new Date(examDate).getTime()))) {
    return jsonError("Data examenului nu este valida.");
  }

  if (examDate && new Date(`${examDate}T23:59:59.999Z`).getTime() < Date.now()) {
    return jsonError("Data examenului nu poate fi in trecut.");
  }

  const admin = createAdminClient();
  let existingStudySet = null;
  try {
    existingStudySet = await findExistingStudySetByIdempotencyKey({
      admin,
      userId: user.id,
      idempotencyKey
    });
    if (existingStudySet) {
      if (!existingStudySet.job_id) {
        const existingJob = await findExistingJobForStudySet({
          admin,
          userId: user.id,
          studySetId: existingStudySet.id
        });
        if (existingJob?.id) {
          await attachLearningStudySetJob({
            userId: user.id,
            studySetId: existingStudySet.id,
            jobId: existingJob.id
          });
          existingStudySet.job_id = existingJob.id;
        }
      }

      if (existingStudySet.job_id) {
        return NextResponse.json({
          ok: true,
          reused: true,
          studySetId: existingStudySet.id,
          redirectUrl: `/materiale/invata/${existingStudySet.id}`
        });
      }
    }
  } catch {
    return jsonError("Nu am putut verifica o procesare existenta. Incearca din nou.", 503);
  }

  let billingSnapshot = null;
  try {
    billingSnapshot = await getBillingSnapshot(user.id);
  } catch {
    return jsonError("Nu am putut verifica incarcarile disponibile. Incearca din nou.", 503);
  }
  if (billingSnapshot.aiCredits < 1) {
    return NextResponse.json(
      {
        error: "Nu ai incarcari disponibile. Adauga incarcari si incearca din nou.",
        actionHref: "/cont?section=credits&returnTo=%2Fmateriale%2Finvata"
      },
      { status: 402 }
    );
  }

  const stageDurationsMs = {};
  let currentStage = "validateInput";

  try {
    let stageStartedAt = Date.now();
    if (!existingStudySet) {
      validateUpload({
        file: null,
        manualText,
        uploadedSourceDocumentId
      });
    }
    stageDurationsMs.validateInput = Date.now() - stageStartedAt;

    if (!existingStudySet) {
      currentStage = "rateLimit";
      stageStartedAt = Date.now();
      await assertRateLimit({
        action: "learning_study_set_create",
        subject: user.id,
        windowSeconds: 15 * 60,
        maxRequests: 8
      });
      stageDurationsMs.rateLimit = Date.now() - stageStartedAt;
    }

    let sourceDocument = null;

    if (existingStudySet?.source_document_id) {
      currentStage = "recoverSource";
      stageStartedAt = Date.now();
      sourceDocument = await getUploadedSourceDocument({
        admin,
        sourceDocumentId: existingStudySet.source_document_id,
        userId: user.id,
        allowManual: true
      });
      stageDurationsMs.recoverSource = Date.now() - stageStartedAt;
    } else if (uploadedSourceDocumentId) {
      currentStage = "loadSource";
      stageStartedAt = Date.now();
      sourceDocument = await getUploadedSourceDocument({
        admin,
        sourceDocumentId: uploadedSourceDocumentId,
        userId: user.id
      });
      stageDurationsMs.loadSource = Date.now() - stageStartedAt;
    } else {
      currentStage = "createManualSource";
      stageStartedAt = Date.now();
      sourceDocument = await createManualSourceDocument({
        admin,
        userId: user.id,
        title,
        manualText
      });
      stageDurationsMs.createManualSource = Date.now() - stageStartedAt;
    }

    currentStage = "createStudySet";
    stageStartedAt = Date.now();
    let studySetId = existingStudySet?.id || null;
    try {
      if (!studySetId) {
        studySetId = await createPendingLearningStudySet({
          userId: user.id,
          academicContext,
          title,
          sourceDocumentId: sourceDocument.id,
          sourceKind: sourceDocument.source_kind === "manual" ? "text" : sourceDocument.source_kind,
          originalFilename: sourceDocument.original_filename,
          extractionMetadata: {
            sourceDocumentId: sourceDocument.id,
            sourceMimeType: sourceDocument.mime_type,
            sourceSizeBytes: sourceDocument.size_bytes,
            uploadAcceptedAt: new Date().toISOString()
          },
          idempotencyKey,
          examDate,
          minutesPerDay,
          objective
        });
      }
    } catch (createError) {
      if (createError?.code === "23505" && idempotencyKey) {
        const concurrentStudySet = await findExistingStudySetByIdempotencyKey({
          admin,
          userId: user.id,
          idempotencyKey
        });
        if (concurrentStudySet) {
          await cleanupUnusedSourceDocumentsForUser(admin, user.id, [sourceDocument.id]).catch(() => {});
          sourceDocument = await getUploadedSourceDocument({
            admin,
            sourceDocumentId: concurrentStudySet.source_document_id,
            userId: user.id,
            allowManual: true
          });
          existingStudySet = concurrentStudySet;
          studySetId = concurrentStudySet.id;
        }
      }
      if (!studySetId) throw createError;
    }
    stageDurationsMs.createStudySet = Date.now() - stageStartedAt;

    currentStage = "createJob";
    stageStartedAt = Date.now();
    let jobId = null;
    try {
      jobId = await createLearningStudySetJob({
        userId: user.id,
        sourceDocumentId: sourceDocument.id,
        studySetId,
        title: existingStudySet?.title || title,
        sourceKind: sourceDocument.source_kind === "manual" ? "text" : sourceDocument.source_kind,
        originalFilename: sourceDocument.original_filename,
        metadata: {
          idempotencyKey,
          objective: objective || null,
          examDate,
          minutesPerDay,
          uploadStageDurationsMs: stageDurationsMs
        }
      });
    } catch (jobError) {
      if (jobError?.code !== "23505") throw jobError;
      const existingJob = await findExistingJobForStudySet({
        admin,
        userId: user.id,
        studySetId
      });
      if (!existingJob?.id) throw jobError;
      jobId = existingJob.id;
    }
    await attachLearningStudySetJob({ userId: user.id, studySetId, jobId });
    if (
      existingStudySet &&
      uploadedSourceDocumentId &&
      uploadedSourceDocumentId !== sourceDocument.id
    ) {
      await cleanupUnusedSourceDocumentsForUser(admin, user.id, [uploadedSourceDocumentId]).catch(() => {});
    }
    stageDurationsMs.createJob = Date.now() - stageStartedAt;

    await recordLearningUsageEvent(admin, {
      userId: user.id,
      eventName: "learning_upload_queued",
      routePath: "/materiale/invata",
      metadata: {
        studySetId,
        jobId,
        sourceKind: sourceDocument.source_kind,
        uploadDurationMs: Date.now() - startedAt,
        uploadStageDurationsMs: stageDurationsMs
      }
    });

    return NextResponse.json({
      ok: true,
      queued: true,
      studySetId,
      jobId,
      redirectUrl: `/materiale/invata/${studySetId}`
    });
  } catch (error) {
    try {
      const admin = createAdminClient();
      await recordLearningUsageEvent(admin, {
        userId: user.id,
        eventName: "learning_upload_failed",
        routePath: "/materiale/invata",
        metadata: {
          label: "Upload invatare esuat",
          title,
          studySetId: error instanceof Error && "studySetId" in error ? error.studySetId : null,
          sourceKind: uploadedSourceDocumentId ? "file" : "text",
          sourceDocumentId: uploadedSourceDocumentId || null,
          error: trimErrorMessage(error),
          failedAtStage: currentStage,
          processingStageDurationsMs: stageDurationsMs,
          processingDurationMs: Date.now() - startedAt
        }
      });
    } catch {
      // Error logging must not hide the original processing error.
    }

    if (error instanceof Error && "studySetId" in error && error.studySetId) {
      return NextResponse.json({
        ok: true,
        partial: true,
        warning: toUserSafeLearningError(error),
        studySetId: error.studySetId,
        redirectUrl: `/materiale/invata/${error.studySetId}`
      });
    }

    return jsonError(toUserSafeLearningError(error), 400);
  }
}
