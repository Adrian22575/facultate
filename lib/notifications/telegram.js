import "server-only";

import {
  getTelegramNotificationEnvStatus,
  hasSupabaseServiceEnv
} from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

const TELEGRAM_SEND_TIMEOUT_MS = 4000;
const TELEGRAM_MESSAGE_LIMIT = 3900;
const INTERNAL_LINK_BASE = (process.env.NEXT_PUBLIC_SITE_URL || "").replace(/\/$/, "");

function logTelegramSkip(eventType, reason, details = {}) {
  console.warn("telegram_notification_skipped", {
    eventType,
    reason,
    ...details
  });
}

function getTelegramConfig(eventType = "unknown") {
  const envStatus = getTelegramNotificationEnvStatus();

  if (envStatus.notificationsDisabled) {
    logTelegramSkip(eventType, "telegram_notifications_disabled");
    return null;
  }

  const botToken = process.env.TELEGRAM_BOT_TOKEN?.trim();
  const chatId = process.env.TELEGRAM_ADMIN_CHAT_ID?.trim();

  if (!botToken || !chatId) {
    logTelegramSkip(eventType, "telegram_env_missing", {
      botTokenPresent: envStatus.botTokenPresent,
      chatIdPresent: envStatus.chatIdPresent
    });
    return null;
  }

  return { botToken, chatId };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function truncate(value, maxLength = 700) {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  if (text.length <= maxLength) {
    return text;
  }

  return `${text.slice(0, maxLength - 3)}...`;
}

function sanitizeMetadataValue(value, depth = 0) {
  if (depth > 4) {
    return "[truncated]";
  }

  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "string") {
    return truncate(value, 1000);
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 20).map((item) => sanitizeMetadataValue(item, depth + 1));
  }

  if (typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .slice(0, 30)
        .map(([key, item]) => [key, sanitizeMetadataValue(item, depth + 1)])
    );
  }

  return String(value);
}

function sanitizeMetadata(metadata) {
  return sanitizeMetadataValue(metadata || {});
}

function absoluteInternalLink(path) {
  if (!path) {
    return null;
  }

  if (/^https?:\/\//i.test(path)) {
    return path;
  }

  if (!INTERNAL_LINK_BASE) {
    return path;
  }

  return `${INTERNAL_LINK_BASE}${path.startsWith("/") ? path : `/${path}`}`;
}

function formatLine(line) {
  if (!line) {
    return null;
  }

  if (typeof line === "string") {
    const text = truncate(line);
    return text ? escapeHtml(text) : null;
  }

  const value = truncate(line.value);
  if (!value) {
    return null;
  }

  return `- <b>${escapeHtml(line.label)}:</b> ${escapeHtml(value)}`;
}

function formatMessage({ title, lines = [] }) {
  const formattedLines = lines.map(formatLine).filter(Boolean);
  const message = [`<b>${escapeHtml(title)}</b>`, ...formattedLines].join("\n");
  return message.slice(0, TELEGRAM_MESSAGE_LIMIT);
}

async function sendTelegramMessage({ botToken, chatId, text }) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TELEGRAM_SEND_TIMEOUT_MS);

  try {
    const response = await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true
      }),
      signal: controller.signal
    });

    if (!response.ok) {
      const responseText = await response.text().catch(() => "");
      throw new Error(`telegram_send_failed_${response.status}:${truncate(responseText, 300)}`);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function insertPendingNotification(admin, { eventKey, eventType, metadata }) {
  const { data, error } = await admin
    .from("admin_notification_events")
    .insert({
      event_key: eventKey,
      event_type: eventType,
      status: "pending",
      metadata: sanitizeMetadata(metadata)
    })
    .select("id")
    .single();

  if (!error) {
    return data;
  }

  if (error.code === "23505") {
    return null;
  }

  throw error;
}

async function markNotificationSent(admin, id) {
  const { error } = await admin
    .from("admin_notification_events")
    .update({
      status: "sent",
      sent_at: new Date().toISOString(),
      last_error: null
    })
    .eq("id", id);

  if (error) {
    console.error("telegram_notification_mark_sent_failed", error.message);
  }
}

async function markNotificationFailed(admin, id, errorMessage) {
  const { error } = await admin
    .from("admin_notification_events")
    .update({
      status: "failed",
      last_error: truncate(errorMessage, 1000)
    })
    .eq("id", id);

  if (error) {
    console.error("telegram_notification_mark_failed_failed", error.message);
  }
}

async function notifyTelegramAdmin({ eventKey, eventType, title, lines, metadata }) {
  const config = getTelegramConfig(eventType);
  if (!config) {
    return { sent: false, skipped: true };
  }

  if (!hasSupabaseServiceEnv()) {
    logTelegramSkip(eventType, "supabase_service_role_missing");
    return { sent: false, skipped: true };
  }

  let admin;
  let notification;

  try {
    admin = createAdminClient();
    notification = await insertPendingNotification(admin, {
      eventKey,
      eventType,
      metadata
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    console.error("telegram_notification_dedupe_failed", {
      eventType,
      reason:
        code === "42P01" || message.toLowerCase().includes("admin_notification_events")
          ? "admin_notification_events_missing"
          : "admin_notification_events_insert_failed",
      message
    });
    return { sent: false, skipped: true };
  }

  if (!notification) {
    logTelegramSkip(eventType, "duplicate_event", { eventKey });
    return { sent: false, skipped: true, duplicate: true };
  }

  try {
    await sendTelegramMessage({
      ...config,
      text: formatMessage({ title, lines })
    });
    await markNotificationSent(admin, notification.id);
    return { sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    console.error("telegram_notification_send_failed", { eventType, message });
    await markNotificationFailed(admin, notification.id, message);
    return { sent: false, error: message };
  }
}

export async function notifyDictionaryPublished({ term, slug, category, qualityScore, runKey }) {
  return notifyTelegramAdmin({
    eventKey: `dictionary_published:${slug}`,
    eventType: "dictionary_published",
    title: "Termen nou publicat în Dicționar",
    lines: [
      { label: "Termen", value: term },
      { label: "Categorie", value: category },
      { label: "Calitate", value: `${qualityScore}/100` },
      { label: "Pagina", value: absoluteInternalLink(`/dictionar/${slug}`) }
    ],
    metadata: { term, slug, category, qualityScore, runKey }
  });
}

export async function notifyDictionaryGenerationFailed({ runKey, reason }) {
  return notifyTelegramAdmin({
    eventKey: `dictionary_failed:${runKey}`,
    eventType: "dictionary_generation_failed",
    title: "Generarea zilnică pentru Dicționar a eșuat",
    lines: [{ label: "Detaliu", value: reason }],
    metadata: { runKey, reason }
  });
}

export async function notifyEditorialPublished({ article, week, runKey }) {
  return notifyTelegramAdmin({
    eventKey: `editorial_published:${article.slug}`,
    eventType: "editorial_published",
    title: "Articol nou publicat",
    lines: [
      { label: "Titlu", value: article.title },
      { label: "Perioadă", value: `${week.start} – ${week.end}` },
      { label: "Calitate", value: `${article.quality_score}/100` },
      { label: "Pagina", value: absoluteInternalLink(`/articole/${article.slug}`) }
    ],
    metadata: { slug: article.slug, title: article.title, qualityScore: article.quality_score, week, runKey }
  });
}

export async function notifyEditorialDraftReady({ article, week, runKey }) {
  return notifyTelegramAdmin({
    eventKey: `editorial_draft_ready:${article.id}`,
    eventType: "editorial_draft_ready",
    title: "Articol pregătit pentru verificare",
    lines: [
      { label: "Titlu", value: article.title },
      { label: "Perioadă", value: `${week.start} – ${week.end}` },
      { label: "Calitate", value: `${article.quality_score}/100` },
      { label: "Acțiune", value: "Verifică articolul și confirmă publicarea din Admin." },
      { label: "Admin", value: absoluteInternalLink("/admin?section=editorial") }
    ],
    metadata: { id: article.id, slug: article.slug, title: article.title, qualityScore: article.quality_score, week, runKey }
  });
}

export async function notifyEditorialGenerationFailed({ runKey, reason }) {
  return notifyTelegramAdmin({
    eventKey: `editorial_failed:${runKey}`,
    eventType: "editorial_generation_failed",
    title: "Rularea editorială a fost oprită",
    lines: [{ label: "Motiv", value: reason }],
    metadata: { runKey, reason }
  });
}

export async function notifyLinkedInDraftReady({ post, article, mode }) {
  return notifyTelegramAdmin({
    eventKey: `linkedin_draft_ready:${post.id}:${post.generated_at || post.updated_at || "generated"}`,
    eventType: "linkedin_draft_ready",
    title: "Postare LinkedIn pregătită",
    lines: [
      { label: "Articol", value: article.title },
      { label: "Text", value: String(post.edited_text || post.generated_text || "").slice(0, 900) },
      { label: "Caractere", value: String(post.character_count || 0) },
      { label: "Mod", value: mode },
      { label: "Aprobare", value: absoluteInternalLink(`/admin?admin_tab=editorial&linkedin_post=${post.id}#linkedin-distribution`) }
    ],
    metadata: { postId: post.id, articleId: article.id, articleSlug: article.slug, mode, characterCount: post.character_count }
  });
}

export async function notifyLinkedInPublished({ post, article }) {
  return notifyTelegramAdmin({
    eventKey: `linkedin_published:${post.id}`,
    eventType: "linkedin_published",
    title: "Postarea LinkedIn a fost publicată",
    lines: [
      { label: "Articol", value: article.title },
      { label: "Fragment", value: String(post.edited_text || post.generated_text || "").slice(0, 480) },
      { label: "Publicat la", value: post.published_at || new Date().toISOString() },
      { label: "Articol", value: absoluteInternalLink(`/articole/${article.slug}`) },
      { label: "LinkedIn", value: post.linkedin_post_url || null }
    ],
    metadata: { postId: post.id, articleId: article.id, linkedinPostUrn: post.linkedin_post_urn, linkedinPostUrl: post.linkedin_post_url }
  });
}

export async function notifyLinkedInFailed({ postId, article, stage, reason, published = false, reconnect = false }) {
  return notifyTelegramAdmin({
    eventKey: `linkedin_failed:${postId}:${stage}:${String(reason).slice(0, 80)}`,
    eventType: "linkedin_failed",
    title: "Distribuirea LinkedIn necesită atenție",
    lines: [
      { label: "Articol", value: article?.title || "Necunoscut" },
      { label: "Etapă", value: stage },
      { label: "Detaliu", value: reason },
      { label: "Publicată", value: published ? "Da" : "Nu sau neconfirmat" },
      { label: "Reconectare", value: reconnect ? "Da" : "Nu" },
      { label: "Admin", value: absoluteInternalLink(`/admin?admin_tab=editorial&linkedin_post=${postId}#linkedin-distribution`) }
    ],
    metadata: { postId, articleId: article?.id || null, stage, reason, published, reconnect }
  });
}

export async function getAdminNotificationEventsSnapshot(limit = 8) {
  if (!hasSupabaseServiceEnv()) {
    return {
      rows: [],
      warning: "SUPABASE_SERVICE_ROLE_KEY lipseste, deci istoricul notificarilor nu poate fi citit."
    };
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("admin_notification_events")
      .select("event_type, status, last_error, created_at, sent_at")
      .order("created_at", { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return {
      rows: data || [],
      warning: null
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown_error";
    const code = typeof error === "object" && error && "code" in error ? error.code : null;
    const migrationWarning =
      code === "42P01" || message.toLowerCase().includes("admin_notification_events")
        ? "Tabela admin_notification_events lipseste. Ruleaza migrarea 0026_admin_notification_events.sql."
        : `Istoricul notificarilor nu poate fi citit acum: ${message}`;

    console.error("telegram_notification_events_lookup_failed", {
      reason:
        code === "42P01" || message.toLowerCase().includes("admin_notification_events")
          ? "admin_notification_events_missing"
          : "admin_notification_events_lookup_failed",
      message
    });

    return {
      rows: [],
      warning: migrationWarning
    };
  }
}

async function getProfileSummary(userId) {
  if (!userId || !hasSupabaseServiceEnv()) {
    return null;
  }

  try {
    const admin = createAdminClient();
    const { data, error } = await admin
      .from("profiles")
      .select("email, full_name, user_type")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      throw error;
    }

    return data || null;
  } catch (error) {
    console.error("telegram_profile_lookup_failed", {
      message: error instanceof Error ? error.message : "unknown_error"
    });
    return null;
  }
}

function formatAmount(amountTotal, currency) {
  if (typeof amountTotal !== "number") {
    return null;
  }

  return `${(amountTotal / 100).toFixed(2)} ${String(currency || "").toUpperCase()}`;
}

export async function notifyAdminUserCreated({ user, source = "auth" }) {
  if (!user?.id) {
    return;
  }

  const fullName =
    user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.display_name;

  await notifyTelegramAdmin({
    eventKey: `user.created:${user.id}`,
    eventType: "user.created",
    title: "Cont nou creat",
    lines: [
      { label: "Email", value: user.email || "fara email" },
      { label: "Nume", value: fullName || "nespecificat" },
      { label: "Sursa", value: source },
      { label: "User ID", value: user.id },
      { label: "Ora", value: new Date().toISOString() }
    ],
    metadata: {
      userId: user.id,
      email: user.email || null,
      source
    }
  });
}

export async function notifyAdminFeedbackSubmitted({ feedback, user, profile }) {
  if (!feedback?.id) {
    return;
  }

  await notifyTelegramAdmin({
    eventKey: `feedback.created:${feedback.id}`,
    eventType: "feedback.created",
    title: "Feedback nou primit",
    lines: [
      { label: "Tip", value: feedback.feedbackType },
      { label: "Pagina", value: feedback.pagePath },
      { label: "Email", value: user?.email || "fara email" },
      { label: "User type", value: profile?.user_type || "nespecificat" },
      { label: "Mesaj", value: feedback.message },
      { label: "Detalii", value: feedback.optionalDetail || null },
      { label: "Captură", value: feedback.hasScreenshot ? "atașată în Admin" : null }
    ],
    metadata: {
      feedbackId: feedback.id,
      userId: user?.id || null,
      email: user?.email || null,
      feedbackType: feedback.feedbackType,
      pagePath: feedback.pagePath
    }
  });
}

export async function notifyAdminTestimonialReviewSubmitted({ submission, user }) {
  if (!submission?.id) {
    return;
  }

  const adminPath = absoluteInternalLink("/admin?section=testimonials");
  const rewardLabel =
    submission.reward_type === "premium_24h" ? "Acces gratuit 24h" : "O incarcare gratuita";

  await notifyTelegramAdmin({
    eventKey: `testimonial.review.submitted:${submission.id}`,
    eventType: "testimonial.review.submitted",
    title: "Review testimonial asteapta aprobare",
    lines: [
      { label: "Email", value: user?.email || submission.user_email || "fara email" },
      { label: "Recompensa ceruta", value: rewardLabel },
      { label: "Testimonial", value: submission.edited_testimonial },
      { label: "Admin", value: adminPath }
    ],
    metadata: {
      testimonialRewardSubmissionId: submission.id,
      userId: submission.user_id || user?.id || null,
      email: user?.email || submission.user_email || null,
      rewardType: submission.reward_type || null
    }
  });
}

export async function notifyAdminPaymentSucceeded({ session, fulfillment }) {
  if (!session?.id || !fulfillment?.applied) {
    return;
  }

  const profile = await getProfileSummary(fulfillment.userId);
  const email =
    session.customer_details?.email || session.customer_email || profile?.email || "fara email";

  await notifyTelegramAdmin({
    eventKey: `stripe.checkout.paid:${session.id}`,
    eventType: "payment.succeeded",
    title: "Plata Stripe reusita",
    lines: [
      { label: "Plan", value: fulfillment.planCode },
      { label: "Familie", value: fulfillment.family },
      { label: "Suma", value: formatAmount(session.amount_total, session.currency) },
      { label: "Email", value: email },
      { label: "User ID", value: fulfillment.userId },
      { label: "Session", value: session.id }
    ],
    metadata: {
      sessionId: session.id,
      paymentIntentId:
        typeof session.payment_intent === "string" ? session.payment_intent : null,
      userId: fulfillment.userId,
      planCode: fulfillment.planCode,
      family: fulfillment.family,
      amountTotal: session.amount_total || null,
      currency: session.currency || null
    }
  });
}

export async function notifyAdminAiSourceFailed({
  sourceDocumentId,
  user,
  sourceFilename,
  examType,
  error
}) {
  if (!sourceDocumentId) {
    return;
  }

  const message = error instanceof Error ? error.message : String(error || "unknown_error");

  await notifyTelegramAdmin({
    eventKey: `ai.source.failed:${sourceDocumentId}`,
    eventType: "ai.source.failed",
    title: "Fisier respins sau esuat",
    lines: [
      { label: "Fisier", value: sourceFilename || "necunoscut" },
      { label: "Tip examen", value: examType || "normal" },
      { label: "Email", value: user?.email || "fara email" },
      { label: "User ID", value: user?.id || null },
      { label: "Eroare", value: message }
    ],
    metadata: {
      sourceDocumentId,
      userId: user?.id || null,
      email: user?.email || null,
      sourceFilename: sourceFilename || null,
      examType: examType || null,
      error: message
    }
  });
}

export async function notifyAdminAiJobTerminal({ job }) {
  if (!job?.id || (job.status !== "succeeded" && job.status !== "failed")) {
    return;
  }

  let sourceDocument = null;
  const profile = await getProfileSummary(job.user_id);

  if (job.source_document_id && hasSupabaseServiceEnv()) {
    try {
      const admin = createAdminClient();
      const { data, error } = await admin
        .from("ai_source_documents")
        .select("original_filename, source_kind")
        .eq("id", job.source_document_id)
        .maybeSingle();

      if (error) {
        throw error;
      }

      sourceDocument = data || null;
    } catch (error) {
      console.error("telegram_ai_source_lookup_failed", {
        message: error instanceof Error ? error.message : "unknown_error"
      });
    }
  }

  const metadata = job.metadata || {};
  const jobPath = absoluteInternalLink(`/materiale/jobs/${job.id}`);
  const reviewPath = job.result_bank_id
    ? absoluteInternalLink(`/materiale/review/${job.result_bank_id}`)
    : null;
  const providerFailureCode =
    metadata.openaiProviderFailureCode ||
    metadata.openaiPdfSingleFileFailureCode ||
    metadata.openaiPdfBatchFailureCode ||
    metadata.lastFailureContext?.code ||
    null;
  const providerFailureMessage =
    metadata.openaiProviderFailureMessage ||
    metadata.openaiPdfSingleFileFailureMessage ||
    metadata.openaiPdfBatchFailureMessage ||
    metadata.lastFailureContext?.message ||
    null;
  const openAIResponseId =
    metadata.openaiPdfSingleFileResponseId ||
    metadata.openaiPdfBatchResponseId ||
    metadata.openaiPdfResponseId ||
    null;
  const openAIFileId =
    metadata.openaiPdfSingleFileId ||
    metadata.openaiPdfBatchFileId ||
    metadata.openaiPdfFileId ||
    null;

  await notifyTelegramAdmin({
    eventKey: `ai.job.terminal:${job.id}:${job.status}`,
    eventType: `ai.job.${job.status}`,
    title: job.status === "succeeded" ? "Fisier procesat cu succes" : "Procesare esuata",
    lines: [
      { label: "Status", value: job.status },
      { label: "Fisier", value: sourceDocument?.original_filename || metadata.sourceFilename },
      { label: "Tip examen", value: metadata.examType || "normal" },
      { label: "Subiect", value: metadata.subjectLabel || "nespecificat" },
      { label: "Email", value: profile?.email || "fara email" },
      { label: "Detaliu", value: job.status_detail || job.error_message || null },
      { label: "Cauza interna", value: metadata.finalFailureReason || null },
      { label: "Cod provider", value: providerFailureCode },
      { label: "Raspuns provider", value: openAIResponseId },
      { label: "Job", value: jobPath },
      { label: "Review", value: reviewPath }
    ],
    metadata: {
      jobId: job.id,
      status: job.status,
      userId: job.user_id || null,
      email: profile?.email || null,
      sourceDocumentId: job.source_document_id || null,
      resultBankId: job.result_bank_id || null,
      sourceFilename: sourceDocument?.original_filename || metadata.sourceFilename || null,
      examType: metadata.examType || null,
      finalFailureReason: metadata.finalFailureReason || null,
      openaiProviderFailureCode: providerFailureCode,
      openaiProviderFailureMessage: providerFailureMessage,
      openaiResponseId: openAIResponseId,
      openaiFileId: openAIFileId
    }
  });
}

export async function notifyAdminAiImportTerminal({ job }) {
  const terminalStatuses = new Set([
    "ready_for_preview",
    "completed",
    "completed_with_warnings",
    "needs_review",
    "failed"
  ]);

  if (!job?.id || !terminalStatuses.has(job.status)) {
    return;
  }

  const profile = await getProfileSummary(job.user_id);
  const metadata = job.metadata || {};
  const isLicentaSet = Boolean(job.licenta_session_id);
  const importPath = absoluteInternalLink(
    isLicentaSet ? `/materiale/licenta/${job.licenta_session_id}?set=${job.id}` : `/materiale/imports/${job.id}`
  );
  const reviewPath = job.result_bank_id ? absoluteInternalLink(`/materiale/review/${job.result_bank_id}`) : null;
  const statusTitle = {
    ready_for_preview: isLicentaSet ? "Set procesat, asteapta verificare" : "Fisier procesat, asteapta verificare",
    completed: isLicentaSet ? "Set salvat in licenta" : "Fisier salvat cu succes",
    completed_with_warnings: isLicentaSet ? "Set salvat cu atentionari" : "Fisier salvat cu atentionari",
    needs_review: isLicentaSet ? "Setul necesita verificare" : "Fisierul necesita verificare",
    failed: isLicentaSet ? "Import set licenta esuat" : "Import esuat"
  };

  await notifyTelegramAdmin({
    eventKey: `ai.import.terminal:${job.id}:${job.status}`,
    eventType: `ai.import.${job.status}`,
    title: statusTitle[job.status] || "Import actualizat",
    lines: [
      { label: "Status", value: job.status },
      { label: "Fisier", value: job.file_name || metadata.sourceFilename || job.title },
      { label: "Mod", value: job.mode || "import" },
      { label: "Set", value: isLicentaSet && job.set_index ? String(job.set_index) : null },
      { label: "Email", value: profile?.email || "fara email" },
      { label: "Intrebari", value: Number.isFinite(job.total_questions) ? String(job.total_questions) : null },
      {
        label: "Cu raspuns",
        value: Number.isFinite(job.questions_with_answers) ? String(job.questions_with_answers) : null
      },
      {
        label: "Fara raspuns",
        value: Number.isFinite(job.questions_missing_answers) ? String(job.questions_missing_answers) : null
      },
      {
        label: "De verificat",
        value: Number.isFinite(job.needs_review_count) ? String(job.needs_review_count) : null
      },
      { label: "Detaliu", value: job.error_message || metadata.finalFailureReason || null },
      { label: isLicentaSet ? "Licenta" : "Import", value: importPath },
      { label: "Review", value: reviewPath }
    ],
    metadata: {
      importJobId: job.id,
      status: job.status,
      userId: job.user_id || null,
      email: profile?.email || null,
      sourceDocumentId: job.source_document_id || null,
      resultBankId: job.result_bank_id || null,
      fileName: job.file_name || null,
      mode: job.mode || null,
      licentaSessionId: job.licenta_session_id || null,
      setIndex: job.set_index || null,
      totalQuestions: job.total_questions || 0,
      questionsWithAnswers: job.questions_with_answers || 0,
      questionsMissingAnswers: job.questions_missing_answers || 0,
      needsReviewCount: job.needs_review_count || 0,
      error: job.error_message || null
    }
  });
}

export async function notifyAdminLicentaSessionFinalized({ session, resultBankId, setCount, questionCount }) {
  if (!session?.id || !session?.user_id || !resultBankId) {
    return;
  }

  const profile = await getProfileSummary(session.user_id);
  const sessionPath = absoluteInternalLink(`/materiale/licenta/${session.id}`);
  const reviewPath = absoluteInternalLink(`/materiale/review/${resultBankId}`);
  const metadata = session.metadata || {};

  await notifyTelegramAdmin({
    eventKey: `ai.licenta.finalized:${session.id}`,
    eventType: "ai.licenta.finalized",
    title: "Licenta finalizata",
    lines: [
      { label: "Email", value: profile?.email || "fara email" },
      { label: "Seturi", value: String(setCount ?? session.completed_set_count ?? session.set_count ?? 0) },
      { label: "Intrebari", value: String(questionCount ?? session.questions_with_answers ?? session.total_questions ?? 0) },
      { label: "Credit consumat", value: session.credit_consumed_at || "da" },
      { label: "Sesiune", value: sessionPath },
      { label: "Review", value: reviewPath }
    ],
    metadata: {
      sessionId: session.id,
      userId: session.user_id,
      email: profile?.email || null,
      resultBankId,
      setCount: setCount ?? session.completed_set_count ?? session.set_count ?? 0,
      questionCount: questionCount ?? session.questions_with_answers ?? session.total_questions ?? 0,
      creditConsumedAt: session.credit_consumed_at || null,
      targetCohortId: metadata.targetCohortId || null,
      targetUnitId: metadata.targetUnitId || null,
      targetInstitutionId: metadata.targetInstitutionId || null
    }
  });
}
