const ONE_MILLION = 1_000_000;

export const OPENAI_PRICING_VERSION = "2026-07-19-openai-api-pricing";
export const OPENAI_PRICING_SOURCE_URL = "https://openai.com/api/pricing/";
export const OPENAI_PRICING_UPDATED_AT = "2026-07-19";

const MODEL_NAME_ALIASES = new Map([
  ["gpt-5.6", "gpt-5.6-sol"],
  ["gpt-5.6 sol", "gpt-5.6-sol"],
  ["gpt-5.6-sol", "gpt-5.6-sol"],
  ["gpt-5.6 terra", "gpt-5.6-terra"],
  ["gpt-5.6-terra", "gpt-5.6-terra"],
  ["gpt-5.6 luna", "gpt-5.6-luna"],
  ["gpt-5.6-luna", "gpt-5.6-luna"],
  ["gpt-5.5", "gpt-5.5"],
  ["gpt-5.4", "gpt-5.4"],
  ["gpt-5.4 mini", "gpt-5.4-mini"],
  ["gpt-5.4-mini", "gpt-5.4-mini"],
  ["gpt-5.1", "gpt-5.1"],
  ["gpt-5", "gpt-5"],
  ["gpt-5 mini", "gpt-5-mini"],
  ["gpt-5-mini", "gpt-5-mini"],
  ["gpt-4o", "gpt-4o"],
  ["gpt-4o mini", "gpt-4o-mini"],
  ["gpt-4o-mini", "gpt-4o-mini"]
]);

const OPENAI_MODEL_PRICING = {
  "gpt-5.6-sol": {
    inputPer1M: 5,
    cachedInputPer1M: 0.5,
    outputPer1M: 30
  },
  "gpt-5.6-terra": {
    inputPer1M: 2.5,
    cachedInputPer1M: 0.25,
    outputPer1M: 15
  },
  "gpt-5.6-luna": {
    inputPer1M: 1,
    cachedInputPer1M: 0.1,
    outputPer1M: 6
  },
  "gpt-5.5": {
    inputPer1M: 5,
    cachedInputPer1M: 0.5,
    outputPer1M: 30
  },
  "gpt-5.4": {
    inputPer1M: 2.5,
    cachedInputPer1M: 0.25,
    outputPer1M: 15
  },
  "gpt-5.4-mini": {
    inputPer1M: 0.75,
    cachedInputPer1M: 0.075,
    outputPer1M: 4.5
  },
  "gpt-5.1": {
    inputPer1M: 1.25,
    cachedInputPer1M: 0.125,
    outputPer1M: 10
  },
  "gpt-5": {
    inputPer1M: 1.25,
    cachedInputPer1M: 0.125,
    outputPer1M: 10
  },
  "gpt-5-mini": {
    inputPer1M: 0.25,
    cachedInputPer1M: 0.025,
    outputPer1M: 2
  },
  "gpt-4o": {
    inputPer1M: 2.5,
    cachedInputPer1M: 1.25,
    outputPer1M: 10
  },
  "gpt-4o-mini": {
    inputPer1M: 0.15,
    cachedInputPer1M: 0.075,
    outputPer1M: 0.6
  }
};

function coerceFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
}

function roundUsd(value) {
  return Number(value.toFixed(8));
}

export function extractUsageBreakdown(usage = {}) {
  const inputTokens = Math.max(
    0,
    Math.round(coerceFiniteNumber(usage?.input_tokens ?? usage?.prompt_tokens))
  );
  const outputTokens = Math.max(
    0,
    Math.round(coerceFiniteNumber(usage?.output_tokens ?? usage?.completion_tokens))
  );
  const cachedInputTokens = Math.max(
    0,
    Math.round(
      coerceFiniteNumber(
        usage?.input_tokens_details?.cached_tokens ?? usage?.prompt_tokens_details?.cached_tokens
      )
    )
  );
  const reasoningTokens = Math.max(
    0,
    Math.round(
      coerceFiniteNumber(
        usage?.output_tokens_details?.reasoning_tokens ??
          usage?.completion_tokens_details?.reasoning_tokens
      )
    )
  );
  const totalTokens = Math.max(
    0,
    Math.round(coerceFiniteNumber(usage?.total_tokens || inputTokens + outputTokens))
  );

  return {
    inputTokens,
    outputTokens,
    cachedInputTokens: Math.min(cachedInputTokens, inputTokens),
    reasoningTokens,
    totalTokens
  };
}

export function normalizeOpenAIModelName(model) {
  const normalized = String(model || "")
    .trim()
    .toLowerCase();

  if (!normalized) {
    return null;
  }

  const directAlias = MODEL_NAME_ALIASES.get(normalized);
  if (directAlias) {
    return directAlias;
  }

  for (const canonicalModel of Object.keys(OPENAI_MODEL_PRICING)) {
    if (normalized === canonicalModel || normalized.startsWith(`${canonicalModel}-`)) {
      return canonicalModel;
    }
  }

  return normalized;
}

export function getOpenAIModelPricing(model) {
  const canonicalModel = normalizeOpenAIModelName(model);
  if (!canonicalModel) {
    return null;
  }

  const pricing = OPENAI_MODEL_PRICING[canonicalModel];
  if (!pricing) {
    return null;
  }

  return {
    canonicalModel,
    ...pricing
  };
}

export function estimateOpenAIRequestCost({ model, usage = {}, operation = null } = {}) {
  const tokenBreakdown = extractUsageBreakdown(usage);
  const hasAnyTokens =
    tokenBreakdown.inputTokens > 0 ||
    tokenBreakdown.outputTokens > 0 ||
    tokenBreakdown.totalTokens > 0;
  const pricing = getOpenAIModelPricing(model);

  if (!hasAnyTokens) {
    return {
      canonicalModel: normalizeOpenAIModelName(model),
      pricingVersion: OPENAI_PRICING_VERSION,
      pricingStatus: "zero_usage",
      estimatedCostUsd: 0,
      estimatedInputCostUsd: 0,
      estimatedCachedInputCostUsd: 0,
      estimatedOutputCostUsd: 0,
      operation: operation || null,
      ...tokenBreakdown
    };
  }

  if (!pricing) {
    return {
      canonicalModel: normalizeOpenAIModelName(model),
      pricingVersion: OPENAI_PRICING_VERSION,
      pricingStatus: "pricing_missing",
      estimatedCostUsd: null,
      estimatedInputCostUsd: null,
      estimatedCachedInputCostUsd: null,
      estimatedOutputCostUsd: null,
      operation: operation || null,
      ...tokenBreakdown
    };
  }

  const billableUncachedInputTokens = Math.max(
    0,
    tokenBreakdown.inputTokens - tokenBreakdown.cachedInputTokens
  );
  const estimatedInputCostUsd =
    (billableUncachedInputTokens * pricing.inputPer1M) / ONE_MILLION;
  const estimatedCachedInputCostUsd =
    (tokenBreakdown.cachedInputTokens * pricing.cachedInputPer1M) / ONE_MILLION;
  const estimatedOutputCostUsd = (tokenBreakdown.outputTokens * pricing.outputPer1M) / ONE_MILLION;
  const estimatedCostUsd =
    estimatedInputCostUsd + estimatedCachedInputCostUsd + estimatedOutputCostUsd;

  return {
    canonicalModel: pricing.canonicalModel,
    pricingVersion: OPENAI_PRICING_VERSION,
    pricingStatus: "estimated",
    estimatedCostUsd: roundUsd(estimatedCostUsd),
    estimatedInputCostUsd: roundUsd(estimatedInputCostUsd),
    estimatedCachedInputCostUsd: roundUsd(estimatedCachedInputCostUsd),
    estimatedOutputCostUsd: roundUsd(estimatedOutputCostUsd),
    operation: operation || null,
    ...tokenBreakdown
  };
}
