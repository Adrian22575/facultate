import nextEnv from "@next/env";
import { createClient } from "@supabase/supabase-js";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Lipsesc NEXT_PUBLIC_SUPABASE_URL sau SUPABASE_SERVICE_ROLE_KEY.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

function buildDeletedActivityPayload(job, subjectExists) {
  const metadata = job.metadata || {};
  const activityMessage = "Fisierul a fost sters.";

  return {
    ...metadata,
    activityState: "deleted",
    activityMessage,
    activityAt: new Date().toISOString(),
    lastKnownSubjectLabel: metadata.lastKnownSubjectLabel || metadata.subjectLabel || null
  };
}

const { data: jobs, error: jobsError } = await supabase
  .from("ai_generation_jobs")
  .select("id, user_id, status, result_bank_id, metadata")
  .eq("job_kind", "question_bank_extract")
  .eq("status", "succeeded");

if (jobsError) {
  console.error("Nu am putut citi joburile AI.", jobsError.message);
  process.exit(1);
}

const succeededJobs = jobs || [];
const bankIds = Array.from(new Set(succeededJobs.map((job) => job.result_bank_id).filter(Boolean)));
const subjectIds = Array.from(
  new Set(
    succeededJobs
      .map((job) => job.metadata?.subjectId)
      .filter((subjectId) => subjectId && subjectId !== "custom")
  )
);

const [{ data: banks, error: banksError }, { data: subjects, error: subjectsError }] = await Promise.all([
  bankIds.length ? supabase.from("ai_question_banks").select("id").in("id", bankIds) : Promise.resolve({ data: [], error: null }),
  subjectIds.length ? supabase.from("subjects").select("id").in("id", subjectIds) : Promise.resolve({ data: [], error: null })
]);

if (banksError) {
  console.error("Nu am putut citi bancile AI.", banksError.message);
  process.exit(1);
}

if (subjectsError) {
  console.error("Nu am putut citi materiile.", subjectsError.message);
  process.exit(1);
}

const existingBankIds = new Set((banks || []).map((row) => row.id));
const existingSubjectIds = new Set((subjects || []).map((row) => row.id));

let repaired = 0;

for (const job of succeededJobs) {
  const metadata = job.metadata || {};
  if (metadata.activityState === "deleted") {
    continue;
  }

  const subjectId = metadata.subjectId || null;
  const examType = metadata.examType || "normal";
  const hasBankRef = Boolean(job.result_bank_id);
  const bankExists = hasBankRef ? existingBankIds.has(job.result_bank_id) : false;
  const hasNormalSubject = examType !== "licenta" && subjectId && subjectId !== "custom";
  const subjectExists = hasNormalSubject ? existingSubjectIds.has(subjectId) : true;
  const isOrphaned =
    (hasBankRef && !bankExists) || (!hasBankRef && hasNormalSubject && !subjectExists);

  if (!isOrphaned) {
    continue;
  }

  const nextMetadata = buildDeletedActivityPayload(job, subjectExists);
  const { error } = await supabase
    .from("ai_generation_jobs")
    .update({
      metadata: nextMetadata,
      status_detail: nextMetadata.activityMessage
    })
    .eq("id", job.id);

  if (error) {
    console.error(`Nu am putut actualiza jobul ${job.id}.`, error.message);
    process.exit(1);
  }

  repaired += 1;
}

console.log(
  JSON.stringify(
    {
      scanned: succeededJobs.length,
      repaired
    },
    null,
    2
  )
);
