import fs from "node:fs";
import { createClient } from "@supabase/supabase-js";

const EXPECTED_STORAGE_BUCKET = "private-source-documents";
const EXPECTED_MIN_BUCKET_BYTES = 30 * 1024 * 1024;
const EXPECTED_STORAGE_MIME_TYPES = [
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain"
];
const REQUIRED_RPC_FUNCTIONS = [
  "acquire_ai_generation_job_lock",
  "release_ai_generation_job_lock",
  "create_generated_test_draft",
  "can_access_learning_study_set",
  "consume_api_rate_limit",
  "consume_ai_credit",
  "sync_subject_progress",
  "save_learning_quiz_attempt",
  "record_learning_flashcard_review",
  "record_licenta_exam_attempt",
  "save_primary_academic_membership",
  "apply_stripe_premium_grant",
  "apply_reward_premium_grant",
  "create_credit_backed_generation_job",
  "requeue_credit_backed_generation_job",
  "acquire_ai_import_job_lock",
  "release_ai_import_job_lock",
  "claim_stripe_webhook_event",
  "award_gamification_points",
  "refresh_gamification_achievements"
];
const REQUIRED_RELATIONS = [
  { table: "profiles", columns: "id,user_type,onboarding_completed,primary_membership_id,phone_normalized" },
  { table: "licenta_exam_mistakes", columns: "user_id,question_id,updated_at" },
  { table: "institutions", columns: "id,institution_type,name,city,county" },
  { table: "academic_units", columns: "id,institution_id,parent_unit_id,unit_type,name" },
  { table: "cohorts", columns: "id,institution_id,program_unit_id,cohort_type,label" },
  { table: "memberships", columns: "id,user_id,institution_id,program_unit_id,cohort_id,status" },
  { table: "subjects", columns: "id,title" },
  { table: "subject_allocations", columns: "id,subject_id,user_type,study_year,semester,school_class" },
  {
    table: "subject_progress",
    columns:
      "id,user_id,subject_id,study_viewed_question_ids,interactive_answered,interactive_correct,interactive_wrong,test_best_score_percent"
  },
  { table: "premium_access_grants", columns: "id,user_id,product_code,starts_at,ends_at,stripe_checkout_session_id" },
  { table: "ai_credit_ledger", columns: "id,user_id,delta,reason,stripe_checkout_session_id" },
  { table: "stripe_customers", columns: "user_id,stripe_customer_id" },
  {
    table: "stripe_webhook_events",
    columns: "id,stripe_event_id,event_type,status,last_error,started_at,attempt_count"
  },
  {
    table: "ai_source_documents",
    columns: "id,user_id,source_kind,mime_type,storage_bucket,storage_path,extracted_text"
  },
  {
    table: "ai_generation_jobs",
    columns: "id,user_id,status,job_kind,last_heartbeat_at,last_progress_at,result_learning_study_set_id"
  },
  { table: "ai_question_banks", columns: "id,user_id,status,exam_type,subject_id,visibility_scope" },
  { table: "ai_import_jobs", columns: "id,user_id,status,licenta_session_id,set_index" },
  { table: "ai_import_questions", columns: "id,import_job_id,user_id,status,question_text" },
  { table: "ai_licenta_import_sessions", columns: "id,user_id,status,result_bank_id" },
  { table: "admin_notification_views", columns: "id,admin_user_id,scope,viewed_at" },
  { table: "api_rate_limit_events", columns: "id,action,subject,created_at" },
  {
    table: "licenta_exam_attempts",
    columns: "id,user_id,mode,score_percent,question_count,wrong_count,idempotency_key"
  },
  {
    table: "user_usage_events",
    columns: "id,user_id,event_name,route_path,route_query,referrer_path,device_type"
  },
  {
    table: "learning_study_sets",
    columns: "id,user_id,status,source_kind,job_id,metadata,visibility_scope,published_at"
  },
  { table: "learning_chapters", columns: "id,study_set_id,position,quality_status" },
  { table: "learning_concepts", columns: "id,study_set_id,chapter_id,position" },
  { table: "learning_flashcards", columns: "id,study_set_id,chapter_id,position" },
  { table: "learning_questions", columns: "id,study_set_id,question_type,answers,correct_index" },
  {
    table: "learning_attempts",
    columns: "id,study_set_id,user_id,mode,score_percent,wrong_count,idempotency_key"
  },
  { table: "learning_attempt_items", columns: "id,attempt_id,question_id,is_correct,rating" },
  {
    table: "learning_flashcard_reviews",
    columns: "id,study_set_id,flashcard_id,user_id,rating,next_review_at,metadata"
  },
  { table: "learning_study_set_reports", columns: "id,study_set_id,reporter_user_id,status" },
  { table: "gamification_profiles", columns: "user_id,total_points,current_streak,best_streak,last_active_date" },
  {
    table: "gamification_point_transactions",
    columns: "id,user_id,action_type,points,activity_date,idempotency_key"
  },
  { table: "gamification_daily_activity", columns: "user_id,activity_date,action_count,points_earned" },
  { table: "gamification_levels", columns: "level_key,position,title,min_points,badge" },
  {
    table: "gamification_achievements",
    columns: "achievement_key,title,requirement_type,requirement_value,bonus_points"
  },
  {
    table: "gamification_user_achievements",
    columns: "user_id,achievement_key,unlocked_at,points_awarded"
  },
  {
    table: "linkedin_connections",
    columns: "id,connected_by,member_subject,member_urn,status,scopes,token_expires_at"
  },
  {
    table: "linkedin_automation_settings",
    columns: "singleton,mode,model,default_template,notify_telegram,include_article_image,fallback_to_text,updated_by"
  },
  {
    table: "linkedin_oauth_states",
    columns: "id,admin_user_id,state_hash,return_path,expires_at,used_at"
  },
  {
    table: "linkedin_editorial_posts",
    columns:
      "id,article_id,connection_id,status,generated_text,edited_text,template_key,linkedin_post_urn,linkedin_post_url,publish_request_key"
  }
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

async function checkRequiredRelation(supabase, relation) {
  const { error } = await supabase.from(relation.table).select(relation.columns).limit(1);

  if (error) {
    return { table: relation.table, ok: false, message: error.message };
  }

  return { table: relation.table, ok: true };
}

async function checkRequiredRpcFunctions(url, serviceRoleKey) {
  const response = await fetch(`${url}/rest/v1/`, {
    headers: {
      Accept: "application/openapi+json",
      apikey: serviceRoleKey,
      Authorization: `Bearer ${serviceRoleKey}`
    }
  });

  if (!response.ok) {
    return { ok: false, message: `PostgREST metadata returned HTTP ${response.status}` };
  }

  const schema = await response.json();
  const paths = new Set(Object.keys(schema?.paths || {}));
  const missing = REQUIRED_RPC_FUNCTIONS.filter((name) => !paths.has(`/rpc/${name}`));

  return missing.length
    ? { ok: false, message: `missing RPC functions: ${missing.join(", ")}` }
    : { ok: true };
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

  let checkedRelations = 0;
  for (const relation of REQUIRED_RELATIONS) {
    const result = await checkRequiredRelation(supabase, relation);
    if (!result.ok) {
      process.exitCode = 1;
      console.log(`${result.table}: failed (${result.message})`);
      continue;
    }
    checkedRelations += 1;
  }

  if (checkedRelations === REQUIRED_RELATIONS.length) {
    console.log(`Critical schema: ok (${checkedRelations} relations)`);
  } else {
    console.log(`Critical schema: failed (${checkedRelations}/${REQUIRED_RELATIONS.length} relations passed)`);
  }

  const rpcResult = await checkRequiredRpcFunctions(url, serviceRoleKey);
  if (!rpcResult.ok) {
    process.exitCode = 1;
    console.log(`Critical RPC functions: failed (${rpcResult.message})`);
  } else {
    console.log(`Critical RPC functions: ok (${REQUIRED_RPC_FUNCTIONS.length} functions)`);
  }

  const { data: bucket, error: bucketError } = await supabase.storage.getBucket(EXPECTED_STORAGE_BUCKET);
  if (bucketError) {
    process.exitCode = 1;
    console.log(`${EXPECTED_STORAGE_BUCKET}: failed (${bucketError.message})`);
  } else {
    const limit = Number(bucket?.file_size_limit || 0);
    const limitOk = limit === 0 || limit >= EXPECTED_MIN_BUCKET_BYTES;
    const allowedMimeTypes = Array.isArray(bucket?.allowed_mime_types) ? bucket.allowed_mime_types : [];
    const missingMimeTypes = EXPECTED_STORAGE_MIME_TYPES.filter((mimeType) => !allowedMimeTypes.includes(mimeType));
    if (!limitOk) {
      process.exitCode = 1;
      console.log(`${EXPECTED_STORAGE_BUCKET}: failed (file size limit ${limit} is below 30 MB)`);
    } else if (missingMimeTypes.length) {
      process.exitCode = 1;
      console.log(`${EXPECTED_STORAGE_BUCKET}: failed (missing MIME types: ${missingMimeTypes.join(", ")})`);
    } else {
      console.log(`${EXPECTED_STORAGE_BUCKET}: ok (${limit || "unlimited"} byte limit, ${allowedMimeTypes.length} MIME types)`);
    }
  }
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error?.message || error);
});
