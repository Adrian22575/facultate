import assert from "node:assert/strict";
import fs from "node:fs";

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
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

async function consume(admin, userId, key) {
  const { data, error } = await admin.rpc("consume_ai_credit", {
    p_user_id: userId,
    p_cost: 1,
    p_idempotency_key: key,
    p_metadata: { testRun: "credit-consumption-e2e" }
  });
  if (error) throw error;
  return data;
}

async function main() {
  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  let userId = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: `credit-consumption-e2e-${suffix}@example.test`,
      password: `Credit-consumption-e2e-${suffix}!`,
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
      metadata: { testRun: "credit-consumption-e2e" }
    });
    if (creditError) throw creditError;

    const keys = [`test:${suffix}:a`, `test:${suffix}:b`];
    const concurrent = await Promise.allSettled(keys.map((key) => consume(admin, userId, key)));
    const fulfilled = concurrent.filter((result) => result.status === "fulfilled");
    const rejected = concurrent.filter((result) => result.status === "rejected");

    assert.equal(fulfilled.length, 1, "only one concurrent debit succeeds");
    assert.equal(rejected.length, 1, "the second concurrent debit is rejected");
    assert.match(String(rejected[0].reason?.message || ""), /INSUFFICIENT_AI_CREDITS/);
    assert.equal(fulfilled[0].value?.consumed, true, "successful debit reports consumption");
    assert.equal(Number(fulfilled[0].value?.balance), 0, "balance reaches zero");

    const successfulKey = keys[concurrent.findIndex((result) => result.status === "fulfilled")];
    const repeated = await consume(admin, userId, successfulKey);
    assert.equal(repeated?.consumed, false, "same key is idempotent");
    assert.equal(Number(repeated?.balance), 0, "idempotent retry does not change balance");

    const { count, error: countError } = await admin
      .from("ai_credit_ledger")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("reason", "generation_consume");
    if (countError) throw countError;
    assert.equal(count, 1, "exactly one debit row exists");

    console.log("credit:consume:e2e ok");
  } finally {
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error("credit_consume_e2e_cleanup_failed", error.message);
    }
  }
}

main().catch((error) => {
  console.error("credit:consume:e2e failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
