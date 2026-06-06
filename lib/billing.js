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
  const { data: existing, error: existingError } = await supabase
    .from("stripe_webhook_events")
    .select("stripe_event_id, status")
    .eq("stripe_event_id", eventId)
    .maybeSingle();

  if (existingError) throw existingError;

  if (existing?.status === "completed" || existing?.status === "processing") {
    return false;
  }

  const payload = {
    stripe_event_id: eventId,
    event_type: eventType,
    status: "processing",
    last_error: null,
    processed_at: null
  };

  const { error } = await supabase.from("stripe_webhook_events").upsert(payload, {
    onConflict: "stripe_event_id"
  });

  if (error) throw error;

  return true;
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
  const paymentIntentId =
    typeof session.payment_intent === "string" ? session.payment_intent : null;

  if (plan.family === "premium") {
    const { data: existingGrant, error: existingGrantError } = await supabase
      .from("premium_access_grants")
      .select("id")
      .eq("stripe_checkout_session_id", session.id)
      .maybeSingle();

    if (existingGrantError) {
      throw existingGrantError;
    }

    if (existingGrant) {
      return {
        applied: false,
        alreadyApplied: true,
        family: plan.family,
        planCode: plan.code,
        userId,
        section: getSectionForPlanFamily(plan.family)
      };
    }

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + plan.durationHours * 60 * 60 * 1000);

    const { error } = await supabase.from("premium_access_grants").insert({
      user_id: userId,
      source: "stripe",
      product_code: plan.code,
      starts_at: startsAt.toISOString(),
      ends_at: endsAt.toISOString(),
      stripe_checkout_session_id: session.id,
      stripe_payment_intent_id: paymentIntentId,
      metadata: {
        stripe_customer_id: session.customer,
        amount_total: session.amount_total
      }
    });

    if (error && error.code !== "23505") {
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

    if (error && error.code !== "23505") {
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

export async function reconcileCheckoutSession(sessionId) {
  const stripe = getStripe();
  const session = await stripe.checkout.sessions.retrieve(sessionId);
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
