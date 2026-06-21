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

async function applyGrant(admin, params) {
  const { data, error } = await admin.rpc("apply_stripe_premium_grant", params);
  if (error) throw error;
  return data;
}

async function applyRewardGrant(admin, params) {
  const { data, error } = await admin.rpc("apply_reward_premium_grant", params);
  if (error) throw error;
  return data;
}

async function main() {
  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `billing-premium-e2e-${suffix}@example.test`;
  let userId = null;

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: `Billing-premium-e2e-${suffix}!`,
      email_confirm: true
    });
    if (createError) throw createError;
    userId = created?.user?.id;
    assert.ok(userId, "temporary auth user created");

    const session24h = `cs_e2e_24h_${suffix}`;
    const session7d = `cs_e2e_7d_${suffix}`;
    const [firstResult, secondResult] = await Promise.all([
      applyGrant(admin, {
        p_user_id: userId,
        p_plan_code: "premium_24h",
        p_duration_hours: 24,
        p_session_id: session24h,
        p_payment_intent_id: null,
        p_metadata: { test: true }
      }),
      applyGrant(admin, {
        p_user_id: userId,
        p_plan_code: "premium_7d",
        p_duration_hours: 168,
        p_session_id: session7d,
        p_payment_intent_id: null,
        p_metadata: { test: true }
      })
    ]);
    assert.equal(firstResult.applied, true);
    assert.equal(secondResult.applied, true);

    const { data: grants, error: grantsError } = await admin
      .from("premium_access_grants")
      .select("starts_at,ends_at,stripe_checkout_session_id")
      .eq("user_id", userId)
      .order("starts_at", { ascending: true });
    if (grantsError) throw grantsError;
    assert.equal(grants.length, 2, "both purchases created exactly one grant");
    assert.equal(
      new Date(grants[0].ends_at).getTime(),
      new Date(grants[1].starts_at).getTime(),
      "concurrent purchases extend without overlap"
    );
    assert.equal(
      new Date(grants[1].ends_at).getTime() - new Date(grants[0].starts_at).getTime(),
      192 * 60 * 60 * 1000,
      "all purchased hours are preserved"
    );

    const retry = await applyGrant(admin, {
      p_user_id: userId,
      p_plan_code: "premium_24h",
      p_duration_hours: 24,
      p_session_id: session24h,
      p_payment_intent_id: null,
      p_metadata: { test: true }
    });
    assert.equal(retry.applied, false);
    assert.equal(retry.alreadyApplied, true);

    const rewardReference = `referral-${suffix}`;
    const [thirdPurchase, reward] = await Promise.all([
      applyGrant(admin, {
        p_user_id: userId,
        p_plan_code: "premium_24h",
        p_duration_hours: 24,
        p_session_id: `cs_e2e_concurrent_${suffix}`,
        p_payment_intent_id: null,
        p_metadata: { test: true }
      }),
      applyRewardGrant(admin, {
        p_user_id: userId,
        p_source: "referral",
        p_plan_code: "premium_24h",
        p_duration_hours: 24,
        p_reference_id: rewardReference,
        p_metadata: { test: true }
      })
    ]);
    assert.equal(thirdPurchase.applied, true);
    assert.equal(reward.applied, true);

    const rewardRetry = await applyRewardGrant(admin, {
      p_user_id: userId,
      p_source: "referral",
      p_plan_code: "premium_24h",
      p_duration_hours: 24,
      p_reference_id: rewardReference,
      p_metadata: { test: true }
    });
    assert.equal(rewardRetry.applied, false);
    assert.equal(rewardRetry.alreadyApplied, true);

    const { data: combinedGrants, error: combinedError } = await admin
      .from("premium_access_grants")
      .select("starts_at,ends_at")
      .eq("user_id", userId)
      .order("starts_at", { ascending: true });
    if (combinedError) throw combinedError;
    assert.equal(combinedGrants.length, 4, "purchases and rewards create one grant each");
    for (let index = 1; index < combinedGrants.length; index += 1) {
      assert.equal(
        new Date(combinedGrants[index - 1].ends_at).getTime(),
        new Date(combinedGrants[index].starts_at).getTime(),
        "paid and earned access remains contiguous"
      );
    }
    assert.equal(
      new Date(combinedGrants.at(-1).ends_at).getTime() -
        new Date(combinedGrants[0].starts_at).getTime(),
      240 * 60 * 60 * 1000,
      "paid and earned hours are all preserved"
    );

    await assert.rejects(
      applyGrant(admin, {
        p_user_id: userId,
        p_plan_code: "premium_30d",
        p_duration_hours: 1,
        p_session_id: `cs_e2e_invalid_${suffix}`,
        p_payment_intent_id: null,
        p_metadata: { test: true }
      }),
      (error) => String(error?.message || "").includes("INVALID_STRIPE_PREMIUM_PLAN")
    );

    console.log("billing:premium:e2e ok");
  } finally {
    if (userId) {
      await admin.auth.admin.deleteUser(userId).catch(() => {});
    }
  }
}

await main();
