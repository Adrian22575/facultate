import "server-only";

import crypto from "node:crypto";

import { cleanupUnusedSourceDocumentsForUser } from "@/lib/ai/source-document-cleanup";
import { requeueCreditBackedGenerationJob } from "@/lib/ai/job-capacity";
import {
  awardGamificationPoints,
  calculateGamificationAward
} from "@/lib/gamification";
import { buildLearningArtifactsFromText } from "@/lib/learning/study-set-generator";
import { createAdminClient } from "@/lib/supabase/admin";

function normalizeNumber(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function normalizeText(value) {
  return String(value || "").trim();
}

function toJsonArray(value) {
  return Array.isArray(value) ? value : [];
}

function toIsoDateOffset(milliseconds) {
  return new Date(Date.now() + milliseconds).toISOString();
}

function getCommunityTargets(academicContext) {
  const membership = academicContext?.membership || {};

  return {
    target_cohort_id: membership.cohort_id || null,
    target_unit_id: membership.program_unit_id || null,
    target_institution_id: membership.institution_id || null
  };
}

function getBestCommunityScope(targets) {
  if (targets.target_cohort_id) return "cohort";
  if (targets.target_unit_id) return "program";
  if (targets.target_institution_id) return "institution";
  return null;
}

function studySetMatchesCommunity(studySet, academicContext) {
  const targets = getCommunityTargets(academicContext);
  if (!studySet?.published_at || studySet.visibility_scope === "private") return false;
  if (studySet.visibility_scope === "cohort") {
    return Boolean(studySet.target_cohort_id && targets.target_cohort_id === studySet.target_cohort_id);
  }
  if (studySet.visibility_scope === "program") {
    return Boolean(studySet.target_unit_id && targets.target_unit_id === studySet.target_unit_id);
  }
  if (studySet.visibility_scope === "institution") {
    return Boolean(
      studySet.target_institution_id &&
        targets.target_institution_id === studySet.target_institution_id
    );
  }
  return false;
}

function mapLearningStudySetSummary(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    estimatedPages: normalizeNumber(row.estimated_pages, 0),
    chapterCount: normalizeNumber(row.chapter_count, 0),
    flashcardCount: normalizeNumber(row.flashcard_count, 0),
    questionCount: normalizeNumber(row.question_count, 0),
    recommendedDays: normalizeNumber(row.recommended_days, 1),
    visibilityScope: row.visibility_scope || "private",
    publishedAt: row.published_at || null,
    updatedAt: row.updated_at,
    createdAt: row.created_at
  };
}

function buildAnonymousLeaderboard(attemptRows = [], currentUserId) {
  const byUser = new Map();

  for (const attempt of attemptRows) {
    if (!attempt.user_id) continue;
    const current = byUser.get(attempt.user_id) || {
      userId: attempt.user_id,
      bestScore: 0,
      attemptCount: 0,
      totalScore: 0,
      lastAttemptAt: null
    };
    const score = normalizeNumber(attempt.score_percent, 0);
    current.bestScore = Math.max(current.bestScore, score);
    current.attemptCount += 1;
    current.totalScore += score;
    if (!current.lastAttemptAt || new Date(attempt.created_at).getTime() > new Date(current.lastAttemptAt).getTime()) {
      current.lastAttemptAt = attempt.created_at;
    }
    byUser.set(attempt.user_id, current);
  }

  const ranked = Array.from(byUser.values())
    .map((entry) => ({
      ...entry,
      averageScore: entry.attemptCount ? Math.round(entry.totalScore / entry.attemptCount) : 0
    }))
    .sort((left, right) => {
      if (right.bestScore !== left.bestScore) return right.bestScore - left.bestScore;
      if (right.attemptCount !== left.attemptCount) return right.attemptCount - left.attemptCount;
      return new Date(right.lastAttemptAt || 0).getTime() - new Date(left.lastAttemptAt || 0).getTime();
    })
    .map((entry, index) => ({
      rank: index + 1,
      label: entry.userId === currentUserId ? "Tu" : `Coleg ${index + 1}`,
      isCurrentUser: entry.userId === currentUserId,
      bestScore: entry.bestScore,
      averageScore: entry.averageScore,
      attemptCount: entry.attemptCount,
      lastAttemptAt: entry.lastAttemptAt
    }));

  const currentUserEntry = ranked.find((entry) => entry.isCurrentUser) || null;
  const communityAverage = ranked.length
    ? Math.round(ranked.reduce((total, entry) => total + entry.bestScore, 0) / ranked.length)
    : 0;

  return {
    participantCount: ranked.length,
    communityAverage,
    currentUserRank: currentUserEntry?.rank || null,
    currentUserBestScore: currentUserEntry?.bestScore || null,
    rows: ranked.slice(0, 10)
  };
}

function attachStudySetId(error, studySetId) {
  const message = error instanceof Error ? error.message : "learning_study_set_creation_failed";
  const wrapped = new Error(message);
  wrapped.studySetId = studySetId;
  wrapped.cause = error;
  return wrapped;
}

function buildRetrySourceSnapshot(text) {
  const normalized = String(text || "");
  return normalized.length <= 300_000 ? normalized : null;
}

export function createLearningContentHash(text) {
  const normalized = String(text || "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return null;
  return crypto.createHash("sha256").update(normalized, "utf8").digest("hex");
}

async function resolveRetrySourceText(admin, studySet) {
  const snapshot = studySet.metadata?.retrySourceText;
  if (typeof snapshot === "string" && snapshot.trim().length >= 600) {
    return snapshot;
  }

  const sourceDocumentId = studySet.metadata?.extractionMetadata?.sourceDocumentId;
  if (!sourceDocumentId) return null;

  const { data, error } = await admin
    .from("ai_source_documents")
    .select("extracted_text")
    .eq("id", sourceDocumentId)
    .eq("user_id", studySet.user_id)
    .maybeSingle();

  if (error) throw error;
  return typeof data?.extracted_text === "string" && data.extracted_text.trim().length >= 600
    ? data.extracted_text
    : null;
}

async function insertLearningArtifactsChildren(admin, { studySetId, artifacts }) {
  for (const chapter of artifacts.chapters) {
    const { data: chapterRow, error: chapterError } = await admin
      .from("learning_chapters")
      .insert({
        study_set_id: studySetId,
        position: chapter.position,
        title: chapter.title,
        summary: chapter.summary,
        key_ideas: chapter.keyIdeas,
        key_terms: chapter.keyTerms,
        source_hint: chapter.sourceHint,
        quality_status: chapter.qualityStatus,
        quality_notes: chapter.qualityNotes || null
      })
      .select("id")
      .single();

    if (chapterError) throw chapterError;

    const conceptRows = [];
    for (const concept of chapter.concepts) {
      const { data: conceptRow, error: conceptError } = await admin
        .from("learning_concepts")
        .insert({
          study_set_id: studySetId,
          chapter_id: chapterRow.id,
          position: concept.position,
          title: concept.title,
          simple_explanation: concept.simpleExplanation,
          example: concept.example,
          analogy: concept.analogy,
          check_question: concept.checkQuestion,
          quality_status: chapter.qualityStatus
        })
        .select("id, position")
        .single();

      if (conceptError) throw conceptError;
      conceptRows.push(conceptRow);
    }

    const conceptIdByPosition = new Map(conceptRows.map((row) => [row.position, row.id]));

    if (chapter.flashcards.length) {
      const { error: flashcardError } = await admin.from("learning_flashcards").insert(
        chapter.flashcards.map((flashcard) => ({
          study_set_id: studySetId,
          chapter_id: chapterRow.id,
          concept_id: conceptIdByPosition.get(flashcard.position) || null,
          position: flashcard.position,
          front: flashcard.front,
          back: flashcard.back,
          hint: flashcard.hint,
          quality_status: chapter.qualityStatus
        }))
      );

      if (flashcardError) throw flashcardError;
    }

    if (chapter.questions.length) {
      const { error: questionError } = await admin.from("learning_questions").insert(
        chapter.questions.map((question) => ({
          study_set_id: studySetId,
          chapter_id: chapterRow.id,
          concept_id: conceptIdByPosition.get(question.position) || null,
          position: question.position,
          question_type: "multiple_choice",
          difficulty: question.difficulty,
          question_text: question.questionText,
          answers: question.answers,
          correct_index: question.correctIndex,
          explanation: question.explanation,
          quality_status: chapter.qualityStatus
        }))
      );

      if (questionError) throw questionError;
    }
  }
}

async function deleteLearningStudySetChildren(admin, studySetId) {
  const { data: attemptRows, error: attemptsReadError } = await admin
    .from("learning_attempts")
    .select("id")
    .eq("study_set_id", studySetId);

  if (attemptsReadError) throw attemptsReadError;

  const attemptIds = (attemptRows || []).map((row) => row.id).filter(Boolean);
  if (attemptIds.length) {
    const { error: attemptItemsDeleteError } = await admin
      .from("learning_attempt_items")
      .delete()
      .in("attempt_id", attemptIds);
    if (attemptItemsDeleteError) throw attemptItemsDeleteError;
  }

  const cleanupResults = await Promise.all([
    admin.from("learning_flashcard_reviews").delete().eq("study_set_id", studySetId),
    admin.from("learning_attempts").delete().eq("study_set_id", studySetId),
    admin.from("learning_questions").delete().eq("study_set_id", studySetId),
    admin.from("learning_flashcards").delete().eq("study_set_id", studySetId),
    admin.from("learning_concepts").delete().eq("study_set_id", studySetId),
    admin.from("learning_chapters").delete().eq("study_set_id", studySetId)
  ]);
  const cleanupError = cleanupResults.find((result) => result.error)?.error;
  if (cleanupError) throw cleanupError;
}

export async function createPendingLearningStudySet({
  userId,
  academicContext,
  title,
  sourceDocumentId = null,
  sourceKind = "text",
  originalFilename = null,
  extractionMetadata = null,
  idempotencyKey = null,
  examDate = null,
  minutesPerDay = 30,
  objective = ""
}) {
  const admin = createAdminClient();
  const communityTargets = getCommunityTargets(academicContext);
  const now = new Date().toISOString();
  const normalizedTitle = normalizeText(title) || "Materia mea";

  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .insert({
      user_id: userId,
      source_document_id: sourceDocumentId || null,
      title: normalizedTitle,
      status: "uploaded",
      source_kind: sourceKind === "manual" ? "text" : sourceKind,
      source_excerpt: "",
      estimated_pages: 0,
      chapter_count: 0,
      concept_count: 0,
      flashcard_count: 0,
      question_count: 0,
      recommended_minutes_per_day: normalizeNumber(minutesPerDay, 30),
      exam_date: examDate || null,
      objective: normalizeText(objective) || null,
      warnings: [],
      metadata: {
        plan: [],
        generator: "local_text_mvp",
        processingMode: "async_standard",
        originalFilename,
        extractionMetadata,
        processingStartedAt: null,
        processingCompletedAt: null,
        createdAsPendingAt: now,
        ...(idempotencyKey ? { idempotencyKey } : {})
      },
      ...communityTargets
    })
    .select("id")
    .single();

  if (studySetError) throw studySetError;
  return studySet.id;
}

export async function attachLearningStudySetJob({ userId, studySetId, jobId }) {
  const admin = createAdminClient();
  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .select("metadata")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (studySetError) throw studySetError;
  if (!studySet) throw new Error("learning_study_set_not_found");

  const { error } = await admin
    .from("learning_study_sets")
    .update({
      job_id: jobId,
      metadata: {
        ...(studySet.metadata || {}),
        jobId,
        processingQueuedAt: new Date().toISOString()
      }
    })
    .eq("id", studySetId)
    .eq("user_id", userId);

  if (error) throw error;
}

export async function deleteOwnedLearningStudySet({ userId, studySetId }) {
  const admin = createAdminClient();
  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .select("id, title, source_document_id, job_id")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (studySetError) throw studySetError;
  if (!studySet) throw new Error("Materialul nu a fost gasit in contul tau.");

  if (studySet.job_id) {
    const { data: job, error: jobReadError } = await admin
      .from("ai_generation_jobs")
      .select("id, status, metadata")
      .eq("id", studySet.job_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (jobReadError) throw jobReadError;

    if (job) {
      const cancelledAt = new Date().toISOString();
      const isActive = job.status === "pending" || job.status === "processing";
      const { error: jobUpdateError } = await admin
        .from("ai_generation_jobs")
        .update({
          ...(isActive
            ? {
                status: "failed",
                stage: "cancelled",
                status_detail: "Material sters de utilizator.",
                error_message: "cancelled_by_user",
                completed_at: cancelledAt,
                locked_at: null
              }
            : {}),
          result_learning_study_set_id: null,
          source_document_id: null,
          metadata: {
            ...(job.metadata || {}),
            activityState: "deleted",
            activityMessage: "Material sters de utilizator.",
            deletedAt: cancelledAt
          }
        })
        .eq("id", job.id)
        .eq("user_id", userId);
      if (jobUpdateError) throw jobUpdateError;
    }
  }

  const { data: deleted, error: deleteError } = await admin
    .from("learning_study_sets")
    .delete()
    .eq("id", studySetId)
    .eq("user_id", userId)
    .select("id")
    .maybeSingle();
  if (deleteError) throw deleteError;
  if (!deleted) throw new Error("Materialul nu a putut fi sters.");

  const cleanup = await cleanupUnusedSourceDocumentsForUser(
    admin,
    userId,
    studySet.source_document_id ? [studySet.source_document_id] : []
  );

  return {
    id: studySet.id,
    title: studySet.title,
    sourceCleanupPending: cleanup.pendingIds.length > 0
  };
}

export async function completeLearningStudySetFromText({
  userId,
  studySetId,
  academicContext,
  title,
  text,
  sourceKind = "text",
  originalFilename = null,
  extractionMetadata = null,
  examDate = null,
  minutesPerDay = 30,
  objective = "",
  processingMetadata = {}
}) {
  const admin = createAdminClient();
  const artifacts = buildLearningArtifactsFromText({
    title,
    text,
    examDate,
    minutesPerDay,
    objective
  });
  const communityTargets = getCommunityTargets(academicContext);
  const contentHash = createLearningContentHash(text);

  await deleteLearningStudySetChildren(admin, studySetId);

  const metadataBase = {
    generator: "local_text_mvp",
    processingMode: "async_standard",
    originalFilename,
    extractionMetadata,
    retrySourceText: buildRetrySourceSnapshot(text),
    ...(processingMetadata || {})
  };

  const { error: preparingError } = await admin
    .from("learning_study_sets")
    .update({
      title: artifacts.title,
      status: "generating",
      source_kind: sourceKind === "manual" ? "text" : sourceKind,
      source_excerpt: artifacts.sourceExcerpt,
      estimated_pages: artifacts.estimatedPages,
      chapter_count: artifacts.stats.chapterCount,
      concept_count: artifacts.stats.conceptCount,
      flashcard_count: artifacts.stats.flashcardCount,
      question_count: artifacts.stats.questionCount,
      recommended_level: artifacts.recommendedLevel,
      recommended_days: artifacts.recommendedDays,
      recommended_minutes_per_day: artifacts.recommendedMinutesPerDay,
      exam_date: examDate || null,
      objective: normalizeText(objective) || null,
      content_hash: contentHash,
      warnings: artifacts.warnings,
      metadata: {
        ...metadataBase,
        plan: artifacts.plan,
        partialSave: false,
        processingError: null,
        failedAt: null
      },
      ...communityTargets
    })
    .eq("id", studySetId)
    .eq("user_id", userId);

  if (preparingError) throw preparingError;

  try {
    await insertLearningArtifactsChildren(admin, { studySetId, artifacts });
  } catch (error) {
    await admin
      .from("learning_study_sets")
      .update({
        status: "failed",
        warnings: [
          ...artifacts.warnings,
          "Procesarea s-a oprit inainte ca toate capitolele sa fie salvate."
        ],
        metadata: {
          ...metadataBase,
          plan: artifacts.plan,
          partialSave: true,
          failedAt: "save_learning_children",
          processingError: error instanceof Error ? error.message : String(error || "unknown_error"),
          failedAtTimestamp: new Date().toISOString()
        }
      })
      .eq("id", studySetId)
      .eq("user_id", userId);

    throw attachStudySetId(error, studySetId);
  }

  const { error: readyError } = await admin
    .from("learning_study_sets")
    .update({
      status: artifacts.status,
      warnings: artifacts.warnings,
      metadata: {
        ...metadataBase,
        plan: artifacts.plan,
        partialSave: false,
        processingError: null,
        failedAt: null
      }
    })
    .eq("id", studySetId)
    .eq("user_id", userId);

  if (readyError) throw readyError;
  return { studySetId, artifacts };
}

export async function createLearningStudySetFromText({
  userId,
  academicContext,
  title,
  text,
  sourceKind = "text",
  originalFilename = null,
  extractionMetadata = null,
  idempotencyKey = null,
  examDate = null,
  minutesPerDay = 30,
  objective = ""
}) {
  const admin = createAdminClient();
  const artifacts = buildLearningArtifactsFromText({
    title,
    text,
    examDate,
    minutesPerDay,
    objective
  });
  const communityTargets = getCommunityTargets(academicContext);
  const contentHash = createLearningContentHash(text);

  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .insert({
      user_id: userId,
      title: artifacts.title,
      status: artifacts.status,
      source_kind: sourceKind === "manual" ? "text" : sourceKind,
      source_excerpt: artifacts.sourceExcerpt,
      estimated_pages: artifacts.estimatedPages,
      chapter_count: artifacts.stats.chapterCount,
      concept_count: artifacts.stats.conceptCount,
      flashcard_count: artifacts.stats.flashcardCount,
      question_count: artifacts.stats.questionCount,
      recommended_level: artifacts.recommendedLevel,
      recommended_days: artifacts.recommendedDays,
      recommended_minutes_per_day: artifacts.recommendedMinutesPerDay,
      exam_date: examDate || null,
      objective: normalizeText(objective) || null,
      content_hash: contentHash,
      warnings: artifacts.warnings,
      metadata: {
        plan: artifacts.plan,
        generator: "local_text_mvp",
        processingMode: "standard",
        originalFilename,
        extractionMetadata,
        retrySourceText: buildRetrySourceSnapshot(text),
        ...(idempotencyKey ? { idempotencyKey } : {})
      },
      ...communityTargets
    })
    .select("id")
    .single();

  if (studySetError) throw studySetError;

  try {
    await insertLearningArtifactsChildren(admin, { studySetId: studySet.id, artifacts });
  } catch (error) {
    await admin
      .from("learning_study_sets")
      .update({
        status: "failed",
        warnings: [
          ...artifacts.warnings,
          "Procesarea s-a oprit inainte ca toate capitolele sa fie salvate."
        ],
        metadata: {
          plan: artifacts.plan,
          generator: "local_text_mvp",
          processingMode: "standard",
          originalFilename,
          extractionMetadata,
          retrySourceText: buildRetrySourceSnapshot(text),
          ...(idempotencyKey ? { idempotencyKey } : {}),
          partialSave: true,
          failedAt: "save_learning_children",
          processingError: error instanceof Error ? error.message : String(error || "unknown_error"),
          failedAtTimestamp: new Date().toISOString()
        }
      })
      .eq("id", studySet.id);

    throw attachStudySetId(error, studySet.id);
  }

  return studySet.id;
}

export async function retryFailedLearningStudySet({ userId, studySetId, academicContext = null }) {
  const admin = createAdminClient();
  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .select("*")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (studySetError) throw studySetError;
  if (!studySet) throw new Error("learning_study_set_not_found");
  if (studySet.status !== "failed") throw new Error("learning_study_set_not_failed");

  const asyncJobId = studySet.job_id || studySet.metadata?.jobId || studySet.metadata?.activeJobId;
  if (asyncJobId) {
    await requeueCreditBackedGenerationJob({ jobId: asyncJobId, userId });
    const retryStartedAt = new Date().toISOString();
    const { error: queueError } = await admin
      .from("learning_study_sets")
      .update({
        status: "generating",
        warnings: [],
        metadata: {
          ...(studySet.metadata || {}),
          activeJobId: asyncJobId,
          retryStartedAt,
          retryAttemptCount: Number(studySet.metadata?.retryAttemptCount || 0) + 1,
          processingError: null,
          failedAt: null
        }
      })
      .eq("id", studySetId)
      .eq("user_id", userId);
    if (queueError) throw queueError;

    return { studySetId, jobId: asyncJobId, queued: true };
  }

  const sourceText = await resolveRetrySourceText(admin, studySet);
  if (!sourceText) {
    throw new Error("Nu mai avem textul sursa complet pentru retry. Incarca materialul din nou.");
  }

  const artifacts = buildLearningArtifactsFromText({
    title: studySet.title,
    text: sourceText,
    examDate: studySet.exam_date,
    minutesPerDay: normalizeNumber(studySet.recommended_minutes_per_day, 30),
    objective: studySet.objective || ""
  });
  const communityTargets = getCommunityTargets(academicContext);
  const contentHash = createLearningContentHash(sourceText);

  await deleteLearningStudySetChildren(admin, studySetId);

  const retryStartedAt = new Date().toISOString();
  const { error: preparingError } = await admin
    .from("learning_study_sets")
    .update({
      status: "generating",
      title: artifacts.title,
      source_excerpt: artifacts.sourceExcerpt,
      estimated_pages: artifacts.estimatedPages,
      chapter_count: artifacts.stats.chapterCount,
      concept_count: artifacts.stats.conceptCount,
      flashcard_count: artifacts.stats.flashcardCount,
      question_count: artifacts.stats.questionCount,
      recommended_level: artifacts.recommendedLevel,
      recommended_days: artifacts.recommendedDays,
      recommended_minutes_per_day: artifacts.recommendedMinutesPerDay,
      content_hash: contentHash,
      warnings: artifacts.warnings,
      metadata: {
        ...(studySet.metadata || {}),
        plan: artifacts.plan,
        retryStartedAt,
        retryAttemptCount: Number(studySet.metadata?.retryAttemptCount || 0) + 1,
        partialSave: false,
        processingError: null,
        failedAt: null,
        retrySourceText: buildRetrySourceSnapshot(sourceText)
      },
      ...communityTargets
    })
    .eq("id", studySetId)
    .eq("user_id", userId);

  if (preparingError) throw preparingError;

  try {
    await insertLearningArtifactsChildren(admin, { studySetId, artifacts });
    const retryCompletedAt = new Date().toISOString();
    const { error: updateError } = await admin
      .from("learning_study_sets")
      .update({
        status: artifacts.status,
        content_hash: contentHash,
        warnings: artifacts.warnings,
        metadata: {
          ...(studySet.metadata || {}),
          plan: artifacts.plan,
          retryStartedAt,
          retryCompletedAt,
          retryAttemptCount: Number(studySet.metadata?.retryAttemptCount || 0) + 1,
          partialSave: false,
          processingError: null,
          failedAt: null,
          retrySourceText: buildRetrySourceSnapshot(sourceText)
        }
      })
      .eq("id", studySetId)
      .eq("user_id", userId);

    if (updateError) throw updateError;
  } catch (error) {
    await admin
      .from("learning_study_sets")
      .update({
        status: "failed",
        content_hash: contentHash,
        warnings: [
          ...artifacts.warnings,
          "Retry-ul s-a oprit inainte ca toate capitolele sa fie salvate."
        ],
        metadata: {
          ...(studySet.metadata || {}),
          plan: artifacts.plan,
          retryStartedAt,
          retryAttemptCount: Number(studySet.metadata?.retryAttemptCount || 0) + 1,
          partialSave: true,
          failedAt: "retry_learning_children",
          processingError: error instanceof Error ? error.message : String(error || "unknown_error"),
          failedAtTimestamp: new Date().toISOString(),
          retrySourceText: buildRetrySourceSnapshot(sourceText)
        }
      })
      .eq("id", studySetId)
      .eq("user_id", userId);

    throw attachStudySetId(error, studySetId);
  }

  return { studySetId };
}

export async function getLearningStudySetForUser({ studySetId, userId, academicContext = null }) {
  const admin = createAdminClient();
  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .select("*")
    .eq("id", studySetId)
    .maybeSingle();

  if (studySetError) throw studySetError;
  if (!studySet) return null;
  const isOwner = studySet.user_id === userId;
  if (!isOwner && !studySetMatchesCommunity(studySet, academicContext)) {
    return null;
  }

  let processingJob = null;
  const jobId = studySet.job_id || studySet.metadata?.jobId || studySet.metadata?.activeJobId || null;
  if (jobId && isOwner) {
    const { data: jobRow, error: jobError } = await admin
      .from("ai_generation_jobs")
      .select("id, status, stage, progress_percent, status_detail, error_message, created_at, started_at, completed_at, metadata")
      .eq("id", jobId)
      .eq("user_id", userId)
      .maybeSingle();

    if (jobError) throw jobError;
    if (jobRow) {
      processingJob = {
        id: jobRow.id,
        status: jobRow.status,
        stage: jobRow.stage,
        progressPercent: normalizeNumber(jobRow.progress_percent, 0),
        statusDetail: jobRow.status_detail || "",
        errorMessage: jobRow.error_message || "",
        createdAt: jobRow.created_at,
        startedAt: jobRow.started_at || null,
        completedAt: jobRow.completed_at || null,
        metadata: jobRow.metadata || {}
      };
    }
  }

  const [
    { data: chapters, error: chaptersError },
    { data: concepts, error: conceptsError },
    { data: flashcards, error: flashcardsError },
    { data: questions, error: questionsError },
    { data: attempts, error: attemptsError },
    { data: reviews, error: reviewsError },
    { data: communityAttempts, error: communityAttemptsError }
  ] = await Promise.all([
    admin.from("learning_chapters").select("*").eq("study_set_id", studySetId).order("position"),
    admin.from("learning_concepts").select("*").eq("study_set_id", studySetId).order("position"),
    admin.from("learning_flashcards").select("*").eq("study_set_id", studySetId).order("position"),
    admin.from("learning_questions").select("*").eq("study_set_id", studySetId).order("position"),
    admin
      .from("learning_attempts")
      .select("*")
      .eq("study_set_id", studySetId)
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("learning_flashcard_reviews")
      .select("flashcard_id, rating, review_count, next_review_at, updated_at")
      .eq("study_set_id", studySetId)
      .eq("user_id", userId),
    admin
      .from("learning_attempts")
      .select("user_id, score_percent, created_at")
      .eq("study_set_id", studySetId)
      .order("score_percent", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(500)
  ]);

  if (chaptersError) throw chaptersError;
  if (conceptsError) throw conceptsError;
  if (flashcardsError) throw flashcardsError;
  if (questionsError) throw questionsError;
  if (attemptsError) throw attemptsError;
  if (reviewsError) throw reviewsError;
  if (communityAttemptsError) throw communityAttemptsError;

  const attemptIds = (attempts || []).map((attempt) => attempt.id);
  const { data: attemptItems, error: attemptItemsError } = attemptIds.length
    ? await admin
        .from("learning_attempt_items")
        .select("attempt_id, question_id, selected_index, is_correct, created_at")
        .in("attempt_id", attemptIds)
        .eq("is_correct", false)
    : { data: [], error: null };

  if (attemptItemsError) throw attemptItemsError;

  const wrongQuestionIds = new Set((attemptItems || []).map((item) => item.question_id).filter(Boolean));
  const questionById = new Map((questions || []).map((question) => [question.id, question]));
  const chapterTitleById = new Map((chapters || []).map((chapter) => [chapter.id, chapter.title]));
  const reviewByFlashcardId = new Map((reviews || []).map((review) => [review.flashcard_id, review]));
  const savedMistakes = Array.from(wrongQuestionIds)
    .map((questionId) => questionById.get(questionId))
    .filter(Boolean)
    .map((question) => ({
      id: question.id,
      chapterId: question.chapter_id,
      chapterTitle: chapterTitleById.get(question.chapter_id) || "Capitol",
      questionText: question.question_text,
      answers: toJsonArray(question.answers),
      correctIndex: question.correct_index,
      explanation: question.explanation || "",
      difficulty: question.difficulty || "mediu"
    }));

  return {
    id: studySet.id,
    isOwner,
    jobId,
    processingJob,
    reusedStudySetId: normalizeText(studySet.metadata?.reusedStudySetId) || null,
    title: studySet.title,
    status: studySet.status,
    sourceKind: studySet.source_kind,
    visibilityScope: studySet.visibility_scope || "private",
    publishedAt: studySet.published_at || null,
    estimatedPages: normalizeNumber(studySet.estimated_pages, 0),
    chapterCount: normalizeNumber(studySet.chapter_count, 0),
    conceptCount: normalizeNumber(studySet.concept_count, 0),
    flashcardCount: normalizeNumber(studySet.flashcard_count, 0),
    questionCount: normalizeNumber(studySet.question_count, 0),
    recommendedLevel: studySet.recommended_level || "mediu",
    recommendedDays: normalizeNumber(studySet.recommended_days, 1),
    recommendedMinutesPerDay: normalizeNumber(studySet.recommended_minutes_per_day, 30),
    examDate: studySet.exam_date || null,
    objective: studySet.objective || "",
    warnings: toJsonArray(studySet.warnings),
    plan: toJsonArray(studySet.metadata?.plan),
    createdAt: studySet.created_at,
    updatedAt: studySet.updated_at,
    chapters: (chapters || []).map((chapter) => ({
      id: chapter.id,
      position: chapter.position,
      title: chapter.title,
      summary: chapter.summary || "",
      keyIdeas: toJsonArray(chapter.key_ideas),
      keyTerms: toJsonArray(chapter.key_terms),
      qualityStatus: chapter.quality_status,
      qualityNotes: chapter.quality_notes || "",
      concepts: (concepts || [])
        .filter((concept) => concept.chapter_id === chapter.id)
        .map((concept) => ({
          id: concept.id,
          title: concept.title,
          simpleExplanation: concept.simple_explanation || "",
          example: concept.example || "",
          analogy: concept.analogy || "",
          checkQuestion: concept.check_question || ""
        })),
      flashcards: (flashcards || [])
        .filter((flashcard) => flashcard.chapter_id === chapter.id)
        .map((flashcard) => ({
          id: flashcard.id,
          front: flashcard.front,
          back: flashcard.back,
          hint: flashcard.hint || ""
        })),
      questions: (questions || [])
        .filter((question) => question.chapter_id === chapter.id)
        .map((question) => ({
          id: question.id,
          questionText: question.question_text,
          answers: toJsonArray(question.answers),
          correctIndex: question.correct_index,
          explanation: question.explanation || "",
          difficulty: question.difficulty || "mediu"
        }))
    })),
    flashcards: (flashcards || []).map((flashcard) => ({
      id: flashcard.id,
      chapterId: flashcard.chapter_id,
      front: flashcard.front,
      back: flashcard.back,
      hint: flashcard.hint || "",
      review: reviewByFlashcardId.get(flashcard.id) || null
    })),
    questions: (questions || []).map((question) => ({
      id: question.id,
      chapterId: question.chapter_id,
      questionText: question.question_text,
      answers: toJsonArray(question.answers),
      correctIndex: question.correct_index,
      explanation: question.explanation || "",
      difficulty: question.difficulty || "mediu"
    })),
    attempts: (attempts || []).map((attempt) => ({
      id: attempt.id,
      mode: attempt.mode,
      score: normalizeNumber(attempt.score_percent, 0),
      totalItems: normalizeNumber(attempt.question_count, 0),
      correctItems: normalizeNumber(attempt.correct_count, 0),
      wrongItems: normalizeNumber(attempt.wrong_count, 0),
      createdAt: attempt.created_at
    })),
    leaderboard: buildAnonymousLeaderboard(communityAttempts || [], userId),
    savedMistakes
  };
}

export async function getUserLearningStudySets(userId, limit = 8) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("learning_study_sets")
    .select(
      "id, title, status, visibility_scope, published_at, estimated_pages, chapter_count, flashcard_count, question_count, recommended_days, updated_at, created_at"
    )
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) throw error;

  return (data || []).map(mapLearningStudySetSummary);
}

export async function getCommunityLearningStudySets({ userId, academicContext, limit = 8 }) {
  const targets = getCommunityTargets(academicContext);
  if (!targets.target_cohort_id && !targets.target_unit_id && !targets.target_institution_id) {
    return [];
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("learning_study_sets")
    .select(
      "id, user_id, title, status, visibility_scope, target_cohort_id, target_unit_id, target_institution_id, published_at, estimated_pages, chapter_count, flashcard_count, question_count, recommended_days, updated_at, created_at"
    )
    .not("published_at", "is", null)
    .neq("visibility_scope", "private")
    .neq("status", "archived")
    .order("published_at", { ascending: false })
    .limit(40);

  if (error) throw error;

  return (data || [])
    .filter((row) => row.user_id !== userId)
    .filter((row) => studySetMatchesCommunity(row, academicContext))
    .slice(0, limit)
    .map(mapLearningStudySetSummary);
}

export async function findCommunityLearningStudySetByContentHash({ academicContext, contentHash }) {
  if (!contentHash || !getBestCommunityScope(getCommunityTargets(academicContext))) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("learning_study_sets")
    .select(
      "id, title, status, visibility_scope, target_cohort_id, target_unit_id, target_institution_id, published_at"
    )
    .eq("content_hash", contentHash)
    .not("published_at", "is", null)
    .neq("visibility_scope", "private")
    .in("status", ["ready", "ready_with_warnings"])
    .order("published_at", { ascending: false })
    .limit(12);

  if (error) throw error;

  const match = (data || []).find((row) => studySetMatchesCommunity(row, academicContext));
  return match
    ? {
        id: match.id,
        title: match.title,
        visibilityScope: match.visibility_scope,
        publishedAt: match.published_at
      }
    : null;
}

export async function publishLearningStudySetToCommunity({ userId, academicContext, studySetId }) {
  const admin = createAdminClient();
  const communityTargets = getCommunityTargets(academicContext);
  const visibilityScope = getBestCommunityScope(communityTargets);

  if (!visibilityScope) {
    throw new Error("Nu am gasit comunitatea pentru publicare.");
  }

  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .select("id, user_id, status, visibility_scope, published_at, metadata, content_hash")
    .eq("id", studySetId)
    .eq("user_id", userId)
    .maybeSingle();

  if (studySetError) throw studySetError;
  if (!studySet) throw new Error("Setul de invatare nu a fost gasit.");
  if (!["ready", "ready_with_warnings"].includes(studySet.status)) {
    throw new Error("Setul trebuie sa fie gata inainte de publicare.");
  }

  const publishedAt = studySet.published_at || new Date().toISOString();
  const { error: updateError } = await admin
    .from("learning_study_sets")
    .update({
      visibility_scope: visibilityScope,
      published_at: publishedAt,
      content_hash: studySet.content_hash || createLearningContentHash(studySet.metadata?.retrySourceText),
      ...communityTargets,
      metadata: {
        ...(studySet.metadata || {}),
        publishedByUserId: userId,
        publishedAt,
        visibilityScope
      }
    })
    .eq("id", studySetId)
    .eq("user_id", userId);

  if (updateError) throw updateError;

  return {
    studySetId,
    visibilityScope,
    publishedAt
  };
}

export async function reportLearningStudySet({
  userId,
  academicContext,
  studySetId,
  reason = "content_issue",
  detail = ""
}) {
  const allowedReasons = new Set(["content_issue", "wrong_answers", "inappropriate", "duplicate", "other"]);
  const normalizedReason = allowedReasons.has(reason) ? reason : "content_issue";
  const admin = createAdminClient();
  const accessible = await requireAccessibleStudySet(admin, { studySetId, userId, academicContext });

  if (!accessible) throw new Error("learning_study_set_not_found");

  const { error } = await admin.from("learning_study_set_reports").upsert(
    {
      study_set_id: studySetId,
      reporter_user_id: userId,
      reason: normalizedReason,
      detail: normalizeText(detail).slice(0, 1000) || null,
      status: "pending",
      metadata: {
        reportedAt: new Date().toISOString()
      }
    },
    { onConflict: "study_set_id,reporter_user_id" }
  );

  if (error) throw error;

  return { studySetId, reason: normalizedReason };
}

export async function depublishLearningStudySetFromCommunity({ studySetId, adminUserId, reason = "" }) {
  const admin = createAdminClient();
  const { data: studySet, error: studySetError } = await admin
    .from("learning_study_sets")
    .select("id, metadata")
    .eq("id", studySetId)
    .maybeSingle();

  if (studySetError) throw studySetError;
  if (!studySet) throw new Error("Setul de invatare nu a fost gasit.");

  const depublishedAt = new Date().toISOString();
  const { error: updateError } = await admin
    .from("learning_study_sets")
    .update({
      visibility_scope: "private",
      published_at: null,
      metadata: {
        ...(studySet.metadata || {}),
        depublishedByUserId: adminUserId,
        depublishedAt,
        depublishReason: normalizeText(reason).slice(0, 500) || null
      }
    })
    .eq("id", studySetId);

  if (updateError) throw updateError;

  await admin
    .from("learning_study_set_reports")
    .update({
      status: "reviewed",
      metadata: {
        reviewedByUserId: adminUserId,
        reviewedAt: depublishedAt,
        action: "depublished"
      }
    })
    .eq("study_set_id", studySetId)
    .eq("status", "pending");

  return { studySetId, depublishedAt };
}

async function requireAccessibleStudySet(admin, { studySetId, userId, academicContext = null }) {
  const { data, error } = await admin
    .from("learning_study_sets")
    .select(
      "id, user_id, visibility_scope, target_cohort_id, target_unit_id, target_institution_id, published_at"
    )
    .eq("id", studySetId)
    .maybeSingle();

  if (error) throw error;
  if (!data) return false;
  if (data.user_id === userId) return true;
  return studySetMatchesCommunity(data, academicContext);
}

function getNextReviewAt(rating) {
  if (rating === "nu_stiu") return toIsoDateOffset(2 * 60 * 60 * 1000);
  if (rating === "aproape") return toIsoDateOffset(24 * 60 * 60 * 1000);
  if (rating === "mai_tarziu") return toIsoDateOffset(6 * 60 * 60 * 1000);
  return toIsoDateOffset(3 * 24 * 60 * 60 * 1000);
}

export async function saveLearningFlashcardRating({
  userId,
  studySetId,
  flashcardId,
  rating,
  academicContext = null
}) {
  const allowedRatings = new Set(["nu_stiu", "aproape", "stiu", "mai_tarziu"]);
  if (!allowedRatings.has(rating)) {
    throw new Error("invalid_flashcard_rating");
  }

  const admin = createAdminClient();
  const accessible = await requireAccessibleStudySet(admin, { studySetId, userId, academicContext });
  if (!accessible) throw new Error("learning_study_set_not_found");

  const { data: flashcard, error: flashcardError } = await admin
    .from("learning_flashcards")
    .select("id")
    .eq("id", flashcardId)
    .eq("study_set_id", studySetId)
    .maybeSingle();

  if (flashcardError) throw flashcardError;
  if (!flashcard) throw new Error("learning_flashcard_not_found");

  const nextReviewAt = getNextReviewAt(rating);
  const { data: review, error: reviewError } = await admin.rpc("record_learning_flashcard_review", {
    p_user_id: userId,
    p_study_set_id: studySetId,
    p_flashcard_id: flashcardId,
    p_rating: rating,
    p_next_review_at: nextReviewAt
  });

  if (reviewError) throw reviewError;

  return {
    flashcardId,
    rating,
    reviewCount: normalizeNumber(review?.reviewCount, 1),
    nextReviewAt: review?.nextReviewAt || nextReviewAt
  };
}

export async function saveLearningQuizAttempt({
  userId,
  studySetId,
  chapterId = "all",
  idempotencyKey,
  answers = [],
  academicContext = null
}) {
  const normalizedIdempotencyKey = normalizeText(idempotencyKey);
  const normalizedAnswers = (Array.isArray(answers) ? answers : [])
    .map((answer) => ({
      questionId: normalizeText(answer?.questionId),
      selectedIndex: Number(answer?.selectedIndex)
    }))
    .filter((answer) => answer.questionId && Number.isInteger(answer.selectedIndex));

  if (!normalizedIdempotencyKey || normalizedIdempotencyKey.length < 8 || !normalizedAnswers.length) {
    throw new Error("learning_quiz_empty_answers");
  }

  const questionIds = normalizedAnswers.map((answer) => answer.questionId);
  if (new Set(questionIds).size !== questionIds.length) {
    throw new Error("learning_quiz_questions_mismatch");
  }

  const admin = createAdminClient();
  const accessible = await requireAccessibleStudySet(admin, { studySetId, userId, academicContext });
  if (!accessible) throw new Error("learning_study_set_not_found");

  const { data: questions, error: questionsError } = await admin
    .from("learning_questions")
    .select("id, chapter_id, question_text, answers, correct_index, explanation, difficulty")
    .eq("study_set_id", studySetId)
    .in("id", questionIds);

  if (questionsError) throw questionsError;
  if (!questions?.length || questions.length !== questionIds.length) {
    throw new Error("learning_quiz_questions_mismatch");
  }

  const answerByQuestionId = new Map(normalizedAnswers.map((answer) => [answer.questionId, answer.selectedIndex]));
  const items = questions.map((question) => {
    const selectedIndex = answerByQuestionId.get(question.id);
    const questionAnswers = toJsonArray(question.answers);
    if (selectedIndex < 0 || selectedIndex >= questionAnswers.length) {
      throw new Error("learning_quiz_answer_mismatch");
    }
    const isCorrect = selectedIndex === question.correct_index;
    return {
      question,
      selectedIndex,
      isCorrect
    };
  });
  const correctCount = items.filter((item) => item.isCorrect).length;
  const total = items.length;
  const wrongCount = total - correctCount;
  const percentage = total ? Math.round((correctCount / total) * 100) : 0;

  const mode = chapterId === "mistakes" ? "mistakes" : chapterId === "all" ? "quick_test" : "custom_test";
  const { data: attemptResult, error: attemptError } = await admin.rpc("save_learning_quiz_attempt", {
    p_user_id: userId,
    p_study_set_id: studySetId,
    p_mode: mode,
    p_score_percent: percentage,
    p_correct_count: correctCount,
    p_question_count: total,
    p_wrong_count: wrongCount,
    p_metadata: {
      chapterId,
      answeredQuestionIds: questionIds
    },
    p_items: items.map((item) => ({
      questionId: item.question.id,
      selectedIndex: item.selectedIndex,
      isCorrect: item.isCorrect,
      correctIndex: item.question.correct_index
    })),
    p_idempotency_key: normalizedIdempotencyKey
  });

  if (attemptError) throw attemptError;

  const actionType = mode === "mistakes" ? "learning_mistakes_completed" : "learning_quiz_completed";
  const gamification = attemptResult?.created
    ? await awardGamificationPoints({
        userId,
        actionType,
        points: calculateGamificationAward({
          actionType,
          correctCount,
          questionCount: total,
          scorePercent: percentage
        }),
        referenceType: "learning_study_set",
        referenceId: studySetId,
        idempotencyKey: `learning-quiz:${normalizedIdempotencyKey}`,
        metadata: {
          studySetId,
          chapterId,
          mode,
          scorePercent: percentage,
          correctCount,
          questionCount: total,
          wrongCount
        }
      })
    : null;

  return {
    attemptId: attemptResult?.attemptId,
    gamification,
    score: correctCount,
    total,
    percentage,
    wrong: items
      .filter((item) => !item.isCorrect)
      .map((item) => ({
        id: item.question.id,
        chapterId: item.question.chapter_id,
        questionText: item.question.question_text,
        answers: toJsonArray(item.question.answers),
        correctIndex: item.question.correct_index,
        explanation: item.question.explanation || "",
        difficulty: item.question.difficulty || "mediu",
        selectedIndex: item.selectedIndex
      }))
  };
}
