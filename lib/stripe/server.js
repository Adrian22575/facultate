import "server-only";

import Stripe from "stripe";

import { getSupabaseServerEnv, hasStripeSecretEnv, hasStripeWebhookEnv } from "@/lib/env/server";

export const STRIPE_MODE = {
  LIVE: "live",
  SANDBOX: "sandbox"
};

const stripeClients = new Map();

export function resolveStripeMode(mode) {
  return mode === STRIPE_MODE.SANDBOX ? STRIPE_MODE.SANDBOX : STRIPE_MODE.LIVE;
}

export function hasStripeEnv(mode = STRIPE_MODE.LIVE) {
  return hasStripeSecretEnv(resolveStripeMode(mode));
}

export function hasStripeWebhookSecret(mode = STRIPE_MODE.LIVE) {
  return hasStripeWebhookEnv(resolveStripeMode(mode));
}

export function getAvailableStripeWebhookModes() {
  return [STRIPE_MODE.LIVE, STRIPE_MODE.SANDBOX].filter((mode) => hasStripeWebhookSecret(mode));
}

function getStripeSecretKey(mode) {
  const { STRIPE_SECRET_KEY, STRIPE_SANDBOX_SECRET_KEY } = getSupabaseServerEnv();
  return resolveStripeMode(mode) === STRIPE_MODE.SANDBOX ? STRIPE_SANDBOX_SECRET_KEY : STRIPE_SECRET_KEY;
}

export function getStripe(mode = STRIPE_MODE.LIVE) {
  const stripeMode = resolveStripeMode(mode);

  if (!hasStripeSecretEnv(stripeMode)) {
    throw new Error(
      stripeMode === STRIPE_MODE.SANDBOX
        ? "Stripe sandbox nu este configurat. Completeaza STRIPE_SANDBOX_SECRET_KEY pe server."
        : "Stripe nu este configurat. Completeaza STRIPE_SECRET_KEY pe server."
    );
  }

  if (!stripeClients.has(stripeMode)) {
    stripeClients.set(stripeMode, new Stripe(getStripeSecretKey(stripeMode)));
  }

  return stripeClients.get(stripeMode);
}

export function getStripeWebhookSecret(mode = STRIPE_MODE.LIVE) {
  const stripeMode = resolveStripeMode(mode);
  const { STRIPE_WEBHOOK_SECRET, STRIPE_SANDBOX_WEBHOOK_SECRET } = getSupabaseServerEnv();
  const webhookSecret =
    stripeMode === STRIPE_MODE.SANDBOX ? STRIPE_SANDBOX_WEBHOOK_SECRET : STRIPE_WEBHOOK_SECRET;

  if (!webhookSecret) {
    throw new Error(
      stripeMode === STRIPE_MODE.SANDBOX
        ? "Stripe sandbox webhook secret lipseste. Completeaza STRIPE_SANDBOX_WEBHOOK_SECRET pe server."
        : "Stripe webhook secret lipseste. Completeaza STRIPE_WEBHOOK_SECRET pe server."
    );
  }

  return webhookSecret;
}
