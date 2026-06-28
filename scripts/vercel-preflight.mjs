import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const envLocalPath = path.join(cwd, ".env.local");
const requiredEnvKeys = [
  "NEXT_PUBLIC_SITE_URL",
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "OPENAI_API_KEY",
  "STRIPE_SECRET_KEY",
  "STRIPE_WEBHOOK_SECRET"
];
const productionRequiredEnvKeys = [
  "CRON_SECRET"
];
const productionLaunchEnvKeys = [
  "NEXT_PUBLIC_LEGAL_OPERATOR_NAME",
  "NEXT_PUBLIC_LEGAL_OPERATOR_ADDRESS",
  "NEXT_PUBLIC_LEGAL_REGISTRATION_ID",
  "NEXT_PUBLIC_LEGAL_CONTACT_EMAIL"
];
const migrationDirectory = path.join(cwd, "supabase", "migrations");

function parseDotEnv(contents) {
  const values = {};

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    values[key] = value;
  }

  return values;
}

function loadLocalFallbackEnv() {
  if (!fs.existsSync(envLocalPath)) {
    return {};
  }

  return parseDotEnv(fs.readFileSync(envLocalPath, "utf8"));
}

function getEnvValue(key, localFallback) {
  return process.env[key] || localFallback[key] || "";
}

function formatPresence(value) {
  return value ? "(set)" : "(missing)";
}

function inferTargetEnvironment() {
  const targetArgument = process.argv.find((argument) => argument.startsWith("--target="));
  if (targetArgument) {
    return targetArgument.slice("--target=".length).trim().toLowerCase();
  }

  return process.env.VERCEL_ENV || process.env.NODE_ENV || "local";
}

function getMigrationRange() {
  if (!fs.existsSync(migrationDirectory)) return "migrarile din repo";

  const migrationNumbers = fs
    .readdirSync(migrationDirectory)
    .map((name) => name.match(/^(\d+)_.*\.sql$/)?.[1] || null)
    .filter(Boolean)
    .sort();

  if (!migrationNumbers.length) return "migrarile din repo";
  return `${migrationNumbers[0]}-${migrationNumbers.at(-1)}`;
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isPlaceholder(value) {
  return /de completat|placeholder|example\.com|exemplu/i.test(value);
}

const localFallback = loadLocalFallbackEnv();
const targetEnvironment = inferTargetEnvironment();
const targetRequiredEnvKeys = [
  ...requiredEnvKeys,
  ...(targetEnvironment === "production" ? productionRequiredEnvKeys : [])
];
const missingKeys = targetRequiredEnvKeys.filter((key) => !getEnvValue(key, localFallback));
const siteUrl = getEnvValue("NEXT_PUBLIC_SITE_URL", localFallback);
const stripeSecret = getEnvValue("STRIPE_SECRET_KEY", localFallback);
const telegramNotificationsEnabled = !["0", "false", "off", "disabled"].includes(
  String(getEnvValue("TELEGRAM_NOTIFICATIONS_ENABLED", localFallback) || "").trim().toLowerCase()
);
const telegramBotToken = getEnvValue("TELEGRAM_BOT_TOKEN", localFallback);
const telegramAdminChatId = getEnvValue("TELEGRAM_ADMIN_CHAT_ID", localFallback);
const supabaseUrl = getEnvValue("NEXT_PUBLIC_SUPABASE_URL", localFallback);
const supabasePublishableKey = getEnvValue("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", localFallback);
const supabaseServiceRoleKey = getEnvValue("SUPABASE_SERVICE_ROLE_KEY", localFallback);
const stripeWebhookSecret = getEnvValue("STRIPE_WEBHOOK_SECRET", localFallback);

console.log(`Vercel preflight target: ${targetEnvironment}`);
console.log("");
console.log("Required environment variables:");

for (const key of requiredEnvKeys) {
  const value = getEnvValue(key, localFallback);
  console.log(`- ${key}: ${formatPresence(value)}`);
}

console.log("");
console.log("Production-only environment variables:");
for (const key of productionRequiredEnvKeys) {
  const value = getEnvValue(key, localFallback);
  console.log(`- ${key}: ${formatPresence(value)}`);
}

console.log("");
console.log("Production launch-readiness variables:");
for (const key of productionLaunchEnvKeys) {
  const value = getEnvValue(key, localFallback);
  console.log(`- ${key}: ${formatPresence(value)}`);
}

const warnings = [];
const configurationErrors = [];

if (targetEnvironment !== "local" && targetEnvironment !== "development") {
  if (!siteUrl || siteUrl.includes("localhost")) {
    const message = "NEXT_PUBLIC_SITE_URL still points to localhost for a non-local environment.";
    if (targetEnvironment === "production") configurationErrors.push(message);
    else warnings.push(message);
  }
}

if (targetEnvironment === "preview" && stripeSecret && !stripeSecret.startsWith("sk_test_")) {
  warnings.push("Preview should use Stripe Test keys, but STRIPE_SECRET_KEY does not look like a test key.");
}

if (targetEnvironment === "production" && stripeSecret && stripeSecret.startsWith("sk_test_")) {
  configurationErrors.push("Production cannot use a Stripe Test key.");
}

if (targetEnvironment === "production" && stripeSecret && !stripeSecret.startsWith("sk_live_")) {
  configurationErrors.push("STRIPE_SECRET_KEY must be a Stripe Live secret in Production.");
}

if (stripeWebhookSecret && !stripeWebhookSecret.startsWith("whsec_")) {
  configurationErrors.push("STRIPE_WEBHOOK_SECRET does not have the expected webhook secret format.");
}

if (targetEnvironment === "production" && siteUrl) {
  try {
    const parsedSiteUrl = new URL(siteUrl);
    if (parsedSiteUrl.protocol !== "https:") {
      configurationErrors.push("NEXT_PUBLIC_SITE_URL must use HTTPS in Production.");
    }
    if (parsedSiteUrl.pathname !== "/" || parsedSiteUrl.search || parsedSiteUrl.hash) {
      configurationErrors.push("NEXT_PUBLIC_SITE_URL must contain only the canonical origin, without a path, query or hash.");
    }
  } catch {
    configurationErrors.push("NEXT_PUBLIC_SITE_URL is not a valid absolute URL.");
  }
}

if (supabaseUrl) {
  try {
    const parsedSupabaseUrl = new URL(supabaseUrl);
    if (parsedSupabaseUrl.protocol !== "https:" || !parsedSupabaseUrl.hostname.endsWith(".supabase.co")) {
      configurationErrors.push("NEXT_PUBLIC_SUPABASE_URL must be an HTTPS Supabase project URL.");
    }
  } catch {
    configurationErrors.push("NEXT_PUBLIC_SUPABASE_URL is not a valid absolute URL.");
  }
}

if (
  supabasePublishableKey &&
  !supabasePublishableKey.startsWith("sb_publishable_") &&
  !supabasePublishableKey.startsWith("eyJ")
) {
  configurationErrors.push("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY has an unexpected format.");
}

if (
  supabaseServiceRoleKey &&
  !supabaseServiceRoleKey.startsWith("sb_secret_") &&
  !supabaseServiceRoleKey.startsWith("eyJ")
) {
  configurationErrors.push("SUPABASE_SERVICE_ROLE_KEY has an unexpected format.");
}

if (targetEnvironment === "production") {
  for (const key of productionLaunchEnvKeys) {
    const value = getEnvValue(key, localFallback);
    if (value && isPlaceholder(value)) {
      warnings.push(`${key} still contains a placeholder value.`);
    }
  }

  const legalContactEmail = getEnvValue("NEXT_PUBLIC_LEGAL_CONTACT_EMAIL", localFallback);
  if (legalContactEmail && !isValidEmail(legalContactEmail)) {
    configurationErrors.push("NEXT_PUBLIC_LEGAL_CONTACT_EMAIL is not a valid email address.");
  }
}

if (
  targetEnvironment === "production" &&
  getEnvValue("CRON_SECRET", localFallback).length < 24
) {
  configurationErrors.push("CRON_SECRET must contain at least 24 characters in Production.");
}

if (telegramNotificationsEnabled && (!telegramBotToken || !telegramAdminChatId)) {
  warnings.push(
    "Telegram notifications are enabled by default, but TELEGRAM_BOT_TOKEN or TELEGRAM_ADMIN_CHAT_ID is missing."
  );
}

if (missingKeys.length) {
  console.error("");
  console.error("Missing required environment variables:");
  for (const key of missingKeys) {
    console.error(`- ${key}`);
  }
}

if (configurationErrors.length) {
  console.error("");
  console.error("Invalid production configuration:");
  for (const error of configurationErrors) {
    console.error(`- ${error}`);
  }
}

if (warnings.length) {
  console.warn("");
  console.warn("Warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

console.log("");
console.log("Manual checks still required:");
console.log(`- Supabase migrations ${getMigrationRange()} applied in the target project`);
console.log("- Supabase Auth Site URL and redirect URLs configured");
console.log("- Supabase Storage bucket private-source-documents exists");
console.log("- Google OAuth origins and callback URLs configured");
console.log("- Stripe webhook endpoint secret matches the target environment");
console.log("- Vercel Cron schedule is supported by the target plan");
console.log("- Telegram admin notifications tested if review/import approvals are expected");

if (missingKeys.length || configurationErrors.length) {
  process.exit(1);
}
