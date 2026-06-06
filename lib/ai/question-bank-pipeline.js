import "server-only";

import crypto from "node:crypto";

import { zodTextFormat } from "openai/helpers/zod";

import {
  createQuestionBankItemsOpenAIResponse,
  deleteOpenAIPdfExtractionFile,
  extractQuestionBankItemsFromPdfWithOpenAI,
  parseQuestionBankItemsFromOpenAIResponse,
  profileQuestionBankPdfFromOpenAIFile,
  retrieveQuestionBankItemsOpenAIResponse,
  uploadPdfForOpenAIExtraction
} from "@/lib/ai/openai-pdf-fallback";
import { QuestionBankChunkResultSchema } from "@/lib/ai/question-bank-schema";
import { downloadSourceDocument } from "@/lib/ai/storage";
import { notifyAdminAiJobTerminal } from "@/lib/notifications/telegram";
import {
  getOpenAIProviderFailureCode,
  isPermanentOpenAIError,
  normalizeOpenAIError,
  runLoggedResponseParse
} from "@/lib/openai/logging";
import { createAdminClient } from "@/lib/supabase/admin";

const JOB_KIND = "question_bank_extract";
const ROUTING_MODE = "qa_extract";
const OPENAI_PDF_SINGLE_FILE_ROUTING_MODE = "openai_pdf_single_file";
const OPENAI_PDF_BATCH_ROUTING_MODE = "openai_pdf_batched";
const LOCK_STALE_MS = 5 * 60 * 1000;
const CONSOLIDATING_STALE_MS = 4 * 60 * 1000;
const PROCESSING_HEARTBEAT_STALE_MS = 6 * 60 * 1000;
const PDF_FALLBACK_TIMEOUT_MS = 3 * 60 * 1000;
const OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS = Math.max(
  60_000,
  Number(process.env.OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS || 285_000) || 285_000
);
const OPENAI_PDF_SINGLE_FILE_POLL_INTERVAL_MS = Math.max(
  2_000,
  Number(process.env.OPENAI_PDF_SINGLE_FILE_POLL_INTERVAL_MS || 7_000) || 7_000
);
const OPENAI_PDF_SINGLE_FILE_MAX_POLL_MINUTES = Math.max(
  5,
  Number(process.env.OPENAI_PDF_SINGLE_FILE_MAX_POLL_MINUTES || 45) || 45
);
const OPENAI_PDF_SINGLE_FILE_RETRY_LIMIT = Math.max(
  1,
  Number(process.env.OPENAI_PDF_SINGLE_FILE_RETRY_LIMIT || 3) || 3
);
const OPENAI_PDF_SINGLE_FILE_MAX_OUTPUT_TOKENS = Math.max(
  8000,
  Number(process.env.OPENAI_PDF_SINGLE_FILE_MAX_OUTPUT_TOKENS || 20000) || 20000
);
const OPENAI_PDF_SINGLE_FILE_MAX_ITEMS = Math.min(
  120,
  Math.max(20, Number(process.env.OPENAI_PDF_SINGLE_FILE_MAX_ITEMS || 80) || 80)
);
const OPENAI_PDF_BATCH_SIZE = Math.min(
  120,
  Math.max(20, Number(process.env.OPENAI_PDF_BATCH_SIZE || 80) || 80)
);
const OPENAI_PDF_BATCH_TIMEOUT_MS = Math.max(
  60_000,
  Number(process.env.OPENAI_PDF_BATCH_TIMEOUT_MS || 240_000) || 240_000
);
const OPENAI_PDF_BATCH_MAX_OUTPUT_TOKENS = Math.max(
  8000,
  Number(process.env.OPENAI_PDF_BATCH_MAX_OUTPUT_TOKENS || 20000) || 20000
);
const MIN_PUBLISHABLE_ITEMS = 8;
const PDF_COVERAGE_TARGET_RATIO = 0.75;
const MAX_AUTO_CHUNK_ATTEMPTS = 2;
const MAX_MANUAL_CHUNK_ATTEMPTS = 3;
const PDF_PRIMARY_MODEL = process.env.OPENAI_PDF_PRIMARY_MODEL || "gpt-5.4";
const PDF_PRIMARY_REASONING = process.env.OPENAI_PDF_PRIMARY_REASONING || "medium";
const PDF_ESCALATION_MODEL = process.env.OPENAI_PDF_ESCALATION_MODEL || "gpt-5.4";
const PDF_ESCALATION_REASONING = process.env.OPENAI_PDF_ESCALATION_REASONING || "high";
const LICENTA_GENERAL_LABEL = "Licenta generala";
const MONITOR_HISTORY_LIMIT = 80;
const MONITOR_TERMINAL_WINDOW_MS = 24 * 60 * 60 * 1000;
const MONITOR_FALLBACK_TOTAL_SECONDS = {
  small: 90,
  medium: 180,
  large: 300,
  default: 180
};

const PROFILE_CONFIG = {
  small: {
    model: "gpt-5-mini",
    reasoningEffort: "low",
    targetQuestionsPerChunk: 60,
    maxChunkCharacters: 18000,
    progressBase: 12,
    progressRange: 68
  },
  medium: {
    model: "gpt-5-mini",
    reasoningEffort: "medium",
    targetQuestionsPerChunk: 45,
    maxChunkCharacters: 20000,
    progressBase: 12,
    progressRange: 68
  },
  large: {
    model: "gpt-5-mini",
    reasoningEffort: "medium",
    targetQuestionsPerChunk: 30,
    maxChunkCharacters: 22000,
    progressBase: 12,
    progressRange: 68
  }
};

function normalizeQuestionText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function buildQuestionHash(questionText, correctAnswer) {
  const base = `${normalizeQuestionText(questionText)}::${normalizeQuestionText(correctAnswer)}`;
  return crypto.createHash("sha256").update(base).digest("hex");
}

function cleanupText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .replace(/[ ]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function isPdfSourceDocument(sourceDocument) {
  const filename = String(sourceDocument?.original_filename || "").toLowerCase();
  const mimeType = String(sourceDocument?.mime_type || "").toLowerCase();
  const sourceKind = String(sourceDocument?.source_kind || "").toLowerCase();

  return sourceKind === "pdf" || mimeType === "application/pdf" || filename.endsWith(".pdf");
}

function isLicentaPdfJob(job, sourceDocument = null) {
  const filename = String(
    sourceDocument?.original_filename || job?.metadata?.sourceFilename || ""
  ).toLowerCase();
  const metadataSourceKind = String(job?.metadata?.sourceKind || "").toLowerCase();

  return (
    job?.metadata?.examType === "licenta" &&
    (sourceDocument ? isPdfSourceDocument(sourceDocument) : metadataSourceKind === "pdf" || filename.endsWith(".pdf"))
  );
}

function isOpenAIPdfBatchedJob(job) {
  return (
    job?.routing_mode === OPENAI_PDF_BATCH_ROUTING_MODE ||
    job?.metadata?.processingMode === OPENAI_PDF_BATCH_ROUTING_MODE ||
    job?.metadata?.pdfProcessingMode === OPENAI_PDF_BATCH_ROUTING_MODE
  );
}

function isOpenAIPdfSingleFileJob(job) {
  return (
    job?.routing_mode === OPENAI_PDF_SINGLE_FILE_ROUTING_MODE ||
    job?.metadata?.processingMode === OPENAI_PDF_SINGLE_FILE_ROUTING_MODE ||
    job?.metadata?.pdfProcessingMode === OPENAI_PDF_SINGLE_FILE_ROUTING_MODE
  );
}

function canRestartAsOpenAIPdfBatched(job) {
  return (
    job?.status === "failed" &&
    isLicentaPdfJob(job, null) &&
    !isOpenAIPdfBatchedJob(job) &&
    !isOpenAIPdfSingleFileJob(job)
  );
}

function canResumeOpenAIPdfSingleFileFailure(job) {
  return (
    job?.status === "failed" &&
    isOpenAIPdfSingleFileJob(job) &&
    (job?.stage === "extracting" || job?.stage === "failed")
  );
}

function canResumeOpenAIPdfBatchedFailure(job) {
  return (
    job?.status === "failed" &&
    isOpenAIPdfBatchedJob(job) &&
    (job?.stage === "extracting" || job?.stage === "failed")
  );
}

function mergeJobMetadata(job, patch = {}) {
  return {
    ...(job?.metadata || {}),
    ...patch
  };
}

function buildStageMetadata(job, stage, processingMode, patch = {}) {
  return mergeJobMetadata(job, {
    stageEnteredAt: new Date().toISOString(),
    processingMode,
    currentStage: stage,
    ...patch
  });
}

function parseTimestamp(value) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function secondsBetween(startValue, endValue) {
  const start = parseTimestamp(startValue);
  const end = parseTimestamp(endValue);

  if (start === null || end === null || end <= start) {
    return null;
  }

  return Math.round((end - start) / 1000);
}

function secondsSince(value) {
  const timestamp = parseTimestamp(value);
  if (timestamp === null) {
    return null;
  }

  return Math.max(0, Math.round((Date.now() - timestamp) / 1000));
}

function median(values) {
  const sorted = values
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (!sorted.length) {
    return null;
  }

  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : Math.round((sorted[middle - 1] + sorted[middle]) / 2);
}

function isTimeoutLikeError(error) {
  return normalizeOpenAIError(error).isTimeoutLike;
}

function isKnownOpenAIFallbackError(error) {
  return normalizeOpenAIError(error).isKnownOpenAIError;
}

function isTransientOpenAIError(error) {
  if (isPermanentOpenAIError(error)) {
    return false;
  }

  const normalizedError = normalizeOpenAIError(error);
  if (normalizedError.isTimeoutLike) {
    return true;
  }

  const status = Number(normalizedError.status || 0) || 0;
  return status === 429 || status >= 500;
}

function getOpenAIProviderUnavailableMessage(error) {
  const code = getOpenAIProviderFailureCode(error);

  if (code === "insufficient_quota") {
    return "Procesarea nu este disponibila momentan. Incearca mai tarziu.";
  }

  return "Procesarea nu este disponibila momentan. Incearca mai tarziu.";
}

function buildOpenAIProviderFailureReason(error) {
  const code = getOpenAIProviderFailureCode(error);
  return code ? `openai_provider_${code}` : "openai_provider_unavailable";
}

function buildAsyncOpenAINextPollAt() {
  return buildOpenAIPdfSingleFileNextPollAt();
}

function shouldPollAsyncOpenAIPayloadNow(payload) {
  const nextPollTimestamp = parseTimestamp(payload?.openaiNextPollAt);
  if (nextPollTimestamp === null) {
    return true;
  }

  return Date.now() >= nextPollTimestamp;
}

function hasAsyncOpenAIPayloadPollingExpired(payload) {
  const startedAt = payload?.openaiRequestCreatedAt || payload?.openaiStartedAt || null;
  const startedTimestamp = parseTimestamp(startedAt);
  if (startedTimestamp === null) {
    return false;
  }

  return Date.now() - startedTimestamp >= OPENAI_PDF_SINGLE_FILE_MAX_POLL_MINUTES * 60 * 1000;
}

function canRetryOpenAIPdfSingleFileAsync(job) {
  const retries = Number(job?.metadata?.openaiPdfSingleFileRetryCount || 0) || 0;
  return retries < OPENAI_PDF_SINGLE_FILE_RETRY_LIMIT;
}

function shouldPollOpenAIPdfSingleFileNow(job) {
  const nextPollAt = job?.metadata?.openaiPdfSingleFileNextPollAt;
  const nextPollTimestamp = parseTimestamp(nextPollAt);
  if (nextPollTimestamp === null) {
    return true;
  }

  return Date.now() >= nextPollTimestamp;
}

function buildOpenAIPdfSingleFileNextPollAt() {
  return new Date(Date.now() + OPENAI_PDF_SINGLE_FILE_POLL_INTERVAL_MS).toISOString();
}

function hasOpenAIPdfSingleFilePollingExpired(job) {
  const startedAt =
    job?.metadata?.openaiPdfSingleFileStartedAt ||
    job?.metadata?.openaiPdfSingleFileRequestCreatedAt ||
    job?.startedAt ||
    job?.createdAt ||
    null;
  const startedTimestamp = parseTimestamp(startedAt);
  if (startedTimestamp === null) {
    return false;
  }

  return Date.now() - startedTimestamp >= OPENAI_PDF_SINGLE_FILE_MAX_POLL_MINUTES * 60 * 1000;
}

function isResumableFallbackFailure(job) {
  return (
    job?.status === "failed" &&
    job?.stage === "failed" &&
    (job?.metadata?.processingMode === "pdf_fallback_failed" ||
      job?.metadata?.processingMode === "pdf_fallback_timeout" ||
      job?.metadata?.processingMode === "pdf_fallback_not_publishable")
  );
}

function questionLinePattern(line) {
  return /^\s*(\d{1,4}[\.\)]|(?:intrebarea|question)\s+\d+[\:\.\)]?)\s+/i.test(line);
}

function answerKeywordPattern(value) {
  return /\b(raspuns(?:ul)?(?:\s+corect)?|varianta\s+corecta|correct\s+answer|answer)\b/i.test(
    value
  );
}

function answerLinePattern(line) {
  return (
    /^\s*([A-Ea-e][\)\.\:-]|[1-5][\)\.\:-])\s+/.test(line) ||
    answerKeywordPattern(line)
  );
}

function splitIntoQuestionBlocks(sourceText) {
  const lines = cleanupText(sourceText).split("\n");
  const blocks = [];
  let current = [];

  for (const line of lines) {
    if (questionLinePattern(line) && current.length) {
      blocks.push(cleanupText(current.join("\n")));
      current = [line];
      continue;
    }

    current.push(line);
  }

  if (current.length) {
    blocks.push(cleanupText(current.join("\n")));
  }

  return blocks.filter(Boolean);
}

function detectAnswerSignals(sourceText) {
  return cleanupText(sourceText)
    .split("\n")
    .filter((line) => answerLinePattern(line)).length;
}

function detectAnsweredBlocks(blocks) {
  return blocks.filter((block) => {
    const lines = cleanupText(block).split("\n");
    const answerLineCount = lines.filter((line) => /^\s*([A-Ea-e][\)\.\:-]|[1-5][\)\.\:-])\s+/.test(line))
      .length;

    return answerLineCount >= 2 || answerKeywordPattern(block);
  }).length;
}

function chooseProcessingProfile({ estimatedItems, sourceText, examType }) {
  const charCount = sourceText.length;

  if (examType === "licenta" || estimatedItems > 250 || charCount > 90000) {
    return "large";
  }

  if (estimatedItems > 80 || charCount > 32000) {
    return "medium";
  }

  return "small";
}

export function profileQuestionBankDocument({ sourceText, examType }) {
  const cleaned = cleanupText(sourceText);
  const blocks = splitIntoQuestionBlocks(cleaned);
  const answerSignals = detectAnswerSignals(cleaned);
  const answeredBlocks = detectAnsweredBlocks(blocks);
  const estimatedItems = blocks.length;
  const qualitySignals = [];

  if (estimatedItems >= 5) {
    qualitySignals.push(`Am detectat aproximativ ${estimatedItems} intrebari.`);
  }

  if (
    answeredBlocks >= Math.max(3, Math.round(estimatedItems * 0.35)) ||
    answerSignals >= Math.max(4, Math.round(estimatedItems * 0.45))
  ) {
    qualitySignals.push("Documentul pare sa contina si variante de raspuns.");
  }

  const enoughQuestionBlocks = estimatedItems >= 5;
  const enoughAnsweredBlocks = answeredBlocks >= Math.max(3, Math.round(estimatedItems * 0.3));
  const enoughAnswerSignals = answerSignals >= Math.max(4, Math.round(estimatedItems * 0.25));
  const detectedFormat =
    enoughQuestionBlocks && (enoughAnsweredBlocks || enoughAnswerSignals) ? "qa_extract" : "invalid_source";

  const profile = chooseProcessingProfile({ estimatedItems, sourceText: cleaned, examType });
  const targetQuestionsPerChunk = PROFILE_CONFIG[profile].targetQuestionsPerChunk;
  const chunkCount = Math.max(1, Math.ceil(Math.max(estimatedItems, 1) / targetQuestionsPerChunk));

  return {
    cleanedText: cleaned,
    blocks,
    profile,
    estimatedItems,
    chunkCount,
    detectedFormat,
    qualitySignals,
    answeredBlocks,
    answerSignals
  };
}

function buildChunkPlan({ blocks, profile }) {
  const config = PROFILE_CONFIG[profile];
  const chunks = [];
  let currentBlocks = [];
  let currentCharCount = 0;
  let startIndex = 0;

  blocks.forEach((block, index) => {
    const nextCharCount = currentCharCount + block.length + 2;
    const wouldOverflowQuestions = currentBlocks.length >= config.targetQuestionsPerChunk;
    const wouldOverflowChars =
      currentBlocks.length > 0 && nextCharCount > config.maxChunkCharacters;

    if (wouldOverflowQuestions || wouldOverflowChars) {
      chunks.push({
        chunk_index: chunks.length,
        source_start: startIndex,
        source_end: startIndex + currentBlocks.length - 1,
        estimated_items: currentBlocks.length,
        payload: {
          text: cleanupText(currentBlocks.join("\n\n"))
        }
      });
      currentBlocks = [];
      currentCharCount = 0;
      startIndex = index;
    }

    if (!currentBlocks.length) {
      startIndex = index;
    }

    currentBlocks.push(block);
    currentCharCount += block.length + 2;
  });

  if (currentBlocks.length) {
    chunks.push({
      chunk_index: chunks.length,
      source_start: startIndex,
      source_end: startIndex + currentBlocks.length - 1,
      estimated_items: currentBlocks.length,
      payload: {
        text: cleanupText(currentBlocks.join("\n\n"))
      }
    });
  }

  return chunks;
}

function buildOpenAIPdfBatchPlan({ estimatedItems, batchSize = OPENAI_PDF_BATCH_SIZE }) {
  const totalItems = Math.max(Number(estimatedItems || 0) || batchSize, batchSize);
  const chunks = [];

  for (let start = 1; start <= totalItems; start += batchSize) {
    const end = Math.min(totalItems, start + batchSize - 1);
    chunks.push({
      chunk_index: chunks.length,
      source_start: start,
      source_end: end,
      estimated_items: end - start + 1,
      payload: {
        mode: OPENAI_PDF_BATCH_ROUTING_MODE,
        questionStart: start,
        questionEnd: end
      }
    });
  }

  return chunks;
}

function normalizeOpenAIPdfProfile(profile) {
  const estimatedItems = Math.max(Number(profile?.estimatedItems || 0) || OPENAI_PDF_BATCH_SIZE, 1);
  const resolvedProfile =
    profile?.profile === "small" || profile?.profile === "medium" || profile?.profile === "large"
      ? profile.profile
      : estimatedItems > 250
        ? "large"
        : estimatedItems > 80
          ? "medium"
          : "small";

  return {
    cleanedText: "",
    blocks: [],
    profile: resolvedProfile,
    estimatedItems,
    chunkCount: Math.max(1, Math.ceil(estimatedItems / OPENAI_PDF_BATCH_SIZE)),
    detectedFormat: profile?.detectedFormat === "invalid_source" ? "invalid_source" : "qa_extract",
    qualitySignals: Array.isArray(profile?.qualitySignals)
      ? profile.qualitySignals
      : [`Am estimat aproximativ ${estimatedItems} intrebari in PDF.`],
    answeredBlocks: estimatedItems,
    answerSignals: estimatedItems
  };
}

function getProfileExecutionConfig(profile, forceHighEffort = false) {
  if (forceHighEffort) {
    return {
      model: "gpt-5",
      reasoningEffort: "high"
    };
  }

  const config = PROFILE_CONFIG[profile] || PROFILE_CONFIG.small;
  return {
    model: config.model,
    reasoningEffort: config.reasoningEffort
  };
}

async function extractChunkItems({
  chunkText,
  processingProfile,
  examType,
  subjectName,
  forceHighEffort = false,
  userId = null,
  jobId = null,
  sourceDocumentId = null,
  chunkIndex = null
}) {
  const executionConfig = getProfileExecutionConfig(processingProfile, forceHighEffort);
  const instructions = [
    "Extrage exclusiv intrebari si raspunsuri existente din textul primit.",
    "Nu inventa intrebari sau fapte noi.",
    examType === "licenta"
      ? "Pentru licenta, daca o intrebare este partial incompleta, cu raspuns corect neclar sau cu o varianta lipsa, pastreaz-o pentru review daca textul intrebarii si majoritatea variantelor pot fi identificate."
      : "Daca o intrebare este incompleta sau fara raspuns clar, sari peste ea.",
    examType === "licenta"
      ? "Pentru aceste intrebari de licenta care cer atentie, completeaza review_note cu prefixul `ATENTIE:` si spune concret ce lipseste: raspuns corect, varianta, formulare sau confirmare manuala."
      : "",
    examType === "licenta"
      ? "Daca lipseste o varianta necesara, foloseste placeholderul `[Varianta lipsa - completeaza manual]` doar ca marcaj de review, nu ca raspuns inventat."
      : "",
    examType === "licenta"
      ? "Daca raspunsul corect lipseste sau nu este clar, seteaza temporar cea mai probabila varianta doar daca exista indicii in text si marcheaza obligatoriu review_note cu `ATENTIE: raspuns corect de verificat manual`."
      : "",
    "Pastreaza toate variantele valide ale fiecarei intrebari, de obicei 4 sau 5.",
    "Pastreaza un singur raspuns corect.",
    "Nu reduce artificial intrebarile cu 5 variante la 4.",
    examType === "licenta"
      ? "Daca sursa are mai putin de 4 variante si nu poti pastra intrebarea responsabil cu placeholder de review, sari peste intrebare."
      : "Daca sursa are mai putin de 4 variante, sari peste intrebare.",
    "Daca raspunsul corect nu este marcat explicit, poti deduce logic varianta corecta doar daca intrebarile si variantele sunt clare; in acest caz completeaza review_note cu o mentiune scurta despre inferenta.",
    "Sari peste intrebare doar daca structura raspunsurilor este prea neclara pentru inferenta responsabila.",
    "Scrie totul in romana clara.",
    examType === "licenta"
      ? "Documentul apartine unui context de licenta, deci pastreaza formularea riguroasa."
      : "Documentul apartine unei materii obisnuite, pastreaza formularea clara si usor de invatat.",
    subjectName ? `Materia este: ${subjectName}.` : ""
  ]
    .filter(Boolean)
    .join(" ");

  const response = await runLoggedResponseParse({
    requestScope: "question_bank_chunk_extract",
    userId,
    jobId,
    sourceDocumentId,
    metadata: {
      processingProfile,
      examType,
      subjectName,
      forceHighEffort,
      chunkIndex
    },
    request: {
      model: executionConfig.model,
      reasoning: {
        effort: executionConfig.reasoningEffort
      },
      input: [
        {
          role: "system",
          content: instructions
        },
        {
          role: "user",
          content: `Text sursa pentru chunk:\n\n${chunkText}`
        }
      ],
      max_output_tokens: 8000,
      text: {
        format: zodTextFormat(QuestionBankChunkResultSchema, "question_bank_chunk")
      }
    }
  });

  if (!response.output_parsed) {
    throw new Error("Modelul nu a returnat un chunk valid.");
  }

  return {
    parsed: response.output_parsed,
    model: executionConfig.model,
    reasoningEffort: executionConfig.reasoningEffort
  };
}

function shouldMarkItemNeedsReview({ questionText, answers, reviewNote = "" }) {
  if (reviewNote) {
    return true;
  }

  const normalizedQuestion = normalizeQuestionText(questionText);
  if (
    normalizedQuestion.includes("de completat") ||
    normalizedQuestion.includes("lipsa")
  ) {
    return true;
  }

  if (questionText.includes("...") || questionText.includes("…")) {
    return true;
  }

  if (
    answers.some((answer) => {
      const normalizedAnswer = normalizeQuestionText(answer);
      return (
        normalizedAnswer.includes("varianta lipsa") ||
        normalizedAnswer.includes("de completat") ||
        normalizedAnswer.includes("raspuns lipsa")
      );
    })
  ) {
    return true;
  }

  if (answers.some((answer) => answer.length < 3)) {
    return true;
  }

  return false;
}

function createRejectReasonCounter() {
  return {
    empty_question: 0,
    invalid_answer_count: 0,
    invalid_correct_index: 0,
    duplicate_detected: 0
  };
}

function registerRejectReason(target, reason) {
  if (!target || !reason) {
    return;
  }

  target[reason] = Number(target[reason] || 0) + 1;
}

function normalizeChunkItemDetailed(item, sourceChunkId, options = {}) {
  const { extractionSource = "local_text", allowNeedsReview = false } = options;
  const questionText = cleanupText(item.question_text);
  const answers = (item.answers || []).map((answer) => cleanupText(answer)).filter(Boolean);
  const explanation = cleanupText(item.explanation || "");
  const reviewNote = cleanupText(item.review_note || item.reviewNote || "");

  if (!questionText) {
    return { item: null, rejectReason: "empty_question" };
  }

  if (answers.length < 4) {
    return { item: null, rejectReason: "invalid_answer_count" };
  }

  let normalizedAnswers = answers;
  let normalizedReviewNote = reviewNote;
  if (answers.length > 5) {
    normalizedAnswers = answers.slice(0, 5);
    normalizedReviewNote = normalizedReviewNote
      ? `${normalizedReviewNote} | au fost pastrate primele 5 variante dintr-un set mai lung`
      : "au fost pastrate primele 5 variante dintr-un set mai lung";
  }

  if (
    !Number.isInteger(item.correct_index) ||
    item.correct_index < 0 ||
    item.correct_index >= normalizedAnswers.length
  ) {
    return { item: null, rejectReason: "invalid_correct_index" };
  }

  const duplicateAnswers = new Set(normalizedAnswers.map((answer) => normalizeQuestionText(answer))).size !==
    normalizedAnswers.length;

  const qualityStatus =
    allowNeedsReview &&
    (duplicateAnswers ||
      shouldMarkItemNeedsReview({
        questionText,
        answers: normalizedAnswers,
        reviewNote: normalizedReviewNote
      }))
      ? "needs_review"
      : "accepted";

  if (duplicateAnswers && !normalizedReviewNote) {
    normalizedReviewNote = "varianta de raspuns pare repetata; verifica atent";
  }

  return {
    item: {
      question_text: questionText,
      answers: normalizedAnswers,
      correct_index: item.correct_index,
      explanation,
      source_chunk_id: sourceChunkId,
      source_page: null,
      quality_status: qualityStatus,
      normalized_hash: buildQuestionHash(questionText, normalizedAnswers[item.correct_index]),
      metadata: {
        source_reference: item.source_reference || null,
        extraction_source: extractionSource,
        review_note: normalizedReviewNote || null
      }
    },
    rejectReason: null
  };
}

function normalizeChunkItem(item, sourceChunkId, options = {}) {
  return normalizeChunkItemDetailed(item, sourceChunkId, options).item;
}

function consolidateChunkPayloads(chunkRows, options = {}) {
  const accepted = [];
  const seenHashes = new Set();
  let duplicateCount = 0;
  let rejectedCount = 0;
  let needsReviewCount = 0;
  const rejectReasons = createRejectReasonCounter();

  for (const chunkRow of chunkRows) {
    const payloadItems = Array.isArray(chunkRow?.payload?.items) ? chunkRow.payload.items : [];

    for (const rawItem of payloadItems) {
      const detailed = normalizeChunkItemDetailed(rawItem, chunkRow.id, options);
      if (!detailed.item) {
        rejectedCount += 1;
        registerRejectReason(rejectReasons, detailed.rejectReason);
        continue;
      }

      const normalized = detailed.item;
      if (seenHashes.has(normalized.normalized_hash)) {
        duplicateCount += 1;
        registerRejectReason(rejectReasons, "duplicate_detected");
        continue;
      }

      seenHashes.add(normalized.normalized_hash);
      if (normalized.quality_status === "needs_review") {
        needsReviewCount += 1;
      }
      accepted.push(normalized);
    }
  }

  return {
    items: accepted.map((item, index) => ({
      ...item,
      position: index + 1
    })),
    summary: {
      acceptedCount: accepted.length,
      needsReviewCount,
      duplicateCount,
      rejectedCount,
      rejectReasons
    }
  };
}

function countChunkPayloadItems(chunkRows) {
  return (chunkRows || []).reduce((total, row) => {
    const payloadItems = Array.isArray(row?.payload?.items) ? row.payload.items.length : 0;
    return total + payloadItems;
  }, 0);
}

function buildConsolidationDiagnostics(job, { chunkRows = [], consolidated = null, patch = {} } = {}) {
  const previousDiagnostics =
    job?.metadata?.consolidationDiagnostics &&
    typeof job.metadata.consolidationDiagnostics === "object"
      ? job.metadata.consolidationDiagnostics
      : {};
  const successfulChunkRows = (chunkRows || []).filter((row) => row.status === "succeeded");
  const consolidationSummary = consolidated?.summary || previousDiagnostics.consolidationSummary || null;
  const estimatedItems =
    Number(job?.metadata?.estimatedItems || previousDiagnostics.estimatedItems || 0) || 0;
  const acceptedCount =
    typeof patch.acceptedCount === "number"
      ? patch.acceptedCount
      : Number(consolidationSummary?.acceptedCount || previousDiagnostics.acceptedCount || 0) || 0;
  const needsReviewCount =
    typeof patch.needsReviewCount === "number"
      ? patch.needsReviewCount
      : Number(consolidationSummary?.needsReviewCount || previousDiagnostics.needsReviewCount || 0) || 0;
  const rejectedCount =
    typeof patch.rejectedCount === "number"
      ? patch.rejectedCount
      : Number(consolidationSummary?.rejectedCount || previousDiagnostics.rejectedCount || 0) || 0;
  const duplicateCount =
    typeof patch.duplicateCount === "number"
      ? patch.duplicateCount
      : Number(consolidationSummary?.duplicateCount || previousDiagnostics.duplicateCount || 0) || 0;
  const rejectedReasonCounts = {
    ...createRejectReasonCounter(),
    ...(previousDiagnostics.rejectedReasonCounts || {}),
    ...(consolidationSummary?.rejectReasons || {}),
    ...(patch.rejectedReasonCounts || {})
  };
  const publishableThreshold =
    typeof patch.publishableThreshold === "number"
      ? patch.publishableThreshold
      : Number(
          previousDiagnostics.publishableThreshold ||
            job?.metadata?.pdfFallbackPublishableThreshold ||
            MIN_PUBLISHABLE_ITEMS
        ) || MIN_PUBLISHABLE_ITEMS;
  const coverageTargetCount =
    typeof patch.coverageTargetCount === "number"
      ? patch.coverageTargetCount
      : Number(previousDiagnostics.coverageTargetCount || publishableThreshold) || publishableThreshold;
  const coveragePercent =
    coverageTargetCount > 0 ? Math.round((acceptedCount / coverageTargetCount) * 100) : 0;
  const extractionAttempts = Array.isArray(patch.extractionAttempts)
    ? patch.extractionAttempts
    : Array.isArray(previousDiagnostics.extractionAttempts)
      ? previousDiagnostics.extractionAttempts
      : [];

  return {
    ...previousDiagnostics,
    startedAt: patch.startedAt || previousDiagnostics.startedAt || null,
    estimatedItems,
    totalChunkCount:
      typeof patch.totalChunkCount === "number"
        ? patch.totalChunkCount
        : previousDiagnostics.totalChunkCount || chunkRows.length,
    successfulChunkCount:
      typeof patch.successfulChunkCount === "number"
        ? patch.successfulChunkCount
        : successfulChunkRows.length,
    successfulChunkItemCount:
      typeof patch.successfulChunkItemCount === "number"
        ? patch.successfulChunkItemCount
        : countChunkPayloadItems(successfulChunkRows),
    rawExtractedCount:
      typeof patch.rawExtractedCount === "number"
        ? patch.rawExtractedCount
        : Number(previousDiagnostics.rawExtractedCount || countChunkPayloadItems(successfulChunkRows)) || 0,
    acceptedCount,
    needsReviewCount,
    rejectedCount,
    duplicateCount,
    rejectedReasonCounts,
    extractionSource:
      patch.extractionSource !== undefined
        ? patch.extractionSource
        : previousDiagnostics.extractionSource || job?.metadata?.extractionSource || "local_text",
    usedPdfFallback:
      typeof patch.usedPdfFallback === "boolean"
        ? patch.usedPdfFallback
        : Boolean(previousDiagnostics.usedPdfFallback),
    pdfFallbackOutcome:
      patch.pdfFallbackOutcome !== undefined
        ? patch.pdfFallbackOutcome
        : previousDiagnostics.pdfFallbackOutcome || null,
    pdfFallbackAcceptedCount:
      typeof patch.pdfFallbackAcceptedCount === "number"
        ? patch.pdfFallbackAcceptedCount
        : Number(previousDiagnostics.pdfFallbackAcceptedCount || 0) || 0,
    publishableThreshold,
    coverageTargetCount,
    coveragePercent,
    extractionAttempts,
    fallbackUsedAsAuthoritative:
      typeof patch.fallbackUsedAsAuthoritative === "boolean"
        ? patch.fallbackUsedAsAuthoritative
        : Boolean(previousDiagnostics.fallbackUsedAsAuthoritative),
    finalFailureReason:
      patch.finalFailureReason !== undefined
        ? patch.finalFailureReason
        : previousDiagnostics.finalFailureReason || null
  };
}

function buildFailureContext(error) {
  const normalizedError = normalizeOpenAIError(error);
  return {
    message: normalizedError.message,
    status: normalizedError.status,
    code: normalizedError.code,
    type: normalizedError.type,
    details: normalizedError.details || null
  };
}

function buildConsolidationMetadata(job, { chunkRows = [], consolidated = null, patch = {} } = {}) {
  const diagnosticsPatch =
    patch.consolidationDiagnostics && typeof patch.consolidationDiagnostics === "object"
      ? patch.consolidationDiagnostics
      : {};
  const metadataPatch = { ...patch };
  delete metadataPatch.consolidationDiagnostics;

  return mergeJobMetadata(job, {
    ...(consolidated?.summary ? { consolidationSummary: consolidated.summary } : {}),
    ...metadataPatch,
    consolidationDiagnostics: buildConsolidationDiagnostics(job, {
      chunkRows,
      consolidated,
      patch: diagnosticsPatch
    })
  });
}

function getPublishableThreshold(job) {
  const configured = Number(job?.metadata?.pdfFallbackPublishableThreshold || 0) || 0;
  return configured > 0 ? configured : MIN_PUBLISHABLE_ITEMS;
}

function buildCoverageTargetCount({
  estimatedItems = 0,
  rawExtractedCount = 0,
  minimumPublishableCount = MIN_PUBLISHABLE_ITEMS
}) {
  const referenceDetectedCount = Math.max(
    Number(estimatedItems || 0) || 0,
    Number(rawExtractedCount || 0) || 0
  );

  if (referenceDetectedCount <= 0) {
    return minimumPublishableCount;
  }

  return Math.max(minimumPublishableCount, Math.ceil(referenceDetectedCount * PDF_COVERAGE_TARGET_RATIO));
}

function buildPdfFallbackNotPublishableDetails({
  acceptedCount,
  publishableThreshold,
  coverageTargetCount = null
}) {
  const target = Number(coverageTargetCount || 0) || publishableThreshold;
  return {
    errorMessage:
      "Fisierul a fost analizat, dar rezultatul nu a avut suficiente intrebari clare pentru publicare.",
    statusDetail: `Analiza PDF a produs ${acceptedCount} itemi validi, sub pragul minim de ${target} pentru publicare. Poti relua procesarea sau reincarca un fisier mai clar.`
  };
}

async function failPdfFallbackJob({
  jobId,
  userId,
  job,
  chunkRows = [],
  consolidated = null,
  failureReason,
  processingMode,
  errorMessage,
  statusDetail,
  progressPercent = 84,
  extraPatch = {}
}) {
  await updateJob(jobId, {
    status: "failed",
    stage: "failed",
    progress_percent: progressPercent,
    error_message: errorMessage,
    status_detail: statusDetail,
    metadata: buildConsolidationMetadata(job, {
      chunkRows,
      consolidated,
      patch: {
        processingMode,
        currentStage: "failed",
        finalFailureReason: failureReason,
        ...extraPatch,
        consolidationDiagnostics: {
          usedPdfFallback: true,
          finalFailureReason: failureReason,
          ...(extraPatch.consolidationDiagnostics || {})
        }
      }
    }),
    completed_at: new Date().toISOString()
  });

  return getQuestionBankJobSnapshot({ jobId, userId });
}

async function failOpenAIProviderJob({
  jobId,
  userId,
  job,
  error,
  chunkRows = [],
  progressPercent = 8,
  processingMode = OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
  openaiFileId = null,
  openaiResponseId = null,
  extraPatch = {}
}) {
  const normalizedError = normalizeOpenAIError(error);
  const providerFailureCode = getOpenAIProviderFailureCode(normalizedError);
  const failureReason = buildOpenAIProviderFailureReason(normalizedError);

  return failPdfFallbackJob({
    jobId,
    userId,
    job,
    chunkRows,
    consolidated: null,
    failureReason,
    processingMode,
    errorMessage: getOpenAIProviderUnavailableMessage(normalizedError),
    statusDetail: "Procesarea este oprita temporar. Incearca din nou dupa verificarea configurarii.",
    progressPercent,
    extraPatch: {
      pdfProcessingMode: processingMode,
      extractionSource: "openai_file",
      openaiProviderFailureCode: providerFailureCode,
      openaiProviderFailureMessage: normalizedError.message,
      openaiProviderRequestId: normalizedError.requestId || null,
      ...(openaiFileId ? { openaiPdfFileId: openaiFileId } : {}),
      ...(openaiResponseId ? { openaiPdfResponseId: openaiResponseId } : {}),
      lastFailureContext: buildFailureContext(normalizedError),
      consolidationDiagnostics: {
        pdfFallbackOutcome: "provider_unavailable",
        extractionSource: "openai_file",
        fallbackUsedAsAuthoritative: true
      },
      ...extraPatch
    }
  });
}

function buildBankTitle({ subjectName, examType }) {
  if (examType === "licenta") {
    return `${subjectName || LICENTA_GENERAL_LABEL} - banca licenta`;
  }

  return `${subjectName || "Materie"} - banca intrebari`;
}

function buildReviewHref(bankId) {
  return `/materiale/review/${bankId}`;
}

function buildPublishedResultHref(job) {
  const metadata = job.metadata || {};
  if (metadata.examType === "licenta") {
    return "/licenta-exam";
  }

  if (metadata.subjectId && metadata.subjectId !== "custom") {
    return `/materii/${metadata.subjectId}`;
  }

  return "/materii";
}

async function fetchJobForProcessing(jobId) {
  const admin = createAdminClient();
  const { data: job, error } = await admin
    .from("ai_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("job_kind", JOB_KIND)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return job;
}

async function fetchSourceDocument(sourceDocumentId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_source_documents")
    .select("id, extracted_text, original_filename, storage_bucket, storage_path, source_kind, mime_type")
    .eq("id", sourceDocumentId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data;
}

async function updateJob(jobId, payload) {
  const admin = createAdminClient();
  const shouldNotifyTerminal = payload?.status === "succeeded" || payload?.status === "failed";
  const nextPayload = {
    ...payload,
    last_heartbeat_at: new Date().toISOString()
  };
  if (
    Object.prototype.hasOwnProperty.call(payload, "progress_percent") ||
    Object.prototype.hasOwnProperty.call(payload, "stage") ||
    Object.prototype.hasOwnProperty.call(payload, "status_detail")
  ) {
    nextPayload.last_progress_at = nextPayload.last_heartbeat_at;
  }
  let existingJob = null;

  if (shouldNotifyTerminal) {
    const { data, error } = await admin
      .from("ai_generation_jobs")
      .select(
        "id, user_id, status, stage, status_detail, error_message, metadata, result_bank_id, source_document_id"
      )
      .eq("id", jobId)
      .maybeSingle();

    if (error) {
      console.error("ai_job_terminal_notification_lookup_failed", error.message);
    } else {
      existingJob = data || null;
    }
  }

  const { error } = await admin.from("ai_generation_jobs").update(nextPayload).eq("id", jobId);
  if (error) {
    throw error;
  }

  if (shouldNotifyTerminal) {
    const terminalJob = {
      ...(existingJob || {}),
      ...nextPayload,
      id: jobId,
      metadata: {
        ...(existingJob?.metadata || {}),
        ...(nextPayload.metadata || {})
      }
    };

    await notifyAdminAiJobTerminal({
      job: terminalJob
    });
    await cleanupOpenAIPdfBatchFile(admin, terminalJob);
    await cleanupOpenAIPdfSingleFile(admin, terminalJob);
  }
}

async function cleanupOpenAIPdfSingleFile(admin, job) {
  const fileId = job?.metadata?.openaiPdfSingleFileId;
  if (
    job?.status !== "succeeded" ||
    !fileId ||
    job?.metadata?.openaiPdfSingleFileDeletedAt
  ) {
    return;
  }

  try {
    await deleteOpenAIPdfExtractionFile({
      fileId,
      filename: job.metadata?.sourceFilename || "document.pdf",
      examType: job.metadata?.examType || "licenta",
      subjectName: job.metadata?.subjectLabel || null,
      reason: "openai_pdf_single_file_cleanup",
      userId: job.user_id || null,
      sourceDocumentId: job.source_document_id || null,
      jobId: job.id
    });

    const { error } = await admin
      .from("ai_generation_jobs")
      .update({
        metadata: {
          ...(job.metadata || {}),
          openaiPdfSingleFileDeletedAt: new Date().toISOString()
        }
      })
      .eq("id", job.id);

    if (error) {
      throw error;
    }
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    console.error("openai_pdf_single_file_cleanup_failed", {
      jobId: job.id,
      fileId,
      error: normalizedError.message,
      status: normalizedError.status,
      code: normalizedError.code
    });
  }
}

async function cleanupOpenAIPdfBatchFile(admin, job) {
  const fileId = job?.metadata?.openaiPdfBatchFileId;
  if (
    job?.status !== "succeeded" ||
    !fileId ||
    job?.metadata?.openaiPdfBatchFileDeletedAt
  ) {
    return;
  }

  try {
    await deleteOpenAIPdfExtractionFile({
      fileId,
      filename: job.metadata?.sourceFilename || "document.pdf",
      examType: job.metadata?.examType || "licenta",
      subjectName: job.metadata?.subjectLabel || null,
      reason: "openai_pdf_batched_cleanup",
      userId: job.user_id || null,
      sourceDocumentId: job.source_document_id || null,
      jobId: job.id
    });

    const { error } = await admin
      .from("ai_generation_jobs")
      .update({
        metadata: {
          ...(job.metadata || {}),
          openaiPdfBatchFileDeletedAt: new Date().toISOString()
        }
      })
      .eq("id", job.id);

    if (error) {
      throw error;
    }
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    console.error("openai_pdf_batch_cleanup_failed", {
      jobId: job.id,
      fileId,
      error: normalizedError.message,
      status: normalizedError.status,
      code: normalizedError.code
    });
  }
}

async function getChunkRows(jobId) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_generation_job_chunks")
    .select("*")
    .eq("job_id", jobId)
    .order("chunk_index", { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function deleteChunkRows(jobId) {
  const admin = createAdminClient();
  const { error } = await admin
    .from("ai_generation_job_chunks")
    .delete()
    .eq("job_id", jobId);

  if (error) {
    throw error;
  }
}

async function getNextChunkForProcessing(jobId, includeFailed = false) {
  const admin = createAdminClient();
  const allowedStatuses = includeFailed ? ["retry", "pending", "failed"] : ["retry", "pending"];
  const { data, error } = await admin
    .from("ai_generation_job_chunks")
    .select("*")
    .eq("job_id", jobId)
    .in("status", allowedStatuses)
    .order("chunk_index", { ascending: true })
    .limit(1);

  if (error) {
    throw error;
  }

  return data?.[0] || null;
}

async function updateChunk(chunkId, payload) {
  const admin = createAdminClient();
  const { error } = await admin.from("ai_generation_job_chunks").update(payload).eq("id", chunkId);
  if (error) {
    throw error;
  }
}

async function insertChunkRows(rows) {
  if (!rows.length) {
    return;
  }

  const admin = createAdminClient();
  const { error } = await admin.from("ai_generation_job_chunks").insert(rows);
  if (error) {
    throw error;
  }
}

function annotateQuestionBankPersistenceError(step, error) {
  const normalizedError = normalizeOpenAIError(error);
  const wrappedError = new Error(`question_bank_${step}: ${normalizedError.message}`);
  wrappedError.name = "QuestionBankPersistenceError";
  wrappedError.status = normalizedError.status ?? null;
  wrappedError.code = normalizedError.code || null;
  wrappedError.type = step;
  wrappedError.cause = {
    step,
    original: normalizedError.details || {
      message: normalizedError.message,
      status: normalizedError.status,
      code: normalizedError.code,
      type: normalizedError.type
    }
  };
  return wrappedError;
}

async function ensureQuestionBank(job, consolidated) {
  const admin = createAdminClient();
  const metadata = job.metadata || {};
  const bankPayload = {
    user_id: job.user_id,
    source_document_id: job.source_document_id,
    title: buildBankTitle({
      subjectName: metadata.subjectLabel || metadata.subjectName || null,
      examType: metadata.examType || "normal"
    }),
    status: "processing",
    processing_profile: job.processing_profile || "small",
    question_count: consolidated.summary.acceptedCount,
    exam_type: metadata.examType || "normal",
    subject_id: metadata.subjectId || null,
    subject_name: metadata.subjectLabel || metadata.subjectName || null,
    visibility_scope: metadata.visibilityScope || "cohort",
    target_cohort_id: metadata.targetCohortId || null,
    target_unit_id: metadata.targetUnitId || null,
    target_institution_id: metadata.targetInstitutionId || null,
    semester: metadata.semester || null,
    student_year: metadata.studentYear || null,
    school_class: metadata.schoolClass || null,
    metadata: {
      source_filename: metadata.sourceFilename || null,
      summary: consolidated.summary
    }
  };

  if (job.result_bank_id) {
    const { error: bankUpdateError } = await admin
      .from("ai_question_banks")
      .update(bankPayload)
      .eq("id", job.result_bank_id);

    if (bankUpdateError) {
      throw annotateQuestionBankPersistenceError("update_bank", bankUpdateError);
    }

    const { error: deleteItemsError } = await admin
      .from("ai_question_bank_items")
      .delete()
      .eq("bank_id", job.result_bank_id);

    if (deleteItemsError) {
      throw annotateQuestionBankPersistenceError("delete_existing_items", deleteItemsError);
    }

    const itemRows = consolidated.items.map((item) => ({
      bank_id: job.result_bank_id,
      position: item.position,
      question_text: item.question_text,
      answers: item.answers,
      correct_index: item.correct_index,
      explanation: item.explanation,
      source_chunk_id: item.source_chunk_id,
      source_page: item.source_page,
      normalized_hash: item.normalized_hash,
      quality_status: item.quality_status,
      metadata: item.metadata
    }));

    if (itemRows.length) {
      const { error: itemsInsertError } = await admin
        .from("ai_question_bank_items")
        .insert(itemRows);

      if (itemsInsertError) {
        throw annotateQuestionBankPersistenceError("insert_items", itemsInsertError);
      }
    }

    return job.result_bank_id;
  }

  const { data: bank, error: bankInsertError } = await admin
    .from("ai_question_banks")
    .insert(bankPayload)
    .select("id")
    .single();

  if (bankInsertError) {
    throw annotateQuestionBankPersistenceError("insert_bank", bankInsertError);
  }

  const itemRows = consolidated.items.map((item) => ({
    bank_id: bank.id,
    position: item.position,
    question_text: item.question_text,
    answers: item.answers,
    correct_index: item.correct_index,
    explanation: item.explanation,
    source_chunk_id: item.source_chunk_id,
    source_page: item.source_page,
    normalized_hash: item.normalized_hash,
    quality_status: item.quality_status,
    metadata: item.metadata
  }));

  if (itemRows.length) {
    const { error: itemsInsertError } = await admin.from("ai_question_bank_items").insert(itemRows);
    if (itemsInsertError) {
      throw annotateQuestionBankPersistenceError("insert_items", itemsInsertError);
    }
  }

  return bank.id;
}

async function finalizeQuestionBankReview({
  job,
  resultBankId,
  consolidatedSummary,
  metadataPatch = {},
  statusDetail = "Intrebarile sunt gata. Verifica raspunsurile si confirma publicarea cand totul este corect."
}) {
  await ensureCreditConsumed(job);

  const admin = createAdminClient();
  const reviewReadyAt = new Date().toISOString();
  const { error: bankError } = await admin
    .from("ai_question_banks")
    .update({
      status: "review"
    })
    .eq("id", resultBankId);

  if (bankError) {
    throw annotateQuestionBankPersistenceError("mark_review_ready", bankError);
  }

  await updateJob(job.id, {
    status: "succeeded",
    stage: "review",
    progress_percent: 100,
    result_bank_id: resultBankId,
    status_detail: statusDetail,
    error_message: null,
    completed_at: reviewReadyAt,
    metadata: {
      ...(job.metadata || {}),
      consolidationSummary: consolidatedSummary,
      ...metadataPatch
    }
  });

  return getQuestionBankJobSnapshot({
    jobId: job.id,
    userId: job.user_id
  });
}

async function getQuestionBankSummaryMap(bankIds) {
  const filteredIds = Array.from(new Set((bankIds || []).filter(Boolean)));
  if (!filteredIds.length) {
    return new Map();
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_question_banks")
    .select("id, title, status, question_count, exam_type, subject_id, subject_name, published_at")
    .in("id", filteredIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((bank) => [bank.id, bank]));
}

function buildResultHref(job, bank) {
  if (job.result_bank_id && bank && bank.status !== "published") {
    return buildReviewHref(job.result_bank_id);
  }

  if (job.result_bank_id && !bank) {
    return "/materiale";
  }

  return buildPublishedResultHref(job);
}

function getActivityState(job, bank) {
  if (job?.metadata?.activityState) {
    return job.metadata.activityState;
  }

  if (bank?.status === "published") {
    return "published";
  }

  if (bank?.status === "review") {
    return "ready";
  }

  return null;
}

function getActivityMessage(job, bank) {
  if (job?.metadata?.activityMessage) {
    return job.metadata.activityMessage;
  }

  if (bank?.status === "published") {
    return job?.metadata?.examType === "licenta"
      ? "Intrebarile sunt deja active in simularea de licenta."
      : "Intrebarile sunt deja active in aceasta materie.";
  }

  if (bank?.status === "review") {
    return "Intrebarile sunt gata. Verifica raspunsurile si confirma publicarea.";
  }

  return null;
}

export async function getQuestionBankReview({ bankId, userId }) {
  const admin = createAdminClient();
  const { data: bank, error: bankError } = await admin
    .from("ai_question_banks")
    .select(
      "id, title, status, question_count, exam_type, subject_id, subject_name, created_at, published_at, metadata"
    )
    .eq("id", bankId)
    .eq("user_id", userId)
    .maybeSingle();

  if (bankError) {
    throw bankError;
  }

  if (!bank) {
    return null;
  }

  const { data: items, error: itemsError } = await admin
    .from("ai_question_bank_items")
    .select("id, position, question_text, answers, correct_index, explanation, quality_status, metadata")
    .eq("bank_id", bank.id)
    .order("position", { ascending: true });

  if (itemsError) {
    throw itemsError;
  }

  const { data: job, error: jobError } = await admin
    .from("ai_generation_jobs")
    .select("id, metadata, status_detail")
    .eq("result_bank_id", bank.id)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (jobError) {
    throw jobError;
  }

  return {
    bank,
    items: items || [],
    job: job || null
  };
}

async function ensureCreditConsumed(job) {
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin
    .from("ai_credit_ledger")
    .select("id")
    .eq("user_id", job.user_id)
    .eq("source", "generation")
    .eq("reason", "generation_consume")
    .contains("metadata", { job_id: job.id })
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    return;
  }

  const { error } = await admin.from("ai_credit_ledger").insert({
    user_id: job.user_id,
    source: "generation",
    reason: "generation_consume",
    delta: -Math.max(job.credit_cost || 1, 1),
    metadata: {
      job_id: job.id,
      result_bank_id: job.result_bank_id || null,
      source_document_id: job.source_document_id || null,
      prompt_version: "question_bank_pipeline_v1"
    }
  });

  if (error) {
    throw error;
  }
}

async function acquireJobLock(jobId) {
  const admin = createAdminClient();
  const staleBefore = new Date(Date.now() - LOCK_STALE_MS).toISOString();
  const { data, error } = await admin.rpc("acquire_ai_generation_job_lock", {
    p_job_id: jobId,
    p_stale_before: staleBefore
  });

  if (error) {
    throw error;
  }

  return Boolean(data);
}

async function releaseJobLock(jobId) {
  const admin = createAdminClient();
  await admin.rpc("release_ai_generation_job_lock", {
    p_job_id: jobId
  });
}

function buildDeletedActivityPayload(job, subjectExists) {
  const metadata = job.metadata || {};
  const activityMessage = "Fisierul a fost sters.";

  return {
    activityState: "deleted",
    activityMessage,
    activityAt: new Date().toISOString(),
    lastKnownSubjectLabel: metadata.lastKnownSubjectLabel || metadata.subjectLabel || null
  };
}

function shouldAttemptOpenAIPdfFallback({ job, sourceDocument }) {
  return Boolean(
    isPdfSourceDocument(sourceDocument) &&
      sourceDocument?.storage_bucket &&
      sourceDocument?.storage_path &&
      job?.metadata?.pdfProcessingMode !== "openai_fallback"
  );
}

function buildConsolidatedFromFallbackItems(items, options = {}) {
  const normalized = [];
  const rejectReasons = createRejectReasonCounter();
  const seenHashes = new Set();

  for (const rawItem of items || []) {
    const detailed = normalizeChunkItemDetailed(rawItem, null, options);
    if (!detailed.item) {
      registerRejectReason(rejectReasons, detailed.rejectReason);
      continue;
    }

    if (seenHashes.has(detailed.item.normalized_hash)) {
      registerRejectReason(rejectReasons, "duplicate_detected");
      continue;
    }

    seenHashes.add(detailed.item.normalized_hash);
    normalized.push(detailed.item);
  }

  const needsReviewCount = normalized.filter((item) => item.quality_status === "needs_review").length;

  return {
    items: normalized.map((item, index) => ({
      ...item,
      position: index + 1
    })),
    summary: {
      acceptedCount: normalized.length,
      needsReviewCount,
      duplicateCount: rejectReasons.duplicate_detected || 0,
      rejectedCount:
        (rejectReasons.empty_question || 0) +
        (rejectReasons.invalid_answer_count || 0) +
        (rejectReasons.invalid_correct_index || 0),
      rejectReasons
    }
  };
}

async function tryOpenAIPdfFallback({
  job,
  sourceDocument,
  reason,
  model = PDF_PRIMARY_MODEL,
  reasoningEffort = PDF_PRIMARY_REASONING,
  attemptLabel = "primary",
  minimumPublishableCount = MIN_PUBLISHABLE_ITEMS,
  timeoutMs = null,
  throwOnTimeout = false,
  throwOnKnownError = false
}) {
  if (!shouldAttemptOpenAIPdfFallback({ job, sourceDocument })) {
    return null;
  }

  try {
    const buffer = await downloadSourceDocument({
      storageBucket: sourceDocument.storage_bucket,
      storagePath: sourceDocument.storage_path
    });

    const fallback = await extractQuestionBankItemsFromPdfWithOpenAI({
      buffer,
      filename: sourceDocument.original_filename || "document.pdf",
      examType: job.metadata?.examType || "normal",
      subjectName: job.metadata?.subjectLabel || job.metadata?.subjectName || null,
      reason,
      model,
      reasoningEffort,
      timeoutMs,
      userId: job.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId: job.id
    });

    const consolidated = buildConsolidatedFromFallbackItems(fallback.items || [], {
      extractionSource: "openai_file",
      allowNeedsReview: true
    });
    const acceptedCount = consolidated.summary.acceptedCount;
    const rawExtractedCount = Array.isArray(fallback.items) ? fallback.items.length : 0;

    if (acceptedCount < minimumPublishableCount) {
      return {
        kind: "not_publishable",
        reason,
        consolidated,
        notes: fallback.notes || [],
        acceptedCount,
        needsReviewCount: consolidated.summary.needsReviewCount || 0,
        rawExtractedCount,
        publishableThreshold: minimumPublishableCount,
        model,
        reasoningEffort,
        attemptLabel
      };
    }

    return {
      kind: "publishable",
      reason,
      consolidated,
      notes: fallback.notes || [],
      acceptedCount,
      needsReviewCount: consolidated.summary.needsReviewCount || 0,
      rawExtractedCount,
      publishableThreshold: minimumPublishableCount,
      model,
      reasoningEffort,
      attemptLabel
    };
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);

    if (throwOnTimeout && normalizedError.isTimeoutLike) {
      throw normalizedError;
    }

    if (throwOnKnownError && normalizedError.isKnownOpenAIError) {
      throw normalizedError;
    }

    if (throwOnTimeout || throwOnKnownError) {
      throw normalizedError;
    }

    console.error("PDF provider fallback failed", {
      jobId: job.id,
      reason,
      error: normalizedError.message,
      name: normalizedError.name,
      type: normalizedError.type,
      status: normalizedError.status,
      code: normalizedError.code,
      details: normalizedError.details
    });
    return null;
  }
}

function buildPdfAttemptTelemetry({
  attemptLabel,
  model,
  reasoningEffort,
  outcome,
  acceptedCount = 0,
  needsReviewCount = 0,
  rawExtractedCount = 0,
  coverageTargetCount = 0,
  error = null
}) {
  const coveragePercent =
    coverageTargetCount > 0 ? Math.round((Number(acceptedCount || 0) / coverageTargetCount) * 100) : 0;

  return {
    attemptLabel,
    model,
    reasoningEffort,
    outcome,
    acceptedCount: Number(acceptedCount || 0) || 0,
    needsReviewCount: Number(needsReviewCount || 0) || 0,
    rawExtractedCount: Number(rawExtractedCount || 0) || 0,
    coverageTargetCount: Number(coverageTargetCount || 0) || 0,
    coveragePercent,
    error
  };
}

async function runPdfFallbackCoverageLadder({
  job,
  sourceDocument,
  reason,
  estimatedItems = 0,
  minimumPublishableCount = MIN_PUBLISHABLE_ITEMS,
  timeoutMs = null,
  throwOnTimeout = false,
  throwOnKnownError = false
}) {
  const attempts = [
    {
      attemptLabel: "primary",
      model: PDF_PRIMARY_MODEL,
      reasoningEffort: PDF_PRIMARY_REASONING
    },
    {
      attemptLabel: "escalation",
      model: PDF_ESCALATION_MODEL,
      reasoningEffort: PDF_ESCALATION_REASONING
    }
  ];
  const telemetry = [];
  const successfulResults = [];
  let lastError = null;
  let coverageTargetCount = minimumPublishableCount;
  let referenceDetectedCount = Number(estimatedItems || 0) || 0;

  for (let index = 0; index < attempts.length; index += 1) {
    const attempt = attempts[index];

    try {
      const result = await tryOpenAIPdfFallback({
        job,
        sourceDocument,
        reason,
        model: attempt.model,
        reasoningEffort: attempt.reasoningEffort,
        attemptLabel: attempt.attemptLabel,
        minimumPublishableCount,
        timeoutMs,
        throwOnTimeout: true,
        throwOnKnownError: true
      });

      if (!result) {
        telemetry.push(
          buildPdfAttemptTelemetry({
            ...attempt,
            outcome: "no_result",
            coverageTargetCount
          })
        );
        continue;
      }

      const acceptedCount = Number(result.acceptedCount || 0) || 0;
      const needsReviewCount = Number(result.needsReviewCount || 0) || 0;
      const rawExtractedCount = Number(result.rawExtractedCount || 0) || 0;
      if (index === 0) {
        referenceDetectedCount = Math.max(referenceDetectedCount, rawExtractedCount);
        coverageTargetCount = buildCoverageTargetCount({
          estimatedItems: referenceDetectedCount,
          rawExtractedCount,
          minimumPublishableCount
        });
      }

      const outcome = acceptedCount >= coverageTargetCount ? "coverage_met" : "coverage_low";
      telemetry.push(
        buildPdfAttemptTelemetry({
          ...attempt,
          outcome,
          acceptedCount,
          needsReviewCount,
          rawExtractedCount,
          coverageTargetCount
        })
      );

      successfulResults.push(result);
      if (acceptedCount >= coverageTargetCount) {
        return {
          ...result,
          kind: "publishable",
          coverageTargetCount,
          referenceDetectedCount,
          coveragePercent: Math.round((acceptedCount / coverageTargetCount) * 100),
          extractionAttempts: telemetry
        };
      }
    } catch (error) {
      const normalizedError = normalizeOpenAIError(error);
      lastError = normalizedError;
      const outcome = normalizedError.isTimeoutLike ? "timeout" : "failed";
      telemetry.push(
        buildPdfAttemptTelemetry({
          ...attempt,
          outcome,
          coverageTargetCount,
          error: buildFailureContext(normalizedError)
        })
      );
    }
  }

  const bestLowCoverageResult =
    successfulResults
      .slice()
      .sort((left, right) => Number(right.acceptedCount || 0) - Number(left.acceptedCount || 0))[0] || null;

  if (bestLowCoverageResult) {
    const acceptedCount = Number(bestLowCoverageResult.acceptedCount || 0) || 0;
    return {
      ...bestLowCoverageResult,
      kind: "not_publishable",
      coverageTargetCount,
      referenceDetectedCount,
      coveragePercent: coverageTargetCount > 0 ? Math.round((acceptedCount / coverageTargetCount) * 100) : 0,
      extractionAttempts: telemetry
    };
  }

  if (lastError) {
    if (throwOnTimeout && lastError.isTimeoutLike) {
      throw lastError;
    }

    if (throwOnKnownError && lastError.isKnownOpenAIError) {
      throw lastError;
    }

    if (throwOnTimeout || throwOnKnownError) {
      throw lastError;
    }
  }

  return null;
}

async function persistAuthoritativePdfFallback({
  job,
  jobId,
  userId,
  chunkRows = [],
  fallbackResult,
  processingMode = "openai_fallback",
  pdfProcessingMode = "openai_fallback",
  extractionSource = "openai_file"
}) {
  let resultBankId = null;

  try {
    resultBankId = await ensureQuestionBank(job, fallbackResult.consolidated);
  } catch (error) {
    return failPdfFallbackJob({
      jobId,
      userId,
      job,
      chunkRows,
      consolidated: fallbackResult.consolidated,
      failureReason: "pdf_fallback_persist_failed",
      processingMode: "pdf_fallback_persist_failed",
      errorMessage:
        "Fisierul a fost analizat, dar nu am putut salva banca finala. Incearca din nou.",
      statusDetail:
        "Analiza PDF a gasit un set publicabil de intrebari, dar salvarea bancii finale a esuat.",
      extraPatch: {
        pdfProcessingMode,
        pdfFallbackReason: fallbackResult.reason,
        pdfFallbackItemCount: fallbackResult.acceptedCount,
        pdfFallbackNotes: fallbackResult.notes,
        pdfFallbackUsedAsResult: true,
        pdfFallbackPublishableThreshold: fallbackResult.publishableThreshold,
        pdfFallbackCoverageTargetCount:
          fallbackResult.coverageTargetCount || fallbackResult.publishableThreshold,
        pdfFallbackCoveragePercent: fallbackResult.coveragePercent || 0,
        pdfFallbackAttemptModels: fallbackResult.extractionAttempts || [],
        extractionSource,
        lastFailureContext: buildFailureContext(error),
        consolidationDiagnostics: {
          pdfFallbackOutcome: "persist_failed",
          pdfFallbackAcceptedCount: fallbackResult.acceptedCount,
          needsReviewCount: fallbackResult.needsReviewCount || 0,
          rawExtractedCount: fallbackResult.rawExtractedCount || fallbackResult.acceptedCount,
          rejectedReasonCounts: fallbackResult.consolidated?.summary?.rejectReasons || null,
          extractionSource,
          publishableThreshold: fallbackResult.publishableThreshold,
          coverageTargetCount: fallbackResult.coverageTargetCount || fallbackResult.publishableThreshold,
          coveragePercent: fallbackResult.coveragePercent || 0,
          extractionAttempts: fallbackResult.extractionAttempts || [],
          fallbackUsedAsAuthoritative: true
        }
      }
    });
  }

  try {
    return finalizeQuestionBankReview({
      job,
      resultBankId,
      consolidatedSummary: fallbackResult.consolidated.summary,
      metadataPatch: {
        processingMode,
        currentStage: "review",
        finalFailureReason: null,
        pdfProcessingMode,
        pdfFallbackReason: fallbackResult.reason,
        pdfFallbackItemCount: fallbackResult.acceptedCount,
        pdfFallbackNotes: fallbackResult.notes,
        pdfFallbackUsedAsResult: true,
        pdfFallbackPublishableThreshold: fallbackResult.publishableThreshold,
        pdfFallbackCoverageTargetCount:
          fallbackResult.coverageTargetCount || fallbackResult.publishableThreshold,
        pdfFallbackCoveragePercent: fallbackResult.coveragePercent || 0,
        pdfFallbackAttemptModels: fallbackResult.extractionAttempts || [],
        extractionSource,
        consolidationDiagnostics: buildConsolidationDiagnostics(job, {
          chunkRows,
          consolidated: fallbackResult.consolidated,
          patch: {
            usedPdfFallback: true,
            pdfFallbackOutcome: "used",
            pdfFallbackAcceptedCount: fallbackResult.acceptedCount,
            needsReviewCount: fallbackResult.needsReviewCount || 0,
            rawExtractedCount: fallbackResult.rawExtractedCount || fallbackResult.acceptedCount,
            rejectedReasonCounts: fallbackResult.consolidated?.summary?.rejectReasons || null,
            extractionSource,
            publishableThreshold: fallbackResult.publishableThreshold,
            coverageTargetCount: fallbackResult.coverageTargetCount || fallbackResult.publishableThreshold,
            coveragePercent: fallbackResult.coveragePercent || 0,
            extractionAttempts: fallbackResult.extractionAttempts || [],
            fallbackUsedAsAuthoritative: true,
            finalFailureReason: null
          }
        })
      },
      statusDetail:
        fallbackResult.needsReviewCount
          ? `Am extras ${fallbackResult.acceptedCount} intrebari din fisier. ${fallbackResult.needsReviewCount} cer verificare mai atenta.`
          : "Rezultatul este gata. Verifica intrebarile si confirma publicarea."
    });
  } catch (error) {
    return failPdfFallbackJob({
      jobId,
      userId,
      job,
      chunkRows,
      consolidated: fallbackResult.consolidated,
      failureReason: "pdf_fallback_review_finalize_failed",
      processingMode: "pdf_fallback_review_finalize_failed",
      errorMessage:
        "Fisierul a fost analizat, dar nu am putut finaliza pregatirea pentru verificare. Incearca din nou.",
      statusDetail:
        "Analiza PDF a produs un set publicabil de intrebari, dar ultimul pas de pregatire pentru verificare a esuat.",
      extraPatch: {
        pdfProcessingMode,
        pdfFallbackReason: fallbackResult.reason,
        pdfFallbackItemCount: fallbackResult.acceptedCount,
        pdfFallbackNotes: fallbackResult.notes,
        pdfFallbackUsedAsResult: true,
        pdfFallbackPublishableThreshold: fallbackResult.publishableThreshold,
        pdfFallbackCoverageTargetCount:
          fallbackResult.coverageTargetCount || fallbackResult.publishableThreshold,
        pdfFallbackCoveragePercent: fallbackResult.coveragePercent || 0,
        pdfFallbackAttemptModels: fallbackResult.extractionAttempts || [],
        extractionSource,
        lastFailureContext: buildFailureContext(error),
        consolidationDiagnostics: {
          pdfFallbackOutcome: "review_finalize_failed",
          pdfFallbackAcceptedCount: fallbackResult.acceptedCount,
          needsReviewCount: fallbackResult.needsReviewCount || 0,
          rawExtractedCount: fallbackResult.rawExtractedCount || fallbackResult.acceptedCount,
          rejectedReasonCounts: fallbackResult.consolidated?.summary?.rejectReasons || null,
          extractionSource,
          publishableThreshold: fallbackResult.publishableThreshold,
          coverageTargetCount: fallbackResult.coverageTargetCount || fallbackResult.publishableThreshold,
          coveragePercent: fallbackResult.coveragePercent || 0,
          extractionAttempts: fallbackResult.extractionAttempts || [],
          fallbackUsedAsAuthoritative: true
        }
      }
    });
  }
}

export async function backfillDeletedQuestionBankJobs({ userId = null } = {}) {
  const admin = createAdminClient();
  let query = admin
    .from("ai_generation_jobs")
    .select("id, user_id, status, result_bank_id, metadata")
    .eq("job_kind", JOB_KIND)
    .eq("status", "succeeded");

  if (userId) {
    query = query.eq("user_id", userId);
  }

  const { data: jobs, error: jobsError } = await query;
  if (jobsError) {
    throw jobsError;
  }

  const succeededJobs = jobs || [];
  if (!succeededJobs.length) {
    return { scanned: 0, repaired: 0 };
  }

  const bankIds = Array.from(new Set(succeededJobs.map((job) => job.result_bank_id).filter(Boolean)));
  const subjectIds = Array.from(
    new Set(
      succeededJobs
        .map((job) => job.metadata?.subjectId)
        .filter((subjectId) => subjectId && subjectId !== "custom")
    )
  );

  const [banksResult, subjectsResult] = await Promise.all([
    bankIds.length
      ? admin.from("ai_question_banks").select("id").in("id", bankIds)
      : Promise.resolve({ data: [], error: null }),
    subjectIds.length
      ? admin.from("subjects").select("id").in("id", subjectIds)
      : Promise.resolve({ data: [], error: null })
  ]);

  if (banksResult.error) {
    throw banksResult.error;
  }

  if (subjectsResult.error) {
    throw subjectsResult.error;
  }

  const existingBankIds = new Set((banksResult.data || []).map((row) => row.id));
  const existingSubjectIds = new Set((subjectsResult.data || []).map((row) => row.id));

  let repaired = 0;

  for (const job of succeededJobs) {
    const metadata = job.metadata || {};
    const currentState = metadata.activityState || null;
    const subjectId = metadata.subjectId || null;
    const examType = metadata.examType || "normal";
    const hasBankRef = Boolean(job.result_bank_id);
    const bankExists = hasBankRef ? existingBankIds.has(job.result_bank_id) : false;
    const hasNormalSubject = examType !== "licenta" && subjectId && subjectId !== "custom";
    const subjectExists = hasNormalSubject ? existingSubjectIds.has(subjectId) : true;
    const isOrphaned =
      (hasBankRef && !bankExists) || (!hasBankRef && hasNormalSubject && !subjectExists);

    if (!isOrphaned || currentState === "deleted") {
      continue;
    }

    const nextMetadata = {
      ...metadata,
      ...buildDeletedActivityPayload(job, subjectExists)
    };

    const { error } = await admin
      .from("ai_generation_jobs")
      .update({
        metadata: nextMetadata,
        status_detail: nextMetadata.activityMessage
      })
      .eq("id", job.id);

    if (error) {
      throw error;
    }

    repaired += 1;
  }

  return {
    scanned: succeededJobs.length,
    repaired
  };
}

export async function createQuestionBankJob({
  userId,
  sourceDocumentId,
  sourceFilename,
  extractionMetadata = null,
  parsedInput,
  academicContext
}) {
  const admin = createAdminClient();
  const createdAt = new Date().toISOString();
  const metadata = {
    subjectId: parsedInput.examType === "licenta" ? null : parsedInput.subjectId || null,
    subjectLabel:
      parsedInput.examType === "licenta"
        ? parsedInput.subjectLabel || LICENTA_GENERAL_LABEL
        : parsedInput.subjectLabel || null,
    examType: parsedInput.examType,
    semester: parsedInput.examType === "licenta" ? null : parsedInput.semester || null,
    studentYear: parsedInput.examType === "licenta" ? null : parsedInput.studentYear || null,
    schoolClass: parsedInput.examType === "licenta" ? null : parsedInput.schoolClass || null,
    userType: parsedInput.userType,
    sourceFilename: sourceFilename || null,
    ...(extractionMetadata || {}),
    visibilityScope: "cohort",
    targetCohortId: academicContext.membership.cohort_id,
    targetUnitId: academicContext.membership.program_unit_id,
    targetInstitutionId: academicContext.membership.institution_id
  };

  const { data, error } = await admin
    .from("ai_generation_jobs")
    .insert({
      user_id: userId,
      source_document_id: sourceDocumentId,
      status: "pending",
      credit_cost: 1,
      job_kind: JOB_KIND,
      stage: "queued",
      progress_percent: 0,
      status_detail: "Fisierul a fost incarcat. Pregatim analiza documentului.",
      last_progress_at: createdAt,
      metadata
    })
    .select("id")
    .single();

  if (error) {
    throw error;
  }

  return data.id;
}

function buildSingleFileExtractionAttempt({
  model,
  reasoningEffort,
  outcome,
  acceptedCount = 0,
  needsReviewCount = 0,
  rawExtractedCount = 0,
  coverageTargetCount = 0,
  error = null
}) {
  return buildPdfAttemptTelemetry({
    attemptLabel: "single_file",
    model,
    reasoningEffort,
    outcome,
    acceptedCount,
    needsReviewCount,
    rawExtractedCount,
    coverageTargetCount,
    error
  });
}

async function startOpenAIPdfSingleFileJob({
  job,
  jobId,
  userId,
  sourceDocument,
  resetChunks = false
}) {
  let uploadedFile = null;
  let response = null;
  const startedAt = new Date().toISOString();
  const filename = sourceDocument.original_filename || "document.pdf";
  const subjectName = job.metadata?.subjectLabel || LICENTA_GENERAL_LABEL;

  try {
    if (resetChunks) {
      await deleteChunkRows(jobId);
    }

    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      progress_percent: 5,
      error_message: null,
      completed_at: null,
      routing_mode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
      status_detail: "Verificam structura fisierului.",
      metadata: buildStageMetadata(job, "extracting", OPENAI_PDF_SINGLE_FILE_ROUTING_MODE, {
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        extractionSource: "openai_file",
        sourceKind: "pdf",
        openaiPdfSingleFileStartedAt: startedAt
      })
    });

    const buffer = await downloadSourceDocument({
      storageBucket: sourceDocument.storage_bucket,
      storagePath: sourceDocument.storage_path
    });

    uploadedFile = await uploadPdfForOpenAIExtraction({
      buffer,
      filename,
      examType: "licenta",
      subjectName,
      reason: "openai_pdf_single_file",
      model: PDF_PRIMARY_MODEL,
      reasoningEffort: PDF_PRIMARY_REASONING,
      timeoutMs: OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS,
      userId: job.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId
    });

    await updateJob(jobId, {
      status: "processing",
      stage: "profiling",
      progress_percent: 8,
      error_message: null,
      completed_at: null,
      routing_mode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
      status_detail: "Verificam structura fisierului.",
      metadata: buildStageMetadata(job, "profiling", OPENAI_PDF_SINGLE_FILE_ROUTING_MODE, {
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        extractionSource: "openai_file",
        sourceKind: "pdf",
        openaiPdfSingleFileId: uploadedFile.id,
        openaiPdfSingleFileUploadedAt: new Date().toISOString(),
        openaiPdfSingleFileDeletedAt: null,
        openaiPdfSingleFileStartedAt: startedAt
      })
    });

    const openAIProfile = normalizeOpenAIPdfProfile(
      await profileQuestionBankPdfFromOpenAIFile({
        openaiFileId: uploadedFile.id,
        filename,
        examType: "licenta",
        subjectName,
        reason: "openai_pdf_single_file_manifest",
        model: PDF_PRIMARY_MODEL,
        reasoningEffort: PDF_PRIMARY_REASONING,
        timeoutMs: OPENAI_PDF_BATCH_TIMEOUT_MS,
        userId: job.user_id,
        sourceDocumentId: sourceDocument.id,
        jobId
      })
    );

    if (openAIProfile.detectedFormat !== "qa_extract") {
      await updateJob(jobId, {
        status: "failed",
        stage: "failed",
        progress_percent: 8,
        error_message:
          "Nu am putut confirma ca fisierul contine o banca de intrebari grila utilizabila.",
        status_detail:
          "Verificarea fisierului nu a gasit suficiente semnale de intrebari si raspunsuri.",
        completed_at: new Date().toISOString(),
        metadata: buildStageMetadata(job, "failed", OPENAI_PDF_SINGLE_FILE_ROUTING_MODE, {
          sourceKind: "pdf",
          pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
          extractionSource: "openai_file",
          qualitySignals: openAIProfile.qualitySignals,
          estimatedItems: openAIProfile.estimatedItems,
          openaiPdfSingleFileId: uploadedFile.id,
          openaiPdfSingleFileUploadedAt: new Date().toISOString(),
          finalFailureReason: "openai_pdf_single_file_invalid_profile"
        })
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    if (openAIProfile.estimatedItems > OPENAI_PDF_SINGLE_FILE_MAX_ITEMS) {
      const batchPlan = buildOpenAIPdfBatchPlan({
        estimatedItems: openAIProfile.estimatedItems,
        batchSize: OPENAI_PDF_BATCH_SIZE
      });

      await insertChunkRows(
        batchPlan.map((chunk) => ({
          job_id: jobId,
          chunk_index: chunk.chunk_index,
          status: "pending",
          source_start: chunk.source_start,
          source_end: chunk.source_end,
          estimated_items: chunk.estimated_items,
          payload: {
            ...(chunk.payload || {}),
            openaiFileId: uploadedFile.id
          }
        }))
      );

      await updateJob(jobId, {
        status: "processing",
        stage: "extracting",
        progress_percent: 12,
        error_message: null,
        completed_at: null,
        processing_profile: openAIProfile.profile,
        routing_mode: OPENAI_PDF_BATCH_ROUTING_MODE,
        status_detail: "Pregatim fisierul pentru analiza.",
        metadata: buildStageMetadata(job, "extracting", OPENAI_PDF_BATCH_ROUTING_MODE, {
          pdfProcessingMode: OPENAI_PDF_BATCH_ROUTING_MODE,
          processingMode: OPENAI_PDF_BATCH_ROUTING_MODE,
          extractionSource: "openai_file",
          sourceKind: "pdf",
          qualitySignals: openAIProfile.qualitySignals,
          estimatedItems: openAIProfile.estimatedItems,
          answeredBlocks: openAIProfile.answeredBlocks,
          answerSignals: openAIProfile.answerSignals,
          chunkCount: batchPlan.length,
          openaiPdfBatchSize: OPENAI_PDF_BATCH_SIZE,
          openaiPdfBatchTotalCount: batchPlan.length,
          openaiPdfBatchUsesSingleUploadedFile: true,
          openaiPdfBatchFileId: uploadedFile.id,
          openaiPdfBatchFileUploadedAt: new Date().toISOString(),
          openaiPdfBatchStartedAt: startedAt,
          openaiPdfBatchManifest: {
            estimatedItems: openAIProfile.estimatedItems,
            chunkCount: batchPlan.length,
            batchSize: OPENAI_PDF_BATCH_SIZE,
            profile: openAIProfile.profile
          }
        })
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    response = await createQuestionBankItemsOpenAIResponse({
      openaiFileId: uploadedFile.id,
      filename,
      examType: "licenta",
      subjectName,
      reason: "openai_pdf_single_file",
      model: PDF_PRIMARY_MODEL,
      reasoningEffort: PDF_PRIMARY_REASONING,
      timeoutMs: OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS,
      maxOutputTokens: OPENAI_PDF_SINGLE_FILE_MAX_OUTPUT_TOKENS,
      userId: job.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId
    });

    const responseStatus = String(response?.status || "queued");
    const requestCreatedAt = new Date().toISOString();
    if (!response?.id) {
      throw new Error("ID-ul raspunsului de procesare lipseste pentru fisier.");
    }

    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      progress_percent: 14,
      error_message: null,
      completed_at: null,
      routing_mode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
      status_detail: "Asteptam finalizarea analizei fisierului.",
      metadata: buildStageMetadata(job, "extracting", OPENAI_PDF_SINGLE_FILE_ROUTING_MODE, {
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        extractionSource: "openai_file",
        sourceKind: "pdf",
        qualitySignals: openAIProfile.qualitySignals,
        estimatedItems: openAIProfile.estimatedItems,
        answeredBlocks: openAIProfile.answeredBlocks,
        answerSignals: openAIProfile.answerSignals,
        chunkCount: 1,
        openaiPdfSingleFileId: uploadedFile.id,
        openaiPdfSingleFileResponseId: response.id,
        openaiPdfSingleFileRequestStatus: responseStatus,
        openaiPdfSingleFileUploadedAt: new Date().toISOString(),
        openaiPdfSingleFileDeletedAt: null,
        openaiPdfSingleFileStartedAt: startedAt,
        openaiPdfSingleFileAttemptCount: 1,
        openaiPdfSingleFileRetryCount: 0,
        openaiPdfSingleFileRequestCreatedAt: requestCreatedAt,
        openaiPdfSingleFileLastPolledAt: null,
        openaiPdfSingleFileNextPollAt: buildOpenAIPdfSingleFileNextPollAt(),
        openaiPdfSingleFileFailureCode: null,
        openaiPdfSingleFileFailureMessage: null
      })
    });

    return getQuestionBankJobSnapshot({ jobId, userId });
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    const failedJob = {
      ...job,
      metadata: {
        ...(job.metadata || {}),
        ...(uploadedFile?.id
          ? {
              openaiPdfSingleFileId: uploadedFile.id,
              openaiPdfSingleFileUploadedAt: new Date().toISOString(),
              openaiPdfSingleFileDeletedAt: null
            }
          : {})
      }
    };

    if (isPermanentOpenAIError(normalizedError)) {
      return failOpenAIProviderJob({
        jobId,
        userId,
        job: failedJob,
        error: normalizedError,
        progressPercent: uploadedFile?.id ? 8 : 5,
        processingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        openaiFileId: uploadedFile?.id || null,
        openaiResponseId: response?.id || null,
        extraPatch: {
          openaiPdfSingleFileId: uploadedFile?.id || null,
          openaiPdfSingleFileResponseId: response?.id || null,
          openaiPdfSingleFileFailureCode: getOpenAIProviderFailureCode(normalizedError),
          openaiPdfSingleFileFailureMessage: normalizedError.message
        }
      });
    }

    await updateJob(jobId, {
      status: "failed",
      stage: "failed",
      progress_percent: 8,
      error_message:
        "Nu am putut pregati fisierul pentru analiza. Incearca din nou.",
      status_detail:
        "Procesarea s-a oprit inainte de extragerea intrebarilor din fisier.",
      completed_at: new Date().toISOString(),
      metadata: buildStageMetadata(failedJob, "failed", OPENAI_PDF_SINGLE_FILE_ROUTING_MODE, {
        sourceKind: "pdf",
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        extractionSource: "openai_file",
        openaiPdfSingleFileId: uploadedFile?.id || null,
        openaiPdfSingleFileResponseId: response?.id || null,
        openaiPdfSingleFileFailureCode: normalizedError.code || null,
        openaiPdfSingleFileFailureMessage: normalizedError.message,
        finalFailureReason: "openai_pdf_single_file_start_failed",
        lastFailureContext: buildFailureContext(normalizedError)
      })
    });

    return getQuestionBankJobSnapshot({ jobId, userId });
  }
}

async function startOpenAIPdfBatchedJob({
  job,
  jobId,
  userId,
  sourceDocument,
  profile,
  resetChunks = false
}) {
  let uploadedFile = null;
  const startedAt = new Date().toISOString();

  try {
    if (resetChunks) {
      await deleteChunkRows(jobId);
    }

    const seedProfile = normalizeOpenAIPdfProfile(
      profile || {
        estimatedItems: job.metadata?.estimatedItems || OPENAI_PDF_BATCH_SIZE,
        detectedFormat: "qa_extract",
        qualitySignals: ["Verificam structura fisierului."]
      }
    );

    await updateJob(jobId, {
      status: "processing",
      stage: "profiling",
      progress_percent: 5,
      error_message: null,
      completed_at: null,
      processing_profile: seedProfile.profile,
      routing_mode: OPENAI_PDF_BATCH_ROUTING_MODE,
      status_detail: "Verificam structura fisierului.",
      metadata: buildStageMetadata(job, "profiling", OPENAI_PDF_BATCH_ROUTING_MODE, {
        pdfProcessingMode: OPENAI_PDF_BATCH_ROUTING_MODE,
        extractionSource: "openai_file",
        sourceKind: "pdf",
        qualitySignals: seedProfile.qualitySignals,
        estimatedItems: seedProfile.estimatedItems,
        answeredBlocks: seedProfile.answeredBlocks,
        answerSignals: seedProfile.answerSignals,
        openaiPdfBatchStartedAt: startedAt
      })
    });

    const buffer = await downloadSourceDocument({
      storageBucket: sourceDocument.storage_bucket,
      storagePath: sourceDocument.storage_path
    });

    uploadedFile = await uploadPdfForOpenAIExtraction({
      buffer,
      filename: sourceDocument.original_filename || "document.pdf",
      examType: "licenta",
      subjectName: job.metadata?.subjectLabel || LICENTA_GENERAL_LABEL,
      reason: "openai_pdf_batched",
      model: PDF_PRIMARY_MODEL,
      reasoningEffort: PDF_PRIMARY_REASONING,
      timeoutMs: OPENAI_PDF_BATCH_TIMEOUT_MS,
      userId: job.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId
    });

    const openAIProfile = normalizeOpenAIPdfProfile(
      await profileQuestionBankPdfFromOpenAIFile({
        openaiFileId: uploadedFile.id,
        filename: sourceDocument.original_filename || "document.pdf",
        examType: "licenta",
        subjectName: job.metadata?.subjectLabel || LICENTA_GENERAL_LABEL,
        reason: "openai_pdf_batched_profile",
        model: PDF_PRIMARY_MODEL,
        reasoningEffort: PDF_PRIMARY_REASONING,
        timeoutMs: OPENAI_PDF_BATCH_TIMEOUT_MS,
        userId: job.user_id,
        sourceDocumentId: sourceDocument.id,
        jobId
      })
    );

    if (openAIProfile.detectedFormat !== "qa_extract") {
      await updateJob(jobId, {
        status: "failed",
        stage: "failed",
        progress_percent: 8,
        error_message:
          "Nu am putut confirma ca PDF-ul contine o banca de intrebari grila utilizabila.",
        status_detail:
          "Verificarea fisierului nu a gasit suficiente semnale de intrebari si raspunsuri.",
        completed_at: new Date().toISOString(),
        metadata: buildStageMetadata(job, "failed", "openai_pdf_batched_profile_failed", {
          sourceKind: "pdf",
          pdfProcessingMode: OPENAI_PDF_BATCH_ROUTING_MODE,
          extractionSource: "openai_file",
          qualitySignals: openAIProfile.qualitySignals,
          estimatedItems: openAIProfile.estimatedItems,
          openaiPdfBatchFileId: uploadedFile.id,
          openaiPdfBatchFileUploadedAt: new Date().toISOString(),
          finalFailureReason: "openai_pdf_batched_invalid_profile"
        })
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    const batchPlan = buildOpenAIPdfBatchPlan({
      estimatedItems: openAIProfile.estimatedItems,
      batchSize: OPENAI_PDF_BATCH_SIZE
    });

    await insertChunkRows(
      batchPlan.map((chunk) => ({
        job_id: jobId,
        chunk_index: chunk.chunk_index,
        status: "pending",
        source_start: chunk.source_start,
        source_end: chunk.source_end,
        estimated_items: chunk.estimated_items,
        payload: chunk.payload
      }))
    );

    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      progress_percent: 12,
      error_message: null,
      completed_at: null,
      processing_profile: openAIProfile.profile,
      routing_mode: OPENAI_PDF_BATCH_ROUTING_MODE,
      status_detail: "Pregatim fisierul pentru analiza.",
      metadata: buildStageMetadata(job, "extracting", OPENAI_PDF_BATCH_ROUTING_MODE, {
        pdfProcessingMode: OPENAI_PDF_BATCH_ROUTING_MODE,
        extractionSource: "openai_file",
        sourceKind: "pdf",
        qualitySignals: openAIProfile.qualitySignals,
        estimatedItems: openAIProfile.estimatedItems,
        answeredBlocks: openAIProfile.answeredBlocks,
        answerSignals: openAIProfile.answerSignals,
        chunkCount: batchPlan.length,
        openaiPdfBatchSize: OPENAI_PDF_BATCH_SIZE,
        openaiPdfBatchTotalCount: batchPlan.length,
        openaiPdfBatchFileId: uploadedFile.id,
        openaiPdfBatchFileUploadedAt: new Date().toISOString(),
        openaiPdfBatchStartedAt: startedAt
      })
    });

    return getQuestionBankJobSnapshot({ jobId, userId });
  } catch (error) {
    if (uploadedFile?.id) {
      try {
        await deleteOpenAIPdfExtractionFile({
          fileId: uploadedFile.id,
          filename: sourceDocument.original_filename || "document.pdf",
          examType: "licenta",
          subjectName: job.metadata?.subjectLabel || LICENTA_GENERAL_LABEL,
          reason: "openai_pdf_batched_start_failed",
          userId: job.user_id,
          sourceDocumentId: sourceDocument.id,
          jobId
        });
      } catch {
        // Cleanup failures are logged by the lower-level helper when possible.
      }
    }

    const normalizedError = normalizeOpenAIError(error);
    await updateJob(jobId, {
      status: "failed",
      stage: "failed",
      progress_percent: 8,
      error_message:
        "Nu am putut pregati PDF-ul pentru analiza. Incearca din nou.",
      status_detail:
        "Procesarea s-a oprit inainte de extragerea intrebarilor din PDF.",
      completed_at: new Date().toISOString(),
      metadata: buildStageMetadata(job, "failed", "openai_pdf_batched_failed", {
        sourceKind: "pdf",
        finalFailureReason: "openai_pdf_batched_start_failed",
        lastFailureContext: buildFailureContext(normalizedError)
      })
    });

    return getQuestionBankJobSnapshot({ jobId, userId });
  }
}

function buildJobProcessingState(job) {
  const stageEnteredAt = job.metadata?.stageEnteredAt || job.started_at || job.created_at || null;
  const lockedAt = job.locked_at || null;
  const startedAt = job.started_at || null;
  const lastHeartbeatAt = job.last_heartbeat_at || null;
  const lastProgressAt = job.last_progress_at || null;
  const stageTimestamp = parseTimestamp(stageEnteredAt);
  const lockTimestamp = parseTimestamp(lockedAt);
  const heartbeatTimestamp = parseTimestamp(lastHeartbeatAt);
  const stageAgeMs = stageTimestamp !== null ? Date.now() - stageTimestamp : null;
  const lockAgeMs = lockTimestamp !== null ? Date.now() - lockTimestamp : null;
  const heartbeatAgeMs =
    heartbeatTimestamp !== null ? Date.now() - heartbeatTimestamp : null;
  const processingMode =
    job.metadata?.processingMode ||
    (job.metadata?.pdfProcessingMode === "openai_fallback" ? "openai_fallback" : null);
  const isConsolidationStalled =
    job.status === "processing" &&
    job.stage === "consolidating" &&
    stageAgeMs !== null &&
    stageAgeMs >= CONSOLIDATING_STALE_MS &&
    (lockAgeMs === null || lockAgeMs >= LOCK_STALE_MS);
  const isHeartbeatStalled =
    job.status === "processing" &&
    heartbeatAgeMs !== null &&
    heartbeatAgeMs >= PROCESSING_HEARTBEAT_STALE_MS &&
    (lockAgeMs === null || lockAgeMs >= PROCESSING_HEARTBEAT_STALE_MS);
  const isLikelyStalled = isConsolidationStalled || isHeartbeatStalled;
  const canResumeFromFailure = isResumableFallbackFailure(job);

  return {
    startedAt,
    lockedAt,
    stageEnteredAt,
    lastHeartbeatAt,
    lastProgressAt,
    processingMode,
    extractionSource: job.metadata?.extractionSource || null,
    isLikelyStalled,
    canResumeProcessing:
      canResumeFromFailure ||
      canResumeOpenAIPdfSingleFileFailure(job) ||
      canResumeOpenAIPdfBatchedFailure(job) ||
      canRestartAsOpenAIPdfBatched(job) ||
      (job.status === "processing" &&
        job.stage === "consolidating" &&
        isLikelyStalled),
    consolidatingStaleAfterSeconds: Math.floor(CONSOLIDATING_STALE_MS / 1000),
    heartbeatStaleAfterSeconds: Math.floor(PROCESSING_HEARTBEAT_STALE_MS / 1000)
  };
}

export async function getQuestionBankJobSnapshot({ jobId, userId }) {
  await backfillDeletedQuestionBankJobs({ userId });
  const admin = createAdminClient();
  const { data: job, error: jobError } = await admin
    .from("ai_generation_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .eq("job_kind", JOB_KIND)
    .maybeSingle();

  if (jobError) {
    throw jobError;
  }

  if (!job) {
    return null;
  }

  const [chunkRows, bankSummaryMap] = await Promise.all([
    getChunkRows(jobId),
    getQuestionBankSummaryMap(job.result_bank_id ? [job.result_bank_id] : [])
  ]);

  const bank = job.result_bank_id ? bankSummaryMap.get(job.result_bank_id) || null : null;

  const chunkSummary = {
    total: chunkRows.length,
    pending: chunkRows.filter((row) => row.status === "pending").length,
    retry: chunkRows.filter((row) => row.status === "retry").length,
    processing: chunkRows.filter((row) => row.status === "processing").length,
    succeeded: chunkRows.filter((row) => row.status === "succeeded").length,
    failed: chunkRows.filter((row) => row.status === "failed").length
  };

  const canRetryFailedChunks =
    job.status === "failed" &&
    chunkRows.some((row) => row.status === "failed" && row.attempt_count < MAX_MANUAL_CHUNK_ATTEMPTS);
  const processingState = buildJobProcessingState(job);
  const diagnostics = job.metadata?.consolidationDiagnostics || null;
  const coverageTargetCount =
    Number(diagnostics?.coverageTargetCount || diagnostics?.publishableThreshold || 0) || 0;
  const acceptedCount = Number(diagnostics?.acceptedCount || job.metadata?.consolidationSummary?.acceptedCount || 0) || 0;
  const needsReviewCount =
    Number(diagnostics?.needsReviewCount || job.metadata?.consolidationSummary?.needsReviewCount || 0) || 0;
  const rejectedCount =
    Number(diagnostics?.rejectedCount || job.metadata?.consolidationSummary?.rejectedCount || 0) || 0;
  const rawExtractedCount = Number(diagnostics?.rawExtractedCount || 0) || 0;
  const coveragePercent =
    Number(diagnostics?.coveragePercent || (coverageTargetCount > 0 ? Math.round((acceptedCount / coverageTargetCount) * 100) : 0)) || 0;

  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progressPercent: job.progress_percent || 0,
    processingProfile: job.processing_profile || null,
    routingMode: job.routing_mode || null,
    statusDetail: job.status_detail || null,
    errorMessage: job.error_message || null,
    createdAt: job.created_at,
    startedAt: processingState.startedAt,
    lockedAt: processingState.lockedAt,
    stageEnteredAt: processingState.stageEnteredAt,
    lastHeartbeatAt: processingState.lastHeartbeatAt,
    lastProgressAt: processingState.lastProgressAt,
    elapsedSeconds: secondsSince(processingState.startedAt || job.created_at),
    stageElapsedSeconds: secondsSince(processingState.stageEnteredAt || job.created_at),
    lastHeartbeatAgeSeconds: secondsSince(processingState.lastHeartbeatAt),
    lastProgressAgeSeconds: secondsSince(processingState.lastProgressAt),
    processingAttemptCount: job.processing_attempt_count || 0,
    completedAt: job.completed_at,
    resultBankId: job.result_bank_id || null,
    resultGeneratedTestId: job.generated_test_id || null,
    resultQuestionCount: bank?.question_count || 0,
    resultHref: buildResultHref(job, bank),
    reviewHref: job.result_bank_id && bank ? buildReviewHref(job.result_bank_id) : null,
    bankStatus: bank?.status || null,
    bankTitle: bank?.title || null,
    activityState: getActivityState(job, bank),
    activityMessage: getActivityMessage(job, bank),
    processingMode: processingState.processingMode,
    extractionSource: processingState.extractionSource,
    isLikelyStalled: processingState.isLikelyStalled,
    canResumeProcessing: processingState.canResumeProcessing,
    consolidatingStaleAfterSeconds: processingState.consolidatingStaleAfterSeconds,
    heartbeatStaleAfterSeconds: processingState.heartbeatStaleAfterSeconds,
    finalFailureReason: job.metadata?.finalFailureReason || null,
    rawExtractedCount,
    acceptedCount,
    needsReviewCount,
    rejectedCount,
    coverageTargetCount,
    coveragePercent,
    rejectionReasons: diagnostics?.rejectedReasonCounts || null,
    extractionAttempts: Array.isArray(diagnostics?.extractionAttempts) ? diagnostics.extractionAttempts : [],
    consolidationDiagnostics: diagnostics,
    metadata: job.metadata || {},
    chunks: chunkSummary,
    canRetryFailedChunks
  };
}

export async function getUserQuestionBankJobs(userId, limit = 8) {
  await backfillDeletedQuestionBankJobs({ userId });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_generation_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("job_kind", JOB_KIND)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  const bankSummaryMap = await getQuestionBankSummaryMap(
    (data || []).map((job) => job.result_bank_id).filter(Boolean)
  );

  return (data || [])
    .filter(
      (job) =>
        !(
          job.result_bank_id &&
          job.status === "succeeded" &&
          !bankSummaryMap.get(job.result_bank_id) &&
          job.metadata?.activityState !== "deleted"
        )
    )
    .map((job) => {
    const bank = job.result_bank_id ? bankSummaryMap.get(job.result_bank_id) || null : null;
    const activityState = getActivityState(job, bank);
    const isDeleted = activityState === "deleted";
    const reviewHref = job.result_bank_id && bank ? buildReviewHref(job.result_bank_id) : null;
    const resultHref = isDeleted ? null : buildResultHref(job, bank);
    const processingState = buildJobProcessingState(job);
    const diagnostics = job.metadata?.consolidationDiagnostics || null;
    const coverageTargetCount =
      Number(diagnostics?.coverageTargetCount || diagnostics?.publishableThreshold || 0) || 0;
    const acceptedCount =
      Number(diagnostics?.acceptedCount || job.metadata?.consolidationSummary?.acceptedCount || 0) || 0;
    const needsReviewCount =
      Number(diagnostics?.needsReviewCount || job.metadata?.consolidationSummary?.needsReviewCount || 0) || 0;
    const rejectedCount =
      Number(diagnostics?.rejectedCount || job.metadata?.consolidationSummary?.rejectedCount || 0) || 0;
    const rawExtractedCount = Number(diagnostics?.rawExtractedCount || 0) || 0;
    const coveragePercent =
      Number(
        diagnostics?.coveragePercent ||
          (coverageTargetCount > 0 ? Math.round((acceptedCount / coverageTargetCount) * 100) : 0)
      ) || 0;

    return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progressPercent: job.progress_percent || 0,
    processingProfile: job.processing_profile || null,
    statusDetail: job.status_detail || null,
    errorMessage: job.error_message || null,
    createdAt: job.created_at,
    startedAt: processingState.startedAt,
    lockedAt: processingState.lockedAt,
    stageEnteredAt: processingState.stageEnteredAt,
    lastHeartbeatAt: processingState.lastHeartbeatAt,
    lastProgressAt: processingState.lastProgressAt,
    elapsedSeconds: secondsSince(processingState.startedAt || job.created_at),
    stageElapsedSeconds: secondsSince(processingState.stageEnteredAt || job.created_at),
    lastHeartbeatAgeSeconds: secondsSince(processingState.lastHeartbeatAt),
    lastProgressAgeSeconds: secondsSince(processingState.lastProgressAt),
    processingAttemptCount: job.processing_attempt_count || 0,
    processingMode: processingState.processingMode,
    extractionSource: processingState.extractionSource,
    resultHref,
    reviewHref: isDeleted ? null : reviewHref,
    bankStatus: bank?.status || null,
    resultQuestionCount: bank?.question_count || 0,
    activityState,
    activityMessage: getActivityMessage(job, bank),
    isLikelyStalled: processingState.isLikelyStalled,
    canResumeProcessing: processingState.canResumeProcessing,
    finalFailureReason: job.metadata?.finalFailureReason || null,
    rawExtractedCount,
    acceptedCount,
    needsReviewCount,
    rejectedCount,
    coverageTargetCount,
    coveragePercent,
    rejectionReasons: diagnostics?.rejectedReasonCounts || null,
    extractionAttempts: Array.isArray(diagnostics?.extractionAttempts) ? diagnostics.extractionAttempts : [],
    consolidationDiagnostics: diagnostics,
    metadata: job.metadata || {}
  };
  });
}

export async function getUserQuestionBankMaterials(userId, limit = 50) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_question_banks")
    .select("id, title, status, question_count, exam_type, subject_id, subject_name, published_at, updated_at, created_at, metadata")
    .eq("user_id", userId)
    .neq("status", "archived")
    .order("updated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw error;
  }

  return (data || []).map((bank) => {
    const isLicenta = bank.exam_type === "licenta";
    const isPublished = bank.status === "published";
    const reviewHref = buildReviewHref(bank.id);
    const resultHref = isPublished
      ? isLicenta
        ? "/licenta-exam"
        : bank.subject_id && bank.subject_id !== "custom"
          ? `/materii/${bank.subject_id}`
          : "/materii"
      : reviewHref;

    return {
      id: bank.id,
      title: bank.title,
      status: bank.status,
      examType: bank.exam_type || "normal",
      typeLabel: isLicenta ? "Licenta" : "Test grila",
      subjectLabel: bank.subject_name || (isLicenta ? LICENTA_GENERAL_LABEL : "Materie"),
      questionCount: bank.question_count || 0,
      updatedAt: bank.updated_at || bank.published_at || bank.created_at,
      createdAt: bank.created_at,
      reviewHref,
      resultHref,
      primaryHref: resultHref,
      primaryActionLabel: isPublished
        ? isLicenta
          ? "Deschide simularea"
          : "Deschide materia"
        : "Verifica",
      canReview: !isPublished,
      metadata: bank.metadata || {}
    };
  });
}

function matchesMonitorSimilarity(activeJob, finishedJob) {
  const activeMetadata = activeJob.metadata || {};
  const finishedMetadata = finishedJob.metadata || {};
  const activeProfile = activeJob.processing_profile || activeMetadata.processingProfile || null;
  const finishedProfile = finishedJob.processing_profile || finishedMetadata.processingProfile || null;
  const activeRouting = activeJob.routing_mode || activeMetadata.routingMode || null;
  const finishedRouting = finishedJob.routing_mode || finishedMetadata.routingMode || null;

  return (
    (activeProfile && activeProfile === finishedProfile) ||
    (activeRouting && activeRouting === finishedRouting) ||
    (activeMetadata.examType && activeMetadata.examType === finishedMetadata.examType) ||
    (activeMetadata.sourceKind && activeMetadata.sourceKind === finishedMetadata.sourceKind)
  );
}

function getFallbackTotalSeconds(job) {
  const profile = job.processing_profile || job.metadata?.processingProfile || "default";
  const stage = job.stage || "queued";
  const baseSeconds =
    MONITOR_FALLBACK_TOTAL_SECONDS[profile] || MONITOR_FALLBACK_TOTAL_SECONDS.default;

  if (stage === "queued" || stage === "profiling") {
    return baseSeconds;
  }

  if (stage === "extracting") {
    return Math.max(baseSeconds, 150);
  }

  if (stage === "consolidating") {
    return Math.max(baseSeconds, 210);
  }

  if (stage === "publishing") {
    return Math.max(baseSeconds, 90);
  }

  return baseSeconds;
}

function estimateRemainingSeconds(job, finishedJobs) {
  if (job.status !== "pending" && job.status !== "processing") {
    return null;
  }

  const startedAt = job.started_at || job.created_at;
  const startedTimestamp = parseTimestamp(startedAt);
  const elapsedSeconds =
    startedTimestamp !== null ? Math.max(0, Math.round((Date.now() - startedTimestamp) / 1000)) : 0;
  const similarDurations = finishedJobs
    .filter((finishedJob) => matchesMonitorSimilarity(job, finishedJob))
    .map((finishedJob) => secondsBetween(finishedJob.started_at || finishedJob.created_at, finishedJob.completed_at))
    .filter(Boolean);
  const allDurations = finishedJobs
    .map((finishedJob) => secondsBetween(finishedJob.started_at || finishedJob.created_at, finishedJob.completed_at))
    .filter(Boolean);
  const historicalTotalSeconds =
    median(similarDurations) || median(allDurations) || getFallbackTotalSeconds(job);
  const progressRatio = Math.max(0, Math.min(0.98, (job.progress_percent || 0) / 100));
  const progressTotalSeconds = progressRatio > 0.08 ? Math.round(elapsedSeconds / progressRatio) : null;
  const estimatedTotalSeconds = progressTotalSeconds
    ? Math.round((historicalTotalSeconds + progressTotalSeconds) / 2)
    : historicalTotalSeconds;

  return Math.max(15, Math.round(estimatedTotalSeconds - elapsedSeconds));
}

function mapMonitorJob(job, bankSummaryMap, finishedJobs = []) {
  const bank = job.result_bank_id ? bankSummaryMap.get(job.result_bank_id) || null : null;
  const processingState = buildJobProcessingState(job);
  const reviewHref = job.result_bank_id && bank ? buildReviewHref(job.result_bank_id) : null;
  const resultHref = buildResultHref(job, bank);

  return {
    id: job.id,
    status: job.status,
    stage: job.stage,
    progressPercent: job.progress_percent || 0,
    processingProfile: job.processing_profile || null,
    routingMode: job.routing_mode || null,
    statusDetail: job.status_detail || null,
    errorMessage: job.error_message || null,
    createdAt: job.created_at,
    startedAt: processingState.startedAt,
    completedAt: job.completed_at,
    stageEnteredAt: processingState.stageEnteredAt,
    lastHeartbeatAt: processingState.lastHeartbeatAt,
    lastProgressAt: processingState.lastProgressAt,
    elapsedSeconds: secondsSince(processingState.startedAt || job.created_at),
    stageElapsedSeconds: secondsSince(processingState.stageEnteredAt || job.created_at),
    lastHeartbeatAgeSeconds: secondsSince(processingState.lastHeartbeatAt),
    lastProgressAgeSeconds: secondsSince(processingState.lastProgressAt),
    processingAttemptCount: job.processing_attempt_count || 0,
    resultBankId: job.result_bank_id || null,
    resultQuestionCount: bank?.question_count || 0,
    resultHref,
    reviewHref,
    bankStatus: bank?.status || null,
    bankTitle: bank?.title || null,
    activityState: getActivityState(job, bank),
    activityMessage: getActivityMessage(job, bank),
    processingMode: processingState.processingMode,
    isLikelyStalled: processingState.isLikelyStalled,
    canResumeProcessing: processingState.canResumeProcessing,
    heartbeatStaleAfterSeconds: processingState.heartbeatStaleAfterSeconds,
    estimatedRemainingSeconds: estimateRemainingSeconds(job, finishedJobs),
    metadata: job.metadata || {}
  };
}

export async function getQuestionBankJobMonitor(userId) {
  await backfillDeletedQuestionBankJobs({ userId });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_generation_jobs")
    .select("*")
    .eq("user_id", userId)
    .eq("job_kind", JOB_KIND)
    .order("created_at", { ascending: false })
    .limit(MONITOR_HISTORY_LIMIT);

  if (error) {
    throw error;
  }

  const jobs = data || [];
  const terminalCutoff = Date.now() - MONITOR_TERMINAL_WINDOW_MS;
  const visibleJobs = jobs.filter((job) => job.metadata?.activityState !== "deleted");
  const activeRows = visibleJobs.filter((job) => job.status === "pending" || job.status === "processing");
  const terminalRows = visibleJobs.filter((job) => {
    if (job.status !== "succeeded" && job.status !== "failed") {
      return false;
    }

    const finishedAt = parseTimestamp(job.completed_at || job.created_at);
    return finishedAt !== null && finishedAt >= terminalCutoff;
  });
  const finishedRows = terminalRows.filter((job) => job.completed_at);
  const bankSummaryMap = await getQuestionBankSummaryMap(
    visibleJobs.map((job) => job.result_bank_id).filter(Boolean)
  );

  const activeJobs = activeRows.map((job) => mapMonitorJob(job, bankSummaryMap, finishedRows));
  const terminalJob = terminalRows[0] ? mapMonitorJob(terminalRows[0], bankSummaryMap, finishedRows) : null;

  return {
    activeJobs,
    terminalJob,
    generatedAt: new Date().toISOString()
  };
}

async function processOpenAIPdfSingleFileStep({ job, jobId, userId, sourceDocument }) {
  let openaiFileId = job.metadata?.openaiPdfSingleFileDeletedAt
    ? null
    : job.metadata?.openaiPdfSingleFileId || null;
  let openaiResponseId = job.metadata?.openaiPdfSingleFileResponseId || null;
  let workingJob = job;
  const filename = sourceDocument.original_filename || "document.pdf";
  const subjectLabel = job.metadata?.subjectLabel || LICENTA_GENERAL_LABEL;

  if (job.status === "failed") {
    const resumedAt = new Date().toISOString();
    const resetFailedProviderResponse = Boolean(job.metadata?.openaiProviderFailureCode);
    if (resetFailedProviderResponse) {
      openaiResponseId = null;
    }

    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      error_message: null,
      completed_at: null,
      status_detail: "Procesarea poate fi reluata fara sa reincarci fisierul.",
      metadata: buildStageMetadata(job, "extracting", OPENAI_PDF_SINGLE_FILE_ROUTING_MODE, {
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        extractionSource: "openai_file",
        sourceKind: "pdf",
        lastResumeRequestedAt: resumedAt,
        openaiPdfSingleFileStartedAt: resumedAt,
        openaiPdfSingleFileNextPollAt: resumedAt,
        openaiProviderFailureCode: null,
        openaiProviderFailureMessage: null,
        ...(resetFailedProviderResponse
          ? {
              openaiPdfSingleFileResponseId: null,
              openaiPdfSingleFileRequestStatus: "queued"
            }
          : {}),
        openaiPdfSingleFileFailureCode: null,
        openaiPdfSingleFileFailureMessage: null
      })
    });

    workingJob = {
      ...job,
      status: "processing",
      stage: "extracting",
      metadata: {
        ...(job.metadata || {}),
        openaiPdfSingleFileStartedAt: resumedAt,
        openaiPdfSingleFileNextPollAt: resumedAt,
        openaiProviderFailureCode: null,
        openaiProviderFailureMessage: null,
        ...(resetFailedProviderResponse
          ? {
              openaiPdfSingleFileResponseId: null,
              openaiPdfSingleFileRequestStatus: "queued"
            }
          : {}),
        openaiPdfSingleFileFailureCode: null,
        openaiPdfSingleFileFailureMessage: null
      }
    };
  }

  if (!openaiFileId) {
    const buffer = await downloadSourceDocument({
      storageBucket: sourceDocument.storage_bucket,
      storagePath: sourceDocument.storage_path
    });

    const uploadedFile = await uploadPdfForOpenAIExtraction({
      buffer,
      filename,
      examType: "licenta",
      subjectName: subjectLabel,
      reason: "openai_pdf_single_file_resume",
      model: PDF_PRIMARY_MODEL,
      reasoningEffort: PDF_PRIMARY_REASONING,
      timeoutMs: OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS,
      userId: job.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId
    });

    openaiFileId = uploadedFile.id;
    workingJob = {
      ...job,
      metadata: {
        ...(job.metadata || {}),
        processingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        extractionSource: "openai_file",
        sourceKind: "pdf",
        openaiPdfSingleFileId: openaiFileId,
        openaiPdfSingleFileUploadedAt: new Date().toISOString(),
        openaiPdfSingleFileDeletedAt: null,
        openaiPdfSingleFileResponseId: null,
        openaiPdfSingleFileRequestStatus: "queued",
        openaiPdfSingleFileFailureCode: null,
        openaiPdfSingleFileFailureMessage: null
      }
    };

    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      error_message: null,
      completed_at: null,
      routing_mode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
      status_detail: "Asteptam finalizarea analizei fisierului.",
      metadata: workingJob.metadata
    });
  }

  const retryCount = Number(workingJob.metadata?.openaiPdfSingleFileRetryCount || 0) || 0;
  const model = retryCount > 0 ? PDF_ESCALATION_MODEL : PDF_PRIMARY_MODEL;
  const reasoningEffort = retryCount > 0 ? PDF_ESCALATION_REASONING : PDF_PRIMARY_REASONING;

  if (!openaiResponseId) {
    const attemptCount = Number(workingJob.metadata?.openaiPdfSingleFileAttemptCount || 0) + 1;
    const response = await createQuestionBankItemsOpenAIResponse({
      openaiFileId,
      filename,
      examType: "licenta",
      subjectName: workingJob.metadata?.subjectLabel || subjectLabel,
      reason: "openai_pdf_single_file",
      model,
      reasoningEffort,
      timeoutMs: OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS,
      maxOutputTokens: OPENAI_PDF_SINGLE_FILE_MAX_OUTPUT_TOKENS,
      userId: workingJob.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId: workingJob.id
    });

    openaiResponseId = response?.id || null;
    if (!openaiResponseId) {
      throw new Error("ID-ul raspunsului de procesare lipseste pentru fisier.");
    }
    const createdAt = new Date().toISOString();
    workingJob = {
      ...workingJob,
      metadata: {
        ...(workingJob.metadata || {}),
        openaiPdfSingleFileResponseId: openaiResponseId,
        openaiPdfSingleFileRequestStatus: String(response?.status || "queued"),
        openaiPdfSingleFileAttemptCount: attemptCount,
        openaiPdfSingleFileRetryCount: retryCount,
        openaiPdfSingleFileRequestCreatedAt: createdAt,
        openaiPdfSingleFileLastPolledAt: null,
        openaiPdfSingleFileNextPollAt: buildOpenAIPdfSingleFileNextPollAt(),
        openaiPdfSingleFileRequestModel: model,
        openaiPdfSingleFileRequestReasoningEffort: reasoningEffort,
        openaiPdfSingleFileFailureCode: null,
        openaiPdfSingleFileFailureMessage: null
      }
    };

    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      progress_percent: 18,
      error_message: null,
      completed_at: null,
      routing_mode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
      status_detail: "Asteptam finalizarea analizei fisierului.",
      metadata: buildStageMetadata(workingJob, "extracting", OPENAI_PDF_SINGLE_FILE_ROUTING_MODE, {
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        extractionSource: "openai_file",
        sourceKind: "pdf",
        openaiPdfSingleFileId: openaiFileId,
        openaiPdfSingleFileResponseId: openaiResponseId,
        openaiPdfSingleFileRequestStatus: String(response?.status || "queued"),
        openaiPdfSingleFileAttemptCount: attemptCount,
        openaiPdfSingleFileRetryCount: retryCount,
        openaiPdfSingleFileRequestCreatedAt: createdAt,
        openaiPdfSingleFileNextPollAt: buildOpenAIPdfSingleFileNextPollAt(),
        openaiPdfSingleFileRequestModel: model,
        openaiPdfSingleFileRequestReasoningEffort: reasoningEffort
      })
    });

    return getQuestionBankJobSnapshot({ jobId, userId });
  }

  if (!shouldPollOpenAIPdfSingleFileNow(workingJob)) {
    return getQuestionBankJobSnapshot({ jobId, userId });
  }

  try {
    const response = await retrieveQuestionBankItemsOpenAIResponse({
      responseId: openaiResponseId,
      filename,
      examType: "licenta",
      subjectName: workingJob.metadata?.subjectLabel || subjectLabel,
      reason: "openai_pdf_single_file",
      model: workingJob.metadata?.openaiPdfSingleFileRequestModel || model,
      timeoutMs: OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS,
      userId: workingJob.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId: workingJob.id
    });
    const responseStatus = String(response?.status || "in_progress");
    const nowIso = new Date().toISOString();
    const nextPollAt = buildOpenAIPdfSingleFileNextPollAt();

    workingJob = {
      ...workingJob,
      metadata: {
        ...(workingJob.metadata || {}),
        openaiPdfSingleFileRequestStatus: responseStatus,
        openaiPdfSingleFileLastPolledAt: nowIso,
        openaiPdfSingleFileNextPollAt: nextPollAt
      }
    };

    if (responseStatus === "queued" || responseStatus === "in_progress") {
      if (hasOpenAIPdfSingleFilePollingExpired(workingJob)) {
        return failPdfFallbackJob({
          jobId,
          userId,
          job: workingJob,
          chunkRows: [],
          consolidated: null,
          failureReason: "pdf_fallback_timeout",
          processingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
          errorMessage: "Procesarea fisierului a durat prea mult si s-a oprit inainte de finalizare.",
          statusDetail: "Procesarea poate fi reluata fara sa reincarci fisierul.",
          progressPercent: 18,
          extraPatch: {
            pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
            pdfFallbackReason: "openai_pdf_single_file",
            extractionSource: "openai_file",
            openaiPdfSingleFileId: openaiFileId,
            openaiPdfSingleFileResponseId: openaiResponseId,
            openaiPdfSingleFileRequestStatus: responseStatus,
            openaiPdfSingleFileLastPolledAt: nowIso,
            openaiPdfSingleFileFailureCode: "polling_timeout",
            openaiPdfSingleFileFailureMessage: "openai_response_polling_timeout",
            consolidationDiagnostics: {
              pdfFallbackOutcome: "timeout",
              extractionSource: "openai_file",
              fallbackUsedAsAuthoritative: true
            }
          }
        });
      }

      await updateJob(jobId, {
        status: "processing",
        stage: "extracting",
        progress_percent: 18,
        error_message: null,
        completed_at: null,
        routing_mode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        status_detail: "Asteptam finalizarea analizei fisierului.",
        metadata: buildStageMetadata(workingJob, "extracting", OPENAI_PDF_SINGLE_FILE_ROUTING_MODE, {
          pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
          extractionSource: "openai_file",
          sourceKind: "pdf",
          openaiPdfSingleFileId: openaiFileId,
          openaiPdfSingleFileResponseId: openaiResponseId,
          openaiPdfSingleFileRequestStatus: responseStatus,
          openaiPdfSingleFileLastPolledAt: nowIso,
          openaiPdfSingleFileNextPollAt: nextPollAt
        })
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    if (responseStatus !== "completed") {
      const responseErrorMessage =
        response?.error?.message ||
        response?.incomplete_details?.reason ||
        `openai_response_${responseStatus}`;
      const responseError = new Error(responseErrorMessage);
      if (response?.error?.code) {
        responseError.code = response.error.code;
      } else {
        responseError.code = `openai_response_${responseStatus}`;
      }
      if (response?.error?.type) {
        responseError.type = response.error.type;
      }
      if (response?.error?.status) {
        responseError.status = response.error.status;
      }
      responseError.openaiResponseStatus = responseStatus;
      throw responseError;
    }

    const extraction = await parseQuestionBankItemsFromOpenAIResponse({
      response,
      responseId: openaiResponseId,
      filename,
      examType: "licenta",
      subjectName: workingJob.metadata?.subjectLabel || subjectLabel,
      reason: "openai_pdf_single_file",
      model: workingJob.metadata?.openaiPdfSingleFileRequestModel || model,
      timeoutMs: OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS,
      userId: workingJob.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId: workingJob.id
    });

    const consolidated = buildConsolidatedFromFallbackItems(extraction.items || [], {
      extractionSource: "openai_file",
      allowNeedsReview: true
    });
    const acceptedCount = consolidated.summary.acceptedCount;
    const needsReviewCount = consolidated.summary.needsReviewCount || 0;
    const rawExtractedCount = Array.isArray(extraction.items) ? extraction.items.length : 0;
    const publishableThreshold = getPublishableThreshold(job);
    const coverageTargetCount = buildCoverageTargetCount({
      estimatedItems: Number(job.metadata?.estimatedItems || 0) || 0,
      rawExtractedCount,
      minimumPublishableCount: publishableThreshold
    });
    const coveragePercent =
      coverageTargetCount > 0 ? Math.round((acceptedCount / coverageTargetCount) * 100) : 0;
    const extractionAttempts = [
      buildSingleFileExtractionAttempt({
        model: workingJob.metadata?.openaiPdfSingleFileRequestModel || model,
        reasoningEffort: workingJob.metadata?.openaiPdfSingleFileRequestReasoningEffort || reasoningEffort,
        outcome: acceptedCount >= coverageTargetCount ? "coverage_met" : "coverage_low",
        acceptedCount,
        needsReviewCount,
        rawExtractedCount,
        coverageTargetCount
      })
    ];

    const fallbackResult = {
      kind: acceptedCount >= coverageTargetCount ? "publishable" : "not_publishable",
      reason: "openai_pdf_single_file",
      consolidated,
      notes: extraction.notes || [],
      acceptedCount,
      needsReviewCount,
      rawExtractedCount,
      publishableThreshold,
      coverageTargetCount,
      coveragePercent,
      model: workingJob.metadata?.openaiPdfSingleFileRequestModel || model,
      reasoningEffort: workingJob.metadata?.openaiPdfSingleFileRequestReasoningEffort || reasoningEffort,
      attemptLabel: "single_file",
      extractionAttempts
    };
    const currentAttemptCount = Number(workingJob.metadata?.openaiPdfSingleFileAttemptCount || 1) || 1;

    if (acceptedCount >= coverageTargetCount) {
      return persistAuthoritativePdfFallback({
        job: workingJob,
        jobId,
        userId,
        chunkRows: [],
        fallbackResult,
        processingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        extractionSource: "openai_file"
      });
    }

    const details = buildPdfFallbackNotPublishableDetails({
      acceptedCount,
      publishableThreshold,
      coverageTargetCount
    });

    return failPdfFallbackJob({
      jobId,
      userId,
      job: workingJob,
      chunkRows: [],
      consolidated,
      failureReason: "pdf_fallback_not_publishable",
      processingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
      errorMessage: details.errorMessage,
      statusDetail: details.statusDetail,
      progressPercent: 84,
      extraPatch: {
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        pdfFallbackReason: "openai_pdf_single_file",
        pdfFallbackItemCount: acceptedCount,
        pdfFallbackNotes: extraction.notes || [],
        pdfFallbackPublishableThreshold: publishableThreshold,
        pdfFallbackCoverageTargetCount: coverageTargetCount,
        pdfFallbackCoveragePercent: coveragePercent,
        pdfFallbackAttemptModels: extractionAttempts,
        extractionSource: "openai_file",
        openaiPdfSingleFileId: openaiFileId,
        openaiPdfSingleFileResponseId: openaiResponseId,
        openaiPdfSingleFileRequestStatus: "completed",
        openaiPdfSingleFileAttemptCount: currentAttemptCount,
        openaiPdfSingleFileFailureCode: null,
        openaiPdfSingleFileFailureMessage: null,
        consolidationDiagnostics: {
          pdfFallbackOutcome: "not_publishable",
          pdfFallbackAcceptedCount: acceptedCount,
          needsReviewCount,
          rawExtractedCount,
          rejectedReasonCounts: consolidated.summary?.rejectReasons || null,
          extractionSource: "openai_file",
          publishableThreshold,
          coverageTargetCount,
          coveragePercent,
          extractionAttempts,
          fallbackUsedAsAuthoritative: true
        }
      }
    });
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    if (isPermanentOpenAIError(normalizedError)) {
      return failOpenAIProviderJob({
        jobId,
        userId,
        job: workingJob,
        error: normalizedError,
        progressPercent: 18,
        processingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        openaiFileId,
        openaiResponseId,
        extraPatch: {
          openaiPdfSingleFileId: openaiFileId,
          openaiPdfSingleFileResponseId: openaiResponseId,
          openaiPdfSingleFileRequestStatus:
            error?.openaiResponseStatus || workingJob.metadata?.openaiPdfSingleFileRequestStatus || "failed",
          openaiPdfSingleFileFailureCode: getOpenAIProviderFailureCode(normalizedError),
          openaiPdfSingleFileFailureMessage: normalizedError.message
        }
      });
    }

    const transient = isTransientOpenAIError(error);
    const failureReason = normalizedError.isTimeoutLike ? "pdf_fallback_timeout" : "pdf_fallback_failed";
    const currentAttemptCount = Number(workingJob.metadata?.openaiPdfSingleFileAttemptCount || 1) || 1;
    const retryCount = Number(workingJob.metadata?.openaiPdfSingleFileRetryCount || 0) || 0;
    const nextRetryCount = retryCount + 1;
    const extractionAttempts = [
      buildSingleFileExtractionAttempt({
        model: workingJob.metadata?.openaiPdfSingleFileRequestModel || model,
        reasoningEffort: workingJob.metadata?.openaiPdfSingleFileRequestReasoningEffort || reasoningEffort,
        outcome: normalizedError.isTimeoutLike ? "timeout" : "failed",
        error: buildFailureContext(normalizedError)
      })
    ];

    if (transient && canRetryOpenAIPdfSingleFileAsync(workingJob)) {
      const retryModel = nextRetryCount > 0 ? PDF_ESCALATION_MODEL : PDF_PRIMARY_MODEL;
      const retryReasoning = nextRetryCount > 0 ? PDF_ESCALATION_REASONING : PDF_PRIMARY_REASONING;
      try {
        const retryResponse = await createQuestionBankItemsOpenAIResponse({
          openaiFileId,
          filename,
          examType: "licenta",
          subjectName: workingJob.metadata?.subjectLabel || subjectLabel,
          reason: "openai_pdf_single_file_retry",
          model: retryModel,
          reasoningEffort: retryReasoning,
          timeoutMs: OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS,
          maxOutputTokens: OPENAI_PDF_SINGLE_FILE_MAX_OUTPUT_TOKENS,
          userId: workingJob.user_id,
          sourceDocumentId: sourceDocument.id,
          jobId: workingJob.id
        });

        await updateJob(jobId, {
          status: "processing",
          stage: "extracting",
          progress_percent: 18,
          error_message: null,
          completed_at: null,
          routing_mode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
          status_detail: "Asteptam finalizarea analizei fisierului.",
          metadata: buildStageMetadata(workingJob, "extracting", OPENAI_PDF_SINGLE_FILE_ROUTING_MODE, {
            pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
            extractionSource: "openai_file",
            sourceKind: "pdf",
            openaiPdfSingleFileId: openaiFileId,
            openaiPdfSingleFileResponseId: retryResponse?.id || openaiResponseId,
            openaiPdfSingleFileRequestStatus: String(retryResponse?.status || "queued"),
            openaiPdfSingleFileRetryCount: nextRetryCount,
            openaiPdfSingleFileAttemptCount: currentAttemptCount + 1,
            openaiPdfSingleFileRequestCreatedAt: new Date().toISOString(),
            openaiPdfSingleFileLastPolledAt: null,
            openaiPdfSingleFileNextPollAt: buildOpenAIPdfSingleFileNextPollAt(),
            openaiPdfSingleFileRequestModel: retryModel,
            openaiPdfSingleFileRequestReasoningEffort: retryReasoning,
            openaiPdfSingleFileFailureCode: null,
            openaiPdfSingleFileFailureMessage: null
          })
        });

        return getQuestionBankJobSnapshot({ jobId, userId });
      } catch (retryError) {
        const normalizedRetryError = normalizeOpenAIError(retryError);
        if (isPermanentOpenAIError(normalizedRetryError)) {
          return failOpenAIProviderJob({
            jobId,
            userId,
            job: workingJob,
            error: normalizedRetryError,
            progressPercent: 18,
            processingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
            openaiFileId,
            openaiResponseId,
            extraPatch: {
              openaiPdfSingleFileId: openaiFileId,
              openaiPdfSingleFileResponseId: openaiResponseId,
              openaiPdfSingleFileRequestStatus: "failed",
              openaiPdfSingleFileAttemptCount: currentAttemptCount,
              openaiPdfSingleFileRetryCount: retryCount,
              openaiPdfSingleFileFailureCode: getOpenAIProviderFailureCode(normalizedRetryError),
              openaiPdfSingleFileFailureMessage: normalizedRetryError.message
            }
          });
        }

        const retryFailureReason =
          normalizedRetryError.isTimeoutLike ? "pdf_fallback_timeout" : "pdf_fallback_failed";

        return failPdfFallbackJob({
          jobId,
          userId,
          job: workingJob,
          chunkRows: [],
          consolidated: null,
          failureReason: retryFailureReason,
          processingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
          errorMessage:
            normalizedRetryError.isTimeoutLike
              ? "Procesarea fisierului a durat prea mult si s-a oprit inainte de finalizare."
              : "Procesarea fisierului s-a oprit inainte de finalizare.",
          statusDetail: "Procesarea poate fi reluata fara sa reincarci fisierul.",
          progressPercent: 18,
          extraPatch: {
            pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
            pdfFallbackReason: "openai_pdf_single_file",
            pdfFallbackAttemptModels: extractionAttempts,
            extractionSource: "openai_file",
            openaiPdfSingleFileId: openaiFileId,
            openaiPdfSingleFileResponseId: openaiResponseId,
            openaiPdfSingleFileRequestStatus: "failed",
            openaiPdfSingleFileAttemptCount: currentAttemptCount,
            openaiPdfSingleFileRetryCount: retryCount,
            openaiPdfSingleFileFailureCode: normalizedRetryError.code || null,
            openaiPdfSingleFileFailureMessage: normalizedRetryError.message,
            lastFailureContext: buildFailureContext(normalizedRetryError),
            consolidationDiagnostics: {
              pdfFallbackOutcome: normalizedRetryError.isTimeoutLike ? "timeout" : "failed",
              extractionSource: "openai_file",
              extractionAttempts,
              fallbackUsedAsAuthoritative: true
            }
          }
        });
      }
    }

    return failPdfFallbackJob({
      jobId,
      userId,
      job: workingJob,
      chunkRows: [],
      consolidated: null,
      failureReason,
      processingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
      errorMessage:
        normalizedError.isTimeoutLike
          ? "Procesarea fisierului a durat prea mult si s-a oprit inainte de finalizare."
          : "Procesarea fisierului s-a oprit inainte de finalizare.",
      statusDetail:
        "Procesarea poate fi reluata fara sa reincarci fisierul.",
      progressPercent: 18,
      extraPatch: {
        pdfProcessingMode: OPENAI_PDF_SINGLE_FILE_ROUTING_MODE,
        pdfFallbackReason: "openai_pdf_single_file",
        pdfFallbackAttemptModels: extractionAttempts,
        extractionSource: "openai_file",
        openaiPdfSingleFileId: openaiFileId,
        openaiPdfSingleFileResponseId: openaiResponseId,
        openaiPdfSingleFileRequestStatus:
          error?.openaiResponseStatus || workingJob.metadata?.openaiPdfSingleFileRequestStatus || "failed",
        openaiPdfSingleFileAttemptCount: currentAttemptCount,
        openaiPdfSingleFileRetryCount: retryCount,
        openaiPdfSingleFileFailureCode: normalizedError.code || null,
        openaiPdfSingleFileFailureMessage: normalizedError.message,
        lastFailureContext: buildFailureContext(normalizedError),
        consolidationDiagnostics: {
          pdfFallbackOutcome: normalizedError.isTimeoutLike ? "timeout" : "failed",
          extractionSource: "openai_file",
          extractionAttempts,
          fallbackUsedAsAuthoritative: true
        }
      }
    });
  }
}

async function processOpenAIPdfBatchStep({ job, jobId, userId, sourceDocument }) {
  let openaiFileId = job.metadata?.openaiPdfBatchFileDeletedAt
    ? null
    : job.metadata?.openaiPdfBatchFileId || null;
  let allChunkRowsBefore = await getChunkRows(jobId);
  const filename = sourceDocument.original_filename || "document.pdf";
  const subjectName = job.metadata?.subjectLabel || LICENTA_GENERAL_LABEL;

  if (!openaiFileId) {
    const buffer = await downloadSourceDocument({
      storageBucket: sourceDocument.storage_bucket,
      storagePath: sourceDocument.storage_path
    });

    const uploadedFile = await uploadPdfForOpenAIExtraction({
      buffer,
      filename,
      examType: "licenta",
      subjectName,
      reason: "openai_pdf_batched_resume",
      model: PDF_PRIMARY_MODEL,
      reasoningEffort: PDF_PRIMARY_REASONING,
      timeoutMs: OPENAI_PDF_BATCH_TIMEOUT_MS,
      userId: job.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId
    });

    openaiFileId = uploadedFile.id;
    job = {
      ...job,
      metadata: {
        ...(job.metadata || {}),
        openaiPdfBatchFileId: openaiFileId,
        openaiPdfBatchFileUploadedAt: new Date().toISOString(),
        openaiPdfBatchFileDeletedAt: null
      }
    };

    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      error_message: null,
      completed_at: null,
      status_detail: "Am reatasat PDF-ul si reluam analiza.",
      metadata: job.metadata
    });
  }

  if (job.status === "failed" && job.metadata?.openaiProviderFailureCode) {
    for (const row of allChunkRowsBefore) {
      if (row.status !== "processing") {
        continue;
      }

      await updateChunk(row.id, {
        status: "retry",
        payload: {
          ...(row.payload || {}),
          openaiResponseId: null,
          openaiRequestStatus: "queued",
          openaiFailureCode: null,
          openaiFailureMessage: null,
          openaiNextPollAt: null
        }
      });
    }

    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      error_message: null,
      completed_at: null,
      status_detail: "Reluam procesarea fisierului.",
      metadata: {
        ...(job.metadata || {}),
        openaiProviderFailureCode: null,
        openaiProviderFailureMessage: null,
        lastResumeRequestedAt: new Date().toISOString()
      }
    });

    job = {
      ...job,
      status: "processing",
      stage: "extracting",
      metadata: {
        ...(job.metadata || {}),
        openaiProviderFailureCode: null,
        openaiProviderFailureMessage: null
      }
    };
    allChunkRowsBefore = await getChunkRows(jobId);
  }

  const activeBatch = allChunkRowsBefore.find(
    (row) => row.status === "processing" && row.payload?.openaiResponseId
  );
  let nextBatch = activeBatch || (await getNextChunkForProcessing(jobId, job.status === "failed"));

  if (job.status === "failed" && nextBatch?.status === "failed") {
    await updateChunk(nextBatch.id, {
      status: "retry"
    });
    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      error_message: null,
      completed_at: null,
      status_detail: "Reluam procesarea fisierului care a ramas cu probleme."
    });
    nextBatch = await getNextChunkForProcessing(jobId, false);
  }

  if (!nextBatch) {
    const allChunkRows = await getChunkRows(jobId);
    const hasFailedBatches = allChunkRows.some((row) => row.status === "failed");

    if (hasFailedBatches) {
      await updateJob(jobId, {
        status: "failed",
        stage: "extracting",
        error_message:
          "O etapa din analiza PDF nu a putut fi procesata complet.",
        status_detail:
          "Poti relua procesarea fara sa reincarci fisierul. PDF-ul sursa ramane disponibil.",
        completed_at: new Date().toISOString()
      });
    } else {
      const consolidationDiagnostics = buildConsolidationDiagnostics(job, {
        chunkRows: allChunkRows,
        patch: {
          startedAt: new Date().toISOString(),
          totalChunkCount: allChunkRows.length,
          successfulChunkCount: allChunkRows.filter((row) => row.status === "succeeded").length,
          successfulChunkItemCount: countChunkPayloadItems(
            allChunkRows.filter((row) => row.status === "succeeded")
          ),
          usedPdfFallback: true,
          pdfFallbackOutcome: "openai_pdf_batched",
          finalFailureReason: null,
          extractionSource: "openai_file"
        }
      });

      await updateJob(jobId, {
        status: "processing",
        stage: "consolidating",
        progress_percent: 84,
        status_detail: "Verificam si curatam intrebarile extrase direct din PDF.",
        metadata: buildStageMetadata(job, "consolidating", "local_consolidation", {
          processingMode: OPENAI_PDF_BATCH_ROUTING_MODE,
          pdfProcessingMode: OPENAI_PDF_BATCH_ROUTING_MODE,
          extractionSource: "openai_file",
          consolidationDiagnostics
        })
      });
    }

    return getQuestionBankJobSnapshot({ jobId, userId });
  }

  const isPollingExistingResponse = nextBatch.status === "processing" && nextBatch.payload?.openaiResponseId;
  const attemptCount = isPollingExistingResponse
    ? Math.max(Number(nextBatch.attempt_count || 1) || 1, 1)
    : (nextBatch.attempt_count || 0) + 1;
  const forceHighEffort =
    nextBatch.status === "retry" || nextBatch.status === "failed" || attemptCount > 1;
  const model = forceHighEffort ? PDF_ESCALATION_MODEL : PDF_PRIMARY_MODEL;
  const reasoningEffort = forceHighEffort ? PDF_ESCALATION_REASONING : PDF_PRIMARY_REASONING;
  const questionStart = Number(nextBatch.payload?.questionStart || nextBatch.source_start || 1);
  const questionEnd = Number(nextBatch.payload?.questionEnd || nextBatch.source_end || questionStart);
  const batchRange = {
    start: questionStart,
    end: questionEnd
  };

  if (isPollingExistingResponse && !shouldPollAsyncOpenAIPayloadNow(nextBatch.payload)) {
    return getQuestionBankJobSnapshot({ jobId, userId });
  }

  try {
    if (!isPollingExistingResponse) {
      const response = await createQuestionBankItemsOpenAIResponse({
        openaiFileId,
        filename,
        examType: "licenta",
        subjectName,
        reason: "openai_pdf_batched",
        model,
        reasoningEffort,
        timeoutMs: OPENAI_PDF_BATCH_TIMEOUT_MS,
        maxOutputTokens: OPENAI_PDF_BATCH_MAX_OUTPUT_TOKENS,
        batchRange,
        userId: job.user_id,
        sourceDocumentId: sourceDocument.id,
        jobId: job.id
      });

      const responseId = response?.id || null;
      if (!responseId) {
        throw new Error("ID-ul raspunsului de procesare lipseste pentru lotul PDF.");
      }

      const requestCreatedAt = new Date().toISOString();
      await updateChunk(nextBatch.id, {
        status: "processing",
        attempt_count: attemptCount,
        model_profile: model,
        reasoning_effort: reasoningEffort,
        payload: {
          ...(nextBatch.payload || {}),
          openaiFileId,
          openaiResponseId: responseId,
          openaiRequestStatus: String(response?.status || "queued"),
          openaiRequestCreatedAt: requestCreatedAt,
          openaiLastPolledAt: null,
          openaiNextPollAt: buildAsyncOpenAINextPollAt(),
          openaiRetryCount: Math.max(attemptCount - 1, 0),
          openaiModel: model,
          openaiReasoningEffort: reasoningEffort,
          questionStart,
          questionEnd
        },
        error_message: null
      });

      await updateJob(jobId, {
        status: "processing",
        stage: "extracting",
        error_message: null,
        completed_at: null,
        status_detail: "Asteptam finalizarea analizei fisierului."
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    const responseId = nextBatch.payload.openaiResponseId;
    const response = await retrieveQuestionBankItemsOpenAIResponse({
      responseId,
      filename,
      examType: "licenta",
      subjectName,
      reason: "openai_pdf_batched",
      model: nextBatch.payload?.openaiModel || model,
      timeoutMs: OPENAI_PDF_BATCH_TIMEOUT_MS,
      batchRange,
      userId: job.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId: job.id
    });
    const responseStatus = String(response?.status || "in_progress");
    const nowIso = new Date().toISOString();
    const nextPollAt = buildAsyncOpenAINextPollAt();

    if (responseStatus === "queued" || responseStatus === "in_progress") {
      if (hasAsyncOpenAIPayloadPollingExpired(nextBatch.payload)) {
        await updateChunk(nextBatch.id, {
          status: attemptCount < MAX_AUTO_CHUNK_ATTEMPTS ? "retry" : "failed",
          error_message: "openai_response_polling_timeout",
          payload: {
            ...(nextBatch.payload || {}),
            openaiRequestStatus: responseStatus,
            openaiLastPolledAt: nowIso,
            openaiFailureCode: "polling_timeout",
            openaiFailureMessage: "openai_response_polling_timeout"
          }
        });

        await updateJob(jobId, {
          status: attemptCount < MAX_AUTO_CHUNK_ATTEMPTS ? "processing" : "failed",
          stage: "extracting",
          error_message:
            attemptCount < MAX_AUTO_CHUNK_ATTEMPTS
              ? null
              : "O etapa din analiza PDF nu a putut fi procesata complet.",
          status_detail:
            attemptCount < MAX_AUTO_CHUNK_ATTEMPTS
              ? "Reincercam automat analiza fisierului."
              : "Procesarea poate fi reluata fara sa reincarci fisierul.",
          completed_at: attemptCount < MAX_AUTO_CHUNK_ATTEMPTS ? null : new Date().toISOString()
        });

        return getQuestionBankJobSnapshot({ jobId, userId });
      }

      await updateChunk(nextBatch.id, {
        status: "processing",
        payload: {
          ...(nextBatch.payload || {}),
          openaiRequestStatus: responseStatus,
          openaiLastPolledAt: nowIso,
          openaiNextPollAt: nextPollAt
        },
        error_message: null
      });

      await updateJob(jobId, {
        status: "processing",
        stage: "extracting",
        status_detail: "Asteptam finalizarea analizei fisierului."
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    if (responseStatus !== "completed") {
      const responseErrorMessage =
        response?.error?.message ||
        response?.incomplete_details?.reason ||
        `openai_response_${responseStatus}`;
      const responseError = new Error(responseErrorMessage);
      responseError.code = response?.error?.code || `openai_response_${responseStatus}`;
      responseError.type = response?.error?.type || null;
      responseError.status = response?.error?.status || null;
      responseError.openaiResponseStatus = responseStatus;
      throw responseError;
    }

    const extraction = await parseQuestionBankItemsFromOpenAIResponse({
      response,
      responseId,
      filename,
      examType: "licenta",
      subjectName,
      reason: "openai_pdf_batched",
      model: nextBatch.payload?.openaiModel || model,
      timeoutMs: OPENAI_PDF_BATCH_TIMEOUT_MS,
      batchRange,
      userId: job.user_id,
      sourceDocumentId: sourceDocument.id,
      jobId: job.id
    });

    const normalizedItems = (extraction.items || [])
      .map((item) =>
        normalizeChunkItem(item, nextBatch.id, {
          extractionSource: "openai_file",
          allowNeedsReview: true
        })
      )
      .filter(Boolean);

    await updateChunk(nextBatch.id, {
      status: "succeeded",
      model_profile: model,
      reasoning_effort: reasoningEffort,
      extracted_items_count: normalizedItems.length,
      payload: {
        ...(nextBatch.payload || {}),
        items: normalizedItems,
        notes: extraction.notes || [],
        openaiFileId,
        openaiResponseId: responseId,
        openaiRequestStatus: "completed",
        openaiLastPolledAt: new Date().toISOString(),
        openaiFailureCode: null,
        openaiFailureMessage: null,
        questionStart,
        questionEnd
      },
      error_message: null
    });

    const allChunkRows = await getChunkRows(jobId);
    const succeededCount = allChunkRows.filter((row) => row.status === "succeeded").length;
    const progress = Math.min(80, 12 + Math.round((succeededCount / Math.max(allChunkRows.length, 1)) * 68));

    await updateJob(jobId, {
      status: "processing",
      stage: "extracting",
      progress_percent: progress,
      status_detail: "Continuam analiza fisierului."
    });
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    const message =
      error instanceof Error ? error.message.slice(0, 1000) : "openai_pdf_batch_failed";
    const responseId = nextBatch.payload?.openaiResponseId || null;

    if (isPermanentOpenAIError(normalizedError)) {
      return failOpenAIProviderJob({
        jobId,
        userId,
        job,
        error: normalizedError,
        chunkRows: allChunkRowsBefore,
        progressPercent: job.progress_percent || 12,
        processingMode: OPENAI_PDF_BATCH_ROUTING_MODE,
        openaiFileId,
        openaiResponseId: responseId,
        extraPatch: {
          pdfProcessingMode: OPENAI_PDF_BATCH_ROUTING_MODE,
          openaiPdfBatchFileId: openaiFileId,
          openaiPdfBatchResponseId: responseId,
          openaiPdfBatchFailureCode: getOpenAIProviderFailureCode(normalizedError),
          openaiPdfBatchFailureMessage: normalizedError.message
        }
      });
    }

    if (isTransientOpenAIError(normalizedError) && isPollingExistingResponse && !error?.openaiResponseStatus) {
      await updateChunk(nextBatch.id, {
        status: "processing",
        error_message: message,
        payload: {
          ...(nextBatch.payload || {}),
          openaiFailureCode: normalizedError.code || null,
          openaiFailureMessage: normalizedError.message,
          openaiNextPollAt: buildAsyncOpenAINextPollAt()
        }
      });

      await updateJob(jobId, {
        status: "processing",
        stage: "extracting",
        status_detail: "Asteptam finalizarea analizei fisierului."
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    if (attemptCount < MAX_AUTO_CHUNK_ATTEMPTS) {
      await updateChunk(nextBatch.id, {
        status: "retry",
        error_message: message,
        payload: {
          ...(nextBatch.payload || {}),
          openaiRequestStatus:
            error?.openaiResponseStatus || nextBatch.payload?.openaiRequestStatus || "failed",
          openaiFailureCode: normalizedError.code || null,
          openaiFailureMessage: normalizedError.message
        }
      });
      await updateJob(jobId, {
        status: "processing",
        stage: "extracting",
        status_detail: "Reincercam automat analiza fisierului."
      });
    } else {
      await updateChunk(nextBatch.id, {
        status: "failed",
        error_message: message
      });
      await updateJob(jobId, {
        status: "failed",
        stage: "extracting",
        error_message: "O etapa din analiza PDF nu a putut fi procesata complet.",
        status_detail:
          "Procesarea poate fi reluata fara sa reincarci fisierul.",
        completed_at: new Date().toISOString()
      });
    }
  }

  return getQuestionBankJobSnapshot({ jobId, userId });
}

export async function processQuestionBankJob({ jobId, userId }) {
  const job = await fetchJobForProcessing(jobId);
  if (!job || job.user_id !== userId) {
    throw new Error("Jobul nu exista sau nu iti apartine.");
  }

  if (job.metadata?.activityState === "deleted") {
    return getQuestionBankJobSnapshot({ jobId, userId });
  }

  const locked = await acquireJobLock(jobId);
  if (!locked) {
    return getQuestionBankJobSnapshot({ jobId, userId });
  }

  try {
    const sourceDocument = await fetchSourceDocument(job.source_document_id);
    const hasLocalExtractedText = Boolean(sourceDocument?.extracted_text);
    const canUseStoredPdf = shouldAttemptOpenAIPdfFallback({ job, sourceDocument });

    if (!sourceDocument || (!hasLocalExtractedText && !canUseStoredPdf)) {
      await updateJob(jobId, {
        status: "failed",
        stage: "failed",
        error_message: "Documentul sursa nu mai este disponibil pentru procesare.",
        status_detail: "Documentul sursa lipseste.",
        completed_at: new Date().toISOString(),
        locked_at: null
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    if (
      isLicentaPdfJob(job, sourceDocument) &&
      !hasLocalExtractedText &&
      !isOpenAIPdfSingleFileJob(job) &&
      !isOpenAIPdfBatchedJob(job)
    ) {
      return startOpenAIPdfBatchedJob({
        job,
        jobId,
        userId,
        sourceDocument,
        resetChunks: true
      });
    }

    if (isResumableFallbackFailure(job)) {
      await updateJob(jobId, {
        status: "processing",
        stage: "consolidating",
        progress_percent: 84,
        error_message: null,
        completed_at: null,
        status_detail: "Reluam verificarea finala a fisierului.",
        metadata: buildStageMetadata(job, "consolidating", "local_consolidation", {
          lastResumeRequestedAt: new Date().toISOString()
        })
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    if (job.stage === "queued") {
      const isLicentaPdf = isLicentaPdfJob(job, sourceDocument);
      if (isLicentaPdf && isOpenAIPdfSingleFileJob(job) && !hasLocalExtractedText) {
        return startOpenAIPdfSingleFileJob({
          job,
          jobId,
          userId,
          sourceDocument
        });
      }

      if (isLicentaPdf && (isOpenAIPdfBatchedJob(job) || !hasLocalExtractedText)) {
        return startOpenAIPdfBatchedJob({
          job,
          jobId,
          userId,
          sourceDocument,
          resetChunks: true
        });
      }

      await updateJob(jobId, {
        status: "processing",
        stage: "profiling",
        progress_percent: 5,
        status_detail: "Analizam documentul si alegem strategia potrivita.",
        metadata: buildStageMetadata(job, "profiling", "profiling")
      });

      const profile = profileQuestionBankDocument({
        sourceText: sourceDocument.extracted_text || "",
        examType: job.metadata?.examType || "normal"
      });
      const publishableThreshold = getPublishableThreshold(job);
      const shouldUsePdfPrimary =
        !hasLocalExtractedText && shouldAttemptOpenAIPdfFallback({ job, sourceDocument });
      let pdfPrimaryAttempted = false;
      let pdfPrimaryResult = null;

      if (shouldUsePdfPrimary) {
        await updateJob(jobId, {
          status: "processing",
          stage: "extracting",
          progress_percent: 14,
          status_detail: "Analizam fisierul ca sa pastram cat mai multe intrebari utile pentru verificare.",
          metadata: buildStageMetadata(job, "extracting", "openai_pdf_primary", {
            extractionSource: "openai_file",
            qualitySignals: profile.qualitySignals,
            estimatedItems: profile.estimatedItems,
            answeredBlocks: profile.answeredBlocks,
            answerSignals: profile.answerSignals,
            chunkCount: profile.chunkCount,
            pdfPrimaryStartedAt: new Date().toISOString()
          })
        });

        try {
          const primaryResult = await runPdfFallbackCoverageLadder({
            job,
            sourceDocument,
            reason: "pdf_primary_initial_extract",
            estimatedItems: profile.estimatedItems,
            minimumPublishableCount: publishableThreshold,
            timeoutMs: PDF_FALLBACK_TIMEOUT_MS,
            throwOnTimeout: true,
            throwOnKnownError: true
          });
          pdfPrimaryResult = primaryResult;
          pdfPrimaryAttempted = true;

          if (primaryResult?.kind === "publishable") {
            return persistAuthoritativePdfFallback({
              job,
              jobId,
              userId,
              chunkRows: [],
              fallbackResult: primaryResult,
              processingMode: "openai_pdf_primary",
              extractionSource: "openai_file"
            });
          }

          await updateJob(jobId, {
            status: "processing",
            stage: "profiling",
            progress_percent: 5,
            status_detail:
              "Analiza fisierului a returnat prea putine intrebari utile. Incercam o verificare alternativa.",
            metadata: buildStageMetadata(job, "profiling", "profiling", {
              extractionSource: "local_text",
              qualitySignals: profile.qualitySignals,
              estimatedItems: profile.estimatedItems,
              answeredBlocks: profile.answeredBlocks,
              answerSignals: profile.answerSignals,
              chunkCount: profile.chunkCount,
              lastPdfPrimaryOutcome: primaryResult?.kind || "not_publishable",
              lastPdfPrimaryExtractedCount: primaryResult?.acceptedCount || 0,
              lastPdfPrimaryNeedsReviewCount: primaryResult?.needsReviewCount || 0,
              lastPdfPrimaryRawExtractedCount: primaryResult?.rawExtractedCount || 0,
              lastPdfPrimaryCoverageTargetCount: primaryResult?.coverageTargetCount || publishableThreshold,
              lastPdfPrimaryCoveragePercent: primaryResult?.coveragePercent || 0,
              lastPdfPrimaryAttempts: primaryResult?.extractionAttempts || []
            })
          });
        } catch (error) {
          const normalizedError = normalizeOpenAIError(error);
          pdfPrimaryAttempted = true;

          await updateJob(jobId, {
            status: "processing",
            stage: "profiling",
            progress_percent: 5,
            status_detail:
              "Analiza fisierului nu a putut continua. Incercam o verificare alternativa.",
            metadata: buildStageMetadata(job, "profiling", "profiling", {
              extractionSource: "local_text",
              qualitySignals: profile.qualitySignals,
              estimatedItems: profile.estimatedItems,
              answeredBlocks: profile.answeredBlocks,
                answerSignals: profile.answerSignals,
                chunkCount: profile.chunkCount,
                lastPdfPrimaryOutcome: normalizedError.isTimeoutLike ? "timeout" : "failed",
                lastPdfPrimaryError: normalizedError.details || {
                  message: normalizedError.message,
                  status: normalizedError.status,
                  code: normalizedError.code,
                  type: normalizedError.type
                },
                lastPdfPrimaryAttempts: []
              })
          });
        }
      }

      if (profile.detectedFormat !== "qa_extract") {
        if (isLicentaPdf && shouldAttemptOpenAIPdfFallback({ job, sourceDocument })) {
          return startOpenAIPdfBatchedJob({
            job,
            jobId,
            userId,
            sourceDocument,
            profile,
            resetChunks: true
          });
        }

        if (pdfPrimaryResult?.kind === "not_publishable") {
          const details = buildPdfFallbackNotPublishableDetails({
            acceptedCount: pdfPrimaryResult.acceptedCount,
            publishableThreshold: pdfPrimaryResult.publishableThreshold,
            coverageTargetCount: pdfPrimaryResult.coverageTargetCount
          });

          return failPdfFallbackJob({
            jobId,
            userId,
            job,
            chunkRows: [],
            consolidated: pdfPrimaryResult.consolidated,
            failureReason: "pdf_fallback_not_publishable",
            processingMode: "pdf_fallback_not_publishable",
            errorMessage: details.errorMessage,
            statusDetail: details.statusDetail,
            progressPercent: 5,
            extraPatch: {
              pdfProcessingMode: "openai_fallback",
              pdfFallbackReason: pdfPrimaryResult.reason,
              pdfFallbackItemCount: pdfPrimaryResult.acceptedCount,
              pdfFallbackNotes: pdfPrimaryResult.notes,
              pdfFallbackPublishableThreshold: pdfPrimaryResult.publishableThreshold,
              pdfFallbackCoverageTargetCount: pdfPrimaryResult.coverageTargetCount || publishableThreshold,
              extractionSource: "openai_file",
              lastFailureContext: {
                message: "pdf_primary_not_publishable_and_local_invalid"
              },
              consolidationDiagnostics: {
                pdfFallbackOutcome: "not_publishable",
                pdfFallbackAcceptedCount: pdfPrimaryResult.acceptedCount,
                needsReviewCount: pdfPrimaryResult.needsReviewCount || 0,
                rawExtractedCount: pdfPrimaryResult.rawExtractedCount || pdfPrimaryResult.acceptedCount,
                rejectedReasonCounts: pdfPrimaryResult.consolidated?.summary?.rejectReasons || null,
                extractionSource: "openai_file",
                publishableThreshold: pdfPrimaryResult.publishableThreshold,
                coverageTargetCount: pdfPrimaryResult.coverageTargetCount || publishableThreshold,
                coveragePercent: pdfPrimaryResult.coveragePercent || 0,
                extractionAttempts: pdfPrimaryResult.extractionAttempts || [],
                fallbackUsedAsAuthoritative: true
              }
            }
          });
        }

        if (!pdfPrimaryAttempted) {
          try {
          const fallbackResult = await runPdfFallbackCoverageLadder({
            job,
            sourceDocument,
            reason: "invalid_source_after_local_extract",
            estimatedItems: profile.estimatedItems,
            minimumPublishableCount: publishableThreshold,
            timeoutMs: PDF_FALLBACK_TIMEOUT_MS,
            throwOnTimeout: true,
            throwOnKnownError: true
          });

          if (fallbackResult?.kind === "publishable") {
            return persistAuthoritativePdfFallback({
              job,
              jobId,
              userId,
              chunkRows: [],
              fallbackResult
            });
          }

          if (fallbackResult?.kind === "not_publishable") {
            const details = buildPdfFallbackNotPublishableDetails({
              acceptedCount: fallbackResult.acceptedCount,
              publishableThreshold: fallbackResult.publishableThreshold,
              coverageTargetCount: fallbackResult.coverageTargetCount
            });

            return failPdfFallbackJob({
              jobId,
              userId,
              job,
              chunkRows: [],
              consolidated: fallbackResult.consolidated,
              failureReason: "pdf_fallback_not_publishable",
              processingMode: "pdf_fallback_not_publishable",
              errorMessage: details.errorMessage,
              statusDetail: details.statusDetail,
              progressPercent: 5,
              extraPatch: {
                pdfProcessingMode: "openai_fallback",
                pdfFallbackReason: fallbackResult.reason,
                pdfFallbackItemCount: fallbackResult.acceptedCount,
                pdfFallbackNotes: fallbackResult.notes,
                pdfFallbackPublishableThreshold: fallbackResult.publishableThreshold,
                pdfFallbackCoverageTargetCount: fallbackResult.coverageTargetCount || publishableThreshold,
                lastFailureContext: {
                  message: "pdf_fallback_not_publishable"
                },
                consolidationDiagnostics: {
                  pdfFallbackOutcome: "not_publishable",
                  pdfFallbackAcceptedCount: fallbackResult.acceptedCount,
                  needsReviewCount: fallbackResult.needsReviewCount || 0,
                  rawExtractedCount: fallbackResult.rawExtractedCount || fallbackResult.acceptedCount,
                  rejectedReasonCounts: fallbackResult.consolidated?.summary?.rejectReasons || null,
                  extractionSource: "openai_file",
                  publishableThreshold: fallbackResult.publishableThreshold,
                  coverageTargetCount: fallbackResult.coverageTargetCount || publishableThreshold,
                  coveragePercent: fallbackResult.coveragePercent || 0,
                  extractionAttempts: fallbackResult.extractionAttempts || [],
                  fallbackUsedAsAuthoritative: true
                }
              }
            });
          }
          } catch (error) {
            const normalizedError = normalizeOpenAIError(error);

            if (normalizedError.isTimeoutLike) {
              return failPdfFallbackJob({
                jobId,
                userId,
                job,
                chunkRows: [],
                consolidated: null,
                failureReason: "pdf_fallback_timeout",
                processingMode: "pdf_fallback_timeout",
                errorMessage:
                  "Analiza mai atenta a PDF-ului a durat prea mult. Poti relua procesarea sau reincarca fisierul.",
                statusDetail:
                  "Procesarea s-a oprit dupa ce verificarea suplimentara a durat prea mult.",
                progressPercent: 5,
                extraPatch: {
                  lastFallbackTimedOutAt: new Date().toISOString(),
                  lastFallbackError: normalizedError.details || {
                    message: normalizedError.message
                  },
                  lastFailureContext: buildFailureContext(normalizedError),
                  consolidationDiagnostics: {
                    pdfFallbackOutcome: "timeout",
                    publishableThreshold,
                    fallbackUsedAsAuthoritative: true
                  }
                }
              });
            }

            if (isKnownOpenAIFallbackError(normalizedError)) {
              return failPdfFallbackJob({
                jobId,
                userId,
                job,
                chunkRows: [],
                consolidated: null,
                failureReason: "pdf_fallback_failed",
                processingMode: "pdf_fallback_failed",
                errorMessage:
                  "Analiza mai atenta a PDF-ului nu a putut fi finalizata. Poti relua procesarea sau reincarca un fisier mai clar.",
                statusDetail:
                  "Procesarea s-a oprit in verificarea suplimentara a fisierului.",
                progressPercent: 5,
                extraPatch: {
                  lastFallbackFailedAt: new Date().toISOString(),
                  lastFallbackError: normalizedError.details || {
                    message: normalizedError.message,
                    status: normalizedError.status,
                    code: normalizedError.code,
                    type: normalizedError.type
                  },
                  lastFailureContext: buildFailureContext(normalizedError),
                  consolidationDiagnostics: {
                    pdfFallbackOutcome: "failed",
                    publishableThreshold,
                    fallbackUsedAsAuthoritative: true
                  }
                }
              });
            }

            return failPdfFallbackJob({
              jobId,
              userId,
              job,
              chunkRows: [],
              consolidated: null,
              failureReason: "pdf_fallback_failed",
              processingMode: "pdf_fallback_failed",
              errorMessage:
                "Analiza mai atenta a PDF-ului nu a putut fi finalizata. Poti relua procesarea sau reincarca un fisier mai clar.",
              statusDetail:
                "Procesarea s-a oprit in verificarea suplimentara a fisierului dupa o eroare neasteptata.",
              progressPercent: 5,
              extraPatch: {
                lastFallbackFailedAt: new Date().toISOString(),
                lastFallbackError: normalizedError.details || {
                  message: normalizedError.message,
                  status: normalizedError.status,
                  code: normalizedError.code,
                  type: normalizedError.type
                },
                lastFailureContext: buildFailureContext(normalizedError),
                consolidationDiagnostics: {
                  pdfFallbackOutcome: "failed",
                  publishableThreshold,
                  fallbackUsedAsAuthoritative: true
                }
              }
            });
          }
        }

        await updateJob(jobId, {
          status: "failed",
          stage: "failed",
          progress_percent: 5,
          error_message:
            "Documentul nu pare sa contina o banca valida de intrebari si raspunsuri.",
          status_detail:
            `Am detectat ${profile.estimatedItems} intrebari candidate, ${profile.answeredBlocks} blocuri cu raspunsuri si ${profile.answerSignals} semnale de raspuns. Incarca un document care contine deja itemii.`,
          processing_profile: profile.profile,
          routing_mode: profile.detectedFormat,
          metadata: {
            ...(job.metadata || {}),
            qualitySignals: profile.qualitySignals,
            estimatedItems: profile.estimatedItems,
            answeredBlocks: profile.answeredBlocks,
            answerSignals: profile.answerSignals,
            chunkCount: profile.chunkCount
          },
          completed_at: new Date().toISOString()
        });

        return getQuestionBankJobSnapshot({ jobId, userId });
      }

      const chunkPlan = buildChunkPlan({
        blocks: profile.blocks,
        profile: profile.profile
      });

      await insertChunkRows(
        chunkPlan.map((chunk) => ({
          job_id: jobId,
          chunk_index: chunk.chunk_index,
          status: "pending",
          source_start: chunk.source_start,
          source_end: chunk.source_end,
          estimated_items: chunk.estimated_items,
          payload: chunk.payload
        }))
      );

      await updateJob(jobId, {
        status: "processing",
        stage: "extracting",
        progress_percent: 12,
        processing_profile: profile.profile,
        routing_mode: ROUTING_MODE,
        status_detail: `Document profilat: ${profile.estimatedItems} itemi estimati. Pregatim extragerea.`,
        metadata: {
          ...buildStageMetadata(job, "extracting", "chunk_extraction"),
          qualitySignals: profile.qualitySignals,
          estimatedItems: profile.estimatedItems,
          answeredBlocks: profile.answeredBlocks,
          answerSignals: profile.answerSignals,
          chunkCount: chunkPlan.length
        }
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    if (
      isOpenAIPdfSingleFileJob(job) &&
      (job.stage === "extracting" ||
        job.stage === "failed" ||
        (job.status === "failed" && job.stage === "extracting"))
    ) {
      return processOpenAIPdfSingleFileStep({ job, jobId, userId, sourceDocument });
    }

    if (
      isOpenAIPdfBatchedJob(job) &&
      (job.stage === "extracting" ||
        job.stage === "failed" ||
        (job.status === "failed" && job.stage === "extracting"))
    ) {
      return processOpenAIPdfBatchStep({ job, jobId, userId, sourceDocument });
    }

    if (job.stage === "extracting" || (job.status === "failed" && job.stage === "extracting")) {
      let nextChunk = await getNextChunkForProcessing(jobId, job.status === "failed");

      if (job.status === "failed" && nextChunk?.status === "failed") {
        await updateChunk(nextChunk.id, {
          status: "retry"
        });
        await updateJob(jobId, {
          status: "processing",
          stage: "extracting",
          error_message: null,
          completed_at: null,
          status_detail: "Reluam partile care au ramas cu probleme."
        });
        nextChunk = await getNextChunkForProcessing(jobId, false);
      }

      if (!nextChunk) {
        const allChunkRows = await getChunkRows(jobId);
        const hasFailedChunks = allChunkRows.some((row) => row.status === "failed");

        if (hasFailedChunks) {
          await updateJob(jobId, {
            status: "failed",
            stage: "extracting",
            error_message:
              "Unele parti ale documentului nu au putut fi extrase corect. Poti incerca reluarea lor.",
            status_detail: "Au ramas parti cu probleme dupa extragere.",
            completed_at: new Date().toISOString()
          });
        } else {
          const consolidationDiagnostics = buildConsolidationDiagnostics(job, {
            chunkRows: allChunkRows,
            patch: {
              startedAt: new Date().toISOString(),
              totalChunkCount: allChunkRows.length,
              successfulChunkCount: allChunkRows.filter((row) => row.status === "succeeded").length,
              successfulChunkItemCount: countChunkPayloadItems(
                allChunkRows.filter((row) => row.status === "succeeded")
              ),
              usedPdfFallback: false,
              pdfFallbackOutcome: null,
              finalFailureReason: null
            }
          });
          await updateJob(jobId, {
            status: "processing",
            stage: "consolidating",
            progress_percent: 84,
            status_detail: "Consolidam si curatam banca finala.",
            metadata: buildStageMetadata(job, "consolidating", "local_consolidation", {
              consolidationDiagnostics
            })
          });
        }

        return getQuestionBankJobSnapshot({ jobId, userId });
      }

      const attemptCount = (nextChunk.attempt_count || 0) + 1;
      const shouldUseHighEffort =
        nextChunk.status === "retry" || nextChunk.status === "failed" || attemptCount > 1;

      await updateChunk(nextChunk.id, {
        status: "processing",
        attempt_count: attemptCount,
        error_message: null
      });

      try {
        const extraction = await extractChunkItems({
          chunkText: nextChunk.payload?.text || "",
          processingProfile: job.processing_profile || "small",
          examType: job.metadata?.examType || "normal",
          subjectName: job.metadata?.subjectLabel || null,
          forceHighEffort: shouldUseHighEffort,
          userId: job.user_id,
          jobId: job.id,
          sourceDocumentId: job.source_document_id,
          chunkIndex: nextChunk.chunk_index
        });

        const normalizedItems = (extraction.parsed.items || [])
          .map((item) => normalizeChunkItem(item, nextChunk.id))
          .filter(Boolean);

        await updateChunk(nextChunk.id, {
          status: "succeeded",
          model_profile: extraction.model,
          reasoning_effort: extraction.reasoningEffort,
          extracted_items_count: normalizedItems.length,
          payload: {
            items: normalizedItems,
            notes: extraction.parsed.notes || []
          },
          error_message: null
        });

        const allChunkRows = await getChunkRows(jobId);
        const succeededCount = allChunkRows.filter((row) => row.status === "succeeded").length;
        const totalCount = Math.max(allChunkRows.length, 1);
        const config = PROFILE_CONFIG[job.processing_profile || "small"] || PROFILE_CONFIG.small;
        const progress = Math.min(
          80,
          config.progressBase + Math.round((succeededCount / totalCount) * config.progressRange)
        );

        await updateJob(jobId, {
          status: "processing",
          stage: "extracting",
          progress_percent: progress,
          status_detail: `Extragem itemii din document: ${succeededCount}/${totalCount} etape finalizate.`
        });
      } catch (error) {
        const message =
          error instanceof Error ? error.message.slice(0, 1000) : "chunk_extraction_failed";

        if (attemptCount < MAX_AUTO_CHUNK_ATTEMPTS) {
          await updateChunk(nextChunk.id, {
            status: "retry",
            error_message: message
          });
          await updateJob(jobId, {
            status: "processing",
            stage: "extracting",
            status_detail: "Reincercam automat partea ramasa cu probleme."
          });
        } else {
          await updateChunk(nextChunk.id, {
            status: "failed",
            error_message: message
          });
          await updateJob(jobId, {
            status: "failed",
            stage: "extracting",
            error_message: "O parte a documentului nu a putut fi procesata complet.",
            status_detail:
              "Exista parti care au nevoie de o noua incercare manuala sau de un document mai clar.",
            completed_at: new Date().toISOString()
          });
        }
      }

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    if (job.stage === "consolidating") {
      const chunkRows = await getChunkRows(jobId);
      const successfulChunks = chunkRows.filter((row) => row.status === "succeeded");
      const consolidated = consolidateChunkPayloads(successfulChunks, {
        allowNeedsReview: job.metadata?.examType === "licenta"
      });
      const estimatedItems = Number(job.metadata?.estimatedItems || 0) || 0;
      const publishableThreshold = getPublishableThreshold(job);
      const coverageTargetCount = buildCoverageTargetCount({
        estimatedItems,
        rawExtractedCount: consolidated.summary.acceptedCount,
        minimumPublishableCount: publishableThreshold
      });
      const consolidationMetadata = buildConsolidationMetadata(job, {
        chunkRows,
        consolidated,
        patch: {
          consolidationDiagnostics: {
            startedAt:
              job.metadata?.consolidationDiagnostics?.startedAt || new Date().toISOString(),
                usedPdfFallback: false,
                pdfFallbackOutcome: null,
                publishableThreshold,
                coverageTargetCount,
                coveragePercent:
                  coverageTargetCount > 0
                    ? Math.round((consolidated.summary.acceptedCount / coverageTargetCount) * 100)
                    : 0,
                finalFailureReason: null
              }
        }
      });
      const shouldTryOpenAIFallback =
        !isLicentaPdfJob(job, sourceDocument) &&
        shouldAttemptOpenAIPdfFallback({ job, sourceDocument }) &&
        consolidated.summary.acceptedCount < coverageTargetCount;

      if (shouldTryOpenAIFallback) {
        await updateJob(jobId, {
          status: "processing",
          stage: "consolidating",
          progress_percent: 84,
          status_detail: "Incercam o analiza mai atenta a PDF-ului. Poate dura 1-3 minute.",
          metadata: buildConsolidationMetadata(job, {
            chunkRows,
            consolidated,
            patch: {
            processingMode: "pdf_fallback_pending",
            currentStage: "consolidating",
              lastFallbackStartedAt: new Date().toISOString(),
              consolidationDiagnostics: {
                startedAt:
                  job.metadata?.consolidationDiagnostics?.startedAt || new Date().toISOString(),
                usedPdfFallback: true,
                pdfFallbackOutcome: "running",
                publishableThreshold,
                coverageTargetCount,
                coveragePercent:
                  coverageTargetCount > 0
                    ? Math.round((consolidated.summary.acceptedCount / coverageTargetCount) * 100)
                    : 0,
                finalFailureReason: null
              }
            }
          })
        });

        try {
          const fallbackResult = await runPdfFallbackCoverageLadder({
            job,
            sourceDocument,
            reason:
              consolidated.items.length === 0
                ? "no_valid_items_after_local_processing"
                : "local_processing_kept_too_few_items",
            estimatedItems: estimatedItems || consolidated.summary.acceptedCount,
            minimumPublishableCount: publishableThreshold,
            timeoutMs: PDF_FALLBACK_TIMEOUT_MS,
            throwOnTimeout: true,
            throwOnKnownError: true
          });

          if (fallbackResult?.kind === "publishable") {
            return persistAuthoritativePdfFallback({
              job,
              jobId,
              userId,
              chunkRows,
              fallbackResult
            });
          }

          if (fallbackResult?.kind === "not_publishable") {
            const details = buildPdfFallbackNotPublishableDetails({
              acceptedCount: fallbackResult.acceptedCount,
              publishableThreshold: fallbackResult.publishableThreshold,
              coverageTargetCount: fallbackResult.coverageTargetCount
            });

            return failPdfFallbackJob({
              jobId,
              userId,
              job,
              chunkRows,
              consolidated: fallbackResult.consolidated,
              failureReason: "pdf_fallback_not_publishable",
              processingMode: "pdf_fallback_not_publishable",
              errorMessage: details.errorMessage,
              statusDetail: details.statusDetail,
              extraPatch: {
                pdfProcessingMode: "openai_fallback",
                pdfFallbackReason: fallbackResult.reason,
                pdfFallbackItemCount: fallbackResult.acceptedCount,
                pdfFallbackNotes: fallbackResult.notes,
                pdfFallbackPublishableThreshold: fallbackResult.publishableThreshold,
                pdfFallbackCoverageTargetCount: fallbackResult.coverageTargetCount || publishableThreshold,
                lastFailureContext: {
                  message: "pdf_fallback_not_publishable"
                },
                consolidationDiagnostics: {
                  pdfFallbackOutcome: "not_publishable",
                  pdfFallbackAcceptedCount: fallbackResult.acceptedCount,
                  needsReviewCount: fallbackResult.needsReviewCount || 0,
                  rawExtractedCount: fallbackResult.rawExtractedCount || fallbackResult.acceptedCount,
                  rejectedReasonCounts: fallbackResult.consolidated?.summary?.rejectReasons || null,
                  extractionSource: "openai_file",
                  publishableThreshold: fallbackResult.publishableThreshold,
                  coverageTargetCount: fallbackResult.coverageTargetCount || publishableThreshold,
                  coveragePercent: fallbackResult.coveragePercent || 0,
                  extractionAttempts: fallbackResult.extractionAttempts || [],
                  fallbackUsedAsAuthoritative: true
                }
              }
            });
          }
        } catch (error) {
          const normalizedError = normalizeOpenAIError(error);

          if (normalizedError.isTimeoutLike) {
            return failPdfFallbackJob({
              jobId,
              userId,
              job,
              chunkRows,
              consolidated,
              failureReason: "pdf_fallback_timeout",
              processingMode: "pdf_fallback_timeout",
              errorMessage:
                "Analiza mai atenta a PDF-ului a durat prea mult. Poti relua procesarea sau reincarca fisierul.",
              statusDetail:
                "Procesarea s-a oprit dupa un timeout in etapa de verificare finala. Incearca reluarea sau un fisier mai clar.",
              extraPatch: {
                lastFallbackTimedOutAt: new Date().toISOString(),
                lastFallbackError: normalizedError.details || {
                  message: normalizedError.message
                },
                lastFailureContext: buildFailureContext(normalizedError),
                consolidationDiagnostics: {
                  pdfFallbackOutcome: "timeout",
                  publishableThreshold,
                  fallbackUsedAsAuthoritative: true
                }
              }
            });
          }

          if (isKnownOpenAIFallbackError(normalizedError)) {
            return failPdfFallbackJob({
              jobId,
              userId,
              job,
              chunkRows,
              consolidated,
              failureReason: "pdf_fallback_failed",
              processingMode: "pdf_fallback_failed",
              errorMessage:
                "Analiza mai atenta a PDF-ului nu a putut fi finalizata. Poti relua procesarea sau reincarca un fisier mai clar.",
              statusDetail:
                "Procesarea s-a oprit in etapa de verificare finala dupa o eroare de analiza suplimentara.",
              extraPatch: {
                lastFallbackFailedAt: new Date().toISOString(),
                lastFallbackError: normalizedError.details || {
                  message: normalizedError.message,
                  status: normalizedError.status,
                  code: normalizedError.code,
                  type: normalizedError.type
                },
                lastFailureContext: buildFailureContext(normalizedError),
                consolidationDiagnostics: {
                  pdfFallbackOutcome: "failed",
                  publishableThreshold,
                  fallbackUsedAsAuthoritative: true
                }
              }
            });
          }

          return failPdfFallbackJob({
            jobId,
            userId,
            job,
            chunkRows,
            consolidated,
            failureReason: "pdf_fallback_failed",
            processingMode: "pdf_fallback_failed",
            errorMessage:
              "Analiza mai atenta a PDF-ului nu a putut fi finalizata. Poti relua procesarea sau reincarca un fisier mai clar.",
            statusDetail:
              "Procesarea s-a oprit in etapa de verificare finala dupa o eroare neasteptata de analiza suplimentara.",
            extraPatch: {
              lastFallbackFailedAt: new Date().toISOString(),
              lastFallbackError: normalizedError.details || {
                message: normalizedError.message,
                status: normalizedError.status,
                code: normalizedError.code,
                type: normalizedError.type
              },
              lastFailureContext: buildFailureContext(normalizedError),
              consolidationDiagnostics: {
                pdfFallbackOutcome: "failed",
                publishableThreshold,
                fallbackUsedAsAuthoritative: true
              }
            }
          });
        }
      }

      if (!consolidated.items.length) {
        await updateJob(jobId, {
          status: "failed",
          stage: "failed",
          progress_percent: 84,
          error_message:
            "Am extras intrebari, dar prea multe au fost eliminate la verificarea finala.",
          status_detail:
            "Dupa normalizare si deduplicare, nu au ramas suficiente intrebari valide pentru publicare.",
          metadata: buildConsolidationMetadata(job, {
            chunkRows,
            consolidated,
            patch: {
              processingMode: job.metadata?.processingMode || "local_consolidation",
              currentStage: "failed",
              finalFailureReason: "consolidation_too_few_valid_items",
              lastFailureContext: {
                message: "too_few_valid_items_after_consolidation"
              },
              consolidationDiagnostics: {
                finalFailureReason: "consolidation_too_few_valid_items"
              }
            }
          }),
          completed_at: new Date().toISOString()
        });

        return getQuestionBankJobSnapshot({ jobId, userId });
      }

      let resultBankId = null;
      try {
        resultBankId = await ensureQuestionBank(job, consolidated);
      } catch (error) {
        await updateJob(jobId, {
          status: "failed",
          stage: "failed",
          progress_percent: 84,
          error_message:
            "Am extras intrebarile, dar nu am putut salva banca finala. Incearca din nou.",
          status_detail:
            "Procesarea s-a oprit in etapa de salvare a bancii finale pentru verificare.",
          metadata: buildConsolidationMetadata(job, {
            chunkRows,
            consolidated,
            patch: {
              currentStage: "failed",
              finalFailureReason: "question_bank_persist_failed",
              lastFailureContext: buildFailureContext(error),
              consolidationDiagnostics: {
                finalFailureReason: "question_bank_persist_failed"
              }
            }
          }),
          completed_at: new Date().toISOString()
        });

        return getQuestionBankJobSnapshot({ jobId, userId });
      }

      await updateJob(jobId, {
        status: "processing",
        stage: "publishing",
        progress_percent: 92,
        result_bank_id: resultBankId,
        status_detail: `Pregatim banca finala cu ${consolidated.summary.acceptedCount} itemi validi pentru verificare.`,
        metadata: buildStageMetadata(job, "publishing", "publishing", {
          consolidationSummary: consolidated.summary,
          consolidationDiagnostics: buildConsolidationDiagnostics(job, {
            chunkRows,
            consolidated,
            patch: {
              startedAt:
                job.metadata?.consolidationDiagnostics?.startedAt || new Date().toISOString(),
              usedPdfFallback:
                job.metadata?.consolidationDiagnostics?.usedPdfFallback || false,
              pdfFallbackOutcome:
                job.metadata?.consolidationDiagnostics?.pdfFallbackOutcome || null,
              finalFailureReason: null
            }
          })
        })
      });

      return getQuestionBankJobSnapshot({ jobId, userId });
    }

    if (job.stage === "publishing") {
      try {
        return finalizeQuestionBankReview({
          job,
          resultBankId: job.result_bank_id,
          consolidatedSummary: job.metadata?.consolidationSummary || {
            acceptedCount: 0,
            duplicateCount: 0,
            rejectedCount: 0
          }
        });
      } catch (error) {
        await updateJob(jobId, {
          status: "failed",
          stage: "failed",
          progress_percent: 92,
          error_message:
            "Am extras intrebarile, dar nu am putut finaliza pregatirea pentru verificare. Incearca din nou.",
          status_detail:
            "Procesarea s-a oprit in pasul final, dupa salvarea bancii de intrebari.",
          metadata: buildConsolidationMetadata(job, {
            consolidated: {
              summary: job.metadata?.consolidationSummary || {
                acceptedCount: 0,
                duplicateCount: 0,
                rejectedCount: 0
              }
            },
            patch: {
              currentStage: "failed",
              finalFailureReason: "review_finalize_failed",
              lastFailureContext: buildFailureContext(error),
              consolidationDiagnostics: {
                finalFailureReason: "review_finalize_failed"
              }
            }
          }),
          completed_at: new Date().toISOString()
        });

        return getQuestionBankJobSnapshot({ jobId, userId });
      }
    }

    return getQuestionBankJobSnapshot({ jobId, userId });
  } finally {
    await releaseJobLock(jobId);
  }
}
