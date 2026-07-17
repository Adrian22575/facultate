import fs from "node:fs";
import OpenAI from "openai";

const DEFAULTS = {
  OPENAI_IMPORT_MODEL: "gpt-5.4-mini",
  OPENAI_IMPORT_ESCALATION_MODEL: "gpt-5.4",
  OPENAI_PDF_FALLBACK_MODEL: "gpt-5.4",
  OPENAI_PDF_PRIMARY_MODEL: "gpt-5.4",
  OPENAI_PDF_PRIMARY_REASONING: "medium",
  OPENAI_PDF_ESCALATION_MODEL: "gpt-5.4",
  OPENAI_PDF_ESCALATION_REASONING: "high",
  OPENAI_PDF_BATCH_SIZE: "80",
  OPENAI_PDF_BATCH_TIMEOUT_MS: "240000",
  OPENAI_PDF_BATCH_MAX_OUTPUT_TOKENS: "20000",
  OPENAI_PDF_SINGLE_FILE_TIMEOUT_MS: "285000",
  OPENAI_PDF_SINGLE_FILE_POLL_INTERVAL_MS: "7000",
  OPENAI_PDF_SINGLE_FILE_MAX_POLL_MINUTES: "45",
  OPENAI_PDF_SINGLE_FILE_RETRY_LIMIT: "3",
  OPENAI_PDF_SINGLE_FILE_MAX_OUTPUT_TOKENS: "20000",
  OPENAI_PDF_SINGLE_FILE_MAX_ITEMS: "80",
  OPENAI_IMPORT_SET_SINGLE_PASS_MAX_CHARS: "45000",
  OPENAI_IMPORT_SET_SINGLE_PASS_MAX_BLOCKS: "160",
  OPENAI_EDITORIAL_MODEL: "gpt-5.6"
};

const args = new Set(process.argv.slice(2));
const live = args.has("--live");
const envPath = process.argv.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) || ".env.local";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) {
    return {};
  }

  const env = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const index = trimmed.indexOf("=");
    if (index < 0) continue;

    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith("\"") && value.endsWith("\"")) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function getConfig(env) {
  return Object.fromEntries(
    Object.entries(DEFAULTS).map(([key, fallback]) => [key, env[key] || process.env[key] || fallback])
  );
}

function getConfiguredModels(config) {
  return [
    config.OPENAI_IMPORT_MODEL,
    config.OPENAI_IMPORT_ESCALATION_MODEL,
    config.OPENAI_PDF_FALLBACK_MODEL,
    config.OPENAI_PDF_PRIMARY_MODEL,
    config.OPENAI_PDF_ESCALATION_MODEL,
    config.OPENAI_EDITORIAL_MODEL
  ].filter(Boolean);
}

async function main() {
  const env = { ...loadEnvFile(envPath), ...process.env };
  const apiKey = env.OPENAI_API_KEY;
  const config = getConfig(env);
  const configuredModels = [...new Set(getConfiguredModels(config))];

  console.log(`OpenAI env file: ${envPath}`);
  console.log(`OPENAI_API_KEY: ${apiKey ? "present" : "missing"}`);
  console.log(`Configured models: ${configuredModels.join(", ")}`);

  if (!apiKey) {
    process.exitCode = 1;
    return;
  }

  if (!live) {
    console.log("Live API check skipped. Run `npm run openai:check:live` to verify model access.");
    return;
  }

  const client = new OpenAI({ apiKey });
  for (const model of configuredModels) {
    try {
      const result = await client.models.retrieve(model);
      console.log(`${model}: ok (${result.id})`);
    } catch (error) {
      process.exitCode = 1;
      const status = error?.status || error?.code || "unknown";
      const message = String(error?.message || error).slice(0, 160);
      console.log(`${model}: failed (${status}) ${message}`);
    }
  }
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error?.message || error);
});
