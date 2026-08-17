import "server-only";

const SERVER_TIMING_ENABLED = process.env.PERFORMANCE_SERVER_TIMING === "1";

function sanitizeMetricName(value) {
  return String(value || "metric")
    .trim()
    .replace(/[^a-zA-Z0-9_.-]/g, "_");
}

function roundDuration(value) {
  return Math.round(value * 10) / 10;
}

export function formatServerTimingMetric(name, durationMs, description = "") {
  const metric = `${sanitizeMetricName(name)};dur=${roundDuration(durationMs)}`;
  return description
    ? `${metric};desc="${String(description).replace(/["\\]/g, "")}"`
    : metric;
}

export async function measureServerTiming(name, operation, attributes = {}) {
  const startedAt = performance.now();

  try {
    return await operation();
  } finally {
    const durationMs = roundDuration(performance.now() - startedAt);

    if (SERVER_TIMING_ENABLED) {
      console.info(JSON.stringify({
        type: "server_timing",
        metric: sanitizeMetricName(name),
        duration_ms: durationMs,
        server_timing: formatServerTimingMetric(name, durationMs),
        ...attributes
      }));
    }
  }
}

export function recordServerTiming(name, durationMs, attributes = {}) {
  if (!SERVER_TIMING_ENABLED) {
    return;
  }

  const roundedDurationMs = roundDuration(durationMs);
  console.info(JSON.stringify({
    type: "server_timing",
    metric: sanitizeMetricName(name),
    duration_ms: roundedDurationMs,
    server_timing: formatServerTimingMetric(name, roundedDurationMs),
    ...attributes
  }));
}
