"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import {
  CreateAcademicUnitSchema,
  CreateInstitutionSchema,
  InstitutionTypeSchema,
  SaveMembershipSchema,
  UpdateUserTypeSchema
} from "@/lib/academic/schema";
import { getInstitutionTypeForUserType } from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUser } from "@/lib/supabase/guards";
import { ensureWelcomePackGranted } from "@/lib/welcome-pack";

function assertNotDemo(user) {
  if (isDemoUser(user)) {
    throw new Error("Modul demo nu permite configurarea comunitatii reale.");
  }
}

function getSafeInternalPath(path, fallback = "") {
  if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
    return path;
  }

  return fallback;
}

function getRedirectBase(formData) {
  return getSafeInternalPath(formData.get("redirectBase"), "/onboarding");
}

function getEditFlag(formData) {
  return formData.get("edit") === "1" ? "1" : "";
}

function getSourceFlag(formData) {
  return formData.get("source") === "query" ? "query" : "";
}

function getNextPath(formData) {
  return getSafeInternalPath(formData.get("next"));
}

function getSafeReturnPath(formData) {
  return getSafeInternalPath(formData.get("returnTo"), "/");
}

function getSafeErrorMessage(error, fallbackMessage) {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  return fallbackMessage;
}

function isRedirectError(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT;")
  );
}

function buildRedirectPath(basePath, params) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (typeof value === "string" && value) {
      searchParams.set(key, value);
    }
  });

  const query = searchParams.toString();
  return query ? `${basePath}?${query}` : basePath;
}

function redirectWithError(basePath, params, error) {
  redirect(
    buildRedirectPath(basePath, {
      ...params,
      error: getSafeErrorMessage(error, "Nu am putut salva acum. Incearca din nou.")
    })
  );
}

function normalizeAcademicLookupValue(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

async function ensureProfileRow(supabase, user, overrides = {}) {
  const fullName = user.user_metadata?.full_name || user.user_metadata?.name || null;
  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

  const { error } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      email: user.email || null,
      full_name: fullName,
      avatar_url: avatarUrl,
      ...overrides
    },
    {
      onConflict: "id"
    }
  );

  if (error) {
    throw error;
  }
}

async function resolvePrimaryCohortId({
  supabase,
  userId,
  userType,
  institutionId,
  programUnitId
}) {
  const cohortType = userType === "student" ? "student_group" : "school_class";
  const cohortLabel =
    userType === "student" ? "Comunitate generala studenti" : "Comunitate generala elevi";

  let query = supabase
    .from("cohorts")
    .select("id")
    .eq("institution_id", institutionId)
    .eq("cohort_type", cohortType)
    .eq("label", cohortLabel)
    .order("created_at", { ascending: true })
    .limit(1);

  if (programUnitId) {
    query = query.eq("program_unit_id", programUnitId);
  } else {
    query = query.is("program_unit_id", null);
  }

  const { data: existing, error: existingError } = await query.maybeSingle();
  if (existingError) {
    throw existingError;
  }

  if (existing?.id) {
    return existing.id;
  }

  const { data: inserted, error: insertError } = await supabase
    .from("cohorts")
    .insert({
      institution_id: institutionId,
      program_unit_id: programUnitId || null,
      cohort_type: cohortType,
      label: cohortLabel,
      source: "admin",
      created_by: userId
    })
    .select("id")
    .single();

  if (insertError) {
    throw insertError;
  }

  return inserted.id;
}

async function findExistingInstitutionId({ supabase, institutionType, name, city }) {
  const targetName = normalizeAcademicLookupValue(name);
  const targetCity = normalizeAcademicLookupValue(city);

  const { data, error } = await supabase
    .from("institutions")
    .select("id, name, city")
    .eq("institution_type", institutionType)
    .limit(1000);

  if (error) {
    throw error;
  }

  const existingInstitution = (data || []).find((institution) => {
    return (
      normalizeAcademicLookupValue(institution.name) === targetName &&
      normalizeAcademicLookupValue(institution.city) === targetCity
    );
  });

  return existingInstitution?.id || null;
}

async function findExistingAcademicUnitId({
  supabase,
  institutionId,
  unitType,
  parentUnitId,
  name
}) {
  const targetName = normalizeAcademicLookupValue(name);
  let query = supabase
    .from("academic_units")
    .select("id, name")
    .eq("institution_id", institutionId)
    .eq("unit_type", unitType)
    .limit(1000);

  if (parentUnitId) {
    query = query.eq("parent_unit_id", parentUnitId);
  } else {
    query = query.is("parent_unit_id", null);
  }

  const { data, error } = await query;
  if (error) {
    throw error;
  }

  const existingUnit = (data || []).find((unit) => {
    return normalizeAcademicLookupValue(unit.name) === targetName;
  });

  return existingUnit?.id || null;
}

export async function updateUserTypeAction(formData) {
  const user = await requireUser("/onboarding");
  assertNotDemo(user);

  const { userType } = UpdateUserTypeSchema.parse({
    userType: formData.get("userType")
  });

  const redirectBase = getRedirectBase(formData);
  const edit = getEditFlag(formData);
  const source = getSourceFlag(formData);
  const next = getNextPath(formData);
  const supabase = createAdminClient();

  await ensureProfileRow(supabase, user, {
    user_type: userType,
    onboarding_completed: false,
    onboarding_completed_at: null,
    primary_membership_id: null
  });

  redirect(
    buildRedirectPath(redirectBase, {
      edit,
      source,
      next,
      userType,
      institutionId: "",
      facultyId: "",
      programId: "",
      profileId: ""
    })
  );
}

export async function createInstitutionAction(formData) {
  const user = await requireUser("/onboarding");
  assertNotDemo(user);

  const parsed = CreateInstitutionSchema.parse({
    userType: formData.get("userType"),
    name: formData.get("name"),
    city: formData.get("city"),
    county: formData.get("county") || undefined
  });

  const institutionType = InstitutionTypeSchema.parse(
    getInstitutionTypeForUserType(parsed.userType)
  );
  const redirectBase = getRedirectBase(formData);
  const edit = getEditFlag(formData);
  const source = getSourceFlag(formData);
  const next = getNextPath(formData);
  const redirectParams = {
    edit,
    source,
    next,
    userType: parsed.userType
  };

  try {
    const supabase = createAdminClient();
    let institutionId = await findExistingInstitutionId({
      supabase,
      institutionType,
      name: parsed.name,
      city: parsed.city
    });

    if (!institutionId) {
      const { data, error } = await supabase
        .from("institutions")
        .insert({
          institution_type: institutionType,
          name: parsed.name,
          city: parsed.city,
          county: parsed.county || null,
          created_by: user.id,
          source: "user"
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      institutionId = data.id;
    }

    revalidatePath("/onboarding");
    redirect(
      buildRedirectPath(redirectBase, {
        ...redirectParams,
        institutionId
      })
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithError(redirectBase, redirectParams, error);
  }
}

export async function createAcademicUnitAction(formData) {
  const user = await requireUser("/onboarding");
  assertNotDemo(user);

  const rawParentUnitId =
    typeof formData.get("parentUnitId") === "string" ? formData.get("parentUnitId") : "";

  const parsed = CreateAcademicUnitSchema.parse({
    userType: formData.get("userType"),
    institutionId: formData.get("institutionId"),
    unitType: formData.get("unitType"),
    parentUnitId: rawParentUnitId || undefined,
    name: formData.get("name")
  });

  const redirectBase = getRedirectBase(formData);
  const edit = getEditFlag(formData);
  const source = getSourceFlag(formData);
  const next = getNextPath(formData);
  const redirectParams = {
    edit,
    source,
    next,
    userType: parsed.userType,
    institutionId: parsed.institutionId,
    facultyId: parsed.unitType === "faculty" ? "" : rawParentUnitId,
    programId: "",
    profileId: ""
  };

  try {
    const supabase = createAdminClient();
    let unitId = await findExistingAcademicUnitId({
      supabase,
      institutionId: parsed.institutionId,
      unitType: parsed.unitType,
      parentUnitId: parsed.parentUnitId || "",
      name: parsed.name
    });

    if (!unitId) {
      const { data, error } = await supabase
        .from("academic_units")
        .insert({
          institution_id: parsed.institutionId,
          parent_unit_id: parsed.parentUnitId || null,
          unit_type: parsed.unitType,
          name: parsed.name,
          created_by: user.id,
          source: "user"
        })
        .select("id")
        .single();

      if (error) {
        throw error;
      }

      unitId = data.id;
    }

    revalidatePath("/onboarding");
    redirect(
      buildRedirectPath(redirectBase, {
        ...redirectParams,
        facultyId: parsed.unitType === "faculty" ? unitId : rawParentUnitId,
        programId: parsed.unitType === "program" ? unitId : "",
        profileId: parsed.unitType === "profile" ? unitId : ""
      })
    );
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirectWithError(redirectBase, redirectParams, error);
  }
}

export async function savePrimaryMembershipAction(formData) {
  const user = await requireUser("/onboarding");
  assertNotDemo(user);

  const rawProgramUnitId =
    typeof formData.get("programUnitId") === "string" ? formData.get("programUnitId") : "";

  const parsed = SaveMembershipSchema.parse({
    userType: formData.get("userType"),
    institutionId: formData.get("institutionId"),
    programUnitId: rawProgramUnitId || undefined
  });

  const returnTo = getSafeReturnPath(formData);
  const supabase = createAdminClient();

  await ensureProfileRow(supabase, user, {
    user_type: parsed.userType
  });

  const cohortId = await resolvePrimaryCohortId({
    supabase,
    userId: user.id,
    userType: parsed.userType,
    institutionId: parsed.institutionId,
    programUnitId: parsed.programUnitId || ""
  });

  await supabase
    .from("memberships")
    .update({
      is_primary: false
    })
    .eq("user_id", user.id);

  const { data: existing } = await supabase
    .from("memberships")
    .select("id")
    .eq("user_id", user.id)
    .eq("cohort_id", cohortId)
    .maybeSingle();

  let membershipId = existing?.id || null;

  if (membershipId) {
    const { error: updateError } = await supabase
      .from("memberships")
      .update({
        institution_id: parsed.institutionId,
        program_unit_id: parsed.programUnitId || null,
        membership_role: "member",
        status: "active",
        is_primary: true
      })
      .eq("id", membershipId)
      .eq("user_id", user.id);

    if (updateError) {
      throw updateError;
    }
  } else {
    const { data: insertedMembership, error: insertError } = await supabase
      .from("memberships")
      .insert({
        user_id: user.id,
        institution_id: parsed.institutionId,
        program_unit_id: parsed.programUnitId || null,
        cohort_id: cohortId,
        membership_role: "member",
        status: "active",
        is_primary: true
      })
      .select("id")
      .single();

    if (insertError) {
      throw insertError;
    }

    membershipId = insertedMembership.id;
  }

  const { error: profileError } = await supabase
    .from("profiles")
    .update({
      user_type: parsed.userType,
      primary_membership_id: membershipId,
      onboarding_completed: true,
      onboarding_completed_at: new Date().toISOString()
    })
    .eq("id", user.id);

  if (profileError) {
    throw profileError;
  }

  await ensureWelcomePackGranted({
    userId: user.id
  });

  redirect(returnTo);
}
