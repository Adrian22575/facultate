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

const { createClient } = await import("@supabase/supabase-js");
const { getSupabaseServerEnv } = await import("@/lib/env/server.js");
const { createAdminClient } = await import("@/lib/supabase/admin.js");
const { getGamificationSummary } = await import("@/lib/gamification.js");

function getBucharestDateKey(date = new Date()) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const parts = Object.fromEntries(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== "literal")
      .map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function dateKeyWithOffset(days) {
  return getBucharestDateKey(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

function bucharestNoonIso(dateKey) {
  return `${dateKey}T12:00:00+02:00`;
}

async function createTemporaryUser(admin, suffix, label) {
  const email = `gamification-${label}-${suffix}@example.test`;
  const password = `Gamification-${label}-${suffix}!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });
  if (error) throw error;
  assert.ok(data?.user?.id, `${label} temporary auth user created`);
  return { id: data.user.id, email, password };
}

async function award(admin, params) {
  const { data, error } = await admin.rpc("award_gamification_points", {
    p_user_id: params.userId,
    p_action_type: params.actionType,
    p_points: params.points,
    p_reference_type: params.referenceType || "e2e",
    p_reference_id: params.referenceId || params.idempotencyKey,
    p_idempotency_key: params.idempotencyKey,
    p_metadata: params.metadata || {},
    p_occurred_at: params.occurredAt || new Date().toISOString()
  });
  if (error) throw error;
  return data;
}

async function countRows(admin, table, filters) {
  let query = admin.from(table).select("id", { count: "exact", head: true });
  for (const [column, value] of Object.entries(filters)) {
    query = query.eq(column, value);
  }
  const { count, error } = await query;
  if (error) throw error;
  return count || 0;
}

async function main() {
  const env = getSupabaseServerEnv();
  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const createdUsers = [];

  try {
    const blankUser = await createTemporaryUser(admin, suffix, "blank");
    const duplicateUser = await createTemporaryUser(admin, suffix, "duplicate");
    const streakUser = await createTemporaryUser(admin, suffix, "streak");
    const lostStreakUser = await createTemporaryUser(admin, suffix, "lost");
    createdUsers.push(blankUser, duplicateUser, streakUser, lostStreakUser);

    const blankSummary = await getGamificationSummary(blankUser.id);
    assert.equal(blankSummary.totalPoints, 0, "new users start with zero points");
    assert.equal(blankSummary.currentStreak, 0, "new users start without streak");
    assert.equal(
      await countRows(admin, "gamification_point_transactions", { user_id: blankUser.id }),
      0,
      "creating or signing up a user does not create point transactions"
    );

    const perfectKey = `gamification-perfect-${suffix}`;
    const firstAward = await award(admin, {
      userId: duplicateUser.id,
      actionType: "subject_test_completed",
      points: 85,
      referenceType: "subject_test",
      referenceId: "gamification-e2e",
      idempotencyKey: perfectKey,
      metadata: {
        scorePercent: 100,
        correctCount: 10,
        questionCount: 10
      }
    });

    assert.equal(firstAward.created, true, "first award is created");
    assert.equal(firstAward.pointsAwarded, 85, "base points are returned");
    assert.equal(firstAward.currentStreak, 1, "first learning action starts the streak");
    assert.equal(firstAward.bestStreak, 1, "best streak starts at one");

    const unlocked = new Set(firstAward.unlockedAchievements.map((achievement) => achievement.key));
    assert.ok(unlocked.has("first_test"), "first test achievement unlocks");
    assert.ok(unlocked.has("first_80"), "80 percent achievement unlocks");
    assert.ok(unlocked.has("first_100"), "perfect score achievement unlocks");
    assert.equal(firstAward.totalPoints, 235, "achievement bonuses are added to total points");

    const duplicateAward = await award(admin, {
      userId: duplicateUser.id,
      actionType: "subject_test_completed",
      points: 85,
      referenceType: "subject_test",
      referenceId: "gamification-e2e",
      idempotencyKey: perfectKey,
      metadata: {
        scorePercent: 100,
        correctCount: 10,
        questionCount: 10
      }
    });
    assert.equal(duplicateAward.created, false, "duplicate idempotency key is ignored");
    assert.equal(duplicateAward.pointsAwarded, 0, "duplicate award grants zero points");
    assert.equal(duplicateAward.totalPoints, firstAward.totalPoints, "duplicate does not change total points");
    assert.equal(
      await countRows(admin, "gamification_point_transactions", {
        user_id: duplicateUser.id,
        idempotency_key: perfectKey
      }),
      1,
      "only one base transaction exists for a repeated request"
    );

    const duplicateSummary = await getGamificationSummary(duplicateUser.id);
    assert.equal(duplicateSummary.level.current.key, "explorator", "points move the user to the next level");
    assert.ok(duplicateSummary.level.progressPercent > 0, "level progress is computed");
    assert.equal(duplicateSummary.todayCompleted, true, "today activity is marked completed after a learning action");

    const yesterdayKey = dateKeyWithOffset(-1);
    const todayKey = dateKeyWithOffset(0);
    await award(admin, {
      userId: streakUser.id,
      actionType: "learning_quiz_completed",
      points: 25,
      idempotencyKey: `streak-yesterday-${suffix}`,
      occurredAt: bucharestNoonIso(yesterdayKey),
      metadata: { scorePercent: 60, correctCount: 3, questionCount: 5 }
    });
    const consecutive = await award(admin, {
      userId: streakUser.id,
      actionType: "learning_quiz_completed",
      points: 25,
      idempotencyKey: `streak-today-${suffix}`,
      occurredAt: bucharestNoonIso(todayKey),
      metadata: { scorePercent: 80, correctCount: 4, questionCount: 5 }
    });
    assert.equal(consecutive.currentStreak, 2, "consecutive Bucharest days increase streak");
    assert.equal(consecutive.bestStreak, 2, "best streak follows consecutive days");
    assert.equal(consecutive.activityDate, todayKey, "activity date uses Europe/Bucharest day");

    const threeDaysAgo = dateKeyWithOffset(-3);
    const twoDaysAgo = dateKeyWithOffset(-2);
    await award(admin, {
      userId: lostStreakUser.id,
      actionType: "subject_test_completed",
      points: 25,
      idempotencyKey: `lost-three-days-${suffix}`,
      occurredAt: bucharestNoonIso(threeDaysAgo),
      metadata: { scorePercent: 60, correctCount: 3, questionCount: 5 }
    });
    await award(admin, {
      userId: lostStreakUser.id,
      actionType: "subject_test_completed",
      points: 25,
      idempotencyKey: `lost-two-days-${suffix}`,
      occurredAt: bucharestNoonIso(twoDaysAgo),
      metadata: { scorePercent: 60, correctCount: 3, questionCount: 5 }
    });
    const restarted = await award(admin, {
      userId: lostStreakUser.id,
      actionType: "subject_test_completed",
      points: 25,
      idempotencyKey: `lost-today-${suffix}`,
      occurredAt: bucharestNoonIso(todayKey),
      metadata: { scorePercent: 60, correctCount: 3, questionCount: 5 }
    });
    assert.equal(restarted.currentStreak, 1, "missing a day restarts the current streak");
    assert.equal(restarted.bestStreak, 2, "lost streak does not remove the best streak");

    const userClient = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
    const { error: signInError } = await userClient.auth.signInWithPassword({
      email: duplicateUser.email,
      password: duplicateUser.password
    });
    if (signInError) throw signInError;

    const { data: visibleProfiles, error: visibleProfilesError } = await userClient
      .from("gamification_profiles")
      .select("user_id,total_points")
      .in("user_id", [duplicateUser.id, streakUser.id]);
    if (visibleProfilesError) throw visibleProfilesError;
    assert.deepEqual(
      visibleProfiles.map((profile) => profile.user_id),
      [duplicateUser.id],
      "RLS exposes only the signed-in user's gamification profile"
    );

    const { error: clientRpcError } = await userClient.rpc("award_gamification_points", {
      p_user_id: duplicateUser.id,
      p_action_type: "subject_test_completed",
      p_points: 10,
      p_reference_type: "client",
      p_reference_id: "client",
      p_idempotency_key: `client-forbidden-${suffix}`,
      p_metadata: {},
      p_occurred_at: new Date().toISOString()
    });
    assert.ok(clientRpcError, "authenticated clients cannot award their own points directly");

    console.log("gamification:e2e ok");
  } finally {
    for (const user of createdUsers.reverse()) {
      const { error } = await admin.auth.admin.deleteUser(user.id);
      if (error) console.error("gamification_e2e_cleanup_failed", user.id, error.message);
    }
  }
}

main().catch((error) => {
  console.error("gamification:e2e failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
