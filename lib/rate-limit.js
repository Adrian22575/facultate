import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function checkRateLimit({
  action,
  subject,
  windowSeconds,
  maxRequests
}) {
  const supabase = createAdminClient();
  const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { count, error: countError } = await supabase
    .from("api_rate_limit_events")
    .select("id", { count: "exact", head: true })
    .eq("action", action)
    .eq("subject", subject)
    .gte("created_at", windowStart);

  if (countError) {
    throw countError;
  }

  const attempts = count ?? 0;
  const allowed = attempts < maxRequests;

  if (!allowed) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: windowSeconds
    };
  }

  const { error: insertError } = await supabase.from("api_rate_limit_events").insert({
    action,
    subject
  });

  if (insertError) {
    throw insertError;
  }

  return {
    allowed: true,
    remaining: Math.max(0, maxRequests - attempts - 1),
    retryAfterSeconds: 0
  };
}

export async function assertRateLimit(config) {
  const result = await checkRateLimit(config);

  if (!result.allowed) {
    const error = new Error(
      "Ai ajuns la limita temporară pentru această acțiune. Încearcă din nou puțin mai târziu."
    );
    error.code = "RATE_LIMITED";
    error.retryAfterSeconds = result.retryAfterSeconds;
    throw error;
  }

  return result;
}
