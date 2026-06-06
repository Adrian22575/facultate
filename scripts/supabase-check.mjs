import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_STORAGE_BUCKET = "private-source-documents";
const EXPECTED_MIN_BUCKET_BYTES = 30 * 1024 * 1024;
const REQUIRED_TABLES = [
  "profiles",
  "subjects",
  "ai_source_documents",
  "ai_question_banks",
  "ai_import_jobs",
  "ai_import_questions",
  "ai_licenta_import_sessions",
  "admin_notification_views"
];

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

function getProjectRef(url) {
  try {
    const parsed = new URL(url);
    const match = parsed.hostname.match(/^([^.]+)\.supabase\.co$/);
    return match?.[1] || "";
  } catch {
    return "";
  }
}

function getPublishableKeyType(key) {
  if (!key) return "missing";
  if (key.startsWith("sb_publishable_")) return "modern_publishable";
  if (key.startsWith("eyJ")) return "legacy_anon_jwt";
  return "unknown";
}

function assert(condition, message, failures) {
  if (!condition) {
    failures.push(message);
  }
}

async function checkRequiredTable(supabase, table) {
  const { error, count } = await supabase.from(table).select("id", {
    count: "exact",
    head: true
  });

  if (error) {
    return { table, ok: false, message: error.message };
  }

  return { table, ok: true, count };
}

async function main() {
  const env = { ...loadEnvFile(envPath), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const projectRef = getProjectRef(url);
  const failures = [];

  assert(Boolean(url), "NEXT_PUBLIC_SUPABASE_URL is missing.", failures);
  assert(Boolean(projectRef), "NEXT_PUBLIC_SUPABASE_URL is not a valid Supabase project URL.", failures);
  assert(Boolean(publishableKey), "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is missing.", failures);
  assert(Boolean(serviceRoleKey), "SUPABASE_SERVICE_ROLE_KEY is missing.", failures);

  console.log(`Supabase env file: ${envPath}`);
  console.log(`Project ref: ${projectRef || "(unknown)"}`);
  console.log(`Publishable key: ${getPublishableKeyType(publishableKey)}`);
  console.log(`Service role key: ${serviceRoleKey ? "present" : "missing"}`);

  if (failures.length) {
    for (const failure of failures) {
      console.log(`failed: ${failure}`);
    }
    process.exitCode = 1;
    return;
  }

  if (!live) {
    console.log("Live Supabase check skipped. Run `npm run supabase:check:live` for read-only runtime checks.");
    return;
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  for (const table of REQUIRED_TABLES) {
    const result = await checkRequiredTable(supabase, table);
    if (!result.ok) {
      process.exitCode = 1;
      console.log(`${table}: failed (${result.message})`);
      continue;
    }
    console.log(`${table}: ok (${result.count ?? 0} rows)`);
  }

  const { data: bucket, error: bucketError } = await supabase.storage.getBucket(EXPECTED_STORAGE_BUCKET);
  if (bucketError) {
    process.exitCode = 1;
    console.log(`${EXPECTED_STORAGE_BUCKET}: failed (${bucketError.message})`);
  } else {
    const limit = Number(bucket?.file_size_limit || 0);
    const limitOk = limit === 0 || limit >= EXPECTED_MIN_BUCKET_BYTES;
    if (!limitOk) {
      process.exitCode = 1;
      console.log(`${EXPECTED_STORAGE_BUCKET}: failed (file size limit ${limit} is below 30 MB)`);
    } else {
      console.log(`${EXPECTED_STORAGE_BUCKET}: ok (${limit || "unlimited"} byte limit)`);
    }
  }
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error?.message || error);
});
