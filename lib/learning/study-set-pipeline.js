import "server-only";

import { extractSourceText } from "@/lib/ai/extract-text";
import { downloadSourceDocument } from "@/lib/ai/storage";
import { consumeCreditForLearningStudySet } from "@/lib/billing";
import {
  completeLearningStudySetFromText,
  createLearningContentHash,
  findCommunityLearningStudySetByContentHash,
  getLearningStudySetForUser
} from "@/lib/learning/study-sets";
import { createAdminClient } from "@/lib/supabase/admin";

export const LEARNING_STUDY_SET_JOB_KIND = "learning_study_set";

const LOCK_STALE_MS = 12 * 60 * 1000;
const MONITOR_HISTORY_LIMIT = 30;
const MONITOR_TERMINAL_WINDOW_MS = 30 * 60 * 1000;

function trimErrorMessage(error) {
  if (!(error instanceof Error)) return "unknown_learning_job_error";
  return error.message.slice(0, 2000);
}

function parseTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : null;
}

function secondsSince(value) {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) return null;
  return Math.max(0, Math.round((Date.now() - timestamp) / 1000));
}

function learningJobHref(job) {
  const studySetId =
    job.metadata?.reusedStudySetId || job.result_learning_study_set_id || job.metadata?.studySetId || null;
  return studySetId ? `/materiale/invata/${studySetId}` : "/materiale/invata";
}

async function updateJob(jobId, payload) {
  const admin = createAdminClient();
  const nextPayload = {
    ...payload,
    last_heartbeat_at: new Date().toISOString()
  };

  if (
    Object.prototype.hasOwnProperty.call(payload, "stage") ||
    Object.prototype.hasOwnProperty.call(payload, "progress_percent") ||
    Object.prototype.hasOwnProperty.call(payload, "status_detail")
  ) {
    nextPayload.last_progress_at = new Date().toISOString();
  }

  const { error } = await admin.from("ai_generation_jobs").update(nextPayload).eq("id", jobId);
  if (error) throw error;
}

async function acquireJobLock(jobId) {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS).toISOString();
  const { data, error } = await admin.rpc("acquire_ai_generation_job_lock", {
    p_job_id: jobId,
    p_stale_before: staleBefore
  });

  if (error) throw error;
  return Boolean(data);
}

export async function claimNextLearningStudySetJob() {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS).toISOString();
  const selectColumns = "id, user_id, status, locked_at, created_at";
  const [{ data: pendingJobs, error: pendingError }, { data: staleJobs, error: staleError }] =
    await Promise.all([
      admin
        .from("ai_generation_jobs")
        .select(selectColumns)
        .eq("job_kind", LEARNING_STUDY_SET_JOB_KIND)
        .eq("status", "pending")
        .order("created_at", { ascending: true })
        .limit(8),
      admin
        .from("ai_generation_jobs")
        .select(selectColumns)
        .eq("job_kind", LEARNING_STUDY_SET_JOB_KIND)
        .eq("status", "processing")
        .or(`locked_at.is.null,locked_at.lt.${staleBefore}`)
        .order("locked_at", { ascending: true })
        .limit(4)
    ]);

  if (pendingError) throw pendingError;
  if (staleError) throw staleError;

  const candidates = [...(pendingJobs || []), ...(staleJobs || [])];
  for (const candidate of candidates) {
    if (await acquireJobLock(candidate.id)) {
      return {
        jobId: candidate.id,
        userId: candidate.user_id,
        recovered: candidate.status === "processing"
      };
    }
  }

  return null;
}

async function releaseJobLock(jobId) {
  const admin = createAdminClient();
  await admin.rpc("release_ai_generation_job_lock", {
    p_job_id: jobId
  });
}

export async function releaseLearningStudySetJobLock(jobId) {
  await releaseJobLock(jobId);
}

async function fetchLearningJob(jobId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("job_kind", LEARNING_STUDY_SET_JOB_KIND)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function fetchSourceDocument(sourceDocumentId, userId) {
  if (!sourceDocumentId) return null;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_source_documents")
    .select("*")
    .eq("id", sourceDocumentId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function fetchStudySet(studySetId, userId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("learning_study_sets")
    .select("*")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data || null;
}

async function updateStudySetStatus({ studySetId, userId, status, metadata = {}, warnings = null }) {
  const admin = createAdminClient();
  const { data: current, error: currentError } = await admin
    .from("learning_study_sets")
    .select("metadata, warnings")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (currentError) throw currentError;
  if (!current) return;

  const payload = {
    status,
    metadata: {
      ...(current.metadata || {}),
      ...metadata
    }
  };

  if (warnings) {
    payload.warnings = warnings;
  }

  const { error } = await admin
    .from("learning_study_sets")
    .update(payload)
    .eq("id", studySetId)
    .eq("user_id", userId);

  if (error) throw error;
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
    // Usage analytics must not block processing.
  }
}

export async function createLearningStudySetJob({
  userId,
  sourceDocumentId,
  studySetId,
  title,
  sourceKind,
  originalFilename = null,
  metadata = {}
}) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("create_credit_backed_generation_job", {
    p_user_id: userId,
    p_source_document_id: sourceDocumentId || null,
    p_job_kind: LEARNING_STUDY_SET_JOB_KIND,
    p_status_detail: "Materia a fost incarcata. Pregatim procesarea.",
    p_result_learning_study_set_id: studySetId,
    p_metadata: {
      studySetId,
      title,
      sourceKind,
      sourceFilename: originalFilename,
      activityMessage: "Materia a fost incarcata. Pregatim procesarea.",
      ...(metadata || {})
    }
  });

  if (error) throw error;
  return data;
}

export async function getLearningStudySetJobSnapshot({ jobId, userId }) {
  const job = await fetchLearningJob(jobId);
  if (!job || job.user_id !== userId) {
    return null;
  }

  const studySetId = job.result_learning_study_set_id || job.metadata?.studySetId || null;
  const studySet = studySetId ? await fetchStudySet(studySetId, userId) : null;
  const title = studySet?.title || job.metadata?.title || "Materia ta";
  const progressPercent = job.progress_percent || 0;
  const statusDetail = job.status_detail || job.metadata?.activityMessage || null;
  const resultHref = learningJobHref(job);

  return {
    id: job.id,
    kind: "learning",
    status: job.status,
    stage: job.stage,
    progressPercent,
    statusDetail,
    errorMessage: job.error_message || null,
    createdAt: job.created_at,
    startedAt: job.started_at || null,
    lockedAt: job.locked_at || null,
    completedAt: job.completed_at || null,
    lastHeartbeatAt: job.last_heartbeat_at || null,
    lastProgressAt: job.last_progress_at || null,
    elapsedSeconds: secondsSince(job.started_at || job.created_at),
    stageElapsedSeconds: secondsSince(job.last_progress_at || job.started_at || job.created_at),
    lastHeartbeatAgeSeconds: secondsSince(job.last_heartbeat_at),
    lastProgressAgeSeconds: secondsSince(job.last_progress_at),
    title,
    fileName: job.metadata?.sourceFilename || null,
    resultStudySetId: studySetId,
    resultHref,
    reviewHref: resultHref,
    activityState: job.status === "succeeded" ? "ready" : job.status,
    activityMessage:
      job.status === "succeeded"
        ? "Materia este gata de invatat."
        : job.status === "failed"
          ? job.error_message || "Procesarea s-a oprit."
          : statusDetail || "Procesam materia.",
    estimatedRemainingSeconds:
      job.status === "pending" || job.status === "processing"
        ? Math.max(20, Math.round(180 * (1 - Math.min(progressPercent, 95) / 100)))
        : null,
    metadata: job.metadata || {}
  };
}

export async function processLearningStudySetJob({
  jobId,
  userId,
  academicContext,
  lockAlreadyAcquired = false
}) {
  const job = await fetchLearningJob(jobId);
  if (!job || job.user_id !== userId) {
    throw new Error("Jobul nu exista sau nu iti apartine.");
  }

  if (job.status === "succeeded") {
    return getLearningStudySetJobSnapshot({ jobId, userId });
  }

  const locked = lockAlreadyAcquired || (await acquireJobLock(jobId));
  if (!locked) {
    return getLearningStudySetJobSnapshot({ jobId, userId });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();
  const processingStartedAt = job.started_at || new Date().toISOString();
  const stageDurationsMs = {};
  let currentStage = "queued";
  let stageStartedAt = Date.now();
  const studySetId = job.result_learning_study_set_id || job.metadata?.studySetId || null;

  try {
    if (!studySetId) {
      throw new Error("Materialul de invatare nu este legat de job.");
    }

    const studySet = await fetchStudySet(studySetId, userId);
    if (!studySet) {
      throw new Error("Materialul de invatare nu a fost gasit.");
    }

    const sourceDocument = await fetchSourceDocument(job.source_document_id || studySet.source_document_id, userId);
    if (!sourceDocument) {
      throw new Error("Documentul sursa nu mai este disponibil pentru procesare.");
    }

    currentStage = "extractText";
    stageStartedAt = Date.now();
    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      progress_percent: 12,
      error_message: null,
      completed_at: null,
      status_detail: "Citim materia si pregatim textul."
    });
    await updateStudySetStatus({
      studySetId,
      userId,
      status: "extracting",
      metadata: {
        processingStartedAt,
        activeJobId: jobId
      }
    });

    let extracted = null;
    if (sourceDocument.extracted_text && sourceDocument.extracted_text.trim().length >= 600) {
      extracted = {
        extractedText: sourceDocument.extracted_text,
        sourceKind: sourceDocument.source_kind === "manual" ? "text" : sourceDocument.source_kind,
        originalFilename: sourceDocument.original_filename || job.metadata?.sourceFilename || null,
        mimeType: sourceDocument.mime_type || "text/plain",
        sizeBytes: Number(sourceDocument.size_bytes || Buffer.byteLength(sourceDocument.extracted_text, "utf8")),
        extractionMetadata: {
          sourceKind: sourceDocument.source_kind,
          reusedExtractedText: true
        }
      };
    } else if (sourceDocument.storage_bucket && sourceDocument.storage_path) {
      const buffer = await downloadSourceDocument({
        storageBucket: sourceDocument.storage_bucket,
        storagePath: sourceDocument.storage_path
      });
      const preparedFile = {
        sourceKind: sourceDocument.source_kind,
        originalFilename: sourceDocument.original_filename || "document",
        mimeType: sourceDocument.mime_type || "application/octet-stream",
        sizeBytes: Number(sourceDocument.size_bytes || buffer.length),
        buffer
      };

      extracted = await extractSourceText({
        file: null,
        manualText: "",
        examType: "normal",
        subjectName: studySet.title,
        userId,
        sourceDocumentId: sourceDocument.id,
        preparedFile,
        allowPdfOpenAIFallback: false
      });

      const { error: sourceUpdateError } = await admin
        .from("ai_source_documents")
        .update({
          source_kind: extracted.sourceKind === "manual" ? "txt" : extracted.sourceKind,
          original_filename: extracted.originalFilename,
          mime_type: extracted.mimeType,
          size_bytes: extracted.sizeBytes,
          extracted_text: extracted.extractedText,
          extraction_status: "succeeded",
          extraction_error: null
        })
        .eq("id", sourceDocument.id)
        .eq("user_id", userId);

      if (sourceUpdateError) throw sourceUpdateError;
    } else {
      throw new Error("Documentul sursa nu are text disponibil pentru procesare.");
    }

    if (!extracted?.extractedText || extracted.extractedText.trim().length < 600) {
      throw new Error(
        "Textul extras este prea scurt. Incarca un material cu mai mult continut sau lipeste textul complet."
      );
    }
    stageDurationsMs.extractText = Date.now() - stageStartedAt;

    currentStage = "reuseExisting";
    stageStartedAt = Date.now();
    const contentHash = createLearningContentHash(extracted.extractedText);
    await updateJob(jobId, {
      status: "processing",
      stage: "checking_existing",
      progress_percent: 42,
      status_detail: "Verificam daca materia este deja pregatita pentru comunitatea ta."
    });

    const existingStudySet = await findCommunityLearningStudySetByContentHash({
      academicContext,
      contentHash
    });

    if (existingStudySet) {
      const reusedAt = new Date().toISOString();
      stageDurationsMs.reuseExisting = Date.now() - stageStartedAt;
      await updateStudySetStatus({
        studySetId,
        userId,
        status: "archived",
        metadata: {
          activeJobId: jobId,
          reusedStudySetId: existingStudySet.id,
          reusedStudySetTitle: existingStudySet.title,
          reusedAt,
          reusedContentHash: contentHash
        }
      });
      await updateJob(jobId, {
        status: "succeeded",
        stage: "reused",
        progress_percent: 100,
        error_message: null,
        completed_at: reusedAt,
        locked_at: null,
        status_detail: "Am gasit un material deja pregatit pentru comunitatea ta.",
        metadata: {
          ...(job.metadata || {}),
          reusedStudySetId: existingStudySet.id,
          reusedStudySetTitle: existingStudySet.title,
          reusedAt,
          reusedContentHash: contentHash,
          activityMessage: "Am deschis materialul deja pregatit pentru comunitatea ta.",
          processingStageDurationsMs: stageDurationsMs
        }
      });
      await recordLearningUsageEvent(admin, {
        userId,
        eventName: "learning_upload_reused_community_material",
        routePath: "/materiale/invata",
        metadata: {
          submittedStudySetId: studySetId,
          reusedStudySetId: existingStudySet.id,
          jobId,
          sourceKind: extracted.sourceKind
        }
      });

      return getLearningStudySetJobSnapshot({ jobId, userId });
    }

    currentStage = "buildStudySet";
    stageStartedAt = Date.now();
    await updateJob(jobId, {
      status: "processing",
      stage: "generating",
      progress_percent: 48,
      status_detail: "Construim capitolele, flashcards si testele."
    });
    await updateStudySetStatus({
      studySetId,
      userId,
      status: "generating"
    });

    const completed = await completeLearningStudySetFromText({
      userId,
      studySetId,
      academicContext,
      title: studySet.title,
      text: extracted.extractedText,
      sourceKind: extracted.sourceKind,
      originalFilename: extracted.originalFilename,
      extractionMetadata: {
        ...(extracted.extractionMetadata || {}),
        sourceDocumentId: sourceDocument.id,
        sourceMimeType: extracted.mimeType,
        sourceSizeBytes: extracted.sizeBytes
      },
      examDate: studySet.exam_date || null,
      minutesPerDay: studySet.recommended_minutes_per_day || 30,
      objective: studySet.objective || "",
      processingMetadata: {
        activeJobId: jobId,
        jobId,
        processingStartedAt,
        processingStageDurationsMs: stageDurationsMs
      }
    });
    stageDurationsMs.buildStudySet = Date.now() - stageStartedAt;

    currentStage = "consumeCredit";
    stageStartedAt = Date.now();
    await updateJob(jobId, {
      status: "processing",
      stage: "finalizing",
      progress_percent: 92,
      status_detail: "Salvam progresul si finalizam materialul."
    });
    const creditConsumption = await consumeCreditForLearningStudySet({
      userId,
      studySetId,
      sourceKind: extracted.sourceKind
    });
    stageDurationsMs.consumeCredit = Date.now() - stageStartedAt;

    const completedAt = new Date().toISOString();
    const { data: finalStudySet, error: finalStudySetError } = await admin
      .from("learning_study_sets")
      .select("metadata")
      .eq("id", studySetId)
      .eq("user_id", userId)
      .single();

    if (finalStudySetError) throw finalStudySetError;

    const processingDurationMs = Date.now() - startedAt;
    const { error: finalUpdateError } = await admin
      .from("learning_study_sets")
      .update({
        metadata: {
          ...(finalStudySet.metadata || {}),
          activeJobId: jobId,
          jobId,
          processingStartedAt,
          processingCompletedAt: completedAt,
          processingDurationMs,
          processingStageDurationsMs: stageDurationsMs,
          estimatedCostUnit: "1_incarcare",
          creditConsumedAt: completedAt,
          creditLedgerId: creditConsumption.ledgerId,
          creditConsumed: creditConsumption.consumed
        }
      })
      .eq("id", studySetId)
      .eq("user_id", userId);

    if (finalUpdateError) throw finalUpdateError;

    await updateJob(jobId, {
      status: "succeeded",
      stage: "ready",
      progress_percent: 100,
      error_message: null,
      completed_at: completedAt,
      locked_at: null,
      status_detail: "Materia este gata de invatat.",
      metadata: {
        ...(job.metadata || {}),
        activityMessage: "Materia este gata de invatat.",
        processingCompletedAt: completedAt,
        processingDurationMs,
        processingStageDurationsMs: stageDurationsMs,
        chapterCount: completed.artifacts.stats.chapterCount,
        flashcardCount: completed.artifacts.stats.flashcardCount,
        questionCount: completed.artifacts.stats.questionCount
      }
    });

    await recordLearningUsageEvent(admin, {
      userId,
      eventName: "learning_upload_completed",
      routePath: "/materiale/invata",
      metadata: {
        studySetId,
        jobId,
        sourceKind: extracted.sourceKind,
        processingDurationMs,
        processingStageDurationsMs: stageDurationsMs,
        creditConsumed: creditConsumption.consumed
      }
    });

    return getLearningStudySetJobSnapshot({ jobId, userId });
  } catch (error) {
    const message = trimErrorMessage(error);
    const failedAt = new Date().toISOString();

    await updateJob(jobId, {
      status: "failed",
      stage: "failed",
      progress_percent: 100,
      error_message: message,
      completed_at: failedAt,
      locked_at: null,
      status_detail: "Procesarea s-a oprit. Poti reincerca din pagina materialului.",
      metadata: {
        ...(job.metadata || {}),
        activityMessage: "Procesarea s-a oprit.",
        failedAtStage: currentStage,
        processingStageDurationsMs: {
          ...stageDurationsMs,
          [currentStage]: Date.now() - stageStartedAt
        },
        processingError: message,
        failedAt
      }
    });

    if (studySetId) {
      await updateStudySetStatus({
        studySetId,
        userId,
        status: "failed",
        warnings: ["Procesarea s-a oprit inainte sa termine materialul."],
        metadata: {
          activeJobId: jobId,
          failedAtStage: currentStage,
          processingError: message,
          failedAtTimestamp: failedAt
        }
      });
    }

    await recordLearningUsageEvent(admin, {
      userId,
      eventName: "learning_upload_failed",
      routePath: "/materiale/invata",
      metadata: {
        studySetId,
        jobId,
        error: message,
        failedAtStage: currentStage
      }
    });

    return getLearningStudySetJobSnapshot({ jobId, userId });
  } finally {
    await releaseJobLock(jobId);
  }
}

function getSortTimestamp(item) {
  const parsed = Date.parse(item?.updatedAt || item?.completedAt || item?.createdAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function mapLearningMonitorJob(job) {
  const resultHref = learningJobHref(job);
  return {
    id: job.id,
    kind: "learning",
    status: job.status,
    stage: job.stage,
    progressPercent: job.progress_percent || 0,
    statusDetail: job.status_detail || null,
    errorMessage: job.error_message || null,
    createdAt: job.created_at,
    startedAt: job.started_at || null,
    completedAt: job.completed_at || null,
    updatedAt: job.last_progress_at || job.completed_at || job.created_at,
    lastHeartbeatAt: job.last_heartbeat_at || null,
    lastProgressAt: job.last_progress_at || null,
    elapsedSeconds: secondsSince(job.started_at || job.created_at),
    title: job.metadata?.title || "Materia ta",
    fileName: job.metadata?.sourceFilename || null,
    resultHref,
    reviewHref: resultHref,
    activityState: job.status === "succeeded" ? "ready" : job.status,
    activityMessage:
      job.status === "succeeded"
        ? "Materia este gata de invatat."
        : job.status === "failed"
          ? job.error_message || "Procesarea s-a oprit."
          : job.status_detail || "Procesam materia.",
    estimatedRemainingSeconds:
      job.status === "pending" || job.status === "processing"
        ? Math.max(20, Math.round(180 * (1 - Math.min(job.progress_percent || 0, 95) / 100)))
        : null,
    metadata: job.metadata || {}
  };
}

export async function getLearningStudySetJobMonitor(userId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_generation_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("job_kind", LEARNING_STUDY_SET_JOB_KIND)
    .order("created_at", { ascending: false })
    .limit(MONITOR_HISTORY_LIMIT);

  if (error) throw error;

  const jobs = data || [];
  const terminalCutoff = Date.now() - MONITOR_TERMINAL_WINDOW_MS;
  const activeRows = jobs.filter((job) => job.status === "pending" || job.status === "processing");
  const terminalRows = jobs.filter((job) => {
    if (job.status !== "succeeded" && job.status !== "failed") return false;
    const finishedAt = parseTimestamp(job.completed_at || job.created_at);
    return finishedAt !== null && finishedAt >= terminalCutoff;
  });

  const activeJobs = activeRows.map(mapLearningMonitorJob);
  const terminalJobs = terminalRows.map(mapLearningMonitorJob);
  terminalJobs.sort((left, right) => getSortTimestamp(right) - getSortTimestamp(left));

  return {
    activeJobs,
    terminalJob: terminalJobs[0] || null,
    generatedAt: new Date().toISOString()
  };
}

export async function getUserLearningStudySetJobs(userId, limit = 16) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_generation_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("job_kind", LEARNING_STUDY_SET_JOB_KIND)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw error;
  return (data || []).map(mapLearningMonitorJob);
}

export async function getLearningStudySetJobForOwner({ jobId, userId }) {
  const job = await fetchLearningJob(jobId);
  if (!job || job.user_id !== userId) return null;
  const studySetId = job.result_learning_study_set_id || job.metadata?.studySetId || null;
  if (!studySetId) return null;
  return getLearningStudySetForUser({ studySetId, userId });
}
