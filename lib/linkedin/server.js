import "server-only";

import { zodTextFormat } from "openai/helpers/zod";

import { createLinkedInPost, LinkedInApiError } from "@/lib/linkedin/client";
import { getLinkedInConfigStatus } from "@/lib/linkedin/config";
import { decryptLinkedInToken } from "@/lib/linkedin/crypto";
import {
  buildArticleEvidence,
  isConnectionUsable,
  linkedInDraftSchema,
  LINKEDIN_MODES,
  LINKEDIN_POST_MAX_CHARACTERS,
  validateLinkedInDraft
} from "@/lib/linkedin/shared";
import { notifyLinkedInDraftReady, notifyLinkedInFailed, notifyLinkedInPublished } from "@/lib/notifications/telegram";
import { runLoggedResponseParse } from "@/lib/openai/logging";
import { getPublicSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

const POST_SELECT = "id, article_id, connection_id, status, generated_payload, generated_text, edited_text, character_count, claims, model, generation_started_at, generated_at, approved_at, approved_by, published_at, linkedin_post_urn, linkedin_post_url, publish_started_at, last_error, attempt_count, notification_sent, created_at, updated_at";
const ARTICLE_SELECT = "id, slug, title, subtitle, summary, key_takeaways, sections, student_implications, conclusion, status, published_at";
const CONNECTION_SELECT = "id, member_subject, member_urn, display_name, profile_picture_url, token_expires_at, scopes, status, last_error, connected_at, disconnected_at, last_published_at, created_at, updated_at";

const DEFAULT_SETTINGS = {
  singleton: true,
  mode: "approval_required",
  notify_telegram: true,
  include_article_image: false,
  fallback_to_text: true,
  model: process.env.OPENAI_EDITORIAL_MODEL?.trim() || "gpt-5.6"
};

function errorCode(error) {
  return error instanceof Error ? error.message.slice(0, 1000) : String(error || "unknown_error").slice(0, 1000);
}

function articleUrl(article) {
  return `${getPublicSiteUrl()}/articole/${article.slug}`;
}

function linkedinPrompt() {
  return [
    "Scrie o postare LinkedIn în limba română pentru profilul profesional al administratorului Nota5Plus.",
    "Profilul se află la intersecția dintre digitalizare, educație, îmbunătățirea proceselor și produse digitale.",
    "Folosește exclusiv articolul furnizat. Nu adăuga date, citate, experiențe personale sau concluzii factuale care nu apar în articol.",
    "Câmpul claims trebuie să conțină 2-6 fragmente factuale copiate exact din articol, fără parafrazare. Aceste fragmente vor fi validate automat.",
    "Începe direct cu o idee concretă. Include două sau trei informații relevante, apoi o interpretare profesională prudentă.",
    "Poți menționa o singură dată perspectiva produselor educaționale construite de administrator, numai dacă legătura este naturală.",
    "Încheie cu o întrebare precisă despre subiect, nu cu «Ce părere aveți?» sau altă întrebare generică.",
    "Folosește între 3 și 5 hashtaguri specifice. Evită clickbaitul, jargonul corporatist, superlativele, formulările teatrale și experiențele inventate.",
    "Nu folosi: «Sunt încântat să vă împărtășesc», «În lumea dinamică de astăzi», «Educația este într-o continuă transformare», «game changer», «revoluționar», «Viitorul este deja aici».",
    `Postarea completă nu poate depăși ${LINKEDIN_POST_MAX_CHARACTERS} de caractere. fullPost trebuie să combine hook, body, articleUrl, closingQuestion și hashtagurile, separate prin linii libere.`
  ].join("\n");
}

export function getLinkedInGenerationPreview(model = DEFAULT_SETTINGS.model) {
  return {
    workflow: "linkedin_editorial_distribution",
    model,
    trigger: "După publicarea unui articol sau la cerere din Admin",
    instructions: linkedinPrompt(),
    input: "Articolul publicat, URL-ul public și identificatorul articolului",
    output: "hook, body, articleUrl, closingQuestion, hashtags, fullPost, characterCount, tone, claims, sourceArticleId",
    validation: "URL exact, articol publicat, 3-5 hashtaguri, maximum 3.000 de caractere și claims copiate din articol",
    publication: "Implicit rămâne în așteptarea aprobării. Publicarea automată rulează numai dacă modul este activat și conexiunea este validă."
  };
}

export async function getLinkedInSettings(admin = createAdminClient()) {
  const { data, error } = await admin.from("linkedin_automation_settings").select("singleton, mode, notify_telegram, include_article_image, fallback_to_text, model, updated_at").eq("singleton", true).maybeSingle();
  if (error) throw error;
  return data || DEFAULT_SETTINGS;
}

export async function getLinkedInAdminOverview() {
  const config = getLinkedInConfigStatus();
  try {
    const admin = createAdminClient();
    const [{ data: settings, error: settingsError }, { data: connections, error: connectionsError }, { data: posts, error: postsError }] = await Promise.all([
      admin.from("linkedin_automation_settings").select("singleton, mode, notify_telegram, include_article_image, fallback_to_text, model, updated_at").eq("singleton", true).maybeSingle(),
      admin.from("linkedin_connections").select(CONNECTION_SELECT).order("connected_at", { ascending: false }).limit(5),
      admin.from("linkedin_editorial_posts").select(`${POST_SELECT}, article:editorial_articles(id, slug, title, status, published_at)`).order("updated_at", { ascending: false }).limit(80)
    ]);
    if (settingsError) throw settingsError;
    if (connectionsError) throw connectionsError;
    if (postsError) throw postsError;
    return {
      config,
      settings: settings || DEFAULT_SETTINGS,
      connection: (connections || []).find((item) => item.status !== "disconnected") || connections?.[0] || null,
      posts: posts || [],
      generationPreview: getLinkedInGenerationPreview(settings?.model || DEFAULT_SETTINGS.model),
      warning: null
    };
  } catch (error) {
    const message = errorCode(error);
    const setupMissing = /linkedin_(?:automation_settings|connections|editorial_posts)|relation .* does not exist/i.test(message);
    return {
      config,
      settings: DEFAULT_SETTINGS,
      connection: null,
      posts: [],
      generationPreview: getLinkedInGenerationPreview(),
      warning: setupMissing ? "Migrarea LinkedIn nu este aplicată încă." : "Starea LinkedIn nu a putut fi încărcată."
    };
  }
}

async function loadPublishedArticle(admin, articleId) {
  const { data, error } = await admin.from("editorial_articles").select(ARTICLE_SELECT).eq("id", articleId).maybeSingle();
  if (error) throw error;
  if (!data) throw new Error("article_not_found");
  if (data.status !== "published") throw new Error("article_not_published");
  return data;
}

async function activeConnection(admin) {
  const { data, error } = await admin.from("linkedin_connections").select(`${CONNECTION_SELECT}, access_token_encrypted`).neq("status", "disconnected").order("connected_at", { ascending: false }).limit(1).maybeSingle();
  if (error) throw error;
  return data || null;
}

async function ensurePost(admin, articleId, connectionId) {
  const { data: existing, error: existingError } = await admin.from("linkedin_editorial_posts").select(POST_SELECT).eq("article_id", articleId).eq("connection_id", connectionId).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;
  const { data, error } = await admin.from("linkedin_editorial_posts").insert({ article_id: articleId, connection_id: connectionId, status: "not_generated" }).select(POST_SELECT).maybeSingle();
  if (!error && data) return data;
  if (error?.code !== "23505") throw error || new Error("linkedin_post_not_created");
  const { data: raced, error: racedError } = await admin.from("linkedin_editorial_posts").select(POST_SELECT).eq("article_id", articleId).eq("connection_id", connectionId).maybeSingle();
  if (racedError || !raced) throw racedError || new Error("linkedin_post_not_created");
  return raced;
}

async function generateDraftPayload({ article, model }) {
  const url = articleUrl(article);
  const response = await runLoggedResponseParse({
    requestScope: "linkedin_editorial_post",
    metadata: { articleId: article.id, articleSlug: article.slug, channel: "linkedin" },
    request: {
      model,
      reasoning: { effort: "medium" },
      input: [
        { role: "developer", content: linkedinPrompt() },
        { role: "user", content: JSON.stringify({ sourceArticleId: article.id, articleUrl: url, article: { title: article.title, subtitle: article.subtitle, summary: article.summary, keyTakeaways: article.key_takeaways, sections: article.sections, studentImplications: article.student_implications, conclusion: article.conclusion } }).slice(0, 60000) }
      ],
      text: { format: zodTextFormat(linkedInDraftSchema, "linkedin_editorial_post") }
    }
  });
  if (!response.output_parsed) throw new Error("linkedin_draft_missing_structured_output");
  const assessment = validateLinkedInDraft(response.output_parsed, { article, articleUrl: url });
  if (!assessment.valid) throw new Error(`linkedin_draft_validation_failed:${assessment.reasons.join(",")}`);
  return assessment.draft;
}

async function markConnectionExpired(admin, connection, reason) {
  await admin.from("linkedin_connections").update({ status: "connection_expired", last_error: reason }).eq("id", connection.id);
}

export async function prepareLinkedInDraft(articleId, { force = false } = {}) {
  const admin = createAdminClient();
  const [article, settings, connection] = await Promise.all([loadPublishedArticle(admin, articleId), getLinkedInSettings(admin), activeConnection(admin)]);
  if (settings.mode === "disabled") return { ok: true, skipped: true, reason: "linkedin_disabled" };
  if (!connection) return { ok: false, skipped: true, reason: "linkedin_not_connected" };
  const post = await ensurePost(admin, article.id, connection.id);
  if (post.status === "published") return { ok: true, skipped: true, reason: "already_published", post };
  if (post.status === "publishing") return { ok: true, skipped: true, reason: "already_publishing", post };
  if (!force && ["draft", "pending_approval", "approved", "publishing"].includes(post.status)) return { ok: true, skipped: true, reason: "already_prepared", post };

  if (!isConnectionUsable(connection)) {
    await markConnectionExpired(admin, connection, "linkedin_connection_expired");
    await admin.from("linkedin_editorial_posts").update({ status: "connection_expired", last_error: "linkedin_connection_expired" }).eq("id", post.id);
    if (settings.notify_telegram) await notifyLinkedInFailed({ postId: post.id, article, stage: "conexiune", reason: "Conexiunea LinkedIn a expirat. Reconectează profilul.", reconnect: true });
    return { ok: false, reason: "linkedin_connection_expired", postId: post.id };
  }

  await admin.from("linkedin_editorial_posts").update({ status: "not_generated", generation_started_at: new Date().toISOString(), generated_payload: {}, generated_text: null, edited_text: null, character_count: 0, claims: [], approved_at: null, approved_by: null, last_error: null }).eq("id", post.id);
  try {
    const draft = await generateDraftPayload({ article, model: settings.model || DEFAULT_SETTINGS.model });
    const nextStatus = settings.mode === "approval_required" ? "pending_approval" : settings.mode === "auto_publish" ? "approved" : "draft";
    const now = new Date().toISOString();
    const { data: saved, error } = await admin.from("linkedin_editorial_posts").update({
      status: nextStatus,
      generated_payload: draft,
      generated_text: draft.fullPost,
      edited_text: draft.fullPost,
      character_count: draft.characterCount,
      claims: draft.claims,
      model: settings.model || DEFAULT_SETTINGS.model,
      generated_at: now,
      generation_started_at: null,
      approved_at: settings.mode === "auto_publish" ? now : null,
      last_error: null
    }).eq("id", post.id).select(POST_SELECT).maybeSingle();
    if (error || !saved) throw error || new Error("linkedin_draft_save_failed");
    if (settings.notify_telegram) await notifyLinkedInDraftReady({ post: saved, article, mode: settings.mode });
    if (settings.mode === "auto_publish") return publishLinkedInPost(saved.id, { admin });
    return { ok: true, post: saved };
  } catch (error) {
    const reason = errorCode(error);
    await admin.from("linkedin_editorial_posts").update({ status: "failed", generation_started_at: null, last_error: reason }).eq("id", post.id);
    if (settings.notify_telegram) await notifyLinkedInFailed({ postId: post.id, article, stage: "generare", reason });
    return { ok: false, reason, postId: post.id };
  }
}

function validateManualText(text, url) {
  const value = String(text || "").trim();
  if (value.length < 120 || value.length > LINKEDIN_POST_MAX_CHARACTERS) throw new Error("linkedin_text_length_invalid");
  if (!value.includes(url)) throw new Error("linkedin_article_url_missing");
  const hashtags = value.match(/#[\p{L}\p{N}_]+/gu) || [];
  if (hashtags.length < 3 || hashtags.length > 5) throw new Error("linkedin_hashtag_count_invalid");
  return value;
}

async function postWithContext(admin, postId) {
  const { data: post, error } = await admin.from("linkedin_editorial_posts").select(`${POST_SELECT}, article:editorial_articles(${ARTICLE_SELECT}), connection:linkedin_connections(${CONNECTION_SELECT}, access_token_encrypted)`).eq("id", postId).maybeSingle();
  if (error) throw error;
  if (!post) throw new Error("linkedin_post_not_found");
  return post;
}

export async function updateLinkedInPostText(postId, text) {
  const admin = createAdminClient();
  const post = await postWithContext(admin, postId);
  if (post.status === "published" || post.status === "publishing") throw new Error("linkedin_post_locked");
  const value = validateManualText(text, articleUrl(post.article));
  const { data, error } = await admin.from("linkedin_editorial_posts").update({ edited_text: value, character_count: value.length, status: post.status === "rejected" ? "draft" : post.status, approved_at: null, approved_by: null, last_error: null }).eq("id", postId).select(POST_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_post_update_failed");
  return data;
}

export async function approveLinkedInPost(postId, userId) {
  const admin = createAdminClient();
  const post = await postWithContext(admin, postId);
  if (!["draft", "pending_approval", "rejected", "failed"].includes(post.status)) throw new Error("linkedin_post_not_approvable");
  validateManualText(post.edited_text || post.generated_text, articleUrl(post.article));
  const { data, error } = await admin.from("linkedin_editorial_posts").update({ status: "approved", approved_at: new Date().toISOString(), approved_by: userId, last_error: null }).eq("id", postId).select(POST_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_post_approval_failed");
  return data;
}

export async function rejectLinkedInPost(postId) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("linkedin_editorial_posts").update({ status: "rejected", approved_at: null, approved_by: null }).eq("id", postId).neq("status", "published").select(POST_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_post_rejection_failed");
  return data;
}

export async function publishLinkedInPost(postId, { admin = createAdminClient() } = {}) {
  let post = await postWithContext(admin, postId);
  if (post.status === "published") return { ok: true, skipped: true, reason: "already_published", post };
  if (post.article?.status !== "published") throw new Error("article_not_published");
  if (!isConnectionUsable(post.connection)) {
    await markConnectionExpired(admin, post.connection, "linkedin_connection_expired");
    await admin.from("linkedin_editorial_posts").update({ status: "connection_expired", last_error: "linkedin_connection_expired" }).eq("id", post.id);
    const settings = await getLinkedInSettings(admin);
    if (settings.notify_telegram) await notifyLinkedInFailed({ postId: post.id, article: post.article, stage: "publicare", reason: "Conexiunea LinkedIn a expirat.", reconnect: true });
    return { ok: false, reason: "linkedin_connection_expired" };
  }
  if (["linkedin_publish_result_unknown", "linkedin_publish_confirmation_missing", "linkedin_publish_confirmation_persistence_failed"].includes(post.last_error)) throw new Error("linkedin_retry_blocked_ambiguous_result");
  const text = validateManualText(post.edited_text || post.generated_text, articleUrl(post.article));
  const { data: claimed, error: claimError } = await admin.from("linkedin_editorial_posts").update({ status: "publishing", publish_started_at: new Date().toISOString(), attempt_count: post.attempt_count + 1, last_error: null }).eq("id", post.id).in("status", ["approved", "failed"]).select(POST_SELECT).maybeSingle();
  if (claimError) throw claimError;
  if (!claimed) {
    post = await postWithContext(admin, postId);
    if (post.status === "published") return { ok: true, skipped: true, reason: "already_published", post };
    return { ok: false, skipped: true, reason: "already_publishing", post };
  }

  const settings = await getLinkedInSettings(admin);
  try {
    const token = decryptLinkedInToken(post.connection.access_token_encrypted);
    const result = await createLinkedInPost({ accessToken: token, authorUrn: post.connection.member_urn, text });
    const now = new Date().toISOString();
    const { data: saved, error } = await admin.from("linkedin_editorial_posts").update({ status: "published", published_at: now, linkedin_post_urn: result.postUrn, linkedin_post_url: result.postUrl, publish_started_at: null, last_error: null }).eq("id", post.id).select(POST_SELECT).maybeSingle();
    if (error || !saved) throw new LinkedInApiError("linkedin_publish_confirmation_persistence_failed", { ambiguous: true });
    await admin.from("linkedin_connections").update({ last_published_at: now, last_error: null }).eq("id", post.connection.id);
    if (settings.notify_telegram) await notifyLinkedInPublished({ post: saved, article: post.article });
    return { ok: true, post: saved };
  } catch (error) {
    const reason = error?.code || errorCode(error);
    const expired = reason === "linkedin_connection_expired";
    await admin.from("linkedin_editorial_posts").update({ status: expired ? "connection_expired" : "failed", publish_started_at: null, last_error: reason }).eq("id", post.id);
    if (expired) await markConnectionExpired(admin, post.connection, reason);
    if (settings.notify_telegram) await notifyLinkedInFailed({ postId: post.id, article: post.article, stage: "publicare", reason, published: false, reconnect: expired });
    return { ok: false, reason, ambiguous: Boolean(error?.ambiguous) };
  }
}

export async function disconnectLinkedInConnection(connectionId) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("linkedin_connections").update({ status: "disconnected", disconnected_at: new Date().toISOString(), last_error: null }).eq("id", connectionId).select(CONNECTION_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_disconnect_failed");
  return data;
}

export async function saveLinkedInSettings(value, userId) {
  if (!LINKEDIN_MODES.includes(value.mode)) throw new Error("linkedin_mode_invalid");
  const admin = createAdminClient();
  const { data, error } = await admin.from("linkedin_automation_settings").upsert({ singleton: true, mode: value.mode, notify_telegram: Boolean(value.notifyTelegram), include_article_image: false, fallback_to_text: true, model: String(value.model || DEFAULT_SETTINGS.model).slice(0, 80), updated_by: userId }, { onConflict: "singleton" }).select("singleton, mode, notify_telegram, include_article_image, fallback_to_text, model, updated_at").maybeSingle();
  if (error || !data) throw error || new Error("linkedin_settings_save_failed");
  return data;
}
