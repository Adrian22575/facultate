import "server-only";

import crypto from "node:crypto";

import { zodTextFormat } from "openai/helpers/zod";

import {
  ImportAnswerKeyExtractionSchema,
  ImportAnswerMatchingSchema,
  ImportChunkClassificationSchema,
  ImportQuestionExtractionSchema,
  ImportSetExtractionSchema
} from "@/lib/ai/import-schemas";
import {
  extractSourceText,
  inferMimeTypeFromName,
  prepareSourceFile,
  sanitizeFilename
} from "@/lib/ai/extract-text";
import { downloadSourceDocument } from "@/lib/ai/storage";
import {
  notifyAdminAiImportTerminal,
  notifyAdminLicentaSessionFinalized
} from "@/lib/notifications/telegram";
import { runLoggedResponseParse } from "@/lib/openai/logging";
import { createAdminClient } from "@/lib/supabase/admin";

const DEFAULT_TITLE = "Import grile licenta";
const LICENTA_GENERAL_LABEL = "Licenta generala";
const LICENTA_SIMULATION_HREF = "/licenta-exam";
const IMPORT_MODEL = process.env.OPENAI_IMPORT_MODEL || "gpt-5.4-mini";
const IMPORT_ESCALATION_MODEL = process.env.OPENAI_IMPORT_ESCALATION_MODEL || "gpt-5.4";
const CHUNK_TARGET_CHARS = 12_000;
const CHUNK_MAX_CHARS = 15_000;
const SET_SINGLE_PASS_MAX_CHARS = Number(process.env.OPENAI_IMPORT_SET_SINGLE_PASS_MAX_CHARS || 45_000);
const SET_SINGLE_PASS_MAX_BLOCKS = Number(process.env.OPENAI_IMPORT_SET_SINGLE_PASS_MAX_BLOCKS || 160);
const MAX_MATCH_CANDIDATES = 160;
const QUESTION_BANK_ITEM_INSERT_BATCH_SIZE = 150;
const IMPORT_ANSWER_OPTIONS_FETCH_BATCH_SIZE = 150;
const DIRECT_MATCH_MIN_RATIO = 0.75;
const AI_OVERALL_CONFIDENCE = 0.85;
const AI_MATCH_CONFIDENCE = 0.8;
const IMPORT_TERMINAL_STATUSES = new Set([
  "ready_for_preview",
  "completed",
  "completed_with_warnings",
  "needs_review",
  "failed"
]);
const IMPORT_ACTIVE_STATUSES = new Set(["uploaded", "extracting", "chunking", "processing", "matching_answers"]);
const IMPORT_MONITOR_HISTORY_LIMIT = 12;
const IMPORT_MONITOR_TERMINAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const IMPORT_QUESTIONS_PAGE_SIZE = 25;
const IMPORT_CHUNK_PROCESSING_STALE_MS = Number(process.env.AI_IMPORT_CHUNK_PROCESSING_STALE_MS || 10 * 60 * 1000);

function cleanupText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function normalizeLabel(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function getOptionSortRank(label, index = 0) {
  const normalized = normalizeLabel(label);
  if (/^[a-z]$/.test(normalized)) {
    return normalized.charCodeAt(0) - 97;
  }

  if (/^\d+$/.test(normalized)) {
    return 100 + Number(normalized);
  }

  return 1000 + index;
}

function sortAnswerOptions(options) {
  return [...(options || [])].sort((left, right) => {
    const leftRank = getOptionSortRank(left?.label, left?._originalIndex || 0);
    const rightRank = getOptionSortRank(right?.label, right?._originalIndex || 0);
    return leftRank - rightRank;
  });
}

function expectedOptionLabel(index) {
  return String.fromCharCode(97 + index);
}

function hasDuplicateLabels(options) {
  const seen = new Set();

  for (const option of options || []) {
    const label = normalizeLabel(option.label);
    if (!label) {
      continue;
    }

    if (seen.has(label)) {
      return true;
    }

    seen.add(label);
  }

  return false;
}

function normalizeExtractedOptions(rawOptions = []) {
  const sortedOptions = sortAnswerOptions(
    rawOptions.map((option, index) => ({
      label: normalizeLabel(option.label || expectedOptionLabel(index)) || expectedOptionLabel(index),
      text: cleanupText(option.text),
      _originalIndex: index
    }))
  ).filter((option) => option.text);
  const shouldRelabel = hasDuplicateLabels(sortedOptions);

  return sortedOptions.map((option, index) => ({
    label: shouldRelabel ? expectedOptionLabel(index) : option.label,
    originalLabel: option.label,
    text: option.text
  }));
}

function resolveCorrectLabelsForOptions(options, labels = []) {
  const usedIndexes = new Set();
  const resolved = [];

  for (const rawLabel of labels) {
    const label = normalizeLabel(rawLabel);
    const optionIndex = options.findIndex(
      (option, index) =>
        !usedIndexes.has(index) &&
        (normalizeLabel(option.originalLabel || option.label) === label ||
          normalizeLabel(option.label) === label)
    );

    if (optionIndex < 0) {
      continue;
    }

    usedIndexes.add(optionIndex);
    resolved.push(normalizeLabel(options[optionIndex].label));
  }

  return [...new Set(resolved)];
}

function normalizeQuestionNumber(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function shouldUseSinglePassSet(text) {
  if (!text || text.length > SET_SINGLE_PASS_MAX_CHARS) {
    return false;
  }

  return splitQuestionBlocks(text).length <= SET_SINGLE_PASS_MAX_BLOCKS;
}

function buildQuestionHash(questionText, answers) {
  return crypto
    .createHash("sha256")
    .update(`${cleanupText(questionText).toLowerCase()}::${answers.join("|").toLowerCase()}`)
    .digest("hex");
}

function normalizeDuplicateText(value) {
  return cleanupText(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function buildSetDuplicateSignature(question, options = []) {
  const normalizedQuestion = normalizeDuplicateText(question?.question_text);
  if (!normalizedQuestion) {
    return null;
  }

  const sortedOptions = sortAnswerOptions(options);
  const optionParts = sortedOptions
    .map((option) => normalizeDuplicateText(option.text))
    .filter(Boolean);
  const correctParts = sortedOptions
    .filter((option) => option.is_correct)
    .map((option) => normalizeDuplicateText(option.text) || normalizeLabel(option.label))
    .filter(Boolean);

  if (optionParts.length < 2) {
    return null;
  }

  return crypto
    .createHash("sha256")
    .update(`${normalizedQuestion}::${optionParts.join("|")}::correct:${correctParts.join("|")}`)
    .digest("hex");
}

function getDuplicateSetWarningMessage(warning) {
  if (!warning?.detected) {
    return null;
  }

  const setLabel = warning.matchedSetIndex ? `Set ${warning.matchedSetIndex}` : "un set incarcat anterior";
  const matchedCount = Number(warning.matchedQuestionCount || 0);
  return `${setLabel} pare sa contina acelasi set de intrebari: am gasit ${matchedCount} intrebari cu aceleasi variante si acelasi raspuns corect. Daca repetitia este intentionata, poti continua; altfel elimina setul duplicat.`;
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function secondsSince(value) {
  const parsed = parseTimestamp(value);
  if (parsed === null) {
    return null;
  }

  return Math.max(0, Math.round((Date.now() - parsed) / 1000));
}

function secondsBetween(startValue, endValue) {
  const start = parseTimestamp(startValue);
  const end = parseTimestamp(endValue);
  if (start === null || end === null || end < start) {
    return null;
  }

  return Math.round((end - start) / 1000);
}

function splitQuestionBlocks(text) {
  const cleaned = cleanupText(text);
  if (!cleaned) {
    return [];
  }

  const lines = cleaned.split("\n");
  const blocks = [];
  let current = [];

  for (const line of lines) {
    const startsQuestion =
      /^\s*(\d{1,4}|[IVXLCDM]{1,8})[\).:-]\s+/.test(line) ||
      /^\s*(intrebarea|întrebarea)\s+\d{1,4}/i.test(line);

    if (startsQuestion && current.join("\n").length > 120) {
      blocks.push(current.join("\n").trim());
      current = [];
    }

    current.push(line);
  }

  if (current.join("\n").trim()) {
    blocks.push(current.join("\n").trim());
  }

  if (blocks.length < 3) {
    return cleaned
      .split(/\n{2,}/)
      .map((block) => block.trim())
      .filter(Boolean);
  }

  return blocks;
}

function buildTextChunks(text, forcedClassification = null) {
  const blocks = splitQuestionBlocks(text);
  const chunks = [];
  let current = [];
  let currentLength = 0;

  function pushCurrent() {
    const rawText = cleanupText(current.join("\n\n"));
    if (!rawText) {
      return;
    }

    chunks.push({
      chunk_index: chunks.length,
      raw_text: rawText,
      classification: forcedClassification || "unknown",
      metadata: {
        estimatedBlockCount: current.length,
        sourceStart: Math.max(chunks.reduce((sum, item) => sum + Number(item.metadata?.estimatedBlockCount || 0), 0), 0),
        sourceEnd:
          Math.max(chunks.reduce((sum, item) => sum + Number(item.metadata?.estimatedBlockCount || 0), 0), 0) +
          current.length -
          1
      }
    });
  }

  for (const block of blocks.length ? blocks : [text]) {
    const nextLength = currentLength + block.length + 2;
    if (current.length && nextLength > CHUNK_MAX_CHARS) {
      pushCurrent();
      current = [];
      currentLength = 0;
    }

    current.push(block);
    currentLength += block.length + 2;

    if (currentLength >= CHUNK_TARGET_CHARS) {
      pushCurrent();
      current = [];
      currentLength = 0;
    }
  }

  if (current.length) {
    pushCurrent();
  }

  return chunks.length ? chunks : [];
}

function buildPublicStatus(job) {
  const terminalAt = job.completed_at || (IMPORT_TERMINAL_STATUSES.has(job.status) ? job.updated_at : null);
  const publicErrorMessage =
    IMPORT_ACTIVE_STATUSES.has(job.status)
      ? null
      : job.total_questions > 0 && String(job.error_message || "").toLowerCase().includes("nu am gasit intrebari")
      ? null
      : job.error_message;

  return {
    kind: "import",
    id: job.id,
    importJobId: job.id,
    licentaSessionId: job.licenta_session_id || null,
    setIndex: job.set_index || null,
    href: job.licenta_session_id ? `/materiale/licenta/${job.licenta_session_id}?set=${job.id}` : `/materiale/imports/${job.id}`,
    mode: job.mode,
    sourceType: job.source_type,
    fileName: job.file_name,
    title: job.title,
    status: job.status,
    totalChunks: job.total_chunks,
    processedChunks: job.processed_chunks,
    totalQuestions: job.total_questions,
    questionsWithAnswers: job.questions_with_answers,
    questionsMissingAnswers: job.questions_missing_answers,
    needsReviewCount: job.needs_review_count,
    errorMessage: publicErrorMessage,
    createdAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: terminalAt,
    startedAt: job.created_at,
    lastHeartbeatAt: job.updated_at,
    lastProgressAt: job.updated_at,
    elapsedSeconds: terminalAt ? secondsBetween(job.created_at, terminalAt) : secondsSince(job.created_at),
    lastHeartbeatAgeSeconds: secondsSince(job.updated_at),
    lastProgressAgeSeconds: secondsSince(job.updated_at),
    progressPercent: getImportProgressPercent(job),
    resultBankId: job.result_bank_id,
    resultHref: job.result_bank_id ? `/materiale/review/${job.result_bank_id}` : null,
    reviewHref: job.result_bank_id ? `/materiale/review/${job.result_bank_id}` : null,
    metadata: {
      ...(job.metadata || {}),
      examType: "licenta",
      sourceFilename: job.file_name || job.title || DEFAULT_TITLE,
      subjectLabel: LICENTA_GENERAL_LABEL,
      importMode: job.mode,
      importStatus: job.status,
      licentaSessionId: job.licenta_session_id || null,
      setIndex: job.set_index || null
    },
    message: getPublicMessage(job)
  };
}

function getImportProgressPercent(job) {
  if (job.status === "failed") {
    return 0;
  }

  if (IMPORT_TERMINAL_STATUSES.has(job.status)) {
    return 100;
  }

  if (job.total_chunks > 0) {
    return Math.max(8, Math.min(96, Math.round((job.processed_chunks / Math.max(job.total_chunks, 1)) * 100)));
  }

  if (job.status === "uploaded" || job.status === "extracting") return 8;
  if (job.status === "chunking") return 12;
  if (job.status === "matching_answers") return 86;
  return 24;
}

function mapImportJobForUi(job) {
  const terminalAt = job.completed_at || (IMPORT_TERMINAL_STATUSES.has(job.status) ? job.updated_at : null);

  return {
    kind: "import",
    id: job.id,
    importJobId: job.id,
    licentaSessionId: job.licenta_session_id || null,
    setIndex: job.set_index || null,
    status: job.status,
    stage: job.status,
    mode: job.mode,
    sourceType: job.source_type,
    fileName: job.file_name,
    title: job.file_name || job.title || DEFAULT_TITLE,
    progressPercent: getImportProgressPercent(job),
    statusDetail: null,
    errorMessage: job.error_message || null,
    createdAt: job.created_at,
    startedAt: job.created_at,
    updatedAt: job.updated_at,
    completedAt: terminalAt,
    lastHeartbeatAt: job.updated_at,
    lastProgressAt: job.updated_at,
    elapsedSeconds: terminalAt ? secondsBetween(job.created_at, terminalAt) : secondsSince(job.created_at),
    lastHeartbeatAgeSeconds: secondsSince(job.updated_at),
    lastProgressAgeSeconds: secondsSince(job.updated_at),
    totalChunks: job.total_chunks || 0,
    processedChunks: job.processed_chunks || 0,
    totalQuestions: job.total_questions || 0,
    questionsWithAnswers: job.questions_with_answers || 0,
    questionsMissingAnswers: job.questions_missing_answers || 0,
    needsReviewCount: job.needs_review_count || 0,
    resultBankId: job.result_bank_id || null,
    resultHref: job.result_bank_id ? `/materiale/review/${job.result_bank_id}` : null,
    reviewHref: job.result_bank_id ? `/materiale/review/${job.result_bank_id}` : null,
    activityState: null,
    activityMessage: null,
    href: job.licenta_session_id ? `/materiale/licenta/${job.licenta_session_id}?set=${job.id}` : `/materiale/imports/${job.id}`,
    message: getPublicMessage(job),
    metadata: {
      ...(job.metadata || {}),
      examType: "licenta",
      sourceFilename: job.file_name || job.title || DEFAULT_TITLE,
      subjectLabel: LICENTA_GENERAL_LABEL,
      importMode: job.mode,
      importStatus: job.status,
      licentaSessionId: job.licenta_session_id || null,
      setIndex: job.set_index || null
    }
  };
}

function getPublicMessage(job) {
  if (job.status === "uploaded" || job.status === "extracting") {
    return "Pregatim fisierul pentru import.";
  }
  if (job.status === "chunking") {
    return "Impartim continutul in parti usor de verificat.";
  }
  if (job.status === "processing") {
    return "Am gasit intrebarile si continuam verificarea.";
  }
  if (job.status === "matching_answers") {
    return "Cautam raspunsurile corecte.";
  }
  if (job.status === "ready_for_preview") {
    return "Importul este gata pentru verificare.";
  }
  if ((job.status === "completed" || job.status === "completed_with_warnings") && job.licenta_session_id) {
    return "Setul a fost salvat in licenta.";
  }
  if (job.status === "completed" || job.status === "completed_with_warnings") {
    return "Importul a fost salvat.";
  }
  if (job.status === "needs_review") {
    return "Unele intrebari necesita verificare.";
  }
  if (job.status === "failed") {
    if (Number(job.total_questions || 0) > 0) {
      return "Am gasit intrebari in set. Verifica-le si salveaza doar daca sunt corecte.";
    }
    return job.mode === "set"
      ? "Procesarea s-a oprit. Elimina setul si incarca o varianta mai clara."
      : "Procesarea s-a oprit. Incearca importul pe seturi cu un material mai clar.";
  }
  return "Pregatim importul.";
}

async function refreshJobCounts(importJobId) {
  const admin = createAdminClient();
  const payload = toImportJobCountPayload(await readImportJobCounts(importJobId));

  const { data, error } = await admin
    .from("ai_import_jobs")
    .update(payload)
    .eq("id", importJobId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function readImportJobCounts(importJobId) {
  const admin = createAdminClient();
  const results = await Promise.all([
    admin.from("ai_import_questions").select("id", { count: "exact", head: true }).eq("import_job_id", importJobId),
    admin.from("ai_import_questions").select("id", { count: "exact", head: true }).eq("import_job_id", importJobId).eq("status", "answer_matched"),
    admin.from("ai_import_questions").select("id", { count: "exact", head: true }).eq("import_job_id", importJobId).eq("status", "missing_answer"),
    admin.from("ai_import_questions").select("id", { count: "exact", head: true }).eq("import_job_id", importJobId).eq("status", "needs_review"),
    admin.from("ai_import_chunks").select("id", { count: "exact", head: true }).eq("import_job_id", importJobId).eq("status", "processed"),
    admin.from("ai_import_chunks").select("id", { count: "exact", head: true }).eq("import_job_id", importJobId)
  ]);
  const failed = results.find((result) => result.error);
  if (failed?.error) {
    throw failed.error;
  }

  const [totalQuestions, withAnswers, missing, needsReview, processedChunks, totalChunks] = results.map((result) => result.count || 0);
  return {
    totalQuestions,
    withAnswers,
    missing,
    needsReview,
    processedChunks,
    totalChunks
  };
}

function toImportJobCountPayload(counts) {
  return {
    total_questions: counts.totalQuestions || 0,
    questions_with_answers: counts.withAnswers || 0,
    questions_missing_answers: counts.missing || 0,
    needs_review_count: counts.needsReview || 0,
    processed_chunks: counts.processedChunks || 0,
    total_chunks: counts.totalChunks || 0
  };
}

function applyImportJobCounts(job, counts) {
  return {
    ...job,
    ...toImportJobCountPayload(counts)
  };
}

async function recoverFailedImportWithExtractedQuestions(job) {
  const refreshed = await refreshJobCounts(job.id);
  if (refreshed.status !== "failed" || Number(refreshed.total_questions || 0) < 1) {
    return refreshed;
  }

  const updated = await updateImportJob(job.id, {
    status: "ready_for_preview",
    error_message: null,
    completed_at: null,
    metadata: {
      ...(refreshed.metadata || {}),
      recoveredFromFailedAt: new Date().toISOString(),
      recoveredFromFailedReason: "extracted_questions_available"
    }
  });

  return refreshDuplicateLicentaSetWarning(updated);
}

async function fetchImportJob(importJobId, userId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_import_jobs")
    .select("*")
    .eq("id", importJobId)
    .eq("user_id", userId)
    .single();

  if (error || !data) {
    throw new Error("Importul nu exista sau nu iti apartine.");
  }

  return data;
}

async function updateImportJob(importJobId, payload) {
  const admin = createAdminClient();
  const shouldNotifyTerminal =
    payload?.status && IMPORT_TERMINAL_STATUSES.has(payload.status);
  let existingJob = null;

  if (shouldNotifyTerminal) {
    const { data: existing, error: existingError } = await admin
      .from("ai_import_jobs")
      .select("*")
      .eq("id", importJobId)
      .maybeSingle();

    if (existingError) {
      console.error("ai_import_terminal_notification_lookup_failed", existingError.message);
    } else {
      existingJob = existing || null;
    }
  }

  const { data, error } = await admin
    .from("ai_import_jobs")
    .update(payload)
    .eq("id", importJobId)
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  if (shouldNotifyTerminal && existingJob?.status !== data.status) {
    await notifyAdminAiImportTerminal({ job: data });
  }

  return data;
}

async function fetchLicentaSession(sessionId, userId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_licenta_import_sessions")
    .select("*")
    .eq("id", sessionId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Sesiunea de licenta nu exista sau nu iti apartine.");
  }

  return data;
}

async function refreshLicentaSessionCounts(sessionId) {
  const admin = createAdminClient();
  const { data: jobs, error } = await admin
    .from("ai_import_jobs")
    .select("status, total_questions, questions_with_answers, questions_missing_answers, needs_review_count")
    .eq("licenta_session_id", sessionId);

  if (error) {
    throw error;
  }

  const rows = jobs || [];
  const totals = rows.reduce(
    (acc, job) => ({
      setCount: acc.setCount + 1,
      completedSetCount:
        acc.completedSetCount + (job.status === "completed" || job.status === "completed_with_warnings" ? 1 : 0),
      totalQuestions: acc.totalQuestions + Number(job.total_questions || 0),
      questionsWithAnswers: acc.questionsWithAnswers + Number(job.questions_with_answers || 0),
      questionsMissingAnswers: acc.questionsMissingAnswers + Number(job.questions_missing_answers || 0),
      needsReviewCount: acc.needsReviewCount + Number(job.needs_review_count || 0)
    }),
    {
      setCount: 0,
      completedSetCount: 0,
      totalQuestions: 0,
      questionsWithAnswers: 0,
      questionsMissingAnswers: 0,
      needsReviewCount: 0
    }
  );

  const { data: session, error: updateError } = await admin
    .from("ai_licenta_import_sessions")
    .update({
      set_count: totals.setCount,
      completed_set_count: totals.completedSetCount,
      total_questions: totals.totalQuestions,
      questions_with_answers: totals.questionsWithAnswers,
      questions_missing_answers: totals.questionsMissingAnswers,
      needs_review_count: totals.needsReviewCount
    })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (updateError) {
    throw updateError;
  }

  return session;
}

async function getOrCreateActiveLicentaSession({ userId, academicContext, sessionId = null }) {
  const admin = createAdminClient();

  if (sessionId) {
    const session = await fetchLicentaSession(sessionId, userId);
    if (session.status !== "active") {
      throw new Error("Aceasta licenta este deja finalizata. Porneste o licenta noua pentru alte seturi.");
    }
    return session;
  }

  const { data: activeSessions, error: activeError } = await admin
    .from("ai_licenta_import_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (activeError) {
    throw activeError;
  }

  if (activeSessions?.[0]) {
    return activeSessions[0];
  }

  const metadata = {
    examType: "licenta",
    subjectLabel: LICENTA_GENERAL_LABEL,
    visibilityScope: "cohort",
    targetCohortId: academicContext?.membership?.cohort_id || null,
    targetUnitId: academicContext?.membership?.program_unit_id || null,
    targetInstitutionId: academicContext?.membership?.institution_id || null
  };

  const { data, error } = await admin
    .from("ai_licenta_import_sessions")
    .insert({
      user_id: userId,
      status: "active",
      metadata
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getNextLicentaSetIndex(sessionId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_import_jobs")
    .select("set_index")
    .eq("licenta_session_id", sessionId)
    .order("set_index", { ascending: false, nullsFirst: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return Number(data?.[0]?.set_index || 0) + 1;
}

async function assertLicentaSessionCanAcceptNextSet(sessionId) {
  const { data, error } = await createAdminClient()
    .from("ai_import_jobs")
    .select("id, status, set_index, title")
    .eq("licenta_session_id", sessionId)
    .order("set_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const openSet = (data || []).find(
    (job) => job.status !== "completed" && job.status !== "completed_with_warnings"
  );

  if (openSet) {
    const label = openSet.set_index ? `setul ${openSet.set_index}` : "setul curent";
    throw new Error(`Termina ${label} inainte sa incarci urmatorul set.`);
  }
}

async function getLicentaSetJobByIndex(sessionId, userId, setIndex) {
  const { data, error } = await createAdminClient()
    .from("ai_import_jobs")
    .select("*")
    .eq("licenta_session_id", sessionId)
    .eq("user_id", userId)
    .eq("set_index", setIndex)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data || null;
}

async function renumberLicentaSessionSets(sessionId, userId) {
  const admin = createAdminClient();
  const { data: jobs, error } = await admin
    .from("ai_import_jobs")
    .select("id, set_index, title, metadata")
    .eq("licenta_session_id", sessionId)
    .eq("user_id", userId)
    .order("set_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  for (const [index, job] of (jobs || []).entries()) {
    const nextIndex = index + 1;
    const currentIndex = Number(job.set_index || 0);
    if (currentIndex === nextIndex) {
      continue;
    }

    const shouldRenameTitle = !job.title || job.title === `Set ${currentIndex}`;
    const { error: updateJobError } = await admin
      .from("ai_import_jobs")
      .update({
        set_index: nextIndex,
        title: shouldRenameTitle ? `Set ${nextIndex}` : job.title,
        metadata: {
          ...(job.metadata || {}),
          setIndex: nextIndex,
          renumberedFromSetIndex: currentIndex || null
        }
      })
      .eq("id", job.id)
      .eq("user_id", userId);

    if (updateJobError) {
      throw updateJobError;
    }

    const { error: updateSetError } = await admin
      .from("ai_import_question_sets")
      .update({
        title: shouldRenameTitle ? `Set ${nextIndex}` : job.title,
        source_label: `Set ${nextIndex}`
      })
      .eq("import_job_id", job.id)
      .eq("user_id", userId);

    if (updateSetError) {
      throw updateSetError;
    }
  }
}

function summarizeLicentaSessionJobs(jobs = []) {
  const rows = Array.isArray(jobs) ? jobs : [];
  const completedRows = rows.filter((job) => job.status === "completed" || job.status === "completed_with_warnings");

  return {
    setCount: rows.length,
    completedSetCount: completedRows.length,
    totalQuestions: rows.reduce((total, job) => total + (job.total_questions || 0), 0),
    questionsWithAnswers: rows.reduce((total, job) => total + (job.questions_with_answers || 0), 0),
    questionsMissingAnswers: rows.reduce((total, job) => total + (job.questions_missing_answers || 0), 0),
    needsReviewCount: rows.reduce((total, job) => total + (job.needs_review_count || 0), 0),
    hasOpenSets: rows.some(
      (job) =>
        IMPORT_ACTIVE_STATUSES.has(job.status) ||
        job.status === "ready_for_preview" ||
        job.status === "needs_review"
    )
  };
}

function mapLicentaSessionForUi(session, jobs = [], resultBank = null) {
  const jobSummary = jobs.length ? summarizeLicentaSessionJobs(jobs) : null;
  const reviewHref = session.result_bank_id ? `/materiale/review/${session.result_bank_id}` : null;
  const resultHref =
    session.status === "completed" && session.result_bank_id && resultBank?.status === "published"
      ? LICENTA_SIMULATION_HREF
      : reviewHref;

  return {
    id: session.id,
    href: `/materiale/licenta/${session.id}`,
    status: session.status,
    resultBankId: session.result_bank_id || null,
    resultBankStatus: resultBank?.status || null,
    resultHref,
    reviewHref,
    setCount: jobSummary?.setCount || session.set_count || 0,
    completedSetCount: jobSummary?.completedSetCount ?? session.completed_set_count ?? 0,
    totalQuestions: jobSummary?.totalQuestions || session.total_questions || 0,
    questionsWithAnswers: jobSummary?.questionsWithAnswers || session.questions_with_answers || 0,
    questionsMissingAnswers: jobSummary?.questionsMissingAnswers || session.questions_missing_answers || 0,
    needsReviewCount: jobSummary?.needsReviewCount || session.needs_review_count || 0,
    hasOpenSets: jobSummary?.hasOpenSets ?? false,
    creditConsumedAt: session.credit_consumed_at || null,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    completedAt: session.completed_at || null,
    metadata: session.metadata || {},
    jobs: jobs.map(mapImportJobForUi)
  };
}

async function getLicentaResultBanksById({ admin, userId, bankIds }) {
  const ids = Array.from(new Set((bankIds || []).filter(Boolean)));
  if (!ids.length) {
    return new Map();
  }

  const { data, error } = await admin
    .from("ai_question_banks")
    .select("id, status")
    .eq("user_id", userId)
    .in("id", ids);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((bank) => [bank.id, bank]));
}

export async function getActiveLicentaImportSession(userId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_licenta_import_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("status", "active")
    .order("updated_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] ? mapLicentaSessionForUi(data[0]) : null;
}

export async function getUserLicentaImportSessions(userId, limit = 12) {
  const admin = createAdminClient();
  const { data: sessions, error } = await admin
    .from("ai_licenta_import_sessions")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const sessionRows = sessions || [];
  if (!sessionRows.length) {
    return [];
  }

  const sessionIds = sessionRows.map((session) => session.id);
  const { data: jobs, error: jobsError } = await admin
    .from("ai_import_jobs")
    .select("*")
    .eq("user_id", userId)
    .in("licenta_session_id", sessionIds)
    .order("set_index", { ascending: true })
    .order("updated_at", { ascending: false });

  if (jobsError) {
    throw jobsError;
  }

  const jobsBySession = new Map();
  for (const job of jobs || []) {
    if (!job.licenta_session_id) {
      continue;
    }
    const current = jobsBySession.get(job.licenta_session_id) || [];
    current.push(job);
    jobsBySession.set(job.licenta_session_id, current);
  }

  const bankMap = await getLicentaResultBanksById({
    admin,
    userId,
    bankIds: sessionRows.map((session) => session.result_bank_id)
  });

  return sessionRows.map((session) =>
    mapLicentaSessionForUi(session, jobsBySession.get(session.id) || [], bankMap.get(session.result_bank_id) || null)
  );
}

async function ensureDefaultQuestionSet(job, patch = {}) {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("ai_import_question_sets")
    .select("*")
    .eq("import_job_id", job.id)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing) {
    return existing;
  }

  const { data, error } = await admin
    .from("ai_import_question_sets")
    .insert({
      import_job_id: job.id,
      user_id: job.user_id,
      title: patch.title || job.title || DEFAULT_TITLE,
      source_label: patch.sourceLabel || (job.mode === "set" ? "Material lipit manual" : "Set detectat"),
      chunk_start: patch.chunkStart ?? null,
      chunk_end: patch.chunkEnd ?? null,
      status: "extracting",
      confidence: patch.confidence ?? null,
      metadata: patch.metadata || {}
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function classifyChunk({ job, chunk }) {
  const response = await runLoggedResponseParse({
    requestScope: "import_chunk_classification",
    userId: job.user_id,
    metadata: {
      importJobId: job.id,
      chunkIndex: chunk.chunk_index
    },
    request: {
      model: IMPORT_MODEL,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content:
            "Clasifica fragmentul unei banci de intrebari. Raspunde strict conform schemei. Nu extrage intrebari in acest pas."
        },
        {
          role: "user",
          content:
            "Fragment:\n\n" +
            chunk.raw_text +
            "\n\nAlege una dintre clase: questions, answer_key, mixed, irrelevant, unknown."
        }
      ],
      text: {
        format: zodTextFormat(ImportChunkClassificationSchema, "import_chunk_classification")
      }
    }
  });

  if (!response.output_parsed) {
    throw new Error("Clasificarea fragmentului nu a returnat un rezultat valid.");
  }

  return response.output_parsed;
}

async function extractQuestionsFromChunk({ job, chunk }) {
  const response = await runLoggedResponseParse({
    requestScope: "import_questions_extract",
    userId: job.user_id,
    metadata: {
      importJobId: job.id,
      chunkIndex: chunk.chunk_index
    },
    request: {
      model: IMPORT_MODEL,
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: [
            "Extrage doar intrebarile grila existente in fragment.",
            "Nu inventa intrebari, variante sau raspunsuri.",
            "Daca raspunsul corect nu apare clar langa intrebare, inlineCorrectAnswerLabels trebuie sa fie gol.",
            "Pastreaza textul si variantele cat mai aproape de sursa.",
            "Marcheaza needsReview=true pentru intrebarile incomplete sau ambigue."
          ].join(" ")
        },
        {
          role: "user",
          content: `Fragment cu intrebari:\n\n${chunk.raw_text}`
        }
      ],
      max_output_tokens: 12000,
      text: {
        format: zodTextFormat(ImportQuestionExtractionSchema, "import_questions_extract")
      }
    }
  });

  if (!response.output_parsed) {
    throw new Error("Extragerea intrebarilor nu a returnat un rezultat valid.");
  }

  return response.output_parsed;
}

async function extractAnswerKeyFromChunk({ job, chunk }) {
  const response = await runLoggedResponseParse({
    requestScope: "import_answer_key_extract",
    userId: job.user_id,
    metadata: {
      importJobId: job.id,
      chunkIndex: chunk.chunk_index
    },
    request: {
      model: IMPORT_MODEL,
      reasoning: { effort: "low" },
      input: [
        {
          role: "system",
          content: [
            "Extrage doar baremul sau lista de raspunsuri corecte din fragment.",
            "Nu inventa intrebari.",
            "Daca raspunsurile au numere, pastreaza questionNumber.",
            "Daca sunt doar o secventa, foloseste positionIndex."
          ].join(" ")
        },
        {
          role: "user",
          content: `Fragment cu posibile raspunsuri:\n\n${chunk.raw_text}`
        }
      ],
      max_output_tokens: 9000,
      text: {
        format: zodTextFormat(ImportAnswerKeyExtractionSchema, "import_answer_key_extract")
      }
    }
  });

  if (!response.output_parsed) {
    throw new Error("Extragerea baremului nu a returnat un rezultat valid.");
  }

  return response.output_parsed;
}

async function extractSetFromChunk({ job, chunk }) {
  const response = await runLoggedResponseParse({
    requestScope: "import_set_extract",
    userId: job.user_id,
    metadata: {
      importJobId: job.id,
      chunkIndex: chunk.chunk_index,
      mode: "set_single_pass"
    },
    request: {
      model: IMPORT_MODEL,
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: [
            "Proceseaza un singur set de grile pentru licenta.",
            "Extrage intrebarile, variantele si orice barem sau raspuns corect prezent in acelasi material.",
            "Nu inventa intrebari sau raspunsuri.",
            "Daca raspunsul corect este langa intrebare, pune-l in inlineCorrectAnswerLabels.",
            "Daca raspunsurile sunt intr-un barem separat, pune-le in answerKeys.",
            "Pastreaza numerotarea intrebarilor pentru potrivirea ulterioara."
          ].join(" ")
        },
        {
          role: "user",
          content: `Material complet al setului:\n\n${chunk.raw_text}`
        }
      ],
      max_output_tokens: 20000,
      text: {
        format: zodTextFormat(ImportSetExtractionSchema, "import_set_extract")
      }
    }
  });

  if (!response.output_parsed) {
    throw new Error("Procesarea setului nu a returnat un rezultat valid.");
  }

  return response.output_parsed;
}

async function insertExtractedQuestions({ job, chunk, extraction }) {
  const admin = createAdminClient();
  const questionSet = await ensureDefaultQuestionSet(job, {
    title: extraction.questionSetTitle || job.title || DEFAULT_TITLE,
    chunkStart: chunk.chunk_index,
    chunkEnd: chunk.chunk_index
  });

  const { data: maxRows, error: maxError } = await admin
    .from("ai_import_questions")
    .select("global_index")
    .eq("import_job_id", job.id)
    .order("global_index", { ascending: false })
    .limit(1);

  if (maxError) {
    throw maxError;
  }

  let nextIndex = Number(maxRows?.[0]?.global_index || 0) + 1;
  let saved = 0;

  for (const rawQuestion of extraction.questions || []) {
    const options = normalizeExtractedOptions(rawQuestion.options || []);

    if (!cleanupText(rawQuestion.questionText) || options.length < 2) {
      continue;
    }

    const optionLabels = new Set(options.map((option) => normalizeLabel(option.label)));
    const correctLabels = resolveCorrectLabelsForOptions(options, rawQuestion.inlineCorrectAnswerLabels || [])
      .filter((label) => optionLabels.has(label));
    const hasUsableInlineAnswer = correctLabels.length > 0;
    const status = rawQuestion.needsReview
      ? "needs_review"
      : hasUsableInlineAnswer
        ? "answer_matched"
        : "missing_answer";

    const { data: question, error: questionError } = await admin
      .from("ai_import_questions")
      .insert({
        import_job_id: job.id,
        question_set_id: questionSet.id,
        user_id: job.user_id,
        local_number: rawQuestion.localNumber || null,
        global_index: nextIndex,
        question_text: cleanupText(rawQuestion.questionText),
        status,
        confidence: rawQuestion.confidence ?? null,
        source_chunk_index: chunk.chunk_index,
        metadata: {
          warnings: extraction.warnings || [],
          hash: buildQuestionHash(rawQuestion.questionText, options.map((option) => option.text))
        }
      })
      .select("id")
      .single();

    if (questionError) {
      throw questionError;
    }

    const optionRows = options.map((option) => ({
      question_id: question.id,
      import_job_id: job.id,
      user_id: job.user_id,
      label: option.label,
      text: option.text,
      is_correct: correctLabels.includes(normalizeLabel(option.label))
    }));

    const { error: optionsError } = await admin.from("ai_import_answer_options").insert(optionRows);
    if (optionsError) {
      throw optionsError;
    }

    nextIndex += 1;
    saved += 1;
  }

  await refreshQuestionSetCounts(questionSet.id);
  return saved;
}

async function refreshQuestionSetCounts(questionSetId) {
  const admin = createAdminClient();
  const [{ count: questionCount }, { count: answerCount }, { count: missing }, { count: needsReview }] = await Promise.all([
    admin.from("ai_import_questions").select("id", { count: "exact", head: true }).eq("question_set_id", questionSetId),
    admin.from("ai_import_questions").select("id", { count: "exact", head: true }).eq("question_set_id", questionSetId).eq("status", "answer_matched"),
    admin.from("ai_import_questions").select("id", { count: "exact", head: true }).eq("question_set_id", questionSetId).eq("status", "missing_answer"),
    admin.from("ai_import_questions").select("id", { count: "exact", head: true }).eq("question_set_id", questionSetId).eq("status", "needs_review")
  ]);

  const status =
    (needsReview || 0) > 0
      ? "needs_review"
      : (questionCount || 0) > 0 && (missing || 0) === 0
        ? "matched"
        : "missing_answers";

  const { error } = await admin
    .from("ai_import_question_sets")
    .update({
      question_count: questionCount || 0,
      answer_count: answerCount || 0,
      status
    })
    .eq("id", questionSetId);

  if (error) {
    throw error;
  }
}

async function loadQuestionSignaturesByJob(jobIds) {
  const admin = createAdminClient();
  const uniqueJobIds = [...new Set((jobIds || []).filter(Boolean))];
  if (!uniqueJobIds.length) {
    return new Map();
  }

  const { data: questions, error: questionsError } = await admin
    .from("ai_import_questions")
    .select("id, import_job_id, question_text")
    .in("import_job_id", uniqueJobIds);

  if (questionsError) {
    throw questionsError;
  }

  const questionRows = questions || [];
  if (!questionRows.length) {
    return new Map(uniqueJobIds.map((jobId) => [jobId, new Set()]));
  }

  const questionIds = questionRows.map((question) => question.id);
  const { data: options, error: optionsError } = await admin
    .from("ai_import_answer_options")
    .select("question_id, label, text, is_correct")
    .in("question_id", questionIds);

  if (optionsError) {
    throw optionsError;
  }

  const optionsByQuestion = new Map();
  for (const option of options || []) {
    const current = optionsByQuestion.get(option.question_id) || [];
    current.push(option);
    optionsByQuestion.set(option.question_id, current);
  }

  const signaturesByJob = new Map(uniqueJobIds.map((jobId) => [jobId, new Set()]));
  for (const question of questionRows) {
    const signature = buildSetDuplicateSignature(question, optionsByQuestion.get(question.id) || []);
    if (!signature) {
      continue;
    }
    const signatures = signaturesByJob.get(question.import_job_id) || new Set();
    signatures.add(signature);
    signaturesByJob.set(question.import_job_id, signatures);
  }

  return signaturesByJob;
}

function findLikelyDuplicateSet({ currentJob, currentSignatures, candidateJobs, signaturesByJob }) {
  const currentCount = currentSignatures.size;
  if (currentCount < 3) {
    return null;
  }

  let bestMatch = null;
  for (const candidate of candidateJobs) {
    const candidateSignatures = signaturesByJob.get(candidate.id) || new Set();
    const candidateCount = candidateSignatures.size;
    if (candidateCount < 3) {
      continue;
    }

    let matchedQuestionCount = 0;
    for (const signature of currentSignatures) {
      if (candidateSignatures.has(signature)) {
        matchedQuestionCount += 1;
      }
    }

    const smallerSetCount = Math.min(currentCount, candidateCount);
    const minimumOverlap = Math.min(5, Math.max(3, Math.ceil(smallerSetCount * 0.8)));
    const currentCoverage = matchedQuestionCount / currentCount;
    const candidateCoverage = matchedQuestionCount / candidateCount;

    if (matchedQuestionCount < minimumOverlap || currentCoverage < 0.85 || candidateCoverage < 0.85) {
      continue;
    }

    const score = Math.min(currentCoverage, candidateCoverage);
    if (!bestMatch || score > bestMatch.score || matchedQuestionCount > bestMatch.matchedQuestionCount) {
      bestMatch = {
        detected: true,
        currentImportJobId: currentJob.id,
        currentSetIndex: currentJob.set_index || null,
        matchedImportJobId: candidate.id,
        matchedSetIndex: candidate.set_index || null,
        matchedTitle: candidate.title || candidate.file_name || null,
        matchedQuestionCount,
        currentQuestionCount: currentCount,
        candidateQuestionCount: candidateCount,
        overlapRatio: Number(score.toFixed(3)),
        checkedAt: new Date().toISOString(),
        score
      };
    }
  }

  if (!bestMatch) {
    return null;
  }

  const { score, ...warning } = bestMatch;
  warning.message = getDuplicateSetWarningMessage(warning);
  return warning;
}

async function detectDuplicateLicentaSet(job) {
  if (!job?.licenta_session_id) {
    return null;
  }

  const admin = createAdminClient();
  const { data: sessionJobs, error: jobsError } = await admin
    .from("ai_import_jobs")
    .select("id, set_index, title, file_name, status, total_questions")
    .eq("user_id", job.user_id)
    .eq("licenta_session_id", job.licenta_session_id)
    .neq("id", job.id)
    .neq("status", "failed");

  if (jobsError) {
    throw jobsError;
  }

  const candidateJobs = (sessionJobs || []).filter((candidate) => Number(candidate.total_questions || 0) > 0);
  if (!candidateJobs.length || Number(job.total_questions || 0) < 3) {
    return null;
  }

  const signaturesByJob = await loadQuestionSignaturesByJob([job.id, ...candidateJobs.map((candidate) => candidate.id)]);
  const currentSignatures = signaturesByJob.get(job.id) || new Set();
  return findLikelyDuplicateSet({
    currentJob: job,
    currentSignatures,
    candidateJobs,
    signaturesByJob
  });
}

async function refreshDuplicateLicentaSetWarning(job) {
  if (!job?.licenta_session_id) {
    return job;
  }

  const duplicateSetWarning = await detectDuplicateLicentaSet(job);
  return updateImportJob(job.id, {
    metadata: {
      ...(job.metadata || {}),
      duplicateSetDetected: Boolean(duplicateSetWarning),
      duplicateSetWarning
    }
  });
}

async function insertAnswerKeyCandidate({ job, chunk, extraction }) {
  const admin = createAdminClient();
  if (!extraction.answerKeys?.length) {
    return null;
  }

  const { data, error } = await admin
    .from("ai_import_answer_key_candidates")
    .insert({
      import_job_id: job.id,
      user_id: job.user_id,
      source_chunk_index: chunk.chunk_index,
      raw_text: chunk.raw_text,
      parsed_json: extraction,
      status: "parsed",
      confidence: Math.max(...extraction.answerKeys.map((item) => Number(item.confidence || 0))),
      metadata: {
        answerKeyFormat: extraction.answerKeyFormat || null,
        warnings: extraction.warnings || []
      }
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return data;
}

async function getMissingQuestionCandidates(importJobId, questionSetId = null) {
  const admin = createAdminClient();
  let query = admin
    .from("ai_import_questions")
    .select("id, question_set_id, local_number, global_index, question_text, status")
    .eq("import_job_id", importJobId)
    .in("status", ["missing_answer", "needs_review"])
    .order("global_index", { ascending: true })
    .limit(MAX_MATCH_CANDIDATES);

  if (questionSetId) {
    query = query.eq("question_set_id", questionSetId);
  }

  const { data: questions, error } = await query;
  if (error) {
    throw error;
  }

  if (!questions?.length) {
    return [];
  }

  const questionIds = questions.map((question) => question.id);
  const { data: options, error: optionsError } = await admin
    .from("ai_import_answer_options")
    .select("id, question_id, label, text")
    .in("question_id", questionIds);

  if (optionsError) {
    throw optionsError;
  }

  const optionsByQuestion = new Map();
  for (const option of options || []) {
    const list = optionsByQuestion.get(option.question_id) || [];
    list.push(option);
    optionsByQuestion.set(option.question_id, list);
  }

  return questions.map((question) => ({
    ...question,
    options: sortAnswerOptions(optionsByQuestion.get(question.id) || [])
  }));
}

function resolveOptionIdsForQuestionLabels(question, labels) {
  const usedOptionIds = new Set();
  const optionIds = [];

  for (const rawLabel of labels || []) {
    const label = normalizeLabel(rawLabel);
    const option = (question.options || []).find(
      (candidate) => !usedOptionIds.has(candidate.id) && normalizeLabel(candidate.label) === label
    );

    if (!option?.id) {
      continue;
    }

    usedOptionIds.add(option.id);
    optionIds.push(option.id);
  }

  return optionIds;
}

async function applyMatches(importJobId, matches, questionsById) {
  const admin = createAdminClient();
  let applied = 0;

  for (const match of matches) {
    const question = questionsById.get(match.questionId);
    if (!question) {
      continue;
    }

    const optionIds = resolveOptionIdsForQuestionLabels(question, match.correctLabels);
    if (!optionIds.length) {
      continue;
    }

    const { error: resetError } = await admin
      .from("ai_import_answer_options")
      .update({ is_correct: false })
      .eq("question_id", question.id);

    if (resetError) {
      throw resetError;
    }

    const { error: optionError } = await admin
      .from("ai_import_answer_options")
      .update({ is_correct: true })
      .eq("question_id", question.id)
      .in("id", optionIds);

    if (optionError) {
      throw optionError;
    }

    const { error: questionError } = await admin
      .from("ai_import_questions")
      .update({
        status: "answer_matched",
        metadata: {
          ...(question.metadata || {}),
          answerMatchedBy: match.source || "answer_key",
          answerMatchConfidence: match.confidence,
          answerMatchReason: match.reason || null
        }
      })
      .eq("id", question.id)
      .eq("import_job_id", importJobId);

    if (questionError) {
      throw questionError;
    }

    applied += 1;
  }

  return applied;
}

function buildDirectMatches(answerKeys, candidates) {
  const byLocalNumber = new Map();
  const byPosition = new Map();
  for (const question of candidates) {
    if (question.local_number) {
      byLocalNumber.set(normalizeQuestionNumber(question.local_number), question);
    }
    if (question.global_index) {
      byPosition.set(Number(question.global_index), question);
    }
  }

  const matches = [];
  const matchedQuestionIds = new Set();
  for (const answer of answerKeys) {
    const question =
      (answer.questionNumber ? byLocalNumber.get(normalizeQuestionNumber(answer.questionNumber)) : null) ||
      (answer.positionIndex ? byPosition.get(Number(answer.positionIndex)) : null);

    if (!question || matchedQuestionIds.has(question.id)) {
      continue;
    }

    const optionIds = resolveOptionIdsForQuestionLabels(question, answer.correctLabels);
    if (!optionIds.length) {
      continue;
    }

    matches.push({
      questionId: question.id,
      correctLabels: (question.options || [])
        .filter((option) => optionIds.includes(option.id))
        .map((option) => option.label),
      confidence: Math.min(Number(answer.confidence || 0.9), 0.95),
      reason: "Potrivire directa dupa numarul intrebarii.",
      source: "direct_answer_key"
    });
    matchedQuestionIds.add(question.id);
  }

  return matches;
}

async function runAiAnswerMatching({ job, candidate, answerKeys, questions }) {
  const questionPayload = questions.map((question) => ({
    questionId: question.id,
    localNumber: question.local_number || null,
    globalIndex: question.global_index || null,
    questionText: cleanupText(question.question_text).slice(0, 120),
    availableOptionLabels: (question.options || []).map((option) => option.label).filter(Boolean)
  }));

  const response = await runLoggedResponseParse({
    requestScope: "import_answer_key_match",
    userId: job.user_id,
    metadata: {
      importJobId: job.id,
      answerKeyCandidateId: candidate.id
    },
    request: {
      model: IMPORT_ESCALATION_MODEL,
      reasoning: { effort: "medium" },
      input: [
        {
          role: "system",
          content: [
            "Potriveste un barem cu o lista limitata de intrebari candidate.",
            "Nu inventa intrebari si nu schimba labelurile variantelor.",
            "Returneaza match-uri doar cand esti sigur.",
            "Daca potrivirea este slaba, seteaza needsReview=true."
          ].join(" ")
        },
        {
          role: "user",
          content: JSON.stringify({
            answerKeys,
            questions: questionPayload
          })
        }
      ],
      max_output_tokens: 9000,
      text: {
        format: zodTextFormat(ImportAnswerMatchingSchema, "import_answer_key_match")
      }
    }
  });

  if (!response.output_parsed) {
    throw new Error("Potrivirea raspunsurilor nu a returnat un rezultat valid.");
  }

  return response.output_parsed;
}

async function matchAnswerKeyCandidate(job, candidate) {
  const admin = createAdminClient();
  const answerKeys = Array.isArray(candidate.parsed_json?.answerKeys)
    ? candidate.parsed_json.answerKeys
    : [];

  if (!answerKeys.length) {
    return 0;
  }

  const candidates = await getMissingQuestionCandidates(job.id, candidate.question_set_id || null);
  if (!candidates.length) {
    await admin
      .from("ai_import_answer_key_candidates")
      .update({ status: "needs_review" })
      .eq("id", candidate.id);
    return 0;
  }

  const questionsById = new Map(candidates.map((question) => [question.id, question]));
  const directMatches = buildDirectMatches(answerKeys, candidates);
  const directRatio = answerKeys.length ? directMatches.length / answerKeys.length : 0;

  if (directMatches.length && directRatio >= DIRECT_MATCH_MIN_RATIO) {
    const applied = await applyMatches(job.id, directMatches, questionsById);
    await admin
      .from("ai_import_answer_key_candidates")
      .update({ status: applied ? "matched" : "needs_review" })
      .eq("id", candidate.id);
    return applied;
  }

  const aiResult = await runAiAnswerMatching({
    job,
    candidate,
    answerKeys,
    questions: candidates
  });

  const validMatches = (aiResult.matches || []).filter((match) => {
    const question = questionsById.get(match.questionId);
    return (
      !aiResult.needsReview &&
      aiResult.overallConfidence >= AI_OVERALL_CONFIDENCE &&
      Number(match.confidence || 0) >= AI_MATCH_CONFIDENCE &&
      question &&
      resolveOptionIdsForQuestionLabels(question, match.correctLabels).length > 0
    );
  });

  if (!validMatches.length) {
    await admin
      .from("ai_import_answer_key_candidates")
      .update({
        status: "needs_review",
        metadata: {
          ...(candidate.metadata || {}),
          matching: aiResult
        }
      })
      .eq("id", candidate.id);
    return 0;
  }

  const applied = await applyMatches(
    job.id,
    validMatches.map((match) => ({ ...match, source: "ai_answer_key" })),
    questionsById
  );

  await admin
    .from("ai_import_answer_key_candidates")
    .update({
      status: applied ? "matched" : "needs_review",
      metadata: {
        ...(candidate.metadata || {}),
        matching: aiResult
      }
    })
    .eq("id", candidate.id);

  return applied;
}

async function processParsedAnswerKeys(job) {
  const admin = createAdminClient();
  const { data: candidates, error } = await admin
    .from("ai_import_answer_key_candidates")
    .select("*")
    .eq("import_job_id", job.id)
    .in("status", ["parsed", "detected"])
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) {
    throw error;
  }

  if (!candidates?.length) {
    return 0;
  }

  await updateImportJob(job.id, {
    status: "matching_answers",
    error_message: null
  });

  return matchAnswerKeyCandidate(job, candidates[0]);
}

async function initializeAutoChunks(job) {
  const admin = createAdminClient();
  const { data: sourceDocument, error } = await admin
    .from("ai_source_documents")
    .select("*")
    .eq("id", job.source_document_id)
    .eq("user_id", job.user_id)
    .single();

  if (error || !sourceDocument) {
    throw new Error("Documentul sursa nu mai este disponibil.");
  }

  await updateImportJob(job.id, { status: "extracting", error_message: null });

  let extractedText = sourceDocument.extracted_text || "";
  let extractionMetadata = {};
  if (!extractedText) {
    const buffer = await downloadSourceDocument({
      storageBucket: sourceDocument.storage_bucket,
      storagePath: sourceDocument.storage_path
    });
    const extracted = await extractSourceText({
      manualText: "",
      preparedFile: {
        sourceKind: sourceDocument.source_kind,
        originalFilename: sourceDocument.original_filename || job.file_name || "document",
        mimeType: sourceDocument.mime_type || inferMimeTypeFromName(sourceDocument.original_filename || ""),
        sizeBytes: Number(sourceDocument.size_bytes || buffer.length),
        buffer
      },
      examType: "licenta",
      subjectName: LICENTA_GENERAL_LABEL,
      userId: job.user_id,
      sourceDocumentId: sourceDocument.id,
      allowPdfOpenAIFallback: false
    });
    extractedText = extracted.extractedText;
    extractionMetadata = extracted.extractionMetadata || {};
    const { error: sourceUpdateError } = await admin
      .from("ai_source_documents")
      .update({
        extracted_text: extractedText,
        extraction_status: "succeeded",
        extraction_error: null
      })
      .eq("id", sourceDocument.id);

    if (sourceUpdateError) {
      throw sourceUpdateError;
    }
  }

  await updateImportJob(job.id, {
    status: "chunking",
    metadata: {
      ...(job.metadata || {}),
      ...extractionMetadata,
      extractedCharacterCount: extractedText.length
    }
  });

  const chunks = buildTextChunks(extractedText);
  if (!chunks.length) {
    throw new Error("Nu am gasit text suficient pentru import.");
  }

  const { error: insertError } = await admin.from("ai_import_chunks").insert(
    chunks.map((chunk) => ({
      import_job_id: job.id,
      user_id: job.user_id,
      chunk_index: chunk.chunk_index,
      raw_text: chunk.raw_text,
      classification: chunk.classification,
      status: "pending",
      metadata: chunk.metadata
    }))
  );

  if (insertError) {
    throw insertError;
  }

  return updateImportJob(job.id, {
    status: "processing",
    total_chunks: chunks.length,
    processed_chunks: 0,
    error_message: null
  });
}

async function resetStaleProcessingChunks(importJobId) {
  const staleBefore = new Date(Date.now() - IMPORT_CHUNK_PROCESSING_STALE_MS).toISOString();
  const { error } = await createAdminClient()
    .from("ai_import_chunks")
    .update({
      status: "pending",
      error_message: null
    })
    .eq("import_job_id", importJobId)
    .eq("status", "processing")
    .lt("updated_at", staleBefore);

  if (error) {
    throw error;
  }
}

async function hasProcessingChunks(importJobId) {
  const { count, error } = await createAdminClient()
    .from("ai_import_chunks")
    .select("id", { count: "exact", head: true })
    .eq("import_job_id", importJobId)
    .eq("status", "processing");

  if (error) {
    throw error;
  }

  return Number(count || 0) > 0;
}

async function claimNextChunk(importJobId) {
  const admin = createAdminClient();
  const { data: candidate, error } = await admin
    .from("ai_import_chunks")
    .select("*")
    .eq("import_job_id", importJobId)
    .in("status", ["pending", "failed"])
    .order("chunk_index", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!candidate) {
    return null;
  }

  const { data: claimed, error: claimError } = await admin
    .from("ai_import_chunks")
    .update({ status: "processing", error_message: null })
    .eq("id", candidate.id)
    .eq("import_job_id", importJobId)
    .in("status", ["pending", "failed"])
    .select("*")
    .maybeSingle();

  if (claimError) {
    throw claimError;
  }

  return claimed || null;
}

async function processNextChunk(job) {
  const admin = createAdminClient();
  await resetStaleProcessingChunks(job.id);
  const chunk = await claimNextChunk(job.id);

  if (!chunk) {
    if (await hasProcessingChunks(job.id)) {
      await updateImportJob(job.id, {
        status: "processing",
        error_message: null
      });
      return true;
    }

    const matched = await processParsedAnswerKeys(job);
    if (matched > 0) {
      await refreshJobCounts(job.id);
      return true;
    }

    const refreshed = await refreshJobCounts(job.id);
    const finalStatus =
      refreshed.total_questions === 0
        ? "needs_review"
        : refreshed.needs_review_count > 0 || refreshed.questions_missing_answers > 0
          ? "ready_for_preview"
          : "ready_for_preview";
    await updateImportJob(job.id, {
      status: finalStatus,
      error_message:
        refreshed.total_questions === 0
          ? "Nu am gasit intrebari clare in material."
          : null,
      metadata: {
        ...(refreshed.metadata || {}),
        duplicateSetDetected: false,
        duplicateSetWarning: null
      }
    });
    await refreshDuplicateLicentaSetWarning({
      ...refreshed,
      status: finalStatus,
      error_message:
        refreshed.total_questions === 0
          ? "Nu am gasit intrebari clare in material."
          : null,
      metadata: {
        ...(refreshed.metadata || {}),
        duplicateSetDetected: false,
        duplicateSetWarning: null
      }
    });
    return false;
  }

  try {
    if (job.mode === "set" && chunk.metadata?.singlePassSet) {
      const extraction = await extractSetFromChunk({ job, chunk });
      const savedQuestions = await insertExtractedQuestions({ job, chunk, extraction });
      let savedAnswerKeys = 0;
      const candidate = await insertAnswerKeyCandidate({
        job,
        chunk,
        extraction: {
          answerKeys: extraction.answerKeys || [],
          answerKeyFormat: extraction.answerKeyFormat || null,
          warnings: extraction.warnings || []
        }
      });

      if (candidate) {
        savedAnswerKeys = extraction.answerKeys?.length || 0;
        await matchAnswerKeyCandidate(job, candidate);
      }

      await admin
        .from("ai_import_chunks")
        .update({
          status: "processed",
          classification: "mixed",
          metadata: {
            ...(chunk.metadata || {}),
            savedQuestions,
            savedAnswerKeys,
            warnings: extraction.warnings || []
          }
        })
        .eq("id", chunk.id);

      await refreshJobCounts(job.id);
      return true;
    }

    const classification =
      chunk.classification && chunk.classification !== "unknown"
        ? {
            classification: chunk.classification,
            confidence: 1,
            detectedQuestionCount: 0,
            detectedAnswerKeyCount: 0,
            notes: []
          }
        : await classifyChunk({ job, chunk });

    let savedQuestions = 0;
    let savedAnswerKeys = 0;
    if (classification.classification === "questions" || classification.classification === "mixed") {
      const extraction = await extractQuestionsFromChunk({ job, chunk });
      savedQuestions = await insertExtractedQuestions({ job, chunk, extraction });
    }

    if (classification.classification === "answer_key" || classification.classification === "mixed") {
      const extraction = await extractAnswerKeyFromChunk({ job, chunk });
      const candidate = await insertAnswerKeyCandidate({ job, chunk, extraction });
      if (candidate) {
        savedAnswerKeys = extraction.answerKeys?.length || 0;
        await matchAnswerKeyCandidate(job, candidate);
      }
    }

    await admin
      .from("ai_import_chunks")
      .update({
        status: "processed",
        classification: classification.classification,
        metadata: {
          ...(chunk.metadata || {}),
          classification,
          savedQuestions,
          savedAnswerKeys
        }
      })
      .eq("id", chunk.id);

    await refreshJobCounts(job.id);
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "import_chunk_failed";
    await admin
      .from("ai_import_chunks")
      .update({
        status: "failed",
        error_message: message
      })
      .eq("id", chunk.id);

    const refreshed = await refreshJobCounts(job.id);
    if (Number(refreshed.total_questions || 0) > 0) {
      await updateImportJob(job.id, {
        status: "ready_for_preview",
        error_message: null,
        metadata: {
          ...(refreshed.metadata || {}),
          recoveredFromChunkErrorAt: new Date().toISOString(),
          recoveredFromChunkErrorMessage: message,
          recoveredFromChunkIndex: chunk.chunk_index
        }
      });
      return false;
    }

    await updateImportJob(job.id, {
      status: "failed",
      error_message: "O parte din material nu a putut fi procesata.",
      metadata: {
        ...(job.metadata || {}),
        lastChunkErrorAt: new Date().toISOString(),
        lastChunkErrorMessage: message,
        lastChunkErrorIndex: chunk.chunk_index
      }
    });
    return false;
  }
}

export async function createAutoImportJob({
  userId,
  sourceDocumentId,
  sourceType,
  fileName,
  academicContext,
  metadata = {}
}) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_import_jobs")
    .insert({
      user_id: userId,
      source_document_id: sourceDocumentId,
      mode: "auto",
      source_type: sourceType,
      file_name: fileName || null,
      title: DEFAULT_TITLE,
      status: "uploaded",
      metadata: {
        examType: "licenta",
        subjectLabel: LICENTA_GENERAL_LABEL,
        visibilityScope: "cohort",
        targetCohortId: academicContext?.membership?.cohort_id || null,
        targetUnitId: academicContext?.membership?.program_unit_id || null,
        targetInstitutionId: academicContext?.membership?.institution_id || null,
        ...metadata
      }
    })
    .select("*")
    .single();

  if (error) {
    throw error;
  }

  return buildPublicStatus(data);
}

export async function createSetImportJob({
  userId,
  licentaSessionId = null,
  title,
  contentText = "",
  questionsText,
  answerKeyText = "",
  academicContext,
  metadata = {}
}) {
  const admin = createAdminClient();
  const cleanedContent = cleanupText(contentText);
  const cleanedQuestions = cleanupText(questionsText);
  const cleanedAnswerKey = cleanupText(answerKeyText);
  if (cleanedContent.length < 20 && cleanedQuestions.length < 20) {
    throw new Error("Adauga continutul setului sau incarca un fisier cu intrebari si raspunsuri.");
  }

  const session = await getOrCreateActiveLicentaSession({
    userId,
    academicContext,
    sessionId: licentaSessionId
  });
  await assertLicentaSessionCanAcceptNextSet(session.id);
  const setIndex = await getNextLicentaSetIndex(session.id);
  const setTitle = cleanupText(title) || `Set ${setIndex}`;
  const sessionMetadata = session.metadata || {};

  const { data: job, error } = await admin
    .from("ai_import_jobs")
    .insert({
      user_id: userId,
      licenta_session_id: session.id,
      set_index: setIndex,
      mode: "set",
      source_type: "paste",
      file_name: null,
      title: setTitle,
      status: "processing",
      metadata: {
        examType: "licenta",
        subjectLabel: LICENTA_GENERAL_LABEL,
        visibilityScope: sessionMetadata.visibilityScope || "cohort",
        targetCohortId: sessionMetadata.targetCohortId || academicContext?.membership?.cohort_id || null,
        targetUnitId: sessionMetadata.targetUnitId || academicContext?.membership?.program_unit_id || null,
        targetInstitutionId:
          sessionMetadata.targetInstitutionId || academicContext?.membership?.institution_id || null,
        licentaSessionId: session.id,
        setIndex,
        ...metadata
      }
    })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const existingJob = await getLicentaSetJobByIndex(session.id, userId, setIndex);
      if (existingJob) {
        return buildPublicStatus(existingJob);
      }
    }
    throw error;
  }

  const { error: setError } = await admin.from("ai_import_question_sets").insert({
    import_job_id: job.id,
    user_id: userId,
    title: setTitle,
    source_label: `Set ${setIndex}`,
    status: "extracting"
  });

  if (setError) {
    throw setError;
  }

  const combinedSetText = cleanupText([cleanedContent, cleanedQuestions, cleanedAnswerKey].filter(Boolean).join("\n\n"));
  const useSinglePassSet = shouldUseSinglePassSet(combinedSetText);
  const questionChunks = !useSinglePassSet && cleanedQuestions ? buildTextChunks(cleanedQuestions, "questions") : [];
  const answerKeyChunks = !useSinglePassSet && cleanedAnswerKey ? buildTextChunks(cleanedAnswerKey, "answer_key") : [];
  const unifiedChunks = !useSinglePassSet && cleanedContent ? buildTextChunks(cleanedContent, null) : [];
  const chunks = unifiedChunks.length
    ? unifiedChunks
    : useSinglePassSet
      ? [
          {
            chunk_index: 0,
            raw_text: combinedSetText,
            classification: "mixed",
            metadata: {
              singlePassSet: true,
              estimatedBlockCount: splitQuestionBlocks(combinedSetText).length,
              sourceStart: 0,
              sourceEnd: Math.max(splitQuestionBlocks(combinedSetText).length - 1, 0)
            }
          }
        ]
      : [
        ...questionChunks,
        ...answerKeyChunks.map((chunk, index) => ({
          ...chunk,
          chunk_index: index + questionChunks.length
        }))
      ];

  if (!chunks.length) {
    throw new Error("Nu am putut pregati continutul setului.");
  }

  const { error: chunksError } = await admin.from("ai_import_chunks").insert(
    chunks.map((chunk) => ({
      import_job_id: job.id,
      user_id: userId,
      chunk_index: chunk.chunk_index,
      raw_text: chunk.raw_text,
      classification: chunk.classification,
      status: "pending",
      metadata: chunk.metadata
    }))
  );

  if (chunksError) {
    throw chunksError;
  }

  const updated = await updateImportJob(job.id, {
    total_chunks: chunks.length,
    processed_chunks: 0,
    status: "processing",
    metadata: {
      ...(job.metadata || {}),
      setProcessingMode: useSinglePassSet ? "single_pass" : "chunked",
      setCharacterCount: combinedSetText.length
    }
  });

  await refreshLicentaSessionCounts(session.id);

  return buildPublicStatus(updated);
}

export async function processImportJob({ importJobId, userId }) {
  let job = await fetchImportJob(importJobId, userId);

  if (job.status === "failed" && Number(job.total_questions || 0) > 0) {
    const recovered = await recoverFailedImportWithExtractedQuestions(job);
    return buildPublicStatus(recovered);
  }

  if (["completed", "completed_with_warnings", "ready_for_preview", "needs_review"].includes(job.status)) {
    return getImportStatus({ importJobId, userId });
  }

  try {
    if (job.status === "uploaded" || job.status === "extracting" || job.status === "chunking") {
      job = await initializeAutoChunks(job);
    }

    if (job.status === "processing" || job.status === "matching_answers" || job.status === "failed") {
      if (job.status === "failed") {
        const { error } = await createAdminClient()
          .from("ai_import_chunks")
          .update({ status: "pending", error_message: null })
          .eq("import_job_id", job.id)
          .eq("status", "failed");
        if (error) {
          throw error;
        }
        job = await updateImportJob(job.id, { status: "processing", error_message: null });
      }
      await processNextChunk(job);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message.slice(0, 1000) : "import_failed";
    const refreshed = await refreshJobCounts(importJobId);
    if (Number(refreshed.total_questions || 0) > 0) {
      await updateImportJob(importJobId, {
        status: "ready_for_preview",
        error_message: null,
        metadata: {
          ...(refreshed.metadata || {}),
          recoveredFromProcessErrorAt: new Date().toISOString(),
          recoveredFromProcessErrorMessage: message
        }
      });
    } else {
      await updateImportJob(importJobId, {
        status: message.toLowerCase().includes("pdf-ul pare scanat") ? "needs_review" : "failed",
        error_message: message,
        completed_at: new Date().toISOString()
      });
    }
  }

  const status = await getImportStatus({ importJobId, userId });
  if (status.licentaSessionId) {
    await refreshLicentaSessionCounts(status.licentaSessionId);
  }
  return status;
}

export async function getImportStatus({ importJobId, userId }) {
  let job = await fetchImportJob(importJobId, userId);
  if (job.status === "failed" && Number(job.total_questions || 0) > 0) {
    job = await recoverFailedImportWithExtractedQuestions(job);
  }
  return buildPublicStatus(job);
}

export async function getUserImportJobs(userId, limit = 8) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_import_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map(mapImportJobForUi);
}

export async function getImportJobMonitor(userId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_import_jobs")
    .select("*")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(IMPORT_MONITOR_HISTORY_LIMIT);

  if (error) {
    throw error;
  }

  const terminalCutoff = Date.now() - IMPORT_MONITOR_TERMINAL_WINDOW_MS;
  const jobs = data || [];
  const activeJobs = jobs.filter((job) => IMPORT_ACTIVE_STATUSES.has(job.status)).map(mapImportJobForUi);
  const terminalRows = jobs.filter((job) => {
    if (!IMPORT_TERMINAL_STATUSES.has(job.status)) {
      return false;
    }

    const finishedAt = parseTimestamp(job.completed_at || job.updated_at || job.created_at);
    return finishedAt !== null && finishedAt >= terminalCutoff;
  });

  return {
    activeJobs,
    terminalJob: terminalRows[0] ? mapImportJobForUi(terminalRows[0]) : null,
    generatedAt: new Date().toISOString()
  };
}

async function hydratePreviewQuestions(questions) {
  const admin = createAdminClient();
  const questionIds = questions.map((question) => question.id);
  if (!questionIds.length) {
    return [];
  }

  const { data: options, error } = await admin
    .from("ai_import_answer_options")
    .select("question_id, label, text, is_correct")
    .in("question_id", questionIds)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const byQuestion = new Map();
  for (const option of options || []) {
    const list = byQuestion.get(option.question_id) || [];
    list.push({
      label: option.label,
      text: option.text,
      isCorrect: option.is_correct
    });
    byQuestion.set(option.question_id, list);
  }

  return questions.map((question) => ({
    id: question.id,
    localNumber: question.local_number,
    globalIndex: question.global_index,
    questionText: question.question_text,
    status: question.status,
    confidence: question.confidence,
    options: sortAnswerOptions(byQuestion.get(question.id) || [])
  }));
}

function normalizeImportQuestionStatusFilter(status) {
  if (status === "answer_matched" || status === "missing_answer" || status === "needs_review") {
    return status;
  }

  return "all";
}

function normalizeQuestionSearch(value) {
  return cleanupText(value).slice(0, 120);
}

function normalizeOptionLabel(value, index) {
  const cleaned = String(value || "").trim();
  if (cleaned) {
    return cleaned.slice(0, 8);
  }

  return String.fromCharCode(97 + index);
}

function normalizeImportQuestionOptions(options) {
  const sortedOptions = sortAnswerOptions(
    (Array.isArray(options) ? options : []).map((option, index) => ({
      label: normalizeOptionLabel(option?.label, index),
      text: cleanupText(option?.text),
      _originalIndex: index
    }))
  )
    .filter((option) => option.text)
    .map(({ _originalIndex, ...option }) => option);
  const shouldRelabel = hasDuplicateLabels(sortedOptions);

  return sortedOptions.map((option, index) => ({
    ...option,
    label: shouldRelabel ? expectedOptionLabel(index) : option.label
  }));
}

async function markDuplicateOptionLabelQuestionsForReview(importJobId) {
  const admin = createAdminClient();
  const { data: questions, error: questionsError } = await admin
    .from("ai_import_questions")
    .select("id, status, metadata")
    .eq("import_job_id", importJobId)
    .neq("status", "needs_review");

  if (questionsError) {
    throw questionsError;
  }

  if (!questions?.length) {
    return 0;
  }

  const questionIds = questions.map((question) => question.id);
  const { data: options, error: optionsError } = await admin
    .from("ai_import_answer_options")
    .select("question_id, label")
    .in("question_id", questionIds);

  if (optionsError) {
    throw optionsError;
  }

  const optionsByQuestion = new Map();
  for (const option of options || []) {
    const list = optionsByQuestion.get(option.question_id) || [];
    list.push(option);
    optionsByQuestion.set(option.question_id, list);
  }

  let marked = 0;
  const now = new Date().toISOString();
  for (const question of questions) {
    if (!hasDuplicateLabels(optionsByQuestion.get(question.id) || [])) {
      continue;
    }

    const { error } = await admin
      .from("ai_import_questions")
      .update({
        status: "needs_review",
        metadata: {
          ...(question.metadata || {}),
          duplicateOptionLabelsDetected: true,
          duplicateOptionLabelsDetectedAt: now,
          reviewReason: "Litere duplicate la variantele de raspuns."
        }
      })
      .eq("id", question.id);

    if (error) {
      throw error;
    }

    marked += 1;
  }

  if (marked > 0) {
    const { data: job, error: jobError } = await admin
      .from("ai_import_jobs")
      .select("id, status, metadata")
      .eq("id", importJobId)
      .maybeSingle();

    if (jobError) {
      throw jobError;
    }

    if (job?.status === "completed") {
      const { error: updateJobError } = await admin
        .from("ai_import_jobs")
        .update({
          status: "completed_with_warnings",
          metadata: {
            ...(job.metadata || {}),
            reopenedForReviewAt: now,
            reopenedForReviewReason: "duplicate_option_labels"
          }
        })
        .eq("id", importJobId);

      if (updateJobError) {
        throw updateJobError;
      }
    }
  }

  return marked;
}

async function assertOwnedImportQuestion({ importJobId, questionId, userId }) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_import_questions")
    .select("id, import_job_id, user_id, local_number, global_index, question_text, status, metadata")
    .eq("id", questionId)
    .eq("import_job_id", importJobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!data) {
    throw new Error("Intrebarea nu exista in acest import.");
  }

  return data;
}

function normalizeImportEditorOptions(options) {
  const normalizedOptions = (Array.isArray(options) ? options : [])
    .map((option, index) => ({
      label: normalizeOptionLabel(option?.label, index),
      text: cleanupText(option?.text)
    }))
    .filter((option) => option.text);

  const seenLabels = new Set();
  for (const option of normalizedOptions) {
    const normalizedLabel = normalizeLabel(option.label);
    if (!normalizedLabel) {
      throw new Error("Fiecare varianta trebuie sa aiba o litera.");
    }
    if (seenLabels.has(normalizedLabel)) {
      throw new Error(`Litera "${option.label}" apare de mai multe ori. Corecteaza literele variantelor inainte de salvare.`);
    }
    seenLabels.add(normalizedLabel);
  }

  if (normalizedOptions.length < 4 || normalizedOptions.length > 5) {
    throw new Error("Pastreaza 4 sau 5 variante de raspuns.");
  }

  return normalizedOptions;
}

export async function getImportQuestions({ importJobId, userId, status = "all", page = 1, pageSize = IMPORT_QUESTIONS_PAGE_SIZE, query: searchQuery = "" }) {
  const admin = createAdminClient();
  let job = await fetchImportJob(importJobId, userId);
  if (job.status === "failed" && Number(job.total_questions || 0) > 0) {
    job = await recoverFailedImportWithExtractedQuestions(job);
  }
  const markedForReview = await markDuplicateOptionLabelQuestionsForReview(importJobId);
  if (markedForReview > 0) {
    job = await fetchImportJob(importJobId, userId);
  }
  job = applyImportJobCounts(job, await readImportJobCounts(importJobId));
  const statusFilter = normalizeImportQuestionStatusFilter(status);
  const search = normalizeQuestionSearch(searchQuery);
  const resolvedPage = Math.max(1, Number(page || 1) || 1);
  const resolvedPageSize = Math.max(5, Math.min(50, Number(pageSize || IMPORT_QUESTIONS_PAGE_SIZE) || IMPORT_QUESTIONS_PAGE_SIZE));
  const from = (resolvedPage - 1) * resolvedPageSize;
  const to = from + resolvedPageSize - 1;

  let questionsQuery = admin
    .from("ai_import_questions")
    .select("id, local_number, global_index, question_text, status, confidence, source_page, source_chunk_index", {
      count: "exact"
    })
    .eq("import_job_id", importJobId)
    .order("global_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (statusFilter !== "all") {
    questionsQuery = questionsQuery.eq("status", statusFilter);
  }

  if (search) {
    const exactNumber = /^\d+$/.test(search) ? Number(search) : null;
    if (Number.isInteger(exactNumber) && exactNumber > 0) {
      questionsQuery = questionsQuery.or(`global_index.eq.${exactNumber},local_number.eq.${search}`);
    } else {
      questionsQuery = questionsQuery.ilike("question_text", `%${search.replace(/[%_]/g, "\\$&")}%`);
    }
  }

  questionsQuery = questionsQuery.range(from, to);

  const { data, error, count } = await questionsQuery;
  if (error) {
    throw error;
  }

  const items = await hydratePreviewQuestions(data || []);
  return {
    status: buildPublicStatus(job),
    filter: statusFilter,
    page: resolvedPage,
    pageSize: resolvedPageSize,
    total: count || 0,
    hasMore: from + items.length < (count || 0),
    items
  };
}

function assertImportJobQuestionsEditable(job) {
  const editableStatuses = new Set(["ready_for_preview", "needs_review", "completed_with_warnings"]);
  const failedWithExtractedQuestions = job.status === "failed" && Number(job.total_questions || 0) > 0;
  if (job.result_bank_id || (!editableStatuses.has(job.status) && !failedWithExtractedQuestions)) {
    throw new Error("Setul este deja salvat sau nu mai poate fi editat aici.");
  }
}

async function refreshImportJobAfterQuestionChange({ importJobId, userId }) {
  try {
    let refreshed = await refreshDuplicateLicentaSetWarning(await refreshJobCounts(importJobId));
    if (
      Number(refreshed.questions_missing_answers || 0) === 0 &&
      Number(refreshed.needs_review_count || 0) === 0 &&
      ["needs_review", "completed_with_warnings"].includes(refreshed.status) &&
      !refreshed.result_bank_id
    ) {
      refreshed = await updateImportJob(importJobId, {
        status: "ready_for_preview",
        error_message: null,
        metadata: {
          ...(refreshed.metadata || {}),
          reviewClearedAt: new Date().toISOString()
        }
      });
    }
    return refreshed;
  } catch (error) {
    console.error("import_question_post_save_refresh_failed", {
      importJobId,
      message: error instanceof Error ? error.message : String(error)
    });
    return applyImportJobCounts(await fetchImportJob(importJobId, userId), await readImportJobCounts(importJobId));
  }
}

export async function updateImportQuestion({ importJobId, questionId, userId, questionText, options, correctOptionIndex, markReviewed = false }) {
  const admin = createAdminClient();
  const job = await fetchImportJob(importJobId, userId);
  assertImportJobQuestionsEditable(job);
  const currentQuestion = await assertOwnedImportQuestion({ importJobId, questionId, userId });

  const cleanedQuestion = cleanupText(questionText);
  if (cleanedQuestion.length < 10) {
    throw new Error("Intrebarea trebuie sa aiba cel putin 10 caractere.");
  }

  const normalizedOptions = normalizeImportEditorOptions(options);

  const parsedCorrectIndex =
    correctOptionIndex === null || correctOptionIndex === undefined || correctOptionIndex === ""
      ? null
      : Number(correctOptionIndex);
  const hasValidCorrectIndex =
    Number.isInteger(parsedCorrectIndex) &&
    parsedCorrectIndex >= 0 &&
    parsedCorrectIndex < normalizedOptions.length;
  const nextStatus = hasValidCorrectIndex
    ? currentQuestion.status === "needs_review" && !markReviewed
      ? "needs_review"
      : "answer_matched"
    : currentQuestion.status === "needs_review"
      ? "needs_review"
      : "missing_answer";

  const { error: questionError } = await admin
    .from("ai_import_questions")
    .update({
      question_text: cleanedQuestion,
      status: nextStatus,
      confidence: hasValidCorrectIndex ? 1 : null,
      metadata: {
        ...(currentQuestion.metadata || {}),
        editedManually: true,
        editedAt: new Date().toISOString(),
        markedReviewed: Boolean(markReviewed)
      }
    })
    .eq("id", questionId)
    .eq("import_job_id", importJobId)
    .eq("user_id", userId);

  if (questionError) {
    throw questionError;
  }

  const { error: deleteOptionsError } = await admin
    .from("ai_import_answer_options")
    .delete()
    .eq("question_id", questionId)
    .eq("import_job_id", importJobId)
    .eq("user_id", userId);

  if (deleteOptionsError) {
    throw deleteOptionsError;
  }

  const { error: insertOptionsError } = await admin.from("ai_import_answer_options").insert(
    normalizedOptions.map((option, index) => ({
      question_id: questionId,
      import_job_id: importJobId,
      user_id: userId,
      label: option.label,
      text: option.text,
      is_correct: hasValidCorrectIndex && index === parsedCorrectIndex
    }))
  );

  if (insertOptionsError) {
    throw insertOptionsError;
  }

  const refreshed = await refreshImportJobAfterQuestionChange({ importJobId, userId });
  const hydrated = await hydratePreviewQuestions([
    {
      id: questionId,
      local_number: currentQuestion.local_number,
      global_index: currentQuestion.global_index,
      question_text: cleanedQuestion,
      status: nextStatus,
      confidence: hasValidCorrectIndex ? 1 : null
    }
  ]);

  return {
    ok: true,
    status: buildPublicStatus(refreshed),
    question: hydrated[0] || null,
    message: "Intrebarea a fost salvata."
  };
}

export async function createImportQuestion({ importJobId, userId, questionText, options, correctOptionIndex, markReviewed = true }) {
  const admin = createAdminClient();
  const job = await fetchImportJob(importJobId, userId);
  assertImportJobQuestionsEditable(job);

  const cleanedQuestion = cleanupText(questionText);
  if (cleanedQuestion.length < 10) {
    throw new Error("Intrebarea trebuie sa aiba cel putin 10 caractere.");
  }

  const normalizedOptions = normalizeImportEditorOptions(options);
  const parsedCorrectIndex =
    correctOptionIndex === null || correctOptionIndex === undefined || correctOptionIndex === ""
      ? null
      : Number(correctOptionIndex);
  const hasValidCorrectIndex =
    Number.isInteger(parsedCorrectIndex) &&
    parsedCorrectIndex >= 0 &&
    parsedCorrectIndex < normalizedOptions.length;

  const { data: latestQuestion, error: latestError } = await admin
    .from("ai_import_questions")
    .select("global_index")
    .eq("import_job_id", importJobId)
    .order("global_index", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (latestError) {
    throw latestError;
  }

  const nextIndex = Number(latestQuestion?.global_index || 0) + 1;
  const { data: question, error: questionError } = await admin
    .from("ai_import_questions")
    .insert({
      import_job_id: importJobId,
      user_id: userId,
      local_number: String(nextIndex),
      global_index: nextIndex,
      question_text: cleanedQuestion,
      status: hasValidCorrectIndex && markReviewed ? "answer_matched" : "needs_review",
      confidence: hasValidCorrectIndex ? 1 : null,
      metadata: {
        addedManually: true,
        addedAt: new Date().toISOString(),
        markedReviewed: Boolean(markReviewed)
      }
    })
    .select("*")
    .single();

  if (questionError) {
    throw questionError;
  }

  const { error: insertOptionsError } = await admin.from("ai_import_answer_options").insert(
    normalizedOptions.map((option, index) => ({
      question_id: question.id,
      import_job_id: importJobId,
      user_id: userId,
      label: option.label,
      text: option.text,
      is_correct: hasValidCorrectIndex && index === parsedCorrectIndex
    }))
  );

  if (insertOptionsError) {
    throw insertOptionsError;
  }

  const refreshed = await refreshImportJobAfterQuestionChange({ importJobId, userId });
  const hydrated = await hydratePreviewQuestions([question]);

  return {
    ok: true,
    status: buildPublicStatus(refreshed),
    question: hydrated[0] || null,
    message: "Intrebarea a fost adaugata."
  };
}

export async function deleteImportQuestion({ importJobId, questionId, userId }) {
  const admin = createAdminClient();
  const job = await fetchImportJob(importJobId, userId);
  assertImportJobQuestionsEditable(job);
  await assertOwnedImportQuestion({ importJobId, questionId, userId });

  const { error } = await admin
    .from("ai_import_questions")
    .delete()
    .eq("id", questionId)
    .eq("import_job_id", importJobId)
    .eq("user_id", userId);

  if (error) {
    throw error;
  }

  const refreshed = await refreshDuplicateLicentaSetWarning(await refreshJobCounts(importJobId));
  return {
    ok: true,
    status: buildPublicStatus(refreshed),
    message: "Intrebarea a fost eliminata din import."
  };
}

export async function applySupplementalAnswerKey({ importJobId, userId, answerKeyText }) {
  let job = await fetchImportJob(importJobId, userId);
  if (job.status === "failed" && Number(job.total_questions || 0) > 0) {
    job = await recoverFailedImportWithExtractedQuestions(job);
  }
  assertImportJobQuestionsEditable(job);

  const cleanedAnswerKey = cleanupText(answerKeyText);
  if (cleanedAnswerKey.length < 3) {
    throw new Error("Lipeste lista de raspunsuri inainte sa o potrivesti cu intrebarile.");
  }

  job = await refreshJobCounts(importJobId);
  if (Number(job.total_questions || 0) < 1) {
    throw new Error("Nu exista intrebari extrase pentru acest set.");
  }

  const extraction = await extractAnswerKeyFromChunk({
    job,
    chunk: {
      chunk_index: null,
      raw_text: cleanedAnswerKey
    }
  });
  const candidate = await insertAnswerKeyCandidate({
    job,
    chunk: {
      chunk_index: null,
      raw_text: cleanedAnswerKey
    },
    extraction
  });

  if (!candidate) {
    throw new Error("Nu am gasit o lista clara de raspunsuri in textul trimis.");
  }

  await updateImportJob(job.id, {
    status: "matching_answers",
    error_message: null,
    metadata: {
      ...(job.metadata || {}),
      supplementalAnswerKeySubmittedAt: new Date().toISOString()
    }
  });

  const applied = await matchAnswerKeyCandidate(job, candidate);
  const refreshed = await refreshDuplicateLicentaSetWarning(await refreshJobCounts(importJobId));
  const updated = await updateImportJob(job.id, {
    status: "ready_for_preview",
    error_message: null,
    metadata: {
      ...(refreshed.metadata || {}),
      supplementalAnswerKeyLastAppliedAt: new Date().toISOString(),
      supplementalAnswerKeyAppliedCount: applied
    }
  });

  return {
    ok: true,
    status: buildPublicStatus(updated),
    applied,
    message: applied
      ? `Am potrivit ${applied} raspunsuri cu intrebarile extrase.`
      : "Nu am putut potrivi sigur raspunsurile. Verifica manual intrebarile ramase fara raspuns."
  };
}

export async function getImportPreview({ importJobId, userId }) {
  const admin = createAdminClient();
  let job = await fetchImportJob(importJobId, userId);
  if (job.status === "failed" && Number(job.total_questions || 0) > 0) {
    job = await recoverFailedImportWithExtractedQuestions(job);
  }
  const markedForReview = await markDuplicateOptionLabelQuestionsForReview(importJobId);
  if (markedForReview > 0) {
    job = await fetchImportJob(importJobId, userId);
  }
  job = applyImportJobCounts(job, await readImportJobCounts(importJobId));

  const { data: firstRows, error: firstError } = await admin
    .from("ai_import_questions")
    .select("id, local_number, global_index, question_text, status, confidence")
    .eq("import_job_id", importJobId)
    .order("global_index", { ascending: true })
    .limit(5);

  if (firstError) {
    throw firstError;
  }

  const { data: lastRows, error: lastError } = await admin
    .from("ai_import_questions")
    .select("id, local_number, global_index, question_text, status, confidence")
    .eq("import_job_id", importJobId)
    .order("global_index", { ascending: false })
    .limit(5);

  if (lastError) {
    throw lastError;
  }

  const first = await hydratePreviewQuestions(firstRows || []);
  const last = await hydratePreviewQuestions([...(lastRows || [])].reverse());
  const warnings = [];
  if (job.metadata?.setFileWarning) {
    warnings.push(job.metadata.setFileWarning);
  }
  const duplicateSetWarningMessage =
    job.metadata?.duplicateSetWarning?.message || getDuplicateSetWarningMessage(job.metadata?.duplicateSetWarning);
  if (duplicateSetWarningMessage) {
    warnings.push(duplicateSetWarningMessage);
  }
  if (job.questions_missing_answers > 0) {
    warnings.push(`${job.questions_missing_answers} intrebari nu au inca raspuns corect.`);
  }
  if (job.needs_review_count > 0) {
    warnings.push(`${job.needs_review_count} intrebari necesita verificare.`);
  }
  if (job.questions_missing_answers + job.needs_review_count > Math.max(10, job.total_questions * 0.2)) {
    warnings.push(
      job.mode === "set"
        ? "O parte dintre raspunsuri nu a fost potrivita automat. Verifica sau completeaza raspunsurile lipsa."
        : "Fisierul pare greu de interpretat automat. Pentru rezultate mai bune, foloseste Import pe seturi."
    );
  }

  return {
    status: buildPublicStatus(job),
    counts: {
      totalQuestions: job.total_questions,
      questionsWithAnswers: job.questions_with_answers,
      questionsMissingAnswers: job.questions_missing_answers,
      needsReviewCount: job.needs_review_count
    },
    first,
    last,
    warnings
  };
}

async function consumeImportCreditIfNeeded(job) {
  if (job.metadata?.creditConsumedAt) {
    return;
  }

  const admin = createAdminClient();
  const { data: balance, error: balanceError } = await admin.rpc("get_ai_credit_balance", {
    target_user_id: job.user_id
  });

  if (balanceError) {
    throw balanceError;
  }

  if (Number(balance || 0) < 1) {
    throw new Error("Nu ai incarcari disponibile pentru salvarea importului.");
  }

  const { error: ledgerError } = await admin.from("ai_credit_ledger").insert({
    user_id: job.user_id,
    source: "generation",
    reason: "generation_consume",
    delta: -1,
    metadata: {
      importJobId: job.id,
      mode: job.mode
    }
  });

  if (ledgerError) {
    throw ledgerError;
  }

  await updateImportJob(job.id, {
    metadata: {
      ...(job.metadata || {}),
      creditConsumedAt: new Date().toISOString()
    }
  });
}

async function markImportQuestionNeedsReview({ admin, question, job, reason }) {
  const { error } = await admin
    .from("ai_import_questions")
    .update({
      status: "needs_review",
      metadata: {
        ...(question.metadata || {}),
        finalizationReviewReason: reason,
        finalizationReviewMarkedAt: new Date().toISOString()
      }
    })
    .eq("id", question.id);

  if (error) {
    throw error;
  }

  await refreshJobCounts(question.import_job_id);
  if (job?.licenta_session_id) {
    await refreshLicentaSessionCounts(job.licenta_session_id);
  }
}

async function updateImportOptionIfChanged({ admin, option, label, isCorrect }) {
  if (option.label === label && Boolean(option.is_correct) === Boolean(isCorrect)) {
    return;
  }

  const { error } = await admin
    .from("ai_import_answer_options")
    .update({
      label,
      is_correct: Boolean(isCorrect)
    })
    .eq("id", option.id);

  if (error) {
    throw error;
  }
}

async function normalizeImportQuestionOptionsForFinalization({ admin, question, job, options }) {
  const sortedOptions = sortAnswerOptions(
    (options || []).map((option, index) => ({
      ...option,
      label: normalizeLabel(option.label || expectedOptionLabel(index)) || expectedOptionLabel(index),
      text: cleanupText(option.text),
      _originalIndex: index
    }))
  ).filter((option) => option.text);

  if (sortedOptions.length < 4 || sortedOptions.length > 5) {
    const reason = "intrebarea nu are intre 4 si 5 variante valide";
    await markImportQuestionNeedsReview({ admin, question, job, reason });
    return { options: sortedOptions, correctIndex: -1, needsReview: true, reviewReason: reason };
  }

  const duplicateLabels = hasDuplicateLabels(sortedOptions);
  const correctIndexes = sortedOptions
    .map((option, index) => (option.is_correct ? index : -1))
    .filter((index) => index >= 0);

  if (!correctIndexes.length || (correctIndexes.length > 1 && !duplicateLabels)) {
    const reason = !correctIndexes.length
      ? "nu exista un raspuns corect marcat"
      : "sunt marcate mai multe raspunsuri corecte";
    await markImportQuestionNeedsReview({ admin, question, job, reason });
    return { options: sortedOptions, correctIndex: -1, needsReview: true, reviewReason: reason };
  }

  const correctIndex = correctIndexes[0];
  const normalizedOptions = sortedOptions.map((option, index) => ({
    ...option,
    label: duplicateLabels ? expectedOptionLabel(index) : option.label,
    is_correct: index === correctIndex
  }));

  if (duplicateLabels || correctIndexes.length > 1) {
    for (const option of normalizedOptions) {
      await updateImportOptionIfChanged({
        admin,
        option,
        label: option.label,
        isCorrect: option.is_correct
      });
    }
  }

  return {
    options: normalizedOptions,
    correctIndex,
    needsReview: false,
    reviewReason: null
  };
}

async function collectAcceptedImportItems(jobs) {
  const admin = createAdminClient();
  const jobList = Array.isArray(jobs) ? jobs.filter(Boolean) : [jobs].filter(Boolean);
  const jobIds = jobList.map((job) => job.id);

  if (!jobIds.length) {
    return [];
  }

  const { data: questions, error } = await admin
    .from("ai_import_questions")
    .select("id, import_job_id, global_index, question_text, status, metadata")
    .in("import_job_id", jobIds)
    .eq("status", "answer_matched")
    .order("import_job_id", { ascending: true })
    .order("global_index", { ascending: true });

  if (error) {
    throw error;
  }

  if (!questions?.length) {
    return [];
  }

  const options = await fetchImportAnswerOptionsForQuestions({
    admin,
    questionIds: questions.map((question) => question.id)
  });

  const jobsById = new Map(jobList.map((job) => [job.id, job]));
  const optionsByQuestion = new Map();
  for (const option of options) {
    const list = optionsByQuestion.get(option.question_id) || [];
    list.push(option);
    optionsByQuestion.set(option.question_id, list);
  }

  const items = [];
  for (const question of questions) {
    const job = jobsById.get(question.import_job_id);
    const { options, correctIndex, needsReview, reviewReason } = await normalizeImportQuestionOptionsForFinalization({
      admin,
      question,
      job,
      options: optionsByQuestion.get(question.id) || []
    });

    if (needsReview) {
      const setLabel = job?.set_index ? `setul ${job.set_index}` : "un set";
      const questionLabel = question.global_index ? `intrebarea ${question.global_index}` : "o intrebare";
      throw new Error(
        `Revizuieste ${setLabel}, ${questionLabel}, inainte de finalizare. Motiv: ${reviewReason || "raspunsul corect nu este suficient de clar"}.`
      );
    }

    items.push({
      question_text: question.question_text,
      answers: options.map((option) => option.text),
      correct_index: correctIndex,
      explanation: "",
      normalized_hash: buildQuestionHash(question.question_text, options.map((option) => option.text)),
      quality_status: "accepted",
      metadata: {
        importJobId: question.import_job_id,
        importQuestionId: question.id,
        licentaSessionId: job?.licenta_session_id || null,
        setIndex: job?.set_index || null
      }
    });
  }

  return items;
}

async function fetchImportAnswerOptionsForQuestions({ admin, questionIds }) {
  const rows = [];
  for (let start = 0; start < questionIds.length; start += IMPORT_ANSWER_OPTIONS_FETCH_BATCH_SIZE) {
    const batchIds = questionIds.slice(start, start + IMPORT_ANSWER_OPTIONS_FETCH_BATCH_SIZE);
    const { data, error } = await admin
      .from("ai_import_answer_options")
      .select("id, question_id, label, text, is_correct")
      .in("question_id", batchIds)
      .order("created_at", { ascending: true });

    if (error) {
      throw error;
    }

    rows.push(...(data || []));
  }

  return rows;
}

async function insertQuestionBankItemsInBatches({ admin, bankId, items }) {
  for (let start = 0; start < items.length; start += QUESTION_BANK_ITEM_INSERT_BATCH_SIZE) {
    const batch = items.slice(start, start + QUESTION_BANK_ITEM_INSERT_BATCH_SIZE);
    const { error } = await admin.from("ai_question_bank_items").insert(
      batch.map((item, index) => ({
        bank_id: bankId,
        position: start + index + 1,
        ...item
      }))
    );

    if (error) {
      throw error;
    }
  }
}

async function publishLicentaSessionBank({ admin, bankId, userId, sessionId, publishedAt }) {
  const { data: bank, error: fetchError } = await admin
    .from("ai_question_banks")
    .select("id, status, metadata")
    .eq("id", bankId)
    .eq("user_id", userId)
    .eq("exam_type", "licenta")
    .maybeSingle();

  if (fetchError) {
    throw fetchError;
  }

  if (!bank?.id) {
    throw new Error("Banca finala a licentei nu mai exista.");
  }

  if (bank.status === "published") {
    return;
  }

  const { error: updateError } = await admin
    .from("ai_question_banks")
    .update({
      status: "published",
      published_at: publishedAt,
      metadata: {
        ...(bank.metadata || {}),
        licentaSessionId: sessionId,
        autoPublishedFromLicentaSession: true,
        publishedFromLicentaSessionAt: publishedAt
      }
    })
    .eq("id", bankId)
    .eq("user_id", userId)
    .eq("exam_type", "licenta");

  if (updateError) {
    throw updateError;
  }
}

async function consumeLicentaSessionCreditIfNeeded(session) {
  if (session.credit_consumed_at) {
    return session;
  }

  const admin = createAdminClient();
  const { data: balance, error: balanceError } = await admin.rpc("get_ai_credit_balance", {
    target_user_id: session.user_id
  });

  if (balanceError) {
    throw balanceError;
  }

  if (Number(balance || 0) < 1) {
    throw new Error("Nu ai incarcari disponibile pentru finalizarea licentei.");
  }

  const consumedAt = new Date().toISOString();
  const { error: ledgerError } = await admin.from("ai_credit_ledger").insert({
    user_id: session.user_id,
    source: "generation",
    reason: "generation_consume",
    delta: -1,
    metadata: {
      licentaSessionId: session.id
    }
  });

  if (ledgerError && ledgerError.code !== "23505") {
    throw ledgerError;
  }

  const { data: updated, error: updateError } = await admin
    .from("ai_licenta_import_sessions")
    .update({ credit_consumed_at: consumedAt })
    .eq("id", session.id)
    .select("*")
    .single();

  if (updateError) {
    throw updateError;
  }

  return updated;
}

export async function confirmImportJob({ importJobId, userId }) {
  const admin = createAdminClient();
  let job = await fetchImportJob(importJobId, userId);
  if (job.status === "failed" && Number(job.total_questions || 0) > 0) {
    job = await recoverFailedImportWithExtractedQuestions(job);
  }
  if (job.status === "completed" && job.licenta_session_id) {
    return buildPublicStatus(job);
  }

  if (!["ready_for_preview", "needs_review", "completed_with_warnings"].includes(job.status)) {
    throw new Error("Importul nu este gata pentru salvare.");
  }

  await markDuplicateOptionLabelQuestionsForReview(importJobId);
  job = await refreshJobCounts(importJobId);
  if (job.total_questions < 1) {
    throw new Error("Nu exista intrebari in acest import.");
  }

  if (job.questions_missing_answers > 0 || job.needs_review_count > 0) {
    throw new Error("Corecteaza sau elimina toate intrebarile fara raspuns inainte sa salvezi importul.");
  }

  const items = await collectAcceptedImportItems(job);

  if (!items.length) {
    throw new Error("Intrebarile gasite nu au variante si raspunsuri suficient de clare pentru banca finala.");
  }

  if (job.licenta_session_id) {
    const completedAt = new Date().toISOString();
    const updated = await updateImportJob(importJobId, {
      status: "completed",
      completed_at: completedAt,
      metadata: {
        ...(job.metadata || {}),
        addedToLicentaSessionAt: completedAt
      }
    });

    await refreshLicentaSessionCounts(job.licenta_session_id);
    return buildPublicStatus(updated);
  }

  await consumeImportCreditIfNeeded(job);

  const metadata = job.metadata || {};
  const bankPayload = {
    user_id: userId,
    source_document_id: job.source_document_id || null,
    title: job.title || DEFAULT_TITLE,
    status: "review",
    processing_profile: items.length > 250 ? "large" : items.length > 80 ? "medium" : "small",
    question_count: items.length,
    exam_type: "licenta",
    subject_id: null,
    subject_name: metadata.subjectLabel || LICENTA_GENERAL_LABEL,
    visibility_scope: metadata.visibilityScope || "cohort",
    target_cohort_id: metadata.targetCohortId || null,
    target_unit_id: metadata.targetUnitId || null,
    target_institution_id: metadata.targetInstitutionId || null,
    metadata: {
      importJobId: job.id,
      source_filename: job.file_name || null,
      summary: {
        acceptedCount: items.length,
        missingAnswerCount: job.questions_missing_answers,
        needsReviewCount: job.needs_review_count
      }
    }
  };

  const { data: bank, error: bankError } = await admin
    .from("ai_question_banks")
    .insert(bankPayload)
    .select("id")
    .single();

  if (bankError) {
    throw bankError;
  }

  await insertQuestionBankItemsInBatches({ admin, bankId: bank.id, items });

  const finalStatus =
    job.questions_missing_answers > 0 || job.needs_review_count > 0
      ? "completed_with_warnings"
      : "completed";

  const updated = await updateImportJob(importJobId, {
    status: finalStatus,
    result_bank_id: bank.id,
    completed_at: new Date().toISOString()
  });

  return buildPublicStatus(updated);
}

export async function getLicentaImportSessionSnapshot({ sessionId, userId, activeImportJobId = null }) {
  const admin = createAdminClient();
  let session = await fetchLicentaSession(sessionId, userId);
  const { data: jobs, error } = await admin
    .from("ai_import_jobs")
    .select("*")
    .eq("licenta_session_id", sessionId)
    .eq("user_id", userId)
    .order("set_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  session = await refreshLicentaSessionCounts(sessionId);
  const mappedJobs = (jobs || []).map(mapImportJobForUi);
  const resultBankMap = await getLicentaResultBanksById({
    admin,
    userId,
    bankIds: [session.result_bank_id]
  });
  const resultBank = resultBankMap.get(session.result_bank_id) || null;
  const activeJob =
    mappedJobs.find((job) => job.id === activeImportJobId) ||
    mappedJobs.find((job) => IMPORT_ACTIVE_STATUSES.has(job.status)) ||
    mappedJobs.find(
      (job) =>
        job.status === "ready_for_preview" ||
        job.status === "needs_review" ||
        job.status === "completed_with_warnings"
    ) ||
    mappedJobs[mappedJobs.length - 1] ||
    null;

  return {
    session: mapLicentaSessionForUi(session, mappedJobs, resultBank),
    jobs: mappedJobs,
    activeJob
  };
}

export async function finalizeLicentaImportSession({ sessionId, userId }) {
  const admin = createAdminClient();
  let session = await fetchLicentaSession(sessionId, userId);

  if (session.status === "completed" && session.result_bank_id) {
    await publishLicentaSessionBank({
      admin,
      bankId: session.result_bank_id,
      userId,
      sessionId: session.id,
      publishedAt: session.completed_at || new Date().toISOString()
    });
    return getLicentaImportSessionSnapshot({ sessionId, userId });
  }

  const { data: jobs, error } = await admin
    .from("ai_import_jobs")
    .select("*")
    .eq("licenta_session_id", sessionId)
    .eq("user_id", userId)
    .order("set_index", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  const rows = [];
  for (const job of jobs || []) {
    await markDuplicateOptionLabelQuestionsForReview(job.id);
    rows.push(await refreshJobCounts(job.id));
  }
  const completedJobs = rows.filter((job) => job.status === "completed" || job.status === "completed_with_warnings");
  const openJobs = rows.filter(
    (job) =>
      IMPORT_ACTIVE_STATUSES.has(job.status) ||
      job.status === "ready_for_preview" ||
      job.status === "needs_review" ||
      job.status === "failed"
  );

  if (!completedJobs.length) {
    throw new Error("Nu exista seturi salvate in aceasta licenta.");
  }

  if (openJobs.length) {
    throw new Error("Finalizeaza, corecteaza sau reproceseaza seturile ramase inainte sa inchizi licenta.");
  }

  const invalidCompletedSet = completedJobs.find(
    (job) => Number(job.questions_missing_answers || 0) > 0 || Number(job.needs_review_count || 0) > 0
  );

  if (invalidCompletedSet) {
    const label = invalidCompletedSet.set_index ? `setul ${invalidCompletedSet.set_index}` : "un set";
    throw new Error(`Revizuieste ${label} inainte de finalizare. Mai exista raspunsuri lipsa sau intrebari marcate pentru verificare.`);
  }

  const items = await collectAcceptedImportItems(completedJobs);
  if (!items.length) {
    throw new Error("Nu exista intrebari valide pentru banca finala.");
  }

  const { data: existingBank, error: existingBankError } = await admin
    .from("ai_question_banks")
    .select("id, metadata")
    .eq("user_id", userId)
    .contains("metadata", { licentaSessionId: session.id })
    .maybeSingle();

  if (existingBankError) {
    throw existingBankError;
  }

  if (existingBank?.id) {
    const { error: deleteExistingItemsError } = await admin
      .from("ai_question_bank_items")
      .delete()
      .eq("bank_id", existingBank.id);

    if (deleteExistingItemsError) {
      throw deleteExistingItemsError;
    }

    await insertQuestionBankItemsInBatches({ admin, bankId: existingBank.id, items });

    const completedAt = new Date().toISOString();
    const { error: updateBankError } = await admin
      .from("ai_question_banks")
      .update({
        question_count: items.length,
        metadata: {
          ...(existingBank.metadata || {}),
          licentaSessionId: session.id,
          importJobIds: completedJobs.map((job) => job.id),
          recoveredItemsAt: new Date().toISOString()
        }
      })
      .eq("id", existingBank.id);

    if (updateBankError) {
      throw updateBankError;
    }

    await publishLicentaSessionBank({
      admin,
      bankId: existingBank.id,
      userId,
      sessionId: session.id,
      publishedAt: completedAt
    });

    const { error: updateJobsError } = await admin
      .from("ai_import_jobs")
      .update({ result_bank_id: existingBank.id })
      .eq("licenta_session_id", sessionId)
      .eq("user_id", userId)
      .in("status", ["completed", "completed_with_warnings"]);

    if (updateJobsError) {
      throw updateJobsError;
    }

    const { error: updateSessionError } = await admin
      .from("ai_licenta_import_sessions")
      .update({
        status: "completed",
        result_bank_id: existingBank.id,
        completed_at: completedAt,
        metadata: {
          ...(session.metadata || {}),
          finalizedAt: completedAt,
          recoveredExistingBank: true
        }
      })
      .eq("id", sessionId)
      .eq("user_id", userId);

    if (updateSessionError) {
      throw updateSessionError;
    }

    try {
      await notifyAdminLicentaSessionFinalized({
        session: {
          ...session,
          status: "completed",
          result_bank_id: existingBank.id,
          completed_at: completedAt
        },
        resultBankId: existingBank.id,
        setCount: completedJobs.length,
        questionCount: items.length
      });
    } catch (notifyError) {
      console.error("licenta_finalize_notification_failed", notifyError);
    }

    return getLicentaImportSessionSnapshot({ sessionId, userId });
  }

  session = await consumeLicentaSessionCreditIfNeeded(session);

  const metadata = session.metadata || {};
  const bankPayload = {
    user_id: userId,
    source_document_id: null,
    title: "Licenta generala",
    status: "review",
    processing_profile: items.length > 250 ? "large" : items.length > 80 ? "medium" : "small",
    question_count: items.length,
    exam_type: "licenta",
    subject_id: null,
    subject_name: metadata.subjectLabel || LICENTA_GENERAL_LABEL,
    visibility_scope: metadata.visibilityScope || "cohort",
    target_cohort_id: metadata.targetCohortId || null,
    target_unit_id: metadata.targetUnitId || null,
    target_institution_id: metadata.targetInstitutionId || null,
    metadata: {
      licentaSessionId: session.id,
      importJobIds: completedJobs.map((job) => job.id),
      summary: {
        acceptedCount: items.length,
        setCount: completedJobs.length
      }
    }
  };

  const { data: bank, error: bankError } = await admin
    .from("ai_question_banks")
    .insert(bankPayload)
    .select("id")
    .single();

  if (bankError) {
    throw bankError;
  }

  await insertQuestionBankItemsInBatches({ admin, bankId: bank.id, items });

  const completedAt = new Date().toISOString();
  await publishLicentaSessionBank({
    admin,
    bankId: bank.id,
    userId,
    sessionId: session.id,
    publishedAt: completedAt
  });

  const { error: updateJobsError } = await admin
    .from("ai_import_jobs")
    .update({ result_bank_id: bank.id })
    .eq("licenta_session_id", sessionId)
    .eq("user_id", userId)
    .in("status", ["completed", "completed_with_warnings"]);

  if (updateJobsError) {
    throw updateJobsError;
  }

  const { error: updateSessionError } = await admin
    .from("ai_licenta_import_sessions")
    .update({
      status: "completed",
      result_bank_id: bank.id,
      completed_at: completedAt,
      metadata: {
        ...(session.metadata || {}),
        finalizedAt: completedAt
      }
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (updateSessionError) {
    throw updateSessionError;
  }

  try {
    await notifyAdminLicentaSessionFinalized({
      session: {
        ...session,
        status: "completed",
        result_bank_id: bank.id,
        completed_at: completedAt
      },
      resultBankId: bank.id,
      setCount: completedJobs.length,
      questionCount: items.length
    });
  } catch (notifyError) {
    console.error("licenta_finalize_notification_failed", notifyError);
  }

  return getLicentaImportSessionSnapshot({ sessionId, userId });
}

export async function deleteLicentaImportSet({ importJobId, userId }) {
  const admin = createAdminClient();
  const job = await fetchImportJob(importJobId, userId);

  if (!job.licenta_session_id) {
    throw new Error("Acest import nu apartine unei sesiuni de licenta.");
  }

  const session = await fetchLicentaSession(job.licenta_session_id, userId);
  if (session.status !== "active") {
    throw new Error("Nu poti elimina seturi dupa finalizarea licentei.");
  }

  if (job.result_bank_id) {
    throw new Error("Setul este deja legat de banca finala si nu mai poate fi eliminat.");
  }

  const { error } = await admin
    .from("ai_import_jobs")
    .delete()
    .eq("id", importJobId)
    .eq("user_id", userId)
    .eq("licenta_session_id", session.id);

  if (error) {
    throw error;
  }

  await renumberLicentaSessionSets(session.id, userId);
  await refreshLicentaSessionCounts(session.id);
  return getLicentaImportSessionSnapshot({ sessionId: session.id, userId });
}

export async function abandonLicentaImportSession({ sessionId, userId }) {
  const admin = createAdminClient();
  const session = await fetchLicentaSession(sessionId, userId);

  if (session.status !== "active") {
    throw new Error("Poti abandona doar o licenta in lucru.");
  }

  if (session.result_bank_id || session.credit_consumed_at) {
    throw new Error("Licenta finalizata nu mai poate fi abandonata.");
  }

  const { error: deleteJobsError } = await admin
    .from("ai_import_jobs")
    .delete()
    .eq("licenta_session_id", sessionId)
    .eq("user_id", userId);

  if (deleteJobsError) {
    throw deleteJobsError;
  }

  const abandonedAt = new Date().toISOString();
  const { error: updateSessionError } = await admin
    .from("ai_licenta_import_sessions")
    .update({
      status: "failed",
      completed_at: abandonedAt,
      metadata: {
        ...(session.metadata || {}),
        abandonedAt,
        abandonedReason: "user_requested"
      }
    })
    .eq("id", sessionId)
    .eq("user_id", userId);

  if (updateSessionError) {
    throw updateSessionError;
  }

  return {
    ok: true,
    href: "/materiale"
  };
}

export async function retryImportJob({ importJobId, userId }) {
  const admin = createAdminClient();
  const job = await fetchImportJob(importJobId, userId);
  if (job.status === "failed" && Number(job.total_questions || 0) > 0) {
    const recovered = await recoverFailedImportWithExtractedQuestions(job);
    return buildPublicStatus(recovered);
  }

  const { error } = await admin
    .from("ai_import_chunks")
    .update({ status: "pending", error_message: null })
    .eq("import_job_id", importJobId)
    .eq("status", "failed");

  if (error) {
    throw error;
  }

  const updated = await updateImportJob(job.id, {
    status: "processing",
    error_message: null,
    completed_at: null
  });

  return buildPublicStatus(updated);
}

export async function fallbackImportToSet({ importJobId, userId }) {
  const job = await fetchImportJob(importJobId, userId);
  const updated = await updateImportJob(job.id, {
    status: "needs_review",
    metadata: {
      ...(job.metadata || {}),
      fallbackToSetSuggestedAt: new Date().toISOString()
    }
  });
  return buildPublicStatus(updated);
}

export async function buildPreparedFileFromFormFile(file) {
  const prepared = await prepareSourceFile(file);
  return {
    ...prepared,
    originalFilename: sanitizeFilename(prepared.originalFilename || file.name)
  };
}
