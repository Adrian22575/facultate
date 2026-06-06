import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";

function getEmptyAcademicContext(profile = null) {
  return {
    profile,
    membership: null,
    institution: null,
    programUnit: null,
    cohort: null
  };
}

export function getInstitutionTypeForUserType(userType) {
  if (userType === "student") {
    return "university";
  }

  if (userType === "elev") {
    return "school";
  }

  return null;
}

export function isAcademicContextComplete(context) {
  return Boolean(
    context?.profile?.onboarding_completed &&
      context?.profile?.primary_membership_id &&
      context?.membership?.id &&
      context?.institution?.id &&
      context?.cohort?.id
  );
}

export function getOnboardingHref(nextPath = "") {
  const safeNext =
    typeof nextPath === "string" &&
    nextPath.startsWith("/") &&
    !nextPath.startsWith("//") &&
    !nextPath.startsWith("/onboarding")
      ? nextPath
      : "";

  return safeNext && safeNext !== "/"
    ? `/onboarding?next=${encodeURIComponent(safeNext)}`
    : "/onboarding";
}

export function getAcademicCommunityLabel(context) {
  if (!isAcademicContextComplete(context)) {
    return null;
  }

  const cohortLabel =
    context.cohort?.label &&
    !context.cohort.label.toLowerCase().startsWith("comunitate generala")
      ? context.cohort.label
      : null;

  const parts = [
    context.institution?.name,
    context.programUnit?.name,
    cohortLabel
  ].filter(Boolean);

  return parts.join(" > ");
}

export async function getAcademicContext(userId) {
  const supabase = createAdminClient();
  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select(
      "id, email, full_name, avatar_url, user_type, onboarding_completed, onboarding_completed_at, primary_membership_id"
    )
    .eq("id", userId)
    .maybeSingle();

  if (profileError) {
    if (isSupabaseSetupIncompleteError(profileError)) {
      return getEmptyAcademicContext();
    }

    throw profileError;
  }

  if (!profile) {
    return getEmptyAcademicContext();
  }

  if (!profile.primary_membership_id) {
    return getEmptyAcademicContext(profile);
  }

  const { data: membership, error: membershipError } = await supabase
    .from("memberships")
    .select(
      "id, user_id, institution_id, program_unit_id, cohort_id, membership_role, is_primary, status"
    )
    .eq("id", profile.primary_membership_id)
    .eq("user_id", userId)
    .maybeSingle();

  if (membershipError) {
    if (isSupabaseSetupIncompleteError(membershipError)) {
      return getEmptyAcademicContext(profile);
    }

    throw membershipError;
  }

  if (!membership) {
    return getEmptyAcademicContext(profile);
  }

  const fetches = await Promise.all([
    membership.institution_id
      ? supabase
          .from("institutions")
          .select("id, institution_type, name, city, county")
          .eq("id", membership.institution_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    membership.program_unit_id
      ? supabase
          .from("academic_units")
          .select("id, institution_id, parent_unit_id, unit_type, name")
          .eq("id", membership.program_unit_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    membership.cohort_id
      ? supabase
          .from("cohorts")
          .select("id, institution_id, program_unit_id, cohort_type, label, study_year_label, group_label")
          .eq("id", membership.cohort_id)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null })
  ]);

  const [institutionResult, programUnitResult, cohortResult] = fetches;

  if (institutionResult.error) {
    if (isSupabaseSetupIncompleteError(institutionResult.error)) {
      return getEmptyAcademicContext(profile);
    }

    throw institutionResult.error;
  }

  if (programUnitResult.error) {
    if (isSupabaseSetupIncompleteError(programUnitResult.error)) {
      return getEmptyAcademicContext(profile);
    }

    throw programUnitResult.error;
  }

  if (cohortResult.error) {
    if (isSupabaseSetupIncompleteError(cohortResult.error)) {
      return getEmptyAcademicContext(profile);
    }

    throw cohortResult.error;
  }

  return {
    profile,
    membership,
    institution: institutionResult.data || null,
    programUnit: programUnitResult.data || null,
    cohort: cohortResult.data || null
  };
}
