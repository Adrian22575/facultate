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

async function saveMembership(admin, params) {
  const { data, error } = await admin.rpc("save_primary_academic_membership", params);
  if (error) throw error;
  return data;
}

async function getPrimaryMemberships(admin, userId) {
  const { data, error } = await admin
    .from("memberships")
    .select("id,institution_id,program_unit_id,cohort_id,is_primary,status")
    .eq("user_id", userId)
    .eq("is_primary", true)
    .eq("status", "active");
  if (error) throw error;
  return data || [];
}

async function main() {
  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const email = `onboarding-membership-e2e-${suffix}@example.test`;
  let userId = null;
  const institutionIds = [];

  try {
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email,
      password: `Onboarding-membership-e2e-${suffix}!`,
      email_confirm: true
    });
    if (createError) throw createError;
    userId = created?.user?.id;
    assert.ok(userId, "temporary auth user created");

    const { data: institutions, error: institutionsError } = await admin
      .from("institutions")
      .insert([
        {
          institution_type: "university",
          name: `Universitate temporara ${suffix}`,
          city: "Bucuresti",
          source: "admin",
          created_by: userId
        },
        {
          institution_type: "school",
          name: `Liceu temporar ${suffix}`,
          city: "Bucuresti",
          source: "admin",
          created_by: userId
        }
      ])
      .select("id,institution_type");
    if (institutionsError) throw institutionsError;
    const university = institutions.find((row) => row.institution_type === "university");
    const school = institutions.find((row) => row.institution_type === "school");
    assert.ok(university?.id && school?.id, "temporary institutions created");
    institutionIds.push(university.id, school.id);

    const { data: faculty, error: facultyError } = await admin
      .from("academic_units")
      .insert({
        institution_id: university.id,
        unit_type: "faculty",
        name: `Facultate temporara ${suffix}`,
        source: "admin",
        created_by: userId
      })
      .select("id")
      .single();
    if (facultyError) throw facultyError;

    const { data: units, error: unitsError } = await admin
      .from("academic_units")
      .insert([
        {
          institution_id: university.id,
          parent_unit_id: faculty.id,
          unit_type: "program",
          name: `Program temporar ${suffix}`,
          source: "admin",
          created_by: userId
        },
        {
          institution_id: school.id,
          unit_type: "profile",
          name: `Profil temporar ${suffix}`,
          source: "admin",
          created_by: userId
        }
      ])
      .select("id,unit_type");
    if (unitsError) throw unitsError;
    const program = units.find((row) => row.unit_type === "program");
    const schoolProfile = units.find((row) => row.unit_type === "profile");
    assert.ok(program?.id && schoolProfile?.id, "temporary academic units created");

    const studentResult = await saveMembership(admin, {
      p_user_id: userId,
      p_user_type: "student",
      p_institution_id: university.id,
      p_program_unit_id: program.id
    });
    assert.ok(studentResult?.membershipId, "student membership created");

    let primaryRows = await getPrimaryMemberships(admin, userId);
    assert.equal(primaryRows.length, 1, "exactly one primary membership exists");
    assert.equal(primaryRows[0].institution_id, university.id, "university membership is primary");
    assert.equal(primaryRows[0].program_unit_id, program.id, "program belongs to primary membership");

    await assert.rejects(
      saveMembership(admin, {
        p_user_id: userId,
        p_user_type: "student",
        p_institution_id: school.id,
        p_program_unit_id: schoolProfile.id
      }),
      (error) => /INVALID_INSTITUTION/.test(String(error?.message || ""))
    );
    primaryRows = await getPrimaryMemberships(admin, userId);
    assert.equal(primaryRows.length, 1, "invalid selection leaves primary membership intact");
    assert.equal(primaryRows[0].id, studentResult.membershipId, "invalid selection changes nothing");

    const { error: profileDeleteError } = await admin.from("profiles").delete().eq("id", userId);
    if (profileDeleteError) throw profileDeleteError;
    await assert.rejects(
      saveMembership(admin, {
        p_user_id: userId,
        p_user_type: "elev",
        p_institution_id: school.id,
        p_program_unit_id: schoolProfile.id
      }),
      (error) => /PROFILE_NOT_FOUND/.test(String(error?.message || ""))
    );
    primaryRows = await getPrimaryMemberships(admin, userId);
    assert.equal(primaryRows.length, 1, "late transaction failure restores the old primary membership");
    assert.equal(primaryRows[0].id, studentResult.membershipId, "rollback preserves the old membership");

    const { error: profileRestoreError } = await admin.from("profiles").insert({
      id: userId,
      email,
      user_type: "student",
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString(),
      primary_membership_id: studentResult.membershipId
    });
    if (profileRestoreError) throw profileRestoreError;

    const concurrent = await Promise.all([
      saveMembership(admin, {
        p_user_id: userId,
        p_user_type: "elev",
        p_institution_id: school.id,
        p_program_unit_id: schoolProfile.id
      }),
      saveMembership(admin, {
        p_user_id: userId,
        p_user_type: "elev",
        p_institution_id: school.id,
        p_program_unit_id: schoolProfile.id
      })
    ]);
    assert.equal(concurrent[0].membershipId, concurrent[1].membershipId, "concurrent retries reuse membership");

    primaryRows = await getPrimaryMemberships(admin, userId);
    assert.equal(primaryRows.length, 1, "concurrent saves keep exactly one active primary membership");
    assert.equal(primaryRows[0].institution_id, school.id, "school membership becomes primary");
    assert.equal(primaryRows[0].program_unit_id, schoolProfile.id, "school profile is preserved");

    const { count: cohortCount, error: cohortCountError } = await admin
      .from("cohorts")
      .select("id", { count: "exact", head: true })
      .eq("institution_id", school.id)
      .eq("program_unit_id", schoolProfile.id)
      .eq("cohort_type", "school_class")
      .ilike("label", "Comunitate generala elevi");
    if (cohortCountError) throw cohortCountError;
    assert.equal(cohortCount, 1, "concurrent saves create one community cohort");

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("user_type,onboarding_completed,primary_membership_id")
      .eq("id", userId)
      .single();
    if (profileError) throw profileError;
    assert.equal(profile.user_type, "elev", "profile user type is updated");
    assert.equal(profile.onboarding_completed, true, "onboarding is complete");
    assert.equal(profile.primary_membership_id, primaryRows[0].id, "profile points to primary membership");

    console.log("onboarding:membership:e2e ok");
  } finally {
    if (institutionIds.length) {
      const { error } = await admin.from("institutions").delete().in("id", institutionIds);
      if (error) console.error("onboarding_membership_institutions_cleanup_failed", error.message);
    }
    if (userId) {
      const { error } = await admin.auth.admin.deleteUser(userId);
      if (error) console.error("onboarding_membership_user_cleanup_failed", error.message);
    }
  }
}

main().catch((error) => {
  console.error("onboarding:membership:e2e failed", error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
