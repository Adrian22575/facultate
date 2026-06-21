import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const DEFAULT_WINDOW_HOURS = 24;
const DEFAULT_MAX_FAILED = 0;
const DEFAULT_MAX_STALE_ACTIVE = 0;
const DEFAULT_STALE_MINUTES = 20;

const args = process.argv.slice(2);
const envPath = args.find((arg) => arg.startsWith("--env="))?.slice("--env=".length) || ".env.local";

function getNumberArg(name, fallback) {
  const raw = args.find((arg) => arg.startsWith(`--${name}=`))?.slice(name.length + 3);
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

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

function countBy(rows, keySelector) {
  const counts = new Map();
  for (const row of rows || []) {
    const key = keySelector(row) || "unknown";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return Object.fromEntries([...counts.entries()].sort((left, right) => right[1] - left[1]));
}

function parseDate(value) {
  const parsed = Date.parse(value || "");
  return Number.isFinite(parsed) ? parsed : null;
}

function minutesSince(value) {
  const parsed = parseDate(value);
  if (parsed === null) return null;
  return Math.max(0, Math.round((Date.now() - parsed) / 60000));
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function selectRows(label, queryFactory, attempts = 3) {
  let lastError = null;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const { data, error } = await queryFactory();
      if (error) {
        throw new Error(error.message);
      }
      return data || [];
    } catch (error) {
      lastError = error;
      if (attempt < attempts) {
        await sleep(400 * attempt);
      }
    }
  }

  throw new Error(`${label}: ${lastError?.message || "query_failed"}`);
}

async function main() {
  const env = { ...loadEnvFile(envPath), ...process.env };
  const url = env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const failures = [];

  if (!url) failures.push("NEXT_PUBLIC_SUPABASE_URL is missing.");
  if (!serviceRoleKey) failures.push("SUPABASE_SERVICE_ROLE_KEY is missing.");

  const windowHours = getNumberArg("hours", DEFAULT_WINDOW_HOURS);
  const maxFailed = getNumberArg("max-failed", DEFAULT_MAX_FAILED);
  const maxStaleActive = getNumberArg("max-stale-active", DEFAULT_MAX_STALE_ACTIVE);
  const staleMinutes = getNumberArg("stale-minutes", DEFAULT_STALE_MINUTES);
  const since = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
  const staleBefore = new Date(Date.now() - staleMinutes * 60 * 1000).toISOString();

  console.log(`Learning monitor env file: ${envPath}`);
  console.log(`Project ref: ${getProjectRef(url) || "(unknown)"}`);
  console.log(`Window: ${windowHours}h`);

  if (failures.length) {
    for (const failure of failures) console.log(`failed: ${failure}`);
    process.exitCode = 1;
    return;
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });

  const studySets = await selectRows(
    "learning_study_sets",
    () =>
      supabase
        .from("learning_study_sets")
        .select("id, title, status, source_kind, created_at, updated_at, metadata")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500)
  );

  const jobs = await selectRows(
    "ai_generation_jobs",
    () =>
      supabase
        .from("ai_generation_jobs")
        .select("id, status, stage, progress_percent, error_message, status_detail, created_at, started_at, completed_at, last_progress_at, metadata")
        .eq("job_kind", "learning_study_set")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500)
  );

  const failureEvents = await selectRows(
    "user_usage_events",
    () =>
      supabase
        .from("user_usage_events")
        .select("id, event_name, created_at, metadata")
        .in("event_name", ["learning_upload_failed", "learning_upload_completed", "learning_upload_queued"])
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500)
  );

  const failedStudySets = studySets.filter((row) => row.status === "failed");
  const failedJobs = jobs.filter((row) => row.status === "failed");
  const failedEvents = failureEvents.filter((row) => row.event_name === "learning_upload_failed");
  const activeJobs = jobs.filter((row) => row.status === "pending" || row.status === "processing");
  const staleActiveJobs = activeJobs.filter((job) => {
    const lastActivity = job.last_progress_at || job.started_at || job.created_at;
    return parseDate(lastActivity) !== null && lastActivity < staleBefore;
  });
  const completedCount =
    jobs.filter((row) => row.status === "succeeded").length ||
    failureEvents.filter((row) => row.event_name === "learning_upload_completed").length;
  const failedCount = Math.max(failedStudySets.length, failedJobs.length, failedEvents.length);
  const totalTerminal = completedCount + failedCount;
  const successRate = totalTerminal ? Math.round((completedCount / totalTerminal) * 100) : null;

  console.log(`Study sets: ${studySets.length}`);
  console.log(`Jobs: ${jobs.length}`);
  console.log(`Status study sets: ${JSON.stringify(countBy(studySets, (row) => row.status))}`);
  console.log(`Status jobs: ${JSON.stringify(countBy(jobs, (row) => row.status))}`);
  console.log(`Source kinds: ${JSON.stringify(countBy(studySets, (row) => row.source_kind))}`);
  console.log(`Completed: ${completedCount}`);
  console.log(`Failed: ${failedCount}`);
  console.log(`Success rate: ${successRate === null ? "n/a" : `${successRate}%`}`);
  console.log(`Active jobs: ${activeJobs.length}`);
  console.log(`Stale active jobs: ${staleActiveJobs.length}`);

  if (failedCount > 0) {
    console.log("Recent failures:");
    [...failedJobs, ...failedStudySets]
      .slice(0, 8)
      .forEach((row) => {
        const title = row.title || row.metadata?.title || row.metadata?.sourceFilename || row.id;
        console.log(`- ${title}: ${row.error_message || row.metadata?.processingError || row.status || "failed"}`);
      });
  }

  if (staleActiveJobs.length > 0) {
    console.log("Stale active jobs:");
    staleActiveJobs.slice(0, 8).forEach((job) => {
      const title = job.metadata?.title || job.metadata?.sourceFilename || job.id;
      console.log(`- ${title}: ${job.status}/${job.stage}, last activity ${minutesSince(job.last_progress_at || job.started_at || job.created_at)} min ago`);
    });
  }

  if (failedCount > maxFailed) {
    failures.push(`Failed learning processing count ${failedCount} is above allowed ${maxFailed}.`);
  }

  if (staleActiveJobs.length > maxStaleActive) {
    failures.push(`Stale active learning jobs ${staleActiveJobs.length} is above allowed ${maxStaleActive}.`);
  }

  if (failures.length) {
    for (const failure of failures) console.log(`failed: ${failure}`);
    process.exitCode = 1;
    return;
  }

  console.log("learning:monitor ok");
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error?.message || error);
});
