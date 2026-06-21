import "server-only";

import { createHash } from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export async function checkRateLimit({ action, subject, windowSeconds, maxRequests }) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("consume_api_rate_limit", {
    p_action: action,
    p_subject: subject,
    p_window_seconds: windowSeconds,
    p_max_requests: maxRequests
  });

  if (error) throw error;

  const result = Array.isArray(data) ? data[0] : data;
  return {
    allowed: Boolean(result?.allowed),
    remaining: Number(result?.remaining || 0),
    retryAfterSeconds: Number(result?.retry_after_seconds || 0)
  };
}

export function getRateLimitSubject(request, userId = null) {
  if (userId) return `user:${userId}`;

  const forwardedFor = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const address = forwardedFor || request.headers.get("x-real-ip") || "unknown";
  const digest = createHash("sha256").update(address).digest("hex").slice(0, 32);
  return `network:${digest}`;
}

export async function assertRateLimit(config) {
  const result = await checkRateLimit(config);

  if (!result.allowed) {
    const error = new Error(
      "Ai ajuns temporar la limita pentru aceasta actiune. Incearca din nou putin mai tarziu."
    );
    error.code = "RATE_LIMITED";
    error.retryAfterSeconds = result.retryAfterSeconds;
    throw error;
  }

  return result;
}
