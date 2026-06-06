import "server-only";

import { getOpenAI } from "@/lib/openai/server";
import { estimateOpenAIRequestCost } from "@/lib/openai/pricing";
import { createAdminClient } from "@/lib/supabase/admin";

const PREVIEW_LIMIT = 6000;
const PERMANENT_OPENAI_ERROR_CODES = new Set([
  "insufficient_quota",
  "invalid_api_key",
  "permission_denied",
  "model_not_found"
]);

function trimText(value, limit = PREVIEW_LIMIT) {
  const text = String(value || "").trim();
  if (!text) {
    return "";
  }

  if (text.length <= limit) {
    return text;
  }

  return `${text.slice(0, limit)}…`;
}

function normalizeContentText(content) {
  if (typeof content === "string") {
    return trimText(content);
  }

  if (Array.isArray(content)) {
    return trimText(
      content
        .map((item) => {
          if (!item || typeof item !== "object") {
            return "";
          }

          if (typeof item.text === "string") {
            return item.text;
          }

          if (item.type === "input_file") {
            return `[file:${item.file_id || item.filename || "attached"}]`;
          }

          return "";
        })
        .filter(Boolean)
        .join("\n\n")
    );
  }

  return "";
}

function extractPromptParts(request) {
  const inputItems = Array.isArray(request?.input) ? request.input : [];
  const promptSegments = [];
  const inputSegments = [];

  if (typeof request?.instructions === "string" && request.instructions.trim()) {
    promptSegments.push(request.instructions.trim());
  }

  for (const item of inputItems) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const contentText = normalizeContentText(item.content);
    if (!contentText) {
      continue;
    }

    if (item.role === "system" || item.role === "developer") {
      promptSegments.push(contentText);
      continue;
    }

    inputSegments.push(contentText);
  }

  return {
    promptText: trimText(promptSegments.join("\n\n")),
    inputPreview: trimText(inputSegments.join("\n\n"))
  };
}

function firstNonEmptyString(values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return null;
}

function firstFiniteNumber(values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
  }

  return null;
}

function serializeErrorValue(value, depth = 0) {
  if (value == null) {
    return null;
  }

  if (typeof value === "string") {
    return trimText(value, 1000);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (depth >= 2) {
    return trimText(String(value), 1000);
  }

  if (Array.isArray(value)) {
    return value
      .slice(0, 6)
      .map((item) => serializeErrorValue(item, depth + 1))
      .filter((item) => item !== null);
  }

  if (typeof value === "object") {
    const serialized = {};

    for (const [key, nestedValue] of Object.entries(value).slice(0, 10)) {
      if (typeof nestedValue === "function" || typeof nestedValue === "undefined") {
        continue;
      }

      const safeValue = serializeErrorValue(nestedValue, depth + 1);
      if (safeValue !== null) {
        serialized[key] = safeValue;
      }
    }

    return Object.keys(serialized).length ? serialized : null;
  }

  return trimText(String(value), 1000);
}

export function normalizeOpenAIError(error) {
  const errorLike = error && typeof error === "object" ? error : null;
  const nestedError =
    errorLike?.error && typeof errorLike.error === "object" ? errorLike.error : null;
  const bodyError =
    errorLike?.body?.error && typeof errorLike.body.error === "object" ? errorLike.body.error : null;
  const causeError =
    errorLike?.cause && typeof errorLike.cause === "object" ? errorLike.cause : null;

  const message = firstNonEmptyString([
    errorLike?.message,
    nestedError?.message,
    bodyError?.message,
    causeError?.message,
    typeof error === "string" ? error : null
  ]) || "unknown_error";
  const name = firstNonEmptyString([errorLike?.name, nestedError?.name, causeError?.name]);
  const type = firstNonEmptyString([errorLike?.type, nestedError?.type, bodyError?.type]);
  const code = firstNonEmptyString([errorLike?.code, nestedError?.code, bodyError?.code]);
  const status = firstFiniteNumber([
    errorLike?.status,
    errorLike?.statusCode,
    errorLike?.response?.status,
    bodyError?.status
  ]);
  const requestId = firstNonEmptyString([
    errorLike?.request_id,
    errorLike?.requestId,
    errorLike?.headers?.["x-request-id"]
  ]);
  const details = serializeErrorValue({
    status,
    code,
    type,
    param: nestedError?.param || bodyError?.param || null,
    requestId,
    error: nestedError || bodyError || null,
    cause: causeError || null
  });
  const normalizedText = [name, type, code, message].filter(Boolean).join(" ").toLowerCase();
  const isTimeoutLike =
    status === 408 ||
    status === 504 ||
    code === "ETIMEDOUT" ||
    normalizedText.includes("timed out") ||
    normalizedText.includes("timeout") ||
    normalizedText.includes("deadline exceeded") ||
    normalizedText.includes("abort");
  const isKnownOpenAIError = Boolean(
    nestedError ||
      bodyError ||
      requestId ||
      status !== null ||
      code ||
      type ||
      (name && name !== "Error")
  );

  return {
    message: trimText(message, 2000),
    name: name || null,
    type: type || null,
    status,
    code: code || null,
    requestId: requestId || null,
    details,
    isTimeoutLike,
    isKnownOpenAIError
  };
}

export function isPermanentOpenAIError(error) {
  const normalizedError =
    error?.message && Object.prototype.hasOwnProperty.call(error, "isTimeoutLike")
      ? error
      : normalizeOpenAIError(error);
  const code = String(normalizedError.code || "").toLowerCase();
  const type = String(normalizedError.type || "").toLowerCase();
  const message = String(normalizedError.message || "").toLowerCase();

  return (
    PERMANENT_OPENAI_ERROR_CODES.has(code) ||
    PERMANENT_OPENAI_ERROR_CODES.has(type) ||
    PERMANENT_OPENAI_ERROR_CODES.has(message) ||
    message.includes("insufficient_quota") ||
    message.includes("invalid api key") ||
    message.includes("permission_denied") ||
    message.includes("permission denied") ||
    message.includes("model_not_found")
  );
}

export function getOpenAIProviderFailureCode(error) {
  const normalizedError =
    error?.message && Object.prototype.hasOwnProperty.call(error, "isTimeoutLike")
      ? error
      : normalizeOpenAIError(error);
  const code = String(normalizedError.code || normalizedError.type || "").trim();
  const message = String(normalizedError.message || "").toLowerCase();

  if (code) {
    return code;
  }

  for (const knownCode of PERMANENT_OPENAI_ERROR_CODES) {
    if (message.includes(knownCode) || message.includes(knownCode.replace(/_/g, " "))) {
      return knownCode;
    }
  }

  return null;
}

async function writeOpenAILog(entry) {
  try {
    const admin = createAdminClient();
    let { error } = await admin.from("openai_request_logs").insert(entry);

    if (error && isLegacyOpenAILogSchemaError(error)) {
      ({ error } = await admin.from("openai_request_logs").insert(stripCostColumnsFromLogEntry(entry)));
    }

    if (error) {
      console.error("Failed to store OpenAI request log", normalizeOpenAIError(error).message);
    }
  } catch (error) {
    console.error("Failed to store OpenAI request log", normalizeOpenAIError(error).message);
  }
}

function isLegacyOpenAILogSchemaError(error) {
  const normalizedMessage = normalizeOpenAIError(error).message.toLowerCase();
  return (
    normalizedMessage.includes("estimated_cost_usd") ||
    normalizedMessage.includes("estimated_input_cost_usd") ||
    normalizedMessage.includes("estimated_output_cost_usd") ||
    normalizedMessage.includes("estimated_cached_input_cost_usd") ||
    normalizedMessage.includes("pricing_status") ||
    normalizedMessage.includes("pricing_version") ||
    normalizedMessage.includes("input_tokens") ||
    normalizedMessage.includes("output_tokens") ||
    normalizedMessage.includes("cached_input_tokens") ||
    normalizedMessage.includes("reasoning_tokens") ||
    normalizedMessage.includes("total_tokens")
  );
}

function stripCostColumnsFromLogEntry(entry) {
  const legacyEntry = { ...entry };
  delete legacyEntry.estimated_cost_usd;
  delete legacyEntry.estimated_input_cost_usd;
  delete legacyEntry.estimated_output_cost_usd;
  delete legacyEntry.estimated_cached_input_cost_usd;
  delete legacyEntry.pricing_status;
  delete legacyEntry.pricing_version;
  delete legacyEntry.input_tokens;
  delete legacyEntry.output_tokens;
  delete legacyEntry.cached_input_tokens;
  delete legacyEntry.reasoning_tokens;
  delete legacyEntry.total_tokens;
  return legacyEntry;
}

function buildUsagePayload(response) {
  return response?.usage || {};
}

function buildCostColumns({ model, usage, operation }) {
  const estimate = estimateOpenAIRequestCost({
    model,
    usage,
    operation
  });

  return {
    estimated_cost_usd: estimate.estimatedCostUsd,
    estimated_input_cost_usd: estimate.estimatedInputCostUsd,
    estimated_output_cost_usd: estimate.estimatedOutputCostUsd,
    estimated_cached_input_cost_usd: estimate.estimatedCachedInputCostUsd,
    pricing_status: estimate.pricingStatus,
    pricing_version: estimate.pricingVersion,
    input_tokens: estimate.inputTokens,
    output_tokens: estimate.outputTokens,
    cached_input_tokens: estimate.cachedInputTokens,
    reasoning_tokens: estimate.reasoningTokens,
    total_tokens: estimate.totalTokens
  };
}

function buildOutputPreview(response) {
  if (typeof response?.output_text === "string" && response.output_text.trim()) {
    return trimText(response.output_text);
  }

  if (Array.isArray(response?.output)) {
    return trimText(
      response.output
        .map((item) => {
          if (item?.type !== "message" || !Array.isArray(item.content)) {
            return "";
          }

          return item.content
            .map((contentItem) =>
              contentItem?.type === "output_text" ? contentItem.text || "" : ""
            )
            .filter(Boolean)
            .join("\n");
        })
        .filter(Boolean)
        .join("\n\n")
    );
  }

  return "";
}

export async function runLoggedResponseParse({
  requestScope,
  request,
  requestOptions,
  metadata = {},
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  const openai = getOpenAI();
  const startedAt = Date.now();
  const { promptText, inputPreview } = extractPromptParts(request);
  const model = request?.model || null;
  const reasoningEffort = request?.reasoning?.effort || null;

  try {
    const response = await openai.responses.parse(request, requestOptions);
    const usage = buildUsagePayload(response);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "responses.parse",
      request_scope: requestScope,
      status: "succeeded",
      model,
      reasoning_effort: reasoningEffort,
      response_id: response?.id || null,
      openai_file_id: null,
      duration_ms: Date.now() - startedAt,
      prompt_text: promptText || null,
      input_preview: inputPreview || null,
      output_preview: buildOutputPreview(response) || null,
      error_message: null,
      usage,
      metadata,
      ...buildCostColumns({
        model,
        usage,
        operation: "responses.parse"
      })
    });
    return response;
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "responses.parse",
      request_scope: requestScope,
      status: "failed",
      model,
      reasoning_effort: reasoningEffort,
      response_id: null,
      openai_file_id: null,
      duration_ms: Date.now() - startedAt,
      prompt_text: promptText || null,
      input_preview: inputPreview || null,
      output_preview: null,
      error_message: normalizedError.message,
      usage: {},
      metadata,
      ...buildCostColumns({
        model,
        usage: {},
        operation: "responses.parse"
      })
    });
    throw error;
  }
}

export async function runLoggedResponseCreate({
  requestScope,
  request,
  requestOptions,
  metadata = {},
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  const openai = getOpenAI();
  const startedAt = Date.now();
  const { promptText, inputPreview } = extractPromptParts(request);
  const model = request?.model || null;
  const reasoningEffort = request?.reasoning?.effort || null;

  try {
    const response = await openai.responses.create(request, requestOptions);
    const usage = buildUsagePayload(response);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "responses.create",
      request_scope: requestScope,
      status: "succeeded",
      model,
      reasoning_effort: reasoningEffort,
      response_id: response?.id || null,
      openai_file_id: null,
      duration_ms: Date.now() - startedAt,
      prompt_text: promptText || null,
      input_preview: inputPreview || null,
      output_preview: buildOutputPreview(response) || null,
      error_message: null,
      usage,
      metadata,
      ...buildCostColumns({
        model,
        usage,
        operation: "responses.create"
      })
    });
    return response;
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "responses.create",
      request_scope: requestScope,
      status: "failed",
      model,
      reasoning_effort: reasoningEffort,
      response_id: null,
      openai_file_id: null,
      duration_ms: Date.now() - startedAt,
      prompt_text: promptText || null,
      input_preview: inputPreview || null,
      output_preview: null,
      error_message: normalizedError.message,
      usage: {},
      metadata,
      ...buildCostColumns({
        model,
        usage: {},
        operation: "responses.create"
      })
    });
    throw error;
  }
}

export async function runLoggedResponseRetrieve({
  requestScope,
  responseId,
  request,
  requestOptions,
  metadata = {},
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  const openai = getOpenAI();
  const startedAt = Date.now();

  try {
    const response = await openai.responses.retrieve(responseId, request, requestOptions);
    const usage = buildUsagePayload(response);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "responses.retrieve",
      request_scope: requestScope,
      status: "succeeded",
      model: response?.model || null,
      reasoning_effort: null,
      response_id: response?.id || responseId,
      openai_file_id: null,
      duration_ms: Date.now() - startedAt,
      prompt_text: null,
      input_preview: null,
      output_preview: buildOutputPreview(response) || null,
      error_message: null,
      usage,
      metadata: {
        ...metadata,
        requestedResponseId: responseId
      },
      ...buildCostColumns({
        model: response?.model || null,
        usage,
        operation: "responses.retrieve"
      })
    });
    return response;
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "responses.retrieve",
      request_scope: requestScope,
      status: "failed",
      model: null,
      reasoning_effort: null,
      response_id: responseId,
      openai_file_id: null,
      duration_ms: Date.now() - startedAt,
      prompt_text: null,
      input_preview: null,
      output_preview: null,
      error_message: normalizedError.message,
      usage: {},
      metadata: {
        ...metadata,
        requestedResponseId: responseId
      },
      ...buildCostColumns({
        model: null,
        usage: {},
        operation: "responses.retrieve"
      })
    });
    throw error;
  }
}

export async function createLoggedOpenAIFile({
  file,
  purpose,
  requestScope,
  requestOptions,
  metadata = {},
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  const openai = getOpenAI();
  const startedAt = Date.now();

  try {
    const response = await openai.files.create({
      file,
      purpose
    }, requestOptions);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "files.create",
      request_scope: requestScope,
      status: "succeeded",
      model: null,
      reasoning_effort: null,
      response_id: null,
      openai_file_id: response?.id || null,
      duration_ms: Date.now() - startedAt,
      prompt_text: null,
      input_preview: trimText(metadata?.filename || ""),
      output_preview: null,
      error_message: null,
      usage: {},
      metadata: {
        ...metadata,
        purpose
      },
      ...buildCostColumns({
        model: null,
        usage: {},
        operation: "files.create"
      })
    });
    return response;
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "files.create",
      request_scope: requestScope,
      status: "failed",
      model: null,
      reasoning_effort: null,
      response_id: null,
      openai_file_id: null,
      duration_ms: Date.now() - startedAt,
      prompt_text: null,
      input_preview: trimText(metadata?.filename || ""),
      output_preview: null,
      error_message: normalizedError.message,
      usage: {},
      metadata: {
        ...metadata,
        purpose
      },
      ...buildCostColumns({
        model: null,
        usage: {},
        operation: "files.create"
      })
    });
    throw error;
  }
}

export async function getOpenAIRequestDiagnosticsSnapshot(limit = 5) {
  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("openai_request_logs")
      .select("operation, request_scope, status, model, response_id, openai_file_id, error_message, metadata, created_at")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      const normalizedError = normalizeOpenAIError(error);
      return {
        warning: normalizedError.message,
        rows: []
      };
    }

    return {
      warning: null,
      rows: (data || []).map((row) => {
        const normalizedError = normalizeOpenAIError(row.error_message || "");
        const failureCode =
          getOpenAIProviderFailureCode(normalizedError) ||
          row.metadata?.openaiFailureCode ||
          row.metadata?.reason ||
          null;

        return {
          operation: row.operation || null,
          request_scope: row.request_scope || null,
          model: row.model || null,
          response_id: row.response_id || row.metadata?.requestedResponseId || null,
          openai_file_id: row.openai_file_id || row.metadata?.openaiFileId || null,
          failure_code: failureCode,
          error_message: trimText(row.error_message || "", 500),
          created_at: row.created_at || null
        };
      })
    };
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    return {
      warning: normalizedError.message,
      rows: []
    };
  }
}

export async function deleteLoggedOpenAIFile({
  fileId,
  requestScope,
  requestOptions,
  metadata = {},
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  const openai = getOpenAI();
  const startedAt = Date.now();

  try {
    const response = await openai.files.delete(fileId, requestOptions);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "files.delete",
      request_scope: requestScope,
      status: "succeeded",
      model: null,
      reasoning_effort: null,
      response_id: null,
      openai_file_id: fileId,
      duration_ms: Date.now() - startedAt,
      prompt_text: null,
      input_preview: null,
      output_preview: null,
      error_message: null,
      usage: {},
      metadata: {
        ...metadata,
        deleted: response?.deleted === true
      },
      ...buildCostColumns({
        model: null,
        usage: {},
        operation: "files.delete"
      })
    });
    return response;
  } catch (error) {
    const normalizedError = normalizeOpenAIError(error);
    await writeOpenAILog({
      user_id: userId,
      source_document_id: sourceDocumentId,
      job_id: jobId,
      operation: "files.delete",
      request_scope: requestScope,
      status: "failed",
      model: null,
      reasoning_effort: null,
      response_id: null,
      openai_file_id: fileId,
      duration_ms: Date.now() - startedAt,
      prompt_text: null,
      input_preview: null,
      output_preview: null,
      error_message: normalizedError.message,
      usage: {},
      metadata,
      ...buildCostColumns({
        model: null,
        usage: {},
        operation: "files.delete"
      })
    });
    throw error;
  }
}
