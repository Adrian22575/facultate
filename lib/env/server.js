import "server-only";

import { z } from "zod";

import { getSupabasePublicEnv } from "@/lib/env/public";

const supabaseServerEnvSchema = z.object({
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_SANDBOX_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_SANDBOX_WEBHOOK_SECRET: z.string().min(1).optional(),
  OPENAI_API_KEY: z.string().min(1).optional(),
  TELEGRAM_BOT_TOKEN: z.string().min(1).optional(),
  TELEGRAM_ADMIN_CHAT_ID: z.string().min(1).optional(),
  TELEGRAM_NOTIFICATIONS_ENABLED: z.string().min(1).optional()
});

function isSandboxStripeMode(mode) {
  return mode === "sandbox";
}

function optionalEnv(value) {
  const trimmed = String(value || "").trim();
  return trimmed ? value : undefined;
}

export function hasSupabaseServiceEnv() {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function hasStripeSecretEnv(mode = "live") {
  return isSandboxStripeMode(mode)
    ? Boolean(process.env.STRIPE_SANDBOX_SECRET_KEY?.trim())
    : Boolean(process.env.STRIPE_SECRET_KEY?.trim());
}

export function hasStripeWebhookEnv(mode = "live") {
  return isSandboxStripeMode(mode)
    ? Boolean(process.env.STRIPE_SANDBOX_SECRET_KEY?.trim() && process.env.STRIPE_SANDBOX_WEBHOOK_SECRET?.trim())
    : Boolean(process.env.STRIPE_SECRET_KEY?.trim() && process.env.STRIPE_WEBHOOK_SECRET?.trim());
}

export function hasOpenAIEnv() {
  return Boolean(process.env.OPENAI_API_KEY);
}

export function hasTelegramNotificationEnv() {
  const status = getTelegramNotificationEnvStatus();
  return status.ready;
}

export function getTelegramNotificationEnvStatus() {
  const disabled = ["0", "false", "off", "no"].includes(
    String(process.env.TELEGRAM_NOTIFICATIONS_ENABLED || "").trim().toLowerCase()
  );
  const botTokenPresent = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());
  const chatIdPresent = Boolean(process.env.TELEGRAM_ADMIN_CHAT_ID?.trim());
  const supabaseServiceReady = hasSupabaseServiceEnv();

  return {
    ready: Boolean(!disabled && botTokenPresent && chatIdPresent && supabaseServiceReady),
    notificationsDisabled: disabled,
    botTokenPresent,
    chatIdPresent,
    supabaseServiceReady
  };
}

export function getSupabaseServerEnv() {
  return {
    ...getSupabasePublicEnv(),
    ...supabaseServerEnvSchema.parse({
      SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
      STRIPE_SECRET_KEY: optionalEnv(process.env.STRIPE_SECRET_KEY),
      STRIPE_WEBHOOK_SECRET: optionalEnv(process.env.STRIPE_WEBHOOK_SECRET),
      STRIPE_SANDBOX_SECRET_KEY: optionalEnv(process.env.STRIPE_SANDBOX_SECRET_KEY),
      STRIPE_SANDBOX_WEBHOOK_SECRET: optionalEnv(process.env.STRIPE_SANDBOX_WEBHOOK_SECRET),
      OPENAI_API_KEY: optionalEnv(process.env.OPENAI_API_KEY),
      TELEGRAM_BOT_TOKEN: optionalEnv(process.env.TELEGRAM_BOT_TOKEN),
      TELEGRAM_ADMIN_CHAT_ID: optionalEnv(process.env.TELEGRAM_ADMIN_CHAT_ID),
      TELEGRAM_NOTIFICATIONS_ENABLED: optionalEnv(process.env.TELEGRAM_NOTIFICATIONS_ENABLED)
    })
  };
}
