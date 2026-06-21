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
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

Object.assign(process.env, loadEnvFile(".env.local"), process.env);

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`missing_env_${name}`);
  return value;
}

function adminClient() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}

async function createFixture({ uploads = 1 } = {}) {
  const admin = adminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `learning-ui-${suffix}@example.test`;
  const password = `Learning-ui-${suffix}!`;
  const ids = {};

  const { data: userData, error: userError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      full_name: "Learning UI E2E"
    }
  });
  if (userError) throw userError;
  ids.userId = userData.user.id;

  const { data: institution, error: institutionError } = await admin
    .from("institutions")
    .insert({
      institution_type: "university",
      name: `Universitate UI ${suffix}`,
      city: "Bucuresti",
      county: "Bucuresti",
      source: "admin",
      created_by: ids.userId
    })
    .select("id")
    .single();
  if (institutionError) throw institutionError;
  ids.institutionId = institution.id;

  const { data: programUnit, error: programUnitError } = await admin
    .from("academic_units")
    .insert({
      institution_id: ids.institutionId,
      unit_type: "program",
      name: `Program UI ${suffix}`,
      source: "admin",
      created_by: ids.userId
    })
    .select("id")
    .single();
  if (programUnitError) throw programUnitError;
  ids.programUnitId = programUnit.id;

  const { data: cohort, error: cohortError } = await admin
    .from("cohorts")
    .insert({
      institution_id: ids.institutionId,
      program_unit_id: ids.programUnitId,
      cohort_type: "student_group",
      label: `Grupa UI ${suffix}`,
      study_year_label: "Anul 3",
      group_label: "UI",
      source: "admin",
      created_by: ids.userId
    })
    .select("id")
    .single();
  if (cohortError) throw cohortError;
  ids.cohortId = cohort.id;

  const { data: membership, error: membershipError } = await admin
    .from("memberships")
    .insert({
      user_id: ids.userId,
      institution_id: ids.institutionId,
      program_unit_id: ids.programUnitId,
      cohort_id: ids.cohortId,
      membership_role: "member",
      status: "active",
      is_primary: true
    })
    .select("id")
    .single();
  if (membershipError) throw membershipError;
  ids.membershipId = membership.id;

  const { error: profileError } = await admin.from("profiles").upsert(
    {
      id: ids.userId,
      email,
      full_name: "Learning UI E2E",
      user_type: "student",
      primary_membership_id: ids.membershipId,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString()
    },
    { onConflict: "id" }
  );
  if (profileError) throw profileError;

  const { data: credit, error: creditError } = await admin
    .from("ai_credit_ledger")
    .insert({
      user_id: ids.userId,
      source: "manual",
      reason: "manual_adjustment",
      delta: uploads,
      metadata: {
        source: "learning_ui_e2e",
        note: "temporary upload for UI verification"
      }
    })
    .select("id")
    .single();
  if (creditError) throw creditError;
  ids.creditId = credit.id;

  return { email, password, ids };
}

async function cleanupFixture(rawJsonOrUserId, rawInstitutionId = "") {
  const admin = adminClient();
  const ids = rawJsonOrUserId?.trim?.().startsWith("{")
    ? JSON.parse(rawJsonOrUserId).ids || {}
    : {
        userId: rawJsonOrUserId || null,
        institutionId: rawInstitutionId || null
      };

  if (ids.institutionId) {
    const { error } = await admin.from("institutions").delete().eq("id", ids.institutionId);
    if (error) throw error;
  }

  if (ids.userId) {
    const { error } = await admin.auth.admin.deleteUser(ids.userId);
    if (error) throw error;
  }

  return { ok: true, cleanedUserId: ids.userId || null };
}

async function main() {
  const command = process.argv[2] || "create";

  if (command === "create") {
    const uploads = Number.parseInt(process.argv[3] || "1", 10);
    const fixture = await createFixture({
      uploads: Number.isFinite(uploads) && uploads > 0 ? uploads : 1
    });
    console.log(JSON.stringify(fixture, null, 2));
    return;
  }

  if (command === "cleanup") {
    const rawFixture = process.argv[3];
    if (!rawFixture) throw new Error("missing_fixture_json_or_user_id");
    const result = await cleanupFixture(rawFixture, process.argv[4] || "");
    console.log(JSON.stringify(result, null, 2));
    return;
  }

  throw new Error(`unknown_command_${command}`);
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error?.stack || error?.message || error);
});
