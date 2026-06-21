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

const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) =>
  nativeFetch(input, {
    ...init,
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)])
      : AbortSignal.timeout(20_000)
  });

const { createAdminClient } = await import("@/lib/supabase/admin.js");

function enqueue(admin, userId, sourceDocumentId, marker) {
  return admin.rpc("create_credit_backed_generation_job", {
    p_user_id: userId,
    p_source_document_id: sourceDocumentId,
    p_job_kind: "question_bank_extract",
    p_status_detail: "Test de rezervare",
    p_result_learning_study_set_id: null,
    p_metadata: { testRun: "credit-job-enqueue-e2e", marker }
  });
}

async function main() {
  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `credit-job-enqueue-e2e-${suffix}@example.test`;
  const password = `Credit-job-enqueue-e2e-${suffix}!`;
  let userId = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });
    if (createError) throw createError;
    userId = created?.user?.id;
    assert.ok(userId, "temporary auth user created");

    const { error: creditError } = await admin.from("ai_credit_ledger").insert({
      user_id: userId,
      source: "admin",
      reason: "manual_adjustment",
      delta: 1,
      metadata: { testRun: "credit-job-enqueue-e2e" }
    });
    if (creditError) throw creditError;

    const { data: sourceDocument, error: sourceError } = await admin
      .from("ai_source_documents")
      .insert({
        user_id: userId,
        source_kind: "manual",
        mime_type: "text/plain",
        size_bytes: 24,
        extracted_text: "Material temporar pentru test.",
        extraction_status: "succeeded"
      })
      .select("id")
      .single();
    if (sourceError) throw sourceError;

    const concurrent = await Promise.all([
      enqueue(admin, userId, sourceDocument.id, "a"),
      enqueue(admin, userId, sourceDocument.id, "b")
    ]);
    const successful = concurrent.filter((result) => !result.error);
    const rejected = concurrent.filter((result) => result.error);

    assert.equal(successful.length, 1, "only one concurrent job reserves the credit");
    assert.equal(rejected.length, 1, "the other concurrent job is rejected");
    assert.match(
      rejected[0].error.message,
      /nu ai suficiente incarcari disponibile/i,
      "capacity error remains actionable"
    );

    const firstJobId = successful[0].data;
    assert.ok(firstJobId, "successful reservation returns a job id");

    const { error: failError } = await admin
      .from("ai_generation_jobs")
      .update({ status: "failed", error_message: "test release" })
      .eq("id", firstJobId);
    if (failError) throw failError;

    const staleBefore = new Date(Date.now() - 60_000).toISOString();
    const { data: failedLock, error: failedLockError } = await admin.rpc(
      "acquire_ai_generation_job_lock",
      { p_job_id: firstJobId, p_stale_before: staleBefore }
    );
    if (failedLockError) throw failedLockError;
    assert.equal(failedLock, false, "failed jobs cannot bypass the requeue reservation");

    const released = await enqueue(admin, userId, sourceDocument.id, "after-release");
    if (released.error) throw released.error;
    assert.ok(released.data, "a failed job releases the reservation");

    const blockedRequeue = await admin.rpc("requeue_credit_backed_generation_job", {
      p_job_id: firstJobId,
      p_user_id: userId
    });
    assert.ok(blockedRequeue.error, "requeue is blocked while another job reserves the credit");
    assert.match(blockedRequeue.error.message, /nu ai suficiente incarcari disponibile/i);

    const { error: releaseSecondError } = await admin
      .from("ai_generation_jobs")
      .update({ status: "failed", error_message: "test release second" })
      .eq("id", released.data);
    if (releaseSecondError) throw releaseSecondError;

    const requeued = await admin.rpc("requeue_credit_backed_generation_job", {
      p_job_id: firstJobId,
      p_user_id: userId
    });
    if (requeued.error) throw requeued.error;
    assert.equal(requeued.data, firstJobId, "failed job is requeued after capacity is released");

    const repeatedRequeue = await admin.rpc("requeue_credit_backed_generation_job", {
      p_job_id: firstJobId,
      p_user_id: userId
    });
    if (repeatedRequeue.error) throw repeatedRequeue.error;
    assert.equal(repeatedRequeue.data, firstJobId, "requeue is idempotent for an active job");

    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const anonAttempt = await enqueue(anon, userId, sourceDocument.id, "anon");
    assert.ok(anonAttempt.error, "anonymous callers cannot enqueue service jobs");

    const authenticated = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );
    const { error: signInError } = await authenticated.auth.signInWithPassword({ email, password });
    if (signInError) throw signInError;
    const authenticatedAttempt = await enqueue(
      authenticated,
      userId,
      sourceDocument.id,
      "authenticated"
    );
    assert.ok(authenticatedAttempt.error, "authenticated callers cannot enqueue service jobs");

    const authenticatedRequeue = await authenticated.rpc("requeue_credit_backed_generation_job", {
      p_job_id: firstJobId,
      p_user_id: userId
    });
    assert.ok(authenticatedRequeue.error, "authenticated callers cannot requeue service jobs");

    console.log("credit:enqueue:e2e ok");
  } finally {
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error("credit_job_enqueue_e2e_cleanup_failed", error.message);
    }
  }
}

main().catch((error) => {
  console.error("credit:enqueue:e2e failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
