import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingPlan } from "@/lib/stripe/plans";
import { markReferralReadyAfterWelcomeActivation } from "@/lib/referrals";

export const WELCOME_PREMIUM_BENEFIT_TYPE = "premium_24h_claim";
export const WELCOME_UPLOAD_REASON = "welcome_upload_1";
export const WELCOME_PREMIUM_PRODUCT_CODE = "premium_24h";

function isUniqueViolation(error) {
  return error?.code === "23505";
}

function isMissingWelcomeBenefitsTable(error) {
  return error?.code === "42P01";
}

export async function getWelcomePremiumClaim(userId) {
  if (!userId) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_welcome_benefits")
    .select("id, benefit_type, status, activated_at, metadata, created_at")
    .eq("user_id", userId)
    .eq("benefit_type", WELCOME_PREMIUM_BENEFIT_TYPE)
    .maybeSingle();

  if (error) {
    if (isMissingWelcomeBenefitsTable(error)) {
      return null;
    }
    throw error;
  }

  return data || null;
}

export async function ensureWelcomePackGranted({ userId }) {
  if (!userId) {
    return {
      grantedCredit: false,
      grantedPremiumClaim: false
    };
  }

  const admin = createAdminClient();
  let grantedCredit = false;
  let grantedPremiumClaim = false;

  const { data: existingCredit, error: existingCreditError } = await admin
    .from("ai_credit_ledger")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "welcome")
    .eq("reason", WELCOME_UPLOAD_REASON)
    .maybeSingle();

  if (existingCreditError) {
    throw existingCreditError;
  }

  if (!existingCredit?.id) {
    const { error: insertCreditError } = await admin.from("ai_credit_ledger").insert({
      user_id: userId,
      source: "welcome",
      reason: WELCOME_UPLOAD_REASON,
      delta: 1,
      metadata: {
        welcome_pack: true,
        benefit: "welcome_upload_1"
      }
    });

    if (insertCreditError && !isUniqueViolation(insertCreditError)) {
      throw insertCreditError;
    }

    grantedCredit = !insertCreditError;
  }

  const { data: existingClaim, error: existingClaimError } = await admin
    .from("user_welcome_benefits")
    .select("id")
    .eq("user_id", userId)
    .eq("benefit_type", WELCOME_PREMIUM_BENEFIT_TYPE)
    .maybeSingle();

  if (existingClaimError) {
    throw existingClaimError;
  }

  if (!existingClaim?.id) {
    const { error: insertClaimError } = await admin.from("user_welcome_benefits").insert({
      user_id: userId,
      benefit_type: WELCOME_PREMIUM_BENEFIT_TYPE,
      status: "available",
      metadata: {
        welcome_pack: true,
        product_code: WELCOME_PREMIUM_PRODUCT_CODE
      }
    });

    if (insertClaimError && !isUniqueViolation(insertClaimError)) {
      throw insertClaimError;
    }

    grantedPremiumClaim = !insertClaimError;
  }

  return {
    grantedCredit,
    grantedPremiumClaim
  };
}

export async function activateWelcomePremiumClaim({ userId }) {
  if (!userId) {
    throw new Error("Utilizator lipsa pentru activarea beneficiului.");
  }

  const admin = createAdminClient();
  const claim = await getWelcomePremiumClaim(userId);

  if (!claim) {
    return {
      activated: false,
      alreadyActivated: false,
      missing: true
    };
  }

  if (claim.status === "activated") {
    await markReferralReadyAfterWelcomeActivation({
      referredUserId: userId,
      welcomeBenefitId: claim.id
    });

    return {
      activated: false,
      alreadyActivated: true,
      missing: false
    };
  }

  const activationTimestamp = new Date().toISOString();
  const plan = getBillingPlan(WELCOME_PREMIUM_PRODUCT_CODE);
  if (!plan) {
    throw new Error("Planul premium de 24h nu este configurat.");
  }
  const { error: grantError } = await admin.rpc("apply_reward_premium_grant", {
    p_user_id: userId,
    p_source: "welcome",
    p_plan_code: plan.code,
    p_duration_hours: plan.durationHours,
    p_reference_id: claim.id,
    p_metadata: {
      welcome_pack: true,
      welcome_benefit_type: WELCOME_PREMIUM_BENEFIT_TYPE
    }
  });
  if (grantError) {
    throw grantError;
  }

  const { error: updateClaimError } = await admin
    .from("user_welcome_benefits")
    .update({
      status: "activated",
      activated_at: activationTimestamp,
      metadata: {
        ...(claim.metadata || {}),
        welcome_pack: true,
        activated_product_code: WELCOME_PREMIUM_PRODUCT_CODE
      }
    })
    .eq("id", claim.id)
    .eq("user_id", userId);

  if (updateClaimError) {
    throw updateClaimError;
  }

  await markReferralReadyAfterWelcomeActivation({
    referredUserId: userId,
    welcomeBenefitId: claim.id
  });

  return {
    activated: true,
    alreadyActivated: false,
    missing: false
  };
}
