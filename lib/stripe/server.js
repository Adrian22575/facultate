import "server-only";

import Stripe from "stripe";

import { getSupabaseServerEnv, hasStripeSecretEnv, hasStripeWebhookEnv } from "@/lib/env/server";

let stripeClient;

export function hasStripeEnv() {
  return hasStripeSecretEnv();
}

export function hasStripeWebhookSecret() {
  return hasStripeWebhookEnv();
}

export function getStripe() {
  if (!hasStripeSecretEnv()) {
    throw new Error(
      "Stripe nu este configurat. Completează STRIPE_SECRET_KEY în mediul server-side."
    );
  }

  if (!stripeClient) {
    const { STRIPE_SECRET_KEY } = getSupabaseServerEnv();
    stripeClient = new Stripe(STRIPE_SECRET_KEY);
  }

  return stripeClient;
}

export function getStripeWebhookSecret() {
  const { STRIPE_WEBHOOK_SECRET } = getSupabaseServerEnv();

  if (!STRIPE_WEBHOOK_SECRET) {
    throw new Error(
      "Stripe webhook secret lipsește. Completează STRIPE_WEBHOOK_SECRET pe server."
    );
  }

  return STRIPE_WEBHOOK_SECRET;
}
