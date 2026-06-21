import "server-only";

import { hasSupabaseServiceEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

const HEALTH_TIMEOUT_MS = 5_000;

async function checkDatabase() {
  const admin = createAdminClient();
  const { error } = await admin.from("profiles").select("id").limit(1);
  if (error) throw error;
}

export async function checkApplicationHealth() {
  if (!hasSupabaseServiceEnv()) return { ok: false, code: "missing_configuration" };

  let timeoutId;
  try {
    await Promise.race([
      checkDatabase(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => reject(new Error("health_check_timeout")), HEALTH_TIMEOUT_MS);
      })
    ]);
    return { ok: true, code: null };
  } catch (error) {
    return {
      ok: false,
      code: typeof error === "object" && error && "code" in error ? error.code : "health_check_failed"
    };
  } finally {
    clearTimeout(timeoutId);
  }
}
