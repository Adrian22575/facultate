import "server-only";

import {
  estimateOpenAIRequestCost,
  OPENAI_PRICING_SOURCE_URL,
  OPENAI_PRICING_UPDATED_AT,
  OPENAI_PRICING_VERSION
} from "@/lib/openai/pricing";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBillingPlan } from "@/lib/stripe/plans";
import { getAdminFreeAccessOverview } from "@/lib/free-access";
import { getAdminTestimonialRewardEntries } from "@/lib/testimonial-rewards";
import { ADMIN_NOTIFICATION_SCOPES } from "@/lib/admin-notification-scopes";
import { isSupabaseSetupIncompleteError } from "@/lib/supabase/setup-status";

const OPENAI_LOGS_BASE_SELECT =
  "id, user_id, source_document_id, job_id, operation, request_scope, status, model, reasoning_effort, response_id, openai_file_id, duration_ms, prompt_text, input_preview, output_preview, error_message, usage, metadata, created_at";
const OPENAI_LOGS_COST_SELECT = `${OPENAI_LOGS_BASE_SELECT}, estimated_cost_usd, estimated_input_cost_usd, estimated_output_cost_usd, estimated_cached_input_cost_usd, pricing_status, pricing_version, input_tokens, output_tokens, cached_input_tokens, reasoning_tokens, total_tokens`;

async function getProfileEmailMap(userIds) {
  if (!userIds.length) {
    return new Map();
  }

  const admin = createAdminClient();
  const { data, error } = await admin.from("profiles").select("id, email").in("id", userIds);

  if (error) {
    throw error;
  }

  return new Map((data || []).map((row) => [row.id, row.email || null]));
}

function toTimestamp(value) {
  const timestamp = Date.parse(value || "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function latestTimestamp(rows, predicate, getValue) {
  return rows.reduce((latest, row) => {
    if (!predicate(row)) {
      return latest;
    }

    return Math.max(latest, toTimestamp(getValue(row)));
  }, 0);
}

function normalizeNotificationViews(notificationViews = {}) {
  if (notificationViews instanceof Map) {
    return Object.fromEntries(notificationViews.entries());
  }

  return notificationViews || {};
}

function buildVisibleActionCount({ count, latestAt, viewedAt }) {
  if (!count) {
    return 0;
  }

  if (!latestAt) {
    return viewedAt ? 0 : count;
  }

  return toTimestamp(viewedAt) >= latestAt ? 0 : count;
}

export async function getAdminNotificationViews(adminUserId) {
  if (!adminUserId) {
    return {};
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("admin_notification_views")
    .select("scope, viewed_at")
    .eq("admin_user_id", adminUserId);

  if (error) {
    return {};
  }

  return Object.fromEntries((data || []).map((row) => [row.scope, row.viewed_at]));
}

export async function getAdminFeedbackEntries() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("feedback_submissions")
    .select("id, user_email, user_type, feedback_type, message, optional_detail, page_path, created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return data || [];
}

export function buildAdminActionSummary({
  testimonialRewardEntries = [],
  failedUploads = [],
  openAILogs = [],
  billingData = {},
  notificationViews = {}
} = {}) {
  const pendingTestimonials = testimonialRewardEntries.filter((entry) => entry.status === "pending").length;
  const failedProcessing = openAILogs.filter(
    (row) => row.status === "failed" || row.job_status === "failed"
  ).length;
  const failedWebhooks = (billingData.webhookRows || []).filter(
    (row) => row.status === "failed" || row.last_error
  ).length;
  const failedUploadCount = failedUploads.length;
  const views = normalizeNotificationViews(notificationViews);
  const latestTestimonials = latestTimestamp(
    testimonialRewardEntries,
    (entry) => entry.status === "pending",
    (entry) => entry.created_at
  );
  const latestBilling = latestTimestamp(
    billingData.webhookRows || [],
    (row) => row.status === "failed" || row.last_error,
    (row) => row.processed_at
  );
  const latestProcessing = latestTimestamp(
    openAILogs,
    (row) => row.status === "failed" || row.job_status === "failed",
    (row) => row.created_at
  );
  const latestUploads = latestTimestamp(
    failedUploads,
    () => true,
    (row) => row.created_at
  );
  const latestPlatform = Math.max(latestTestimonials, latestBilling);
  const platformRaw = pendingTestimonials + failedWebhooks;
  const visiblePlatform = buildVisibleActionCount({
    count: platformRaw,
    latestAt: latestPlatform,
    viewedAt: views[ADMIN_NOTIFICATION_SCOPES.platform]
  });
  const visibleProcessing = buildVisibleActionCount({
    count: failedProcessing,
    latestAt: latestProcessing,
    viewedAt: views[ADMIN_NOTIFICATION_SCOPES.processing]
  });
  const visibleUploads = buildVisibleActionCount({
    count: failedUploadCount,
    latestAt: latestUploads,
    viewedAt: views[ADMIN_NOTIFICATION_SCOPES.uploads]
  });
  const visibleTestimonials = buildVisibleActionCount({
    count: pendingTestimonials,
    latestAt: latestTestimonials,
    viewedAt: views[ADMIN_NOTIFICATION_SCOPES.testimonials]
  });
  const visibleBilling = buildVisibleActionCount({
    count: failedWebhooks,
    latestAt: latestBilling,
    viewedAt: views[ADMIN_NOTIFICATION_SCOPES.billing]
  });

  return {
    total: visiblePlatform + visibleProcessing + visibleUploads,
    platform: visiblePlatform,
    processing: visibleProcessing,
    uploads: visibleUploads,
    testimonials: visibleTestimonials,
    billing: visibleBilling,
    raw: {
      total: pendingTestimonials + failedUploadCount + failedProcessing + failedWebhooks,
      platform: platformRaw,
      processing: failedProcessing,
      uploads: failedUploadCount,
      testimonials: pendingTestimonials,
      billing: failedWebhooks
    },
    latest: {
      platform: latestPlatform ? new Date(latestPlatform).toISOString() : null,
      processing: latestProcessing ? new Date(latestProcessing).toISOString() : null,
      uploads: latestUploads ? new Date(latestUploads).toISOString() : null,
      testimonials: latestTestimonials ? new Date(latestTestimonials).toISOString() : null,
      billing: latestBilling ? new Date(latestBilling).toISOString() : null
    }
  };
}

export async function getAdminActionSummary(adminUserId = null) {
  const [billingData, testimonialRewardEntries, failedUploads] = await Promise.all([
    getAdminBillingOverview(),
    getAdminTestimonialRewardEntries(),
    getAdminFailedUploadsOverview()
  ]);

  let openAILogs = [];

  try {
    const openAIData = await getAdminOpenAIRequestLogs();
    openAILogs = openAIData.rows || [];
  } catch {
    openAILogs = [];
  }

  const notificationViews = await getAdminNotificationViews(adminUserId);

  return buildAdminActionSummary({
    testimonialRewardEntries,
    failedUploads,
    openAILogs,
    billingData,
    notificationViews
  });
}

export async function getAdminBillingOverview() {
  const admin = createAdminClient();

  const [premiumResult, creditsResult, webhooksResult] = await Promise.all([
    admin
      .from("premium_access_grants")
      .select("id, user_id, product_code, source, stripe_checkout_session_id, created_at, ends_at")
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("ai_credit_ledger")
      .select("id, user_id, reason, source, delta, stripe_checkout_session_id, created_at")
      .eq("source", "stripe")
      .order("created_at", { ascending: false })
      .limit(30),
    admin
      .from("stripe_webhook_events")
      .select("id, stripe_event_id, event_type, status, last_error, processed_at")
      .order("processed_at", { ascending: false, nullsFirst: false })
      .limit(30)
  ]);

  if (premiumResult.error) {
    throw premiumResult.error;
  }

  if (creditsResult.error) {
    throw creditsResult.error;
  }

  if (webhooksResult.error) {
    throw webhooksResult.error;
  }

  const premiumRows = premiumResult.data || [];
  const creditRows = creditsResult.data || [];
  const webhookRows = webhooksResult.data || [];

  const userIds = Array.from(new Set([...premiumRows, ...creditRows].map((row) => row.user_id)));
  const emailMap = await getProfileEmailMap(userIds);

  return {
    premiumRows: premiumRows.map((row) => ({
      ...row,
      user_email: emailMap.get(row.user_id) || null,
      plan_name: getBillingPlan(row.product_code)?.name || row.product_code
    })),
    creditRows: creditRows.map((row) => ({
      ...row,
      user_email: emailMap.get(row.user_id) || null,
      plan_name: getBillingPlan(row.reason)?.name || row.reason
    })),
    webhookRows
  };
}

function countUsageRows(rows, getKey) {
  const map = new Map();

  for (const row of rows) {
    const key = getKey(row);

    if (!key) {
      continue;
    }

    const current = map.get(key) || {
      key,
      label: key,
      count: 0,
      last_seen_at: null
    };

    current.count += 1;
    if (!current.last_seen_at || toTimestamp(row.created_at) > toTimestamp(current.last_seen_at)) {
      current.last_seen_at = row.created_at || null;
    }

    map.set(key, current);
  }

  return Array.from(map.values()).sort((left, right) => right.count - left.count);
}

function buildTopUsageKey(rows, getKey) {
  const top = countUsageRows(rows, getKey)[0];
  return top?.label || null;
}

function buildDailyUsageActivity(rows, days) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  });
  const today = new Date();
  const buckets = new Map();

  for (let index = days - 1; index >= 0; index -= 1) {
    const date = new Date(today);
    date.setDate(today.getDate() - index);
    buckets.set(formatter.format(date), {
      date: formatter.format(date),
      events: 0,
      pageViews: 0,
      users: new Set(),
      sessions: new Set()
    });
  }

  for (const row of rows) {
    const key = row.created_at ? formatter.format(new Date(row.created_at)) : null;
    const bucket = key ? buckets.get(key) : null;

    if (!bucket) {
      continue;
    }

    bucket.events += 1;
    if (row.event_name === "page_view") {
      bucket.pageViews += 1;
    }
    if (row.user_id) {
      bucket.users.add(row.user_id);
    }
    if (row.session_id) {
      bucket.sessions.add(row.session_id);
    }
  }

  return Array.from(buckets.values()).map((bucket) => ({
    date: bucket.date,
    events: bucket.events,
    pageViews: bucket.pageViews,
    users: bucket.users.size,
    sessions: bucket.sessions.size
  }));
}

function buildUsageOverviewFallback(warning = null) {
  return {
    available: !warning,
    warning,
    windowDays: 30,
    totalEvents: 0,
    pageViews: 0,
    clicks: 0,
    uniqueUsers: 0,
    uniqueSessions: 0,
    anonymousSessions: 0,
    activeToday: 0,
    learningEvents: 0,
    topFeatures: [],
    topRoutes: [],
    topEvents: [],
    learningTopActions: [],
    deviceBreakdown: [],
    dailyActivity: [],
    topUsers: [],
    recentEvents: []
  };
}

export async function getAdminUsageAnalyticsOverview({ days = 30, limit = 2500 } = {}) {
  const admin = createAdminClient();
  const windowDays = Math.max(1, Math.min(Number(days) || 30, 90));
  const rowLimit = Math.max(100, Math.min(Number(limit) || 2500, 5000));
  const since = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await admin
    .from("user_usage_events")
    .select(
      "id, user_id, session_id, event_name, feature, route_path, route_query, referrer_path, device_type, viewport_width, viewport_height, metadata, created_at"
    )
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(rowLimit);

  if (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      return buildUsageOverviewFallback(
        "Analytics-ul de utilizare va aparea dupa aplicarea migrarii 0034_user_usage_events.sql."
      );
    }

    throw error;
  }

  const rows = data || [];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
  const emailMap = await getProfileEmailMap(userIds);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);
  const todayTimestamp = todayStart.getTime();
  const uniqueUsers = new Set(userIds);
  const sessions = new Set(rows.map((row) => row.session_id).filter(Boolean));
  const anonymousSessions = new Set(
    rows.filter((row) => !row.user_id).map((row) => row.session_id).filter(Boolean)
  );
  const pageViewRows = rows.filter((row) => row.event_name === "page_view");
  const clickRows = rows.filter((row) => row.event_name === "ui_click");
  const learningEventRows = rows.filter((row) => String(row.event_name || "").startsWith("learning_"));
  const activeToday = new Set(
    rows
      .filter((row) => toTimestamp(row.created_at) >= todayTimestamp)
      .map((row) => row.user_id || row.session_id)
      .filter(Boolean)
  );
  const rowsByUser = new Map();

  for (const row of rows.filter((entry) => entry.user_id)) {
    const current = rowsByUser.get(row.user_id) || [];
    current.push(row);
    rowsByUser.set(row.user_id, current);
  }

  const topUsers = Array.from(rowsByUser.entries())
    .map(([userId, userRows]) => ({
      user_id: userId,
      user_email: emailMap.get(userId) || null,
      count: userRows.length,
      page_views: userRows.filter((row) => row.event_name === "page_view").length,
      clicks: userRows.filter((row) => row.event_name === "ui_click").length,
      last_seen_at: userRows[0]?.created_at || null,
      top_feature: buildTopUsageKey(userRows, (row) => row.feature || "General"),
      top_route: buildTopUsageKey(
        userRows.filter((row) => row.event_name === "page_view"),
        (row) => row.route_path || "/"
      )
    }))
    .sort((left, right) => right.count - left.count)
    .slice(0, 20);

  const recentEvents = rows.slice(0, 80).map((row) => ({
    ...row,
    user_email: row.user_id ? emailMap.get(row.user_id) || null : null
  }));

  return {
    available: true,
    warning: rows.length >= rowLimit
      ? `Afisez ultimele ${rowLimit} evenimente din ultimele ${windowDays} zile.`
      : null,
    windowDays,
    totalEvents: rows.length,
    pageViews: pageViewRows.length,
    clicks: clickRows.length,
    learningEvents: learningEventRows.length,
    uniqueUsers: uniqueUsers.size,
    uniqueSessions: sessions.size,
    anonymousSessions: anonymousSessions.size,
    activeToday: activeToday.size,
    topFeatures: countUsageRows(rows, (row) => row.feature || "General").slice(0, 10),
    topRoutes: countUsageRows(pageViewRows, (row) => row.route_path || "/").slice(0, 12),
    topEvents: countUsageRows(rows, (row) => row.event_name || "unknown").slice(0, 10),
    learningTopActions: countUsageRows(
      learningEventRows,
      (row) => row.metadata?.label || row.event_name || "learning"
    ).slice(0, 10),
    deviceBreakdown: countUsageRows(rows, (row) => row.device_type || "unknown").slice(0, 6),
    dailyActivity: buildDailyUsageActivity(rows, Math.min(windowDays, 14)),
    topUsers,
    recentEvents
  };
}

function buildLearningOverviewFallback(warning = null) {
  return {
    available: !warning,
    warning,
    totalStudySets: 0,
    readyStudySets: 0,
    warningStudySets: 0,
    failedStudySets: 0,
    publishedStudySets: 0,
    privateStudySets: 0,
    recentStudySets: [],
    statusBreakdown: [],
    sourceBreakdown: [],
    unusedStudySets: 0,
    pendingReports: 0,
    stageDurationBreakdown: [],
    processingErrors: [],
    communityReuses: 0,
    topStudySets: [],
    topContributors: []
  };
}

function buildStageDurationBreakdown(rows = []) {
  const labels = {
    validateInput: "Validare",
    rateLimit: "Limitare",
    idempotencyCheck: "Duplicat",
    downloadSource: "Descarcare fisier",
    extractText: "Citire text",
    storeExtractedText: "Salvare text",
    buildStudySet: "Construire materiale",
    consumeCredit: "Consum incarcare",
    finalizeMetadata: "Finalizare"
  };
  const buckets = new Map();

  for (const row of rows) {
    const durations = row.metadata?.processingStageDurationsMs;
    if (!durations || typeof durations !== "object" || Array.isArray(durations)) continue;

    for (const [stage, duration] of Object.entries(durations)) {
      const numericDuration = Number(duration);
      if (!Number.isFinite(numericDuration) || numericDuration < 0) continue;
      const current = buckets.get(stage) || { total: 0, count: 0 };
      current.total += numericDuration;
      current.count += 1;
      buckets.set(stage, current);
    }
  }

  return Array.from(buckets.entries())
    .map(([stage, bucket]) => ({
      label: labels[stage] || stage,
      value: `${Math.round(bucket.total / bucket.count)} ms`,
      count: bucket.count
    }))
    .sort((left, right) => Number.parseInt(right.value, 10) - Number.parseInt(left.value, 10));
}

function incrementMap(map, key, amount = 1) {
  if (!key) return;
  map.set(key, (map.get(key) || 0) + amount);
}

function addToSetMap(map, key, value) {
  if (!key || !value) return;
  const bucket = map.get(key) || new Set();
  bucket.add(value);
  map.set(key, bucket);
}

export async function getAdminLearningStudySetsOverview({ limit = 200 } = {}) {
  const admin = createAdminClient();
  const rowLimit = Math.max(20, Math.min(Number(limit) || 200, 500));
  const { data, error } = await admin
    .from("learning_study_sets")
    .select(
      "id, user_id, title, status, source_kind, visibility_scope, published_at, estimated_pages, chapter_count, flashcard_count, question_count, recommended_days, metadata, created_at, updated_at"
    )
    .order("created_at", { ascending: false })
    .limit(rowLimit);

  if (error) {
    if (isSupabaseSetupIncompleteError(error)) {
      return buildLearningOverviewFallback(
        "Datele pentru invatare apar dupa aplicarea migrarii learning_study_sets."
      );
    }

    throw error;
  }

  const rows = data || [];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
  const publishedRows = rows.filter((row) => row.published_at && row.visibility_scope !== "private");
  const studySetIds = rows.map((row) => row.id);
  let reportCounts = new Map();
  let pendingReports = 0;
  const attemptCounts = new Map();
  const reviewCounts = new Map();
  const activeUsersByStudySet = new Map();
  let processingErrorRows = [];

  try {
    const { data: reportRows, error: reportError } = await admin
      .from("learning_study_set_reports")
      .select("study_set_id, status")
      .in("study_set_id", studySetIds);

    if (reportError) throw reportError;

    for (const report of reportRows || []) {
      reportCounts.set(report.study_set_id, (reportCounts.get(report.study_set_id) || 0) + 1);
      if (report.status === "pending") pendingReports += 1;
    }
  } catch {
    reportCounts = new Map();
    pendingReports = 0;
  }

  try {
    const { data: failureEvents, error: failureEventsError } = await admin
      .from("user_usage_events")
      .select("id, user_id, event_name, route_path, metadata, created_at")
      .eq("event_name", "learning_upload_failed")
      .order("created_at", { ascending: false })
      .limit(30);

    if (failureEventsError) throw failureEventsError;
    processingErrorRows = failureEvents || [];
    for (const row of processingErrorRows) {
      if (row.user_id) userIds.push(row.user_id);
    }
  } catch {
    processingErrorRows = [];
  }

  const emailMap = await getProfileEmailMap(Array.from(new Set(userIds)));

  if (studySetIds.length) {
    try {
      const [{ data: attemptRows }, { data: reviewRows }] = await Promise.all([
        admin.from("learning_attempts").select("study_set_id, user_id").in("study_set_id", studySetIds),
        admin.from("learning_flashcard_reviews").select("study_set_id, user_id").in("study_set_id", studySetIds)
      ]);

      for (const attempt of attemptRows || []) {
        incrementMap(attemptCounts, attempt.study_set_id);
        addToSetMap(activeUsersByStudySet, attempt.study_set_id, attempt.user_id);
      }

      for (const review of reviewRows || []) {
        incrementMap(reviewCounts, review.study_set_id);
        addToSetMap(activeUsersByStudySet, review.study_set_id, review.user_id);
      }
    } catch {
      // Keep analytics available even if usage tables are not ready yet.
    }
  }

  const unusedStudySets = rows.filter((row) => {
    const usageCount = (attemptCounts.get(row.id) || 0) + (reviewCounts.get(row.id) || 0);
    return usageCount < 1;
  }).length;
  const communityReuses = publishedRows.reduce((total, row) => {
    const activeUsers = activeUsersByStudySet.get(row.id) || new Set();
    return total + Array.from(activeUsers).filter((activeUserId) => activeUserId !== row.user_id).length;
  }, 0);
  const topStudySets = rows
    .map((row) => ({
      id: row.id,
      title: row.title || "Material fara titlu",
      status: row.status,
      visibility_scope: row.visibility_scope || "private",
      published_at: row.published_at || null,
      active_user_count: activeUsersByStudySet.get(row.id)?.size || 0,
      attempt_count: attemptCounts.get(row.id) || 0,
      flashcard_review_count: reviewCounts.get(row.id) || 0
    }))
    .sort((left, right) => {
      if (right.active_user_count !== left.active_user_count) return right.active_user_count - left.active_user_count;
      return (right.attempt_count + right.flashcard_review_count) - (left.attempt_count + left.flashcard_review_count);
    })
    .slice(0, 10);
  const contributorMap = new Map();

  for (const row of publishedRows) {
    const current = contributorMap.get(row.user_id) || {
      user_id: row.user_id,
      user_email: row.user_id ? emailMap.get(row.user_id) || null : null,
      published_count: 0,
      active_user_count: 0,
      reuse_count: 0,
      last_published_at: null
    };
    const activeUsers = activeUsersByStudySet.get(row.id) || new Set();
    current.published_count += 1;
    current.active_user_count += activeUsers.size;
    current.reuse_count += Array.from(activeUsers).filter((activeUserId) => activeUserId !== row.user_id).length;
    if (!current.last_published_at || new Date(row.published_at).getTime() > new Date(current.last_published_at).getTime()) {
      current.last_published_at = row.published_at;
    }
    contributorMap.set(row.user_id, current);
  }

  return {
    available: true,
    warning: rows.length >= rowLimit ? `Afisez ultimele ${rowLimit} materiale de invatare.` : null,
    totalStudySets: rows.length,
    readyStudySets: rows.filter((row) => row.status === "ready").length,
    warningStudySets: rows.filter((row) => row.status === "ready_with_warnings").length,
    failedStudySets: rows.filter((row) => row.status === "failed").length,
    publishedStudySets: publishedRows.length,
    privateStudySets: rows.length - publishedRows.length,
    unusedStudySets,
    pendingReports,
    communityReuses,
    statusBreakdown: countUsageRows(rows, (row) => row.status || "unknown"),
    sourceBreakdown: countUsageRows(rows, (row) => row.source_kind || "unknown"),
    stageDurationBreakdown: buildStageDurationBreakdown(rows),
    topStudySets,
    topContributors: Array.from(contributorMap.values())
      .sort((left, right) => {
        if (right.reuse_count !== left.reuse_count) return right.reuse_count - left.reuse_count;
        return right.published_count - left.published_count;
      })
      .slice(0, 10),
    processingErrors: processingErrorRows.map((row) => ({
      id: row.id,
      user_id: row.user_id,
      user_email: row.user_id ? emailMap.get(row.user_id) || null : null,
      title: row.metadata?.title || "Material fara titlu",
      source_kind: row.metadata?.sourceKind || "unknown",
      error: row.metadata?.error || "Eroare necunoscuta",
      processing_duration_ms: Number(row.metadata?.processingDurationMs || 0) || null,
      created_at: row.created_at
    })),
    recentStudySets: rows.slice(0, 30).map((row) => ({
      ...row,
      report_count: reportCounts.get(row.id) || 0,
      attempt_count: attemptCounts.get(row.id) || 0,
      flashcard_review_count: reviewCounts.get(row.id) || 0,
      active_user_count: activeUsersByStudySet.get(row.id)?.size || 0,
      processing_duration_ms: Number(row.metadata?.processingDurationMs || 0) || null,
      processing_stage_durations_ms: row.metadata?.processingStageDurationsMs || null,
      credit_consumed: Boolean(row.metadata?.creditConsumed),
      estimated_cost_unit: row.metadata?.estimatedCostUnit || null,
      user_email: row.user_id ? emailMap.get(row.user_id) || null : null
    }))
  };
}

function isMissingCostTrackingColumnError(error) {
  const message = String(error?.message || "").toLowerCase();
  return (
    message.includes("estimated_cost_usd") ||
    message.includes("estimated_input_cost_usd") ||
    message.includes("estimated_output_cost_usd") ||
    message.includes("estimated_cached_input_cost_usd") ||
    message.includes("pricing_status") ||
    message.includes("pricing_version") ||
    message.includes("cached_input_tokens") ||
    message.includes("reasoning_tokens") ||
    message.includes("total_tokens")
  );
}

function parseNumberOrNull(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function sumUsd(values) {
  return Number(
    values
      .reduce((total, value) => total + (parseNumberOrNull(value) || 0), 0)
      .toFixed(8)
  );
}

function formatPercentValue(part, total) {
  if (!total) {
    return 0;
  }

  return Number(((part / total) * 100).toFixed(1));
}

function buildOpenAICostSnapshot(row) {
  const fallbackEstimate = estimateOpenAIRequestCost({
    model: row.model,
    usage: row.usage || {},
    operation: row.operation
  });
  const storedCost = parseNumberOrNull(row.estimated_cost_usd);
  const hasStoredEstimate = storedCost !== null;
  const storedInputCost = parseNumberOrNull(row.estimated_input_cost_usd);
  const storedOutputCost = parseNumberOrNull(row.estimated_output_cost_usd);
  const storedCachedInputCost = parseNumberOrNull(row.estimated_cached_input_cost_usd);

  return {
    cost_estimate_usd: hasStoredEstimate ? storedCost : fallbackEstimate.estimatedCostUsd,
    cost_input_usd: hasStoredEstimate ? storedInputCost : fallbackEstimate.estimatedInputCostUsd,
    cost_output_usd: hasStoredEstimate ? storedOutputCost : fallbackEstimate.estimatedOutputCostUsd,
    cost_cached_input_usd: hasStoredEstimate
      ? storedCachedInputCost
      : fallbackEstimate.estimatedCachedInputCostUsd,
    cost_pricing_status: hasStoredEstimate
      ? row.pricing_status || "estimated"
      : fallbackEstimate.pricingStatus,
    cost_pricing_version: hasStoredEstimate
      ? row.pricing_version || OPENAI_PRICING_VERSION
      : fallbackEstimate.pricingVersion,
    cost_origin: hasStoredEstimate ? "stored" : "runtime_fallback",
    canonical_model: fallbackEstimate.canonicalModel || null,
    input_tokens_normalized:
      parseNumberOrNull(row.input_tokens) ?? fallbackEstimate.inputTokens ?? 0,
    output_tokens_normalized:
      parseNumberOrNull(row.output_tokens) ?? fallbackEstimate.outputTokens ?? 0,
    cached_input_tokens_normalized:
      parseNumberOrNull(row.cached_input_tokens) ?? fallbackEstimate.cachedInputTokens ?? 0,
    reasoning_tokens_normalized:
      parseNumberOrNull(row.reasoning_tokens) ?? fallbackEstimate.reasoningTokens ?? 0,
    total_tokens_normalized:
      parseNumberOrNull(row.total_tokens) ?? fallbackEstimate.totalTokens ?? 0
  };
}

function aggregateOpenAICostRows(rows) {
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const relevantRows = rows.filter((row) => {
    const createdAt = Date.parse(row.created_at || "");
    return Number.isFinite(createdAt) && createdAt >= thirtyDaysAgo;
  });
  const rowCost = (row) => parseNumberOrNull(row.cost_estimate_usd) || 0;
  const jobIds = new Set(relevantRows.map((row) => row.job_id).filter(Boolean));
  const failedRows = relevantRows.filter(
    (row) => row.status === "failed" || row.job_status === "failed"
  );
  const pdfFallbackRows = relevantRows.filter((row) =>
    ["pdf_fallback_extract", "pdf_batch_extract", "pdf_file_upload", "pdf_file_delete"].includes(row.request_scope)
  );
  const strongModelRows = relevantRows.filter((row) =>
    ["gpt-5.4", "gpt-5.5"].includes(row.canonical_model || row.model)
  );
  const highReasoningRows = relevantRows.filter((row) =>
    ["high", "xhigh"].includes(String(row.reasoning_effort || "").toLowerCase())
  );
  const pricingMissingRows = relevantRows.filter((row) => row.cost_pricing_status === "pricing_missing");
  const runtimeFallbackRows = relevantRows.filter((row) => row.cost_origin === "runtime_fallback");

  function buildWindowSummary(label, durationMs) {
    const cutoff = Date.now() - durationMs;
    const windowRows = relevantRows.filter((row) => Date.parse(row.created_at || "") >= cutoff);
    const costKnownRows = windowRows.filter((row) => row.cost_pricing_status !== "pricing_missing");
    const totalCostUsd = sumUsd(costKnownRows.map((row) => row.cost_estimate_usd));
    const failedCostUsd = sumUsd(
      costKnownRows
        .filter((row) => row.status === "failed" || row.job_status === "failed")
        .map((row) => row.cost_estimate_usd)
    );
    const windowJobIds = new Set(windowRows.map((row) => row.job_id).filter(Boolean));
    const requestCount = windowRows.length;
    const costableRequestCount = costKnownRows.length;

    return {
      label,
      requestCount,
      costableRequestCount,
      jobCount: windowJobIds.size,
      totalCostUsd,
      averageCostPerRequestUsd: costableRequestCount
        ? Number((totalCostUsd / costableRequestCount).toFixed(6))
        : 0,
      averageCostPerJobUsd: windowJobIds.size
        ? Number((totalCostUsd / windowJobIds.size).toFixed(6))
        : 0,
      pricingMissingCount: windowRows.filter((row) => row.cost_pricing_status === "pricing_missing")
        .length,
      runtimeFallbackCount: windowRows.filter((row) => row.cost_origin === "runtime_fallback").length,
      failedCostUsd,
      failedCostRatePercent: formatPercentValue(failedCostUsd, totalCostUsd)
    };
  }

  function buildBreakdown(rowsToAggregate, getKey, getLabel) {
    const map = new Map();

    for (const row of rowsToAggregate) {
      const key = getKey(row);
      if (!key) {
        continue;
      }

      const current = map.get(key) || {
        key,
        label: getLabel(row),
        totalCostUsd: 0,
        requestCount: 0,
        failedCostUsd: 0
      };

      const currentCost = rowCost(row);
      current.totalCostUsd += currentCost;
      current.requestCount += 1;

      if (row.status === "failed" || row.job_status === "failed") {
        current.failedCostUsd += currentCost;
      }

      map.set(key, current);
    }

    return Array.from(map.values())
      .map((entry) => ({
        ...entry,
        totalCostUsd: Number(entry.totalCostUsd.toFixed(8)),
        failedCostUsd: Number(entry.failedCostUsd.toFixed(8)),
        failedCostRatePercent: formatPercentValue(entry.failedCostUsd, entry.totalCostUsd),
        averageCostPerRequestUsd: entry.requestCount
          ? Number((entry.totalCostUsd / entry.requestCount).toFixed(6))
          : 0
      }))
      .sort((left, right) => right.totalCostUsd - left.totalCostUsd);
  }

  const topModels = buildBreakdown(
    relevantRows.filter((row) => row.cost_pricing_status !== "pricing_missing"),
    (row) => row.canonical_model || row.model || "unknown_model",
    (row) => row.canonical_model || row.model || "Model necunoscut"
  ).slice(0, 8);
  const topScopes = buildBreakdown(
    relevantRows.filter((row) => row.cost_pricing_status !== "pricing_missing"),
    (row) => row.request_scope || "unknown_scope",
    (row) => row.request_scope || "Scope necunoscut"
  ).slice(0, 8);
  const topUsers = buildBreakdown(
    relevantRows.filter((row) => row.cost_pricing_status !== "pricing_missing"),
    (row) => row.user_id || "anonymous",
    (row) => row.user_email || row.user_id || "Necunoscut"
  ).slice(0, 8);

  const topRequests = relevantRows
    .filter((row) => row.cost_pricing_status !== "pricing_missing")
    .sort((left, right) => rowCost(right) - rowCost(left))
    .slice(0, 8)
    .map((row) => ({
      id: row.id,
      created_at: row.created_at,
      request_scope: row.request_scope,
      operation: row.operation,
      model: row.model,
      canonical_model: row.canonical_model,
      user_email: row.user_email || row.user_id || "Necunoscut",
      cost_estimate_usd: row.cost_estimate_usd,
      status: row.status,
      job_status: row.job_status,
      reasoning_effort: row.reasoning_effort,
      duration_ms: row.duration_ms
    }));

  const topJobs = buildBreakdown(
    relevantRows.filter((row) => row.job_id && row.cost_pricing_status !== "pricing_missing"),
    (row) => row.job_id,
    (row) => row.job_subject_label || row.job_source_filename || row.job_id
  )
    .slice(0, 8)
    .map((entry) => {
      const latestJobRow = relevantRows.find((row) => row.job_id === entry.key);
      return {
        ...entry,
        job_id: entry.key,
        job_status: latestJobRow?.job_status || null,
        job_stage: latestJobRow?.job_stage || null,
        job_processing_mode: latestJobRow?.job_processing_mode || null
      };
    });

  const trendByDay = Array.from(
    relevantRows.reduce((map, row) => {
      if (row.cost_pricing_status === "pricing_missing") {
        return map;
      }

      const dateKey = new Intl.DateTimeFormat("en-CA", {
        timeZone: "UTC",
        year: "numeric",
        month: "2-digit",
        day: "2-digit"
      }).format(new Date(row.created_at));
      const current = map.get(dateKey) || {
        date: dateKey,
        totalCostUsd: 0,
        requestCount: 0
      };
      current.totalCostUsd += rowCost(row);
      current.requestCount += 1;
      map.set(dateKey, current);
      return map;
    }, new Map()).values()
  )
    .map((entry) => ({
      ...entry,
      totalCostUsd: Number(entry.totalCostUsd.toFixed(8))
    }))
    .sort((left, right) => left.date.localeCompare(right.date));

  const totalCostUsd = sumUsd(relevantRows.map((row) => row.cost_estimate_usd));
  const failedCostUsd = sumUsd(failedRows.map((row) => row.cost_estimate_usd));
  const pdfFallbackCostUsd = sumUsd(pdfFallbackRows.map((row) => row.cost_estimate_usd));
  const strongModelCostUsd = sumUsd(strongModelRows.map((row) => row.cost_estimate_usd));
  const highReasoningCostUsd = sumUsd(highReasoningRows.map((row) => row.cost_estimate_usd));
  const recommendations = [];

  if (formatPercentValue(pdfFallbackCostUsd, totalCostUsd) >= 25) {
    recommendations.push(
      "PDF fallback consuma o parte vizibila din cost. Merita urmarit cate joburi ajung in fallback fata de traseul principal."
    );
  }

  if (formatPercentValue(highReasoningCostUsd, totalCostUsd) >= 20) {
    recommendations.push(
      "Reasoning high sau xhigh ridica semnificativ costul. Verifica daca toate requesturile respective chiar au nevoie de acel nivel."
    );
  }

  if (formatPercentValue(failedCostUsd, totalCostUsd) >= 15) {
    recommendations.push(
      "O parte importanta din cost merge in requesturi sau joburi care esueaza. Aici exista cel mai clar potential de optimizare."
    );
  }

  if (pricingMissingRows.length) {
    recommendations.push(
      "Exista requesturi fara pricing map. Adauga modelele noi in registry ca sa nu pierzi vizibilitatea pe cost."
    );
  }

  if (formatPercentValue(strongModelCostUsd, totalCostUsd) >= 35) {
    recommendations.push(
      "Modelele mai puternice consuma o pondere mare din costul total. Compara cu mini unde calitatea permite."
    );
  }

  return {
    meta: {
      pricingVersion: OPENAI_PRICING_VERSION,
      pricingUpdatedAt: OPENAI_PRICING_UPDATED_AT,
      pricingSourceUrl: OPENAI_PRICING_SOURCE_URL,
      rowCount: rows.length,
      relevantRowCount: relevantRows.length,
      totalJobCount: jobIds.size,
      storedEstimateCount: relevantRows.filter((row) => row.cost_origin === "stored").length,
      runtimeFallbackCount: runtimeFallbackRows.length,
      pricingMissingCount: pricingMissingRows.length
    },
    overview: {
      last24h: buildWindowSummary("24h", 24 * 60 * 60 * 1000),
      last7d: buildWindowSummary("7 zile", 7 * 24 * 60 * 60 * 1000),
      last30d: buildWindowSummary("30 zile", 30 * 24 * 60 * 60 * 1000)
    },
    diagnostics: {
      totalCostUsd,
      failedCostUsd,
      failedCostRatePercent: formatPercentValue(failedCostUsd, totalCostUsd),
      pdfFallbackCostUsd,
      pdfFallbackCostRatePercent: formatPercentValue(pdfFallbackCostUsd, totalCostUsd),
      strongModelCostUsd,
      strongModelCostRatePercent: formatPercentValue(strongModelCostUsd, totalCostUsd),
      highReasoningCostUsd,
      highReasoningCostRatePercent: formatPercentValue(highReasoningCostUsd, totalCostUsd)
    },
    breakdowns: {
      models: topModels,
      scopes: topScopes,
      users: topUsers,
      requests: topRequests,
      jobs: topJobs
    },
    trendByDay,
    recommendations
  };
}

export async function getAdminOpenAIRequestLogs(limit = 1000) {
  const admin = createAdminClient();
  let data = null;
  let costTrackingWarning = null;

  let queryResult = await admin
    .from("openai_request_logs")
    .select(OPENAI_LOGS_COST_SELECT)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (queryResult.error && isMissingCostTrackingColumnError(queryResult.error)) {
    costTrackingWarning =
      "Trackingul de costuri ruleaza in mod compatibil, dar migrarea de costuri 0020 nu este aplicata inca. Costurile vechi sunt estimate la citire, nu salvate istoric.";
    queryResult = await admin
      .from("openai_request_logs")
      .select(OPENAI_LOGS_BASE_SELECT)
      .order("created_at", { ascending: false })
      .limit(limit);
  }

  if (queryResult.error) {
    throw queryResult.error;
  }

  data = queryResult.data;
  const rows = data || [];
  const userIds = Array.from(new Set(rows.map((row) => row.user_id).filter(Boolean)));
  const jobIds = Array.from(new Set(rows.map((row) => row.job_id).filter(Boolean)));
  const emailMap = await getProfileEmailMap(userIds);
  let jobMap = new Map();
  let chunkSummaryMap = new Map();

  if (jobIds.length) {
    const { data: jobs, error: jobsError } = await admin
      .from("ai_generation_jobs")
      .select("id, status, stage, progress_percent, error_message, status_detail, metadata")
      .in("id", jobIds);

    if (jobsError) {
      throw jobsError;
    }

    jobMap = new Map(
      (jobs || []).map((job) => [
        job.id,
        {
          status: job.status || null,
          stage: job.stage || null,
          progress_percent:
            typeof job.progress_percent === "number" ? job.progress_percent : null,
          error_message: job.error_message || null,
          status_detail: job.status_detail || null,
          processing_mode: job.metadata?.processingMode || null,
          extraction_source: job.metadata?.extractionSource || null,
          final_failure_reason: job.metadata?.finalFailureReason || null,
          last_failure_context: job.metadata?.lastFailureContext || null,
          consolidation_summary: job.metadata?.consolidationSummary || null,
          consolidation_diagnostics: job.metadata?.consolidationDiagnostics || null,
          coverage_percent:
            Number(job.metadata?.consolidationDiagnostics?.coveragePercent || 0) || 0,
          coverage_target_count:
            Number(
              job.metadata?.consolidationDiagnostics?.coverageTargetCount ||
                job.metadata?.consolidationDiagnostics?.publishableThreshold ||
                0
            ) || 0,
          extraction_attempts: Array.isArray(job.metadata?.consolidationDiagnostics?.extractionAttempts)
            ? job.metadata.consolidationDiagnostics.extractionAttempts
            : [],
          subject_label:
            job.metadata?.subjectLabel || job.metadata?.subjectName || null,
          source_filename:
            job.metadata?.sourceFilename || job.metadata?.lastKnownSourceFilename || null
        }
      ])
    );

    const { data: chunkRows, error: chunksError } = await admin
      .from("ai_generation_job_chunks")
      .select("job_id, status, extracted_items_count")
      .in("job_id", jobIds);

    if (chunksError) {
      throw chunksError;
    }

    for (const chunk of chunkRows || []) {
      const current = chunkSummaryMap.get(chunk.job_id) || {
        successful_chunk_count: 0,
        successful_chunk_item_count: 0
      };

      if (chunk.status === "succeeded") {
        current.successful_chunk_count += 1;
        current.successful_chunk_item_count += Number(chunk.extracted_items_count || 0) || 0;
      }

      chunkSummaryMap.set(chunk.job_id, current);
    }
  }

  const enrichedRows = rows.map((row) => ({
    ...row,
    user_email: row.user_id ? emailMap.get(row.user_id) || null : null,
    job_status: row.job_id ? jobMap.get(row.job_id)?.status || null : null,
    job_stage: row.job_id ? jobMap.get(row.job_id)?.stage || null : null,
    job_progress_percent:
      row.job_id ? jobMap.get(row.job_id)?.progress_percent ?? null : null,
    job_error_message: row.job_id ? jobMap.get(row.job_id)?.error_message || null : null,
    job_status_detail: row.job_id ? jobMap.get(row.job_id)?.status_detail || null : null,
    job_processing_mode: row.job_id ? jobMap.get(row.job_id)?.processing_mode || null : null,
    job_extraction_source: row.job_id ? jobMap.get(row.job_id)?.extraction_source || null : null,
    job_final_failure_reason:
      row.job_id ? jobMap.get(row.job_id)?.final_failure_reason || null : null,
    job_last_failure_context:
      row.job_id ? jobMap.get(row.job_id)?.last_failure_context || null : null,
    job_consolidation_summary:
      row.job_id ? jobMap.get(row.job_id)?.consolidation_summary || null : null,
    job_consolidation_diagnostics:
      row.job_id ? jobMap.get(row.job_id)?.consolidation_diagnostics || null : null,
    job_coverage_percent: row.job_id ? jobMap.get(row.job_id)?.coverage_percent ?? null : null,
    job_coverage_target_count:
      row.job_id ? jobMap.get(row.job_id)?.coverage_target_count ?? null : null,
    job_extraction_attempts: row.job_id ? jobMap.get(row.job_id)?.extraction_attempts || [] : [],
    job_successful_chunk_count:
      row.job_id ? chunkSummaryMap.get(row.job_id)?.successful_chunk_count ?? null : null,
    job_successful_chunk_item_count:
      row.job_id ? chunkSummaryMap.get(row.job_id)?.successful_chunk_item_count ?? null : null,
    job_subject_label: row.job_id ? jobMap.get(row.job_id)?.subject_label || null : null,
    job_source_filename: row.job_id ? jobMap.get(row.job_id)?.source_filename || null : null,
    ...buildOpenAICostSnapshot(row)
  }));

  return {
    rows: enrichedRows,
    costDashboard: aggregateOpenAICostRows(enrichedRows),
    warning: costTrackingWarning
  };
}

export async function getAdminFailedUploadsOverview(limit = 200) {
  const admin = createAdminClient();
  const [failedJobsResult, failedSourcesResult] = await Promise.all([
    admin
      .from("ai_generation_jobs")
      .select(
        "id, user_id, source_document_id, status, stage, error_message, status_detail, metadata, created_at, completed_at"
      )
      .eq("job_kind", "question_bank_extract")
      .eq("status", "failed")
      .order("created_at", { ascending: false })
      .limit(limit),
    admin
      .from("ai_source_documents")
      .select(
        "id, user_id, source_kind, storage_bucket, storage_path, original_filename, mime_type, size_bytes, extraction_status, extraction_error, created_at, updated_at"
      )
      .in("extraction_status", ["failed", "rejected"])
      .order("created_at", { ascending: false })
      .limit(limit)
  ]);

  if (failedJobsResult.error) {
    throw failedJobsResult.error;
  }

  if (failedSourcesResult.error) {
    throw failedSourcesResult.error;
  }

  const failedJobs = failedJobsResult.data || [];
  const failedSources = failedSourcesResult.data || [];
  const sourceDocumentIds = Array.from(
    new Set(failedJobs.map((row) => row.source_document_id).filter(Boolean))
  );
  const userIds = Array.from(
    new Set(
      [...failedJobs, ...failedSources]
        .map((row) => row.user_id)
        .filter(Boolean)
    )
  );
  const emailMap = await getProfileEmailMap(userIds);

  let sourceMap = new Map();
  if (sourceDocumentIds.length) {
    const { data: linkedSources, error: linkedSourcesError } = await admin
      .from("ai_source_documents")
      .select(
        "id, user_id, source_kind, storage_bucket, storage_path, original_filename, mime_type, size_bytes, extraction_status, extraction_error, created_at, updated_at"
      )
      .in("id", sourceDocumentIds);

    if (linkedSourcesError) {
      throw linkedSourcesError;
    }

    sourceMap = new Map((linkedSources || []).map((row) => [row.id, row]));
  }

  const failedJobSourceIds = new Set(
    failedJobs.map((row) => row.source_document_id).filter(Boolean)
  );

  const jobRows = failedJobs.map((job) => {
    const source = job.source_document_id ? sourceMap.get(job.source_document_id) || null : null;
    const metadata = job.metadata || {};
    const fileAvailable = Boolean(source?.storage_bucket && source?.storage_path);

    return {
      id: `job:${job.id}`,
      entry_type: "job_failed",
      created_at: job.created_at || job.completed_at || null,
      user_id: job.user_id,
      user_email: job.user_id ? emailMap.get(job.user_id) || null : null,
      document_id: source?.id || job.source_document_id || null,
      filename:
        source?.original_filename ||
        metadata?.sourceFilename ||
        metadata?.lastKnownSourceFilename ||
        null,
      source_kind: source?.source_kind || null,
      mime_type: source?.mime_type || null,
      size_bytes: source?.size_bytes || null,
      job_id: job.id,
      job_status: job.status || null,
      job_stage: job.stage || null,
      user_message: job.error_message || null,
      technical_detail: job.status_detail || null,
      failure_reason: metadata?.finalFailureReason || null,
      failure_context: metadata?.lastFailureContext || null,
      subject_label: metadata?.subjectLabel || metadata?.subjectName || null,
      extraction_status: source?.extraction_status || null,
      extraction_error: source?.extraction_error || null,
      file_available: fileAvailable,
      download_path: fileAvailable && source?.id
        ? `/api/admin/ai-source-documents/${source.id}/download`
        : null
    };
  });

  const sourceOnlyRows = failedSources
    .filter((source) => !failedJobSourceIds.has(source.id))
    .map((source) => {
      const fileAvailable = Boolean(source.storage_bucket && source.storage_path);

      return {
        id: `source:${source.id}`,
        entry_type: "source_failed",
        created_at: source.created_at || source.updated_at || null,
        user_id: source.user_id,
        user_email: source.user_id ? emailMap.get(source.user_id) || null : null,
        document_id: source.id,
        filename: source.original_filename || null,
        source_kind: source.source_kind || null,
        mime_type: source.mime_type || null,
        size_bytes: source.size_bytes || null,
        job_id: null,
        job_status: null,
        job_stage: null,
        user_message: source.extraction_error || null,
        technical_detail: source.extraction_error || null,
        failure_reason: source.extraction_status || null,
        failure_context: null,
        subject_label: null,
        extraction_status: source.extraction_status || null,
        extraction_error: source.extraction_error || null,
        file_available: fileAvailable,
        download_path: fileAvailable
          ? `/api/admin/ai-source-documents/${source.id}/download`
          : null
      };
    });

  return [...jobRows, ...sourceOnlyRows]
    .sort((left, right) => {
      const leftTime = left.created_at ? Date.parse(left.created_at) : 0;
      const rightTime = right.created_at ? Date.parse(right.created_at) : 0;
      return rightTime - leftTime;
    })
    .slice(0, limit);
}

function buildCommunityLabel(user) {
  const parts = [user.institution_name, user.program_unit_name, user.cohort_label].filter(Boolean);
  return parts.length ? parts.join(" > ") : null;
}

export async function getAdminUsersOverview() {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("profiles")
    .select(
      `
        id,
        email,
        full_name,
        user_type,
        onboarding_completed,
        onboarding_completed_at,
        created_at,
        primary_membership_id,
        memberships:primary_membership_id (
          id,
          status,
          institution_id,
          program_unit_id,
          cohort_id,
          institutions:institution_id (
            id,
            name
          ),
          academic_units:program_unit_id (
            id,
            name
          ),
          cohorts:cohort_id (
            id,
            label
          )
        )
      `
    )
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) {
    throw error;
  }

  return (data || []).map((row) => {
    const membership = Array.isArray(row.memberships) ? row.memberships[0] : row.memberships;
    const institution = Array.isArray(membership?.institutions)
      ? membership.institutions[0]
      : membership?.institutions;
    const programUnit = Array.isArray(membership?.academic_units)
      ? membership.academic_units[0]
      : membership?.academic_units;
    const cohort = Array.isArray(membership?.cohorts) ? membership.cohorts[0] : membership?.cohorts;

    const user = {
      id: row.id,
      email: row.email || null,
      full_name: row.full_name || null,
      user_type: row.user_type || null,
      onboarding_completed: Boolean(row.onboarding_completed),
      onboarding_completed_at: row.onboarding_completed_at || null,
      created_at: row.created_at || null,
      membership_status: membership?.status || null,
      institution_name: institution?.name || null,
      program_unit_name: programUnit?.name || null,
      cohort_label: cohort?.label || null
    };

    return {
      ...user,
      community_label: buildCommunityLabel(user)
    };
  });
}

export async function deleteAdminUserForTesting({ targetUserId, adminUserId }) {
  if (!targetUserId || !adminUserId) {
    return { ok: false, reason: "missing_user" };
  }

  if (targetUserId === adminUserId) {
    return { ok: false, reason: "cannot_delete_self" };
  }

  const admin = createAdminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id, email")
    .eq("id", targetUserId)
    .maybeSingle();

  if (profileError) {
    throw profileError;
  }

  if (!profile?.id) {
    return { ok: false, reason: "not_found" };
  }

  const { error: deleteError } = await admin.auth.admin.deleteUser(targetUserId);

  if (deleteError) {
    throw deleteError;
  }

  return {
    ok: true,
    deletedUserId: targetUserId,
    deletedEmail: profile.email || null
  };
}

export async function getAdminSubjectsOverview() {
  const admin = createAdminClient();

  const [subjectsResult, allocationsResult] = await Promise.all([
    admin
      .from("subjects")
      .select("id, title, questions_file, source, created_by, created_at")
      .order("title", { ascending: true })
      .limit(250),
    admin
      .from("subject_allocations")
      .select("subject_id, user_type")
      .limit(1000)
  ]);

  if (subjectsResult.error) {
    throw subjectsResult.error;
  }

  if (allocationsResult.error) {
    throw allocationsResult.error;
  }

  const subjects = subjectsResult.data || [];
  const allocations = allocationsResult.data || [];
  const createdByIds = Array.from(
    new Set(subjects.map((subject) => subject.created_by).filter(Boolean))
  );
  const creatorMap = await getProfileEmailMap(createdByIds);
  const allocationMap = new Map();

  for (const allocation of allocations) {
    const current = allocationMap.get(allocation.subject_id) || {
      count: 0,
      hasStudent: false,
      hasElev: false
    };

    current.count += 1;
    if (allocation.user_type === "student") {
      current.hasStudent = true;
    }
    if (allocation.user_type === "elev") {
      current.hasElev = true;
    }
    allocationMap.set(allocation.subject_id, current);
  }

  const rows = subjects.map((subject) => {
    const allocationInfo = allocationMap.get(subject.id) || {
      count: 0,
      hasStudent: false,
      hasElev: false
    };
    const contexts = [];

    if (allocationInfo.hasStudent) {
      contexts.push("student");
    }
    if (allocationInfo.hasElev) {
      contexts.push("elev");
    }

    return {
      id: subject.id,
      title: subject.title,
      questions_file: subject.questions_file || null,
      source: subject.source,
      created_at: subject.created_at || null,
      created_by_email: subject.created_by ? creatorMap.get(subject.created_by) || null : null,
      allocation_count: allocationInfo.count,
      contexts
    };
  });

  return {
    totalSubjects: rows.length,
    totalAllocations: allocations.length,
    rows
  };
}

export async function getAdminAcademicStructureOverview() {
  const admin = createAdminClient();

  const [institutionsResult, unitsResult, cohortsResult, membershipsResult] = await Promise.all([
    admin
      .from("institutions")
      .select("id, institution_type, name, city, county, source, created_at")
      .order("name", { ascending: true })
      .limit(250),
    admin
      .from("academic_units")
      .select("id, institution_id, parent_unit_id, unit_type, name, source, created_at")
      .order("name", { ascending: true })
      .limit(1000),
    admin
      .from("cohorts")
      .select("id, institution_id, program_unit_id, cohort_type, label")
      .limit(1000),
    admin
      .from("memberships")
      .select("id, institution_id, program_unit_id, status")
      .limit(2000)
  ]);

  if (institutionsResult.error) {
    throw institutionsResult.error;
  }
  if (unitsResult.error) {
    throw unitsResult.error;
  }
  if (cohortsResult.error) {
    throw cohortsResult.error;
  }
  if (membershipsResult.error) {
    throw membershipsResult.error;
  }

  const institutions = institutionsResult.data || [];
  const units = unitsResult.data || [];
  const cohorts = cohortsResult.data || [];
  const memberships = membershipsResult.data || [];

  const faculties = units.filter((unit) => unit.unit_type === "faculty");
  const programs = units.filter((unit) => unit.unit_type === "program");

  const institutionRows = institutions.map((institution) => {
    const institutionFaculties = faculties.filter((faculty) => faculty.institution_id === institution.id);
    const institutionCohorts = cohorts.filter((cohort) => cohort.institution_id === institution.id);
    const institutionMemberships = memberships.filter(
      (membership) => membership.institution_id === institution.id
    );

    return {
      id: institution.id,
      name: institution.name,
      type: institution.institution_type,
      city: institution.city || institution.county || "-",
      source: institution.source,
      created_at: institution.created_at || null,
      faculty_count: institutionFaculties.length,
      cohort_count: institutionCohorts.length,
      membership_count: institutionMemberships.length
    };
  });

  const facultyRows = faculties.map((faculty) => {
    const childPrograms = programs.filter((program) => program.parent_unit_id === faculty.id);
    const childProgramIds = new Set(childPrograms.map((program) => program.id));
    const facultyCohorts = cohorts.filter((cohort) => childProgramIds.has(cohort.program_unit_id));
    const facultyMemberships = memberships.filter((membership) =>
      membership.program_unit_id ? childProgramIds.has(membership.program_unit_id) : false
    );
    const institution = institutions.find((item) => item.id === faculty.institution_id);

    return {
      id: faculty.id,
      institution_id: faculty.institution_id,
      name: faculty.name,
      institution_name: institution?.name || "-",
      unit_type: faculty.unit_type,
      source: faculty.source,
      created_at: faculty.created_at || null,
      program_count: childPrograms.length,
      cohort_count: facultyCohorts.length,
      membership_count: facultyMemberships.length
    };
  });

  return {
    counts: {
      institutions: institutions.length,
      faculties: faculties.length,
      programs: programs.length,
      cohorts: cohorts.length
    },
    institutionRows,
    facultyRows
  };
}

export { getAdminFreeAccessOverview, getAdminTestimonialRewardEntries };
