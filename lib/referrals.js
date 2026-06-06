import "server-only";

import crypto from "node:crypto";

import { createAdminClient } from "@/lib/supabase/admin";

export const REFERRAL_COOKIE_NAME = "nota5plus_referral_code";
export const REFERRAL_REWARD_PRODUCT_CODE = "premium_24h";
export const REFERRAL_REWARD_HOURS = 24;

function isMissingReferralSchema(error) {
  return error?.code === "42P01" || error?.code === "42703";
}

function isUniqueViolation(error) {
  return error?.code === "23505";
}

function normalizeReferralCode(code) {
  return String(code || "")
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 16);
}

function createReferralCode() {
  return crypto.randomBytes(5).toString("base64url").replace(/[^a-z0-9]/gi, "").toUpperCase().slice(0, 8);
}

export function getReferralCookieOptions() {
  return {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30
  };
}

export function getExpiredReferralCookieOptions() {
  return {
    ...getReferralCookieOptions(),
    maxAge: 0
  };
}

export async function ensureUserReferralCode(userId) {
  if (!userId) {
    return null;
  }

  const admin = createAdminClient();
  const { data: profile, error } = await admin
    .from("profiles")
    .select("id, referral_code")
    .eq("id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingReferralSchema(error)) {
      return null;
    }
    throw error;
  }

  if (profile?.referral_code) {
    return normalizeReferralCode(profile.referral_code);
  }

  for (let attempt = 0; attempt < 6; attempt += 1) {
    const referralCode = createReferralCode();
    const { error: updateError } = await admin
      .from("profiles")
      .update({ referral_code: referralCode })
      .eq("id", userId);

    if (!updateError) {
      return referralCode;
    }

    if (isMissingReferralSchema(updateError)) {
      return null;
    }

    if (!isUniqueViolation(updateError)) {
      throw updateError;
    }
  }

  throw new Error("Nu am putut genera codul de referral.");
}

export async function captureReferralForUser({ referredUserId, referralCode, source = "signup" }) {
  if (!referredUserId || !referralCode) {
    return { captured: false };
  }

  const normalizedCode = normalizeReferralCode(referralCode);
  if (!normalizedCode) {
    return { captured: false };
  }

  const admin = createAdminClient();
  const { data: referrerProfile, error: referrerError } = await admin
    .from("profiles")
    .select("id, referral_code")
    .ilike("referral_code", normalizedCode)
    .maybeSingle();

  if (referrerError) {
    if (isMissingReferralSchema(referrerError)) {
      return { captured: false };
    }
    throw referrerError;
  }

  if (!referrerProfile?.id || referrerProfile.id === referredUserId) {
    return { captured: false };
  }

  const { data: existing, error: existingError } = await admin
    .from("user_referrals")
    .select("id, status")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (existingError) {
    if (isMissingReferralSchema(existingError)) {
      return { captured: false };
    }
    throw existingError;
  }

  if (existing?.id) {
    return { captured: false, alreadyCaptured: true, referralId: existing.id };
  }

  const { data: referral, error: insertError } = await admin
    .from("user_referrals")
    .insert({
      referrer_user_id: referrerProfile.id,
      referred_user_id: referredUserId,
      referral_code: normalizedCode,
      status: "pending",
      metadata: {
        source
      }
    })
    .select("id")
    .single();

  if (insertError) {
    if (isMissingReferralSchema(insertError)) {
      return { captured: false };
    }
    if (isUniqueViolation(insertError)) {
      return { captured: false, alreadyCaptured: true };
    }
    throw insertError;
  }

  return { captured: true, referralId: referral.id };
}

async function getRewardWindowStart(admin, userId) {
  const { data, error } = await admin
    .from("premium_access_grants")
    .select("ends_at")
    .eq("user_id", userId)
    .order("ends_at", { ascending: false })
    .limit(1);

  if (error) {
    throw error;
  }

  const nowMs = Date.now();
  const latestEndMs = Date.parse(data?.[0]?.ends_at || "");
  return new Date(Number.isFinite(latestEndMs) && latestEndMs > nowMs ? latestEndMs : nowMs);
}

export async function markReferralReadyAfterWelcomeActivation({ referredUserId, welcomeBenefitId = null }) {
  if (!referredUserId) {
    return { ready: false };
  }

  const admin = createAdminClient();
  const { data: referral, error } = await admin
    .from("user_referrals")
    .select("id, referrer_user_id, referred_user_id, status, reward_grant_id, metadata")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (error) {
    if (isMissingReferralSchema(error)) {
      return { ready: false };
    }
    throw error;
  }

  if (!referral?.id || referral.status === "invalid" || referral.status === "rewarded") {
    return { ready: false };
  }

  if (referral.status === "ready") {
    return { ready: false, alreadyReady: true, referralId: referral.id };
  }

  const readyTimestamp = new Date().toISOString();
  const { error: updateError } = await admin
    .from("user_referrals")
    .update({
      status: "ready",
      activated_at: readyTimestamp,
      metadata: {
        ...(referral.metadata || {}),
        welcomeBenefitId,
        readyReason: "welcome_activated"
      }
    })
    .eq("id", referral.id)
    .eq("status", "pending");

  if (updateError) {
    throw updateError;
  }

  return { ready: true, referralId: referral.id };
}

export async function markReferralReadyAfterAccountConfirmation({ referredUserId, reason = "account_confirmed" }) {
  if (!referredUserId) {
    return { ready: false };
  }

  const admin = createAdminClient();
  const { data: referral, error } = await admin
    .from("user_referrals")
    .select("id, status, metadata")
    .eq("referred_user_id", referredUserId)
    .maybeSingle();

  if (error) {
    if (isMissingReferralSchema(error)) {
      return { ready: false };
    }
    throw error;
  }

  if (!referral?.id || referral.status === "invalid" || referral.status === "rewarded") {
    return { ready: false };
  }

  if (referral.status === "ready") {
    return { ready: false, alreadyReady: true, referralId: referral.id };
  }

  const readyTimestamp = new Date().toISOString();
  const { error: updateError } = await admin
    .from("user_referrals")
    .update({
      status: "ready",
      activated_at: readyTimestamp,
      metadata: {
        ...(referral.metadata || {}),
        readyReason: reason,
        accountConfirmedAt: readyTimestamp
      }
    })
    .eq("id", referral.id)
    .eq("status", "pending");

  if (updateError) {
    throw updateError;
  }

  return { ready: true, referralId: referral.id };
}

function isConfirmedAuthUser(user) {
  return Boolean(user?.email_confirmed_at || user?.confirmed_at || user?.last_sign_in_at);
}

async function reconcileReadyReferralsForReferrer(admin, rows) {
  const pendingRows = (rows || []).filter((row) => row.status === "pending" && row.referred_user_id);
  if (!pendingRows.length) {
    return rows || [];
  }

  const reconciledRows = [...rows];

  await Promise.all(
    pendingRows.map(async (row) => {
      const { data, error } = await admin.auth.admin.getUserById(row.referred_user_id);
      if (error || !isConfirmedAuthUser(data?.user)) {
        return;
      }

      const readyTimestamp = new Date().toISOString();
      const { error: updateError } = await admin
        .from("user_referrals")
        .update({
          status: "ready",
          activated_at: readyTimestamp,
          metadata: {
            ...(row.metadata || {}),
            readyReason: "account_confirmed_reconciled",
            accountConfirmedAt: readyTimestamp
          }
        })
        .eq("id", row.id)
        .eq("status", "pending");

      if (updateError) {
        throw updateError;
      }

      const index = reconciledRows.findIndex((candidate) => candidate.id === row.id);
      if (index >= 0) {
        reconciledRows[index] = {
          ...reconciledRows[index],
          status: "ready",
          activated_at: readyTimestamp,
          metadata: {
            ...(reconciledRows[index].metadata || {}),
            readyReason: "account_confirmed_reconciled",
            accountConfirmedAt: readyTimestamp
          }
        };
      }
    })
  );

  return reconciledRows;
}

export async function activateReadyReferralReward({ userId }) {
  if (!userId) {
    throw new Error("Utilizator lipsa pentru activarea referral-ului.");
  }

  const admin = createAdminClient();
  const { data: referral, error } = await admin
    .from("user_referrals")
    .select("id, referrer_user_id, referred_user_id, status, reward_grant_id, metadata")
    .eq("referrer_user_id", userId)
    .eq("status", "ready")
    .order("activated_at", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingReferralSchema(error)) {
      return { activated: false, missing: true };
    }
    throw error;
  }

  if (!referral?.id) {
    return { activated: false, missing: true };
  }

  const startsAt = await getRewardWindowStart(admin, userId);
  const endsAt = new Date(startsAt.getTime() + REFERRAL_REWARD_HOURS * 60 * 60 * 1000);
  const rewardTimestamp = new Date().toISOString();

  const { data: grant, error: grantError } = await admin
    .from("premium_access_grants")
    .insert({
      user_id: userId,
      source: "referral",
      product_code: REFERRAL_REWARD_PRODUCT_CODE,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      metadata: {
        referralId: referral.id,
        referredUserId: referral.referred_user_id,
        welcomeBenefitId: referral.metadata?.welcomeBenefitId || null,
        reward: "premium_24h"
      }
    })
    .select("id")
    .single();

  if (grantError && !isUniqueViolation(grantError)) {
    if (isMissingReferralSchema(grantError)) {
      return { activated: false, missing: true };
    }
    throw grantError;
  }

  let rewardGrantId = grant?.id || referral.reward_grant_id || null;

  if (!rewardGrantId && grantError && isUniqueViolation(grantError)) {
    const { data: existingGrant, error: existingGrantError } = await admin
      .from("premium_access_grants")
      .select("id")
      .eq("source", "referral")
      .eq("metadata->>referralId", referral.id)
      .maybeSingle();

    if (existingGrantError) {
      throw existingGrantError;
    }

    rewardGrantId = existingGrant?.id || null;
  }

  const { error: updateError } = await admin
    .from("user_referrals")
    .update({
      status: "rewarded",
      rewarded_at: rewardTimestamp,
      reward_grant_id: rewardGrantId,
      metadata: {
        ...(referral.metadata || {}),
        manuallyActivatedAt: rewardTimestamp,
        rewardedProductCode: REFERRAL_REWARD_PRODUCT_CODE
      }
    })
    .eq("id", referral.id)
    .eq("referrer_user_id", userId);

  if (updateError) {
    throw updateError;
  }

  return { activated: true, referralId: referral.id, rewardGrantId };
}

export async function getReferralDashboard(userId) {
  const referralCode = await ensureUserReferralCode(userId);

  if (!referralCode) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("user_referrals")
    .select("id, referred_user_id, status, activated_at, rewarded_at, metadata, created_at")
    .eq("referrer_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);

  if (error) {
    if (isMissingReferralSchema(error)) {
      return null;
    }
    throw error;
  }

  const rows = await reconcileReadyReferralsForReferrer(admin, data || []);
  const referredUserIds = Array.from(new Set(rows.map((row) => row.referred_user_id).filter(Boolean)));
  let profileMap = new Map();

  if (referredUserIds.length) {
    const { data: profiles, error: profilesError } = await admin
      .from("profiles")
      .select("id, email, full_name, created_at, onboarding_completed")
      .in("id", referredUserIds);

    if (profilesError) {
      if (!isMissingReferralSchema(profilesError)) {
        throw profilesError;
      }
    } else {
      profileMap = new Map((profiles || []).map((profile) => [profile.id, profile]));
    }
  }

  const pendingCount = rows.filter((row) => row.status === "pending").length;
  const readyCount = rows.filter((row) => row.status === "ready").length;
  const rewardedCount = rows.filter((row) => row.status === "rewarded").length;
  const referrals = rows.map((row) => {
    const profile = profileMap.get(row.referred_user_id) || {};

    return {
      id: row.id,
      referredUserId: row.referred_user_id,
      name: profile.full_name || null,
      email: profile.email || null,
      status: row.status,
      createdAt: row.created_at || null,
      accountCreatedAt: profile.created_at || row.created_at || null,
      confirmedAt: row.activated_at || null,
      rewardedAt: row.rewarded_at || null,
      onboardingCompleted: Boolean(profile.onboarding_completed)
    };
  });

  return {
    referralCode,
    referralPath: `/r/${referralCode}`,
    pendingCount,
    readyCount,
    rewardedCount,
    totalCount: rows.length,
    latestRewardedAt: rows.find((row) => row.status === "rewarded")?.rewarded_at || null,
    referrals
  };
}

export async function getReferralInvitationForUser(userId) {
  if (!userId) {
    return null;
  }

  const admin = createAdminClient();
  const { data: referral, error } = await admin
    .from("user_referrals")
    .select("id, referrer_user_id, status, activated_at, rewarded_at, created_at, metadata")
    .eq("referred_user_id", userId)
    .maybeSingle();

  if (error) {
    if (isMissingReferralSchema(error)) {
      return null;
    }
    throw error;
  }

  if (!referral?.id) {
    return null;
  }

  let currentReferral = referral;
  if (currentReferral.status === "pending") {
    const readyResult = await markReferralReadyAfterAccountConfirmation({
      referredUserId: userId,
      reason: "account_page_view"
    });

    if (readyResult.ready || readyResult.alreadyReady) {
      const { data: updatedReferral, error: updatedError } = await admin
        .from("user_referrals")
        .select("id, referrer_user_id, status, activated_at, rewarded_at, created_at, metadata")
        .eq("id", referral.id)
        .maybeSingle();

      if (updatedError) {
        throw updatedError;
      }

      currentReferral = updatedReferral || referral;
    }
  }

  const { data: referrerProfile, error: profileError } = await admin
    .from("profiles")
    .select("id, email, full_name")
    .eq("id", currentReferral.referrer_user_id)
    .maybeSingle();

  if (profileError && !isMissingReferralSchema(profileError)) {
    throw profileError;
  }

  return {
    id: currentReferral.id,
    status: currentReferral.status,
    createdAt: currentReferral.created_at || null,
    confirmedAt: currentReferral.activated_at || null,
    rewardedAt: currentReferral.rewarded_at || null,
    referrer: {
      id: currentReferral.referrer_user_id,
      name: referrerProfile?.full_name || null,
      email: referrerProfile?.email || null
    }
  };
}
