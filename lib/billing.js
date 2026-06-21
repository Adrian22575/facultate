import "server-only";

import { notifyAdminPaymentSucceeded } from "@/lib/notifications/telegram";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { getBillingPlan } from "@/lib/stripe/plans";
import { getWelcomePremiumClaim } from "@/lib/welcome-pack";

export function getSectionForPlanFamily(family) {
  return family === "ai_credits" ? "credits" : "plans";
}

async function notifyAppliedCheckoutSession(session, fulfillment) {
  if (fulfillment?.applied) {
    await notifyAdminPaymentSucceeded({ session, fulfillment });
  }

  return fulfillment;
}

export async function getBillingSnapshot(userId) {
  const supabase = createAdminClient();

  const [
    { data: premiumRows, error: premiumError },
    { data: credits, error: creditsError },
    welcomePremiumClaim
  ] =
    await Promise.all([
      supabase
        .from("premium_access_grants")
        .select("ends_at, product_code")
        .eq("user_id", userId)
        .gt("ends_at", new Date().toISOString())
        .order("ends_at", { ascending: false })
        .limit(1),
      supabase.rpc("get_ai_credit_balance", { target_user_id: userId }),
      getWelcomePremiumClaim(userId)
    ]);

  if (premiumError) {
    throw premiumError;
  }

  if (creditsError) {
    throw creditsError;
  }

  const activeGrant = premiumRows?.[0] ?? null;

  return {
    activePremium: Boolean(activeGrant),
    premiumEndsAt: activeGrant?.ends_at ?? null,
    premiumProductCode: activeGrant?.product_code ?? null,
    aiCredits: credits ?? 0,
    hasWelcomePremiumClaim: Boolean(welcomePremiumClaim),
    welcomePremiumStatus: welcomePremiumClaim?.status ?? null,
    welcomePremiumActivatedAt: welcomePremiumClaim?.activated_at ?? null
  };
}

export async function consumeAIUploadCredit({
  userId,
  cost = 1,
  idempotencyKey,
  metadata = {},
  insufficientMessage = "Nu ai incarcari disponibile pentru aceasta actiune."
}) {
  if (!userId || !idempotencyKey || !Number.isInteger(cost) || cost < 1) {
    throw new Error("Datele pentru consumul incarcarii nu sunt complete.");
  }

  const { data, error } = await createAdminClient().rpc("consume_ai_credit", {
    p_user_id: userId,
    p_cost: cost,
    p_idempotency_key: idempotencyKey,
    p_metadata: metadata
  });

  if (error) {
    if (String(error.message || "").includes("INSUFFICIENT_AI_CREDITS")) {
      throw new Error(insufficientMessage);
    }
    throw error;
  }

  return {
    consumed: Boolean(data?.consumed),
    ledgerId: data?.ledgerId || null,
    balance: Number(data?.balance || 0)
  };
}

export async function consumeCreditForLearningStudySet({ userId, studySetId, sourceKind = null }) {
  if (!userId || !studySetId) {
    throw new Error("Datele pentru consumul incarcarii nu sunt complete.");
  }

  return consumeAIUploadCredit({
    userId,
    idempotencyKey: `learning:${studySetId}`,
    metadata: {
      learningStudySetId: studySetId,
      sourceKind,
      mode: "learning_study_set"
    },
    insufficientMessage: "Nu ai incarcari disponibile pentru procesarea materialului."
  });
}

export async function ensureStripeCustomer({ userId, email, fullName }) {
  const supabase = createAdminClient();
  const { data: existing, error: selectError } = await supabase
    .from("stripe_customers")
    .select("stripe_customer_id")
    .eq("user_id", userId)
    .maybeSingle();

  if (selectError) throw selectError;
  if (existing?.stripe_customer_id) {
    return existing.stripe_customer_id;
  }

  const customer = await getStripe().customers.create({
    email: email || undefined,
    name: fullName || undefined,
    metadata: {
      user_id: userId
    }
  });

  const { error: upsertError } = await supabase.from("stripe_customers").upsert(
    {
      user_id: userId,
      stripe_customer_id: customer.id,
      email: email || null
    },
    {
      onConflict: "user_id"
    }
  );

  if (upsertError) throw upsertError;

  return customer.id;
}

export async function beginStripeEventProcessing(eventId, eventType) {
  const supabase = createAdminClient();
  const { data, error } = await supabase.rpc("claim_stripe_webhook_event", {
    p_event_id: eventId,
    p_event_type: eventType,
    p_stale_after_seconds: 300
  });

  if (error) throw error;

  return data === true;
}

export async function completeStripeEventProcessing(eventId) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      status: "completed",
      processed_at: new Date().toISOString(),
      last_error: null
    })
    .eq("stripe_event_id", eventId);

  if (error) throw error;
}

export async function failStripeEventProcessing(eventId, errorMessage) {
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("stripe_webhook_events")
    .update({
      status: "failed",
      last_error: errorMessage?.slice(0, 1000) || "unknown_error",
      processed_at: new Date().toISOString()
    })
    .eq("stripe_event_id", eventId);

  if (error) throw error;
}

export async function applyCheckoutSession(session) {
  const userId = session.metadata?.user_id;
  const planCode = session.metadata?.plan_code;
  const plan = getBillingPlan(planCode);

  if (!userId || !plan) {
    throw new Error("Checkout session fără user_id sau plan_code valid.");
  }

  const supabase = createAdminClient();
  if (session.payment_status !== "paid") {
    throw new Error("CHECKOUT_SESSION_NOT_PAID");
  }
  if (session.client_reference_id !== userId) {
    throw new Error("CHECKOUT_SESSION_USER_MISMATCH");
  }
  if (
    session.amount_total !== plan.amount ||
    String(session.currency || "").toLowerCase() !== plan.currency
  ) {
    throw new Error("CHECKOUT_SESSION_AMOUNT_MISMATCH");
  }

  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  if (plan.family === "premium") {
    const { data: grantResult, error } = await supabase.rpc("apply_stripe_premium_grant", {
      p_user_id: userId,
      p_plan_code: plan.code,
      p_duration_hours: plan.durationHours,
      p_session_id: session.id,
      p_payment_intent_id: paymentIntentId,
      p_metadata: {
        stripe_customer_id: session.customer,
        amount_total: session.amount_total,
        currency: session.currency
      }
    });

    if (error) {
      throw error;
    }

    return notifyAppliedCheckoutSession(session, {
      applied: Boolean(grantResult?.applied),
      alreadyApplied: Boolean(grantResult?.alreadyApplied),
      family: plan.family,
      planCode: plan.code,
      userId,
      section: getSectionForPlanFamily(plan.family)
    });
  }

  if (plan.family === "ai_credits") {
    const { data: existingCreditRow, error: existingCreditError } = await supabase
      .from("ai_credit_ledger")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .eq("reason", plan.code)
      .maybeSingle();

    if (existingCreditError) {
      throw existingCreditError;
    }

    if (existingCreditRow) {
      return {
        applied: false,
        alreadyApplied: true,
        family: plan.family,
        planCode: plan.code,
        userId,
        section: getSectionForPlanFamily(plan.family)
      };
    }

    const { error } = await supabase.from("ai_credit_ledger").insert({
      user_id: userId,
      source: "stripe",
      reason: plan.code,
      delta: plan.aiCredits,
      stripe_checkout_session_id: session.id,
      metadata: {
        stripe_customer_id: session.customer,
        amount_total: session.amount_total
      }
    });

    if (error) {
      if (error.code === "23505") {
        return {
          applied: false,
          alreadyApplied: true,
          family: plan.family,
          planCode: plan.code,
          userId,
          section: getSectionForPlanFamily(plan.family)
        };
      }
      throw error;
    }

    return notifyAppliedCheckoutSession(session, {
      applied: true,
      alreadyApplied: false,
      family: plan.family,
      planCode: plan.code,
      userId,
      section: getSectionForPlanFamily(plan.family)
    });
  }

  return {
    applied: false,
    alreadyApplied: false,
    family: plan.family,
    planCode: plan.code,
    userId,
    section: getSectionForPlanFamily(plan.family)
  };
}

export async function reconcileCheckoutSession(sessionId, options = {}) {
  const stripe = getStripe(options.stripeMode);
  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (options.expectedUserId && session.metadata?.user_id !== options.expectedUserId) {
    throw new Error("CHECKOUT_SESSION_USER_MISMATCH");
  }
  const plan = getBillingPlan(session.metadata?.plan_code);
  const section = getSectionForPlanFamily(plan?.family);

  if (!plan) {
    throw new Error("Sesiunea Stripe nu are un plan valid.");
  }

  if (session.payment_status !== "paid") {
    return {
      status: "pending_payment",
      session,
      plan,
      section,
      applied: false
    };
  }

  const fulfillment = await applyCheckoutSession(session);

  return {
    status: fulfillment.alreadyApplied ? "already_applied" : "applied",
    session,
    plan,
    section: fulfillment.section,
    applied: fulfillment.applied
  };
}
