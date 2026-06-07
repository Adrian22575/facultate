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

function maskValue(value) {
  if (!value) {
    return "(missing)";
  }

  if (value.length <= 8) {
    return "*".repeat(value.length);
  }

  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}

function inferTargetEnvironment() {
  return process.env.VERCEL_ENV || process.env.NODE_ENV || "local";
}

const localFallback = loadLocalFallbackEnv();
const targetEnvironment = inferTargetEnvironment();
const missingKeys = requiredEnvKeys.filter((key) => !getEnvValue(key, localFallback));
const siteUrl = getEnvValue("NEXT_PUBLIC_SITE_URL", localFallback);
const stripeSecret = getEnvValue("STRIPE_SECRET_KEY", localFallback);
const telegramNotificationsEnabled = !["0", "false", "off", "disabled"].includes(
  String(getEnvValue("TELEGRAM_NOTIFICATIONS_ENABLED", localFallback) || "").trim().toLowerCase()
);
const telegramBotToken = getEnvValue("TELEGRAM_BOT_TOKEN", localFallback);
const telegramAdminChatId = getEnvValue("TELEGRAM_ADMIN_CHAT_ID", localFallback);

console.log(`Vercel preflight target: ${targetEnvironment}`);
console.log("");
console.log("Required environment variables:");

for (const key of requiredEnvKeys) {
  const value = getEnvValue(key, localFallback);
  console.log(`- ${key}: ${maskValue(value)}`);
}

const warnings = [];

if (targetEnvironment !== "local" && targetEnvironment !== "development") {
  if (!siteUrl || siteUrl.includes("localhost")) {
    warnings.push(
      "NEXT_PUBLIC_SITE_URL still points to localhost for a non-local environment."
    );
  }
}

if (targetEnvironment === "preview" && stripeSecret && !stripeSecret.startsWith("sk_test_")) {
  warnings.push("Preview should use Stripe Test keys, but STRIPE_SECRET_KEY does not look like a test key.");
}

if (targetEnvironment === "production" && stripeSecret && stripeSecret.startsWith("sk_test_")) {
  warnings.push("Production should not use a Stripe Test key.");
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

if (warnings.length) {
  console.warn("");
  console.warn("Warnings:");
  for (const warning of warnings) {
    console.warn(`- ${warning}`);
  }
}

console.log("");
console.log("Manual checks still required:");
console.log("- Supabase migrations 0001-0033 applied in the target project");
console.log("- Supabase Auth Site URL and redirect URLs configured");
console.log("- Supabase Storage bucket private-source-documents exists");
console.log("- Google OAuth origins and callback URLs configured");
console.log("- Stripe webhook endpoint secret matches the target environment");
console.log("- Telegram admin notifications tested if review/import approvals are expected");

if (missingKeys.length) {
  process.exit(1);
}
