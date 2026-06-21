import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import {
  buildTestimonialDraft,
  TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH,
  TESTIMONIAL_REWARD_OPTIONS,
  TESTIMONIAL_REWARD_QUESTIONS
} from "@/lib/testimonial-reward-copy";
import { notifyAdminTestimonialReviewSubmitted } from "@/lib/notifications/telegram";

export const TESTIMONIAL_REWARD_UPLOAD_REASON = "testimonial_reward_upload";

function isMissingSchema(error) {
  return error?.code === "42P01" || error?.code === "42703";
}

function isUniqueViolation(error) {
  return error?.code === "23505";
}

function normalizeAnswer(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 700);
}

function normalizeTestimonial(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 2500);
}

function validateRewardType(value) {
  return Object.prototype.hasOwnProperty.call(TESTIMONIAL_REWARD_OPTIONS, value) ? value : "ai_upload_1";
}

export function normalizeTestimonialRewardAnswers(rawAnswers) {
  const answers = {};
  const missing = [];

  for (const question of TESTIMONIAL_REWARD_QUESTIONS) {
    const answer = normalizeAnswer(rawAnswers?.[question.key]);
    answers[question.key] = answer;

    if (answer.length < TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH) {
      missing.push(question.key);
    }
  }

  return {
    answers,
    missing
  };
}

export async function getUserTestimonialRewardStatus(userId) {
  if (!userId) {
    return null;
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("testimonial_reward_submissions")
    .select(
      "id, status, reward_type, edited_testimonial, public_testimonial, admin_note, reward_granted_at, reward_credit_ledger_id, reward_premium_grant_id, created_at, approved_at, rejected_at"
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return null;
    }
    throw error;
  }

  return data || null;
}

export async function submitTestimonialReward({
  userId,
  userEmail,
  rewardType,
  answers
}) {
  const normalized = normalizeTestimonialRewardAnswers(answers);
  if (normalized.missing.length) {
    return { submitted: false, reason: "missing_answers" };
  }

  const generated = normalizeTestimonial(buildTestimonialDraft(normalized.answers));
  const testimonial = generated;
  if (testimonial.length < 40) {
    return { submitted: false, reason: "testimonial_too_short" };
  }

  const admin = createAdminClient();
  const { data: existingRows, error: existingError } = await admin
    .from("testimonial_reward_submissions")
    .select("id, status, reward_granted_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(20);

  if (existingError) {
    if (isMissingSchema(existingError)) {
      return { submitted: false, reason: "schema_missing" };
    }
    throw existingError;
  }

  const existing = existingRows || [];
  const existingSubmission = existing[0] || null;

  if (existingSubmission?.id) {
    return {
      submitted: false,
      reason: existingSubmission.status === "pending" ? "already_pending" : "already_submitted",
      submissionId: existingSubmission.id
    };
  }

  const { data: submission, error } = await admin
    .from("testimonial_reward_submissions")
    .insert({
      user_id: userId,
      user_email: userEmail || null,
      reward_type: validateRewardType(rewardType),
      answers: normalized.answers,
      generated_testimonial: generated,
      edited_testimonial: testimonial,
      metadata: {
        submittedFrom: "review_reward"
      }
    })
    .select(
      "id, user_id, user_email, status, reward_type, answers, generated_testimonial, edited_testimonial, created_at"
    )
    .single();

  if (error) {
    if (isMissingSchema(error)) {
      return { submitted: false, reason: "schema_missing" };
    }
    if (isUniqueViolation(error)) {
      return { submitted: false, reason: "already_pending" };
    }
    throw error;
  }

  await notifyAdminTestimonialReviewSubmitted({
    submission,
    user: {
      id: userId,
      email: userEmail || null
    }
  });

  return { submitted: true, submissionId: submission.id };
}

export async function getAdminTestimonialRewardEntries(limit = 100) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("testimonial_reward_submissions")
    .select(
      "id, user_id, user_email, status, reward_type, answers, edited_testimonial, public_testimonial, admin_note, approved_at, rejected_at, reward_granted_at, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) {
    if (isMissingSchema(error)) {
      return [];
    }
    throw error;
  }

  return data || [];
}

async function grantTestimonialReward(admin, submission) {
  if (submission.reward_granted_at) {
    return {
      creditLedgerId: submission.reward_credit_ledger_id || null,
      premiumGrantId: submission.reward_premium_grant_id || null
    };
  }

  if (submission.reward_type === "premium_24h") {
    const { data: grantResult, error } = await admin.rpc("apply_reward_premium_grant", {
      p_user_id: submission.user_id,
      p_source: "testimonial",
      p_plan_code: "premium_24h",
      p_duration_hours: 24,
      p_reference_id: submission.id,
      p_metadata: {
        reward: "premium_24h"
      }
    });

    if (error) {
      throw error;
    }

    return { premiumGrantId: grantResult?.grantId || null, creditLedgerId: null };
  }

  const { data: credit, error } = await admin
    .from("ai_credit_ledger")
    .insert({
      user_id: submission.user_id,
      source: "testimonial",
      reason: TESTIMONIAL_REWARD_UPLOAD_REASON,
      delta: 1,
      metadata: {
        testimonialRewardSubmissionId: submission.id,
        reward: "ai_upload_1"
      }
    })
    .select("id")
    .single();

  if (error && !isUniqueViolation(error)) {
    throw error;
  }

  if (credit?.id) {
    return { creditLedgerId: credit.id, premiumGrantId: null };
  }

  const { data: existingCredit, error: existingError } = await admin
    .from("ai_credit_ledger")
    .select("id")
    .eq("source", "testimonial")
    .eq("metadata->>testimonialRewardSubmissionId", submission.id)
    .maybeSingle();

  if (existingError) {
    throw existingError;
  }

  return { creditLedgerId: existingCredit?.id || null, premiumGrantId: null };
}

export async function approveTestimonialRewardSubmission({ submissionId, adminUserId, adminNote }) {
  const admin = createAdminClient();
  const { data: submission, error } = await admin
    .from("testimonial_reward_submissions")
    .select(
      "id, user_id, status, reward_type, edited_testimonial, reward_granted_at, reward_credit_ledger_id, reward_premium_grant_id, metadata"
    )
    .eq("id", submissionId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  if (!submission?.id) {
    return { ok: false, reason: "not_found" };
  }

  if (submission.status === "rejected") {
    return { ok: false, reason: "rejected" };
  }

  if (submission.status === "approved") {
    return { ok: true, alreadyApproved: true };
  }

  if (submission.status !== "pending") {
    return { ok: false, reason: "not_pending" };
  }

  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("testimonial_reward_submissions")
    .update({
      status: "approved",
      public_testimonial: submission.edited_testimonial,
      admin_note: normalizeAnswer(adminNote),
      approved_by: adminUserId,
      approved_at: now,
      metadata: {
        ...(submission.metadata || {}),
        approvedFrom: "admin_center",
        rewardActivation: "manual_user_claim"
      }
    })
    .eq("id", submission.id)
    .eq("status", "pending");

  if (updateError) {
    throw updateError;
  }

  return { ok: true };
}

export async function activateApprovedTestimonialReward({ userId, submissionId = null }) {
  if (!userId) {
    throw new Error("Utilizator lipsa pentru activarea recompensei.");
  }

  const admin = createAdminClient();
  let query = admin
    .from("testimonial_reward_submissions")
    .select(
      "id, user_id, status, reward_type, reward_granted_at, reward_credit_ledger_id, reward_premium_grant_id, metadata"
    )
    .eq("user_id", userId)
    .eq("status", "approved")
    .order("approved_at", { ascending: false })
    .limit(1);

  if (submissionId) {
    query = query.eq("id", submissionId);
  }

  const { data: submission, error } = await query.maybeSingle();

  if (error) {
    if (isMissingSchema(error)) {
      return { activated: false, missing: true };
    }
    throw error;
  }

  if (!submission?.id) {
    return { activated: false, missing: true };
  }

  if (submission.reward_granted_at) {
    return {
      activated: false,
      alreadyActivated: true,
      missing: false,
      rewardType: submission.reward_type
    };
  }

  const reward = await grantTestimonialReward(admin, submission);
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("testimonial_reward_submissions")
    .update({
      reward_granted_at: now,
      reward_credit_ledger_id: reward.creditLedgerId,
      reward_premium_grant_id: reward.premiumGrantId,
      metadata: {
        ...(submission.metadata || {}),
        rewardActivatedByUserAt: now
      }
    })
    .eq("id", submission.id)
    .eq("user_id", userId)
    .is("reward_granted_at", null);

  if (updateError) {
    throw updateError;
  }

  return {
    activated: true,
    alreadyActivated: false,
    missing: false,
    rewardType: submission.reward_type
  };
}

export async function rejectTestimonialRewardSubmission({ submissionId, adminUserId, adminNote }) {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const { data: submission, error: lookupError } = await admin
    .from("testimonial_reward_submissions")
    .select("id, metadata")
    .eq("id", submissionId)
    .eq("status", "pending")
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!submission?.id) {
    return { ok: false, reason: "not_pending" };
  }

  const { data, error } = await admin
    .from("testimonial_reward_submissions")
    .update({
      status: "rejected",
      admin_note: normalizeAnswer(adminNote) || "Respins din admin.",
      approved_by: adminUserId,
      rejected_at: now,
      metadata: {
        ...(submission.metadata || {}),
        rejectedFrom: "admin_center"
      }
    })
    .eq("id", submission.id)
    .eq("status", "pending")
    .select("id")
    .maybeSingle();

  if (error) {
    throw error;
  }

  return { ok: Boolean(data?.id), reason: data?.id ? null : "not_pending" };
}

export async function deleteTestimonialRewardSubmission({ submissionId }) {
  const admin = createAdminClient();
  const { data: submission, error: lookupError } = await admin
    .from("testimonial_reward_submissions")
    .select("id, reward_credit_ledger_id, reward_premium_grant_id")
    .eq("id", submissionId)
    .maybeSingle();

  if (lookupError) {
    throw lookupError;
  }

  if (!submission?.id) {
    return { ok: false, reason: "not_found" };
  }

  if (submission.reward_credit_ledger_id) {
    const { error: creditError } = await admin
      .from("ai_credit_ledger")
      .delete()
      .eq("id", submission.reward_credit_ledger_id)
      .eq("source", "testimonial");

    if (creditError) {
      throw creditError;
    }
  }

  if (submission.reward_premium_grant_id) {
    const { error: grantError } = await admin
      .from("premium_access_grants")
      .delete()
      .eq("id", submission.reward_premium_grant_id)
      .eq("source", "testimonial");

    if (grantError) {
      throw grantError;
    }
  }

  const { error: deleteError } = await admin
    .from("testimonial_reward_submissions")
    .delete()
    .eq("id", submission.id);

  if (deleteError) {
    throw deleteError;
  }

  return { ok: true };
}
