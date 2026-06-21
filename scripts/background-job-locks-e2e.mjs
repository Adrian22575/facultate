import assert from "node:assert/strict";
import fs from "node:fs";

import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};
  const env = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

Object.assign(process.env, loadEnvFile(".env.local"), process.env);
const { createAdminClient } = await import("@/lib/supabase/admin.js");

async function main() {
  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `background-locks-e2e-${suffix}@example.test`;
  const password = `Background-locks-e2e-${suffix}!`;
  let userId = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createError) throw createError;
    userId = created?.user?.id;
    assert.ok(userId);

    const { data: job, error: jobError } = await admin
      .from("ai_import_jobs")
      .insert({
        user_id: userId,
        mode: "set",
        source_type: "paste",
        title: "Test lock",
        status: "uploaded",
        metadata: { testRun: "background-job-locks-e2e" }
      })
      .select("id")
      .single();
    if (jobError) throw jobError;

    const staleBefore = new Date(Date.now() - 8 * 60 * 1000).toISOString();
    const acquire = () =>
      admin.rpc("acquire_ai_import_job_lock", {
        p_job_id: job.id,
        p_stale_before: staleBefore
      });

    const concurrent = await Promise.all([acquire(), acquire()]);
    assert.equal(
      concurrent.filter((result) => result.data === true && !result.error).length,
      1,
      "only one worker acquires an import job"
    );
    assert.equal(
      concurrent.filter((result) => result.data === false && !result.error).length,
      1,
      "the competing worker is rejected"
    );

    const released = await admin.rpc("release_ai_import_job_lock", { p_job_id: job.id });
    if (released.error) throw released.error;
    const reacquired = await acquire();
    if (reacquired.error) throw reacquired.error;
    assert.equal(reacquired.data, true, "released import jobs can be claimed again");

    const publicClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: signInError } = await publicClient.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    const unauthorized = await publicClient.rpc("release_ai_import_job_lock", {
      p_job_id: job.id
    });
    assert.ok(unauthorized.error, "client sessions cannot control worker locks");

    console.log("background:locks:e2e ok");
  } finally {
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error("background_locks_e2e_cleanup_failed", error.message);
    }
  }
}

main().catch((error) => {
  console.error("background:locks:e2e failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
