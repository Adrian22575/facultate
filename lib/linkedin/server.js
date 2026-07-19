import "server-only";

import { createLinkedInComment, createLinkedInPost, LinkedInApiError } from "@/lib/linkedin/client";
import { getLinkedInConfigStatus } from "@/lib/linkedin/config";
import { decryptLinkedInToken } from "@/lib/linkedin/crypto";
import { normalizeLinkedInModel } from "@/lib/linkedin/models";
import { generateLinkedInDraftPipeline, refineLinkedInDraftPipeline } from "@/lib/linkedin/pipeline";
import { getLinkedInPromptPreview } from "@/lib/linkedin/prompts/builders";
import { LINKEDIN_PROMPT_VERSION } from "@/lib/linkedin/prompts/banned-phrases";
import {
  DEFAULT_LINKEDIN_POST_AUDIENCE,
  DEFAULT_LINKEDIN_POST_CTA,
  DEFAULT_LINKEDIN_POST_LENGTH,
  DEFAULT_LINKEDIN_POST_LINK_PLACEMENT,
  DEFAULT_LINKEDIN_POST_NARRATIVE,
  DEFAULT_LINKEDIN_POST_OBJECTIVE,
  DEFAULT_LINKEDIN_POST_TEMPLATE,
  DEFAULT_LINKEDIN_POST_VOICE,
  getLinkedInPostAudience,
  getLinkedInPostCta,
  getLinkedInPostLength,
  getLinkedInPostLinkPlacement,
  getLinkedInPostNarrative,
  getLinkedInPostObjective,
  getLinkedInPostTemplate,
  getLinkedInPostVoice,
  LINKEDIN_POST_TEMPLATES,
  normalizeLinkedInGenerationOptions
} from "@/lib/linkedin/templates";
import {
  isConnectionUsable,
  LINKEDIN_MODES,
  LINKEDIN_POST_MAX_CHARACTERS,
} from "@/lib/linkedin/shared";
import { notifyLinkedInDraftReady, notifyLinkedInFailed, notifyLinkedInPublished } from "@/lib/notifications/telegram";
import { getPublicSiteUrl } from "@/lib/site";
import { createAdminClient } from "@/lib/supabase/admin";

const POST_SELECT = "id, article_id, connection_id, edition_number, status, generated_payload, generated_text, edited_text, character_count, claims, model, template_key, goal_key, voice_key, audience_key, custom_audience, cta_key, narrative_key, length_key, link_placement_key, prompt_version, quality_score, generation_warnings, feedback, feedback_at, linkedin_comment_id, link_comment_status, link_comment_error, generation_started_at, generated_at, approved_at, approved_by, published_at, linkedin_post_urn, linkedin_post_url, publish_started_at, last_error, attempt_count, notification_sent, created_at, updated_at";
const ARTICLE_SELECT = "id, slug, title, subtitle, summary, key_takeaways, sections, student_implications, conclusion, status, published_at";
const CONNECTION_SELECT = "id, member_subject, member_urn, display_name, profile_picture_url, token_expires_at, scopes, status, last_error, connected_at, disconnected_at, last_published_at, created_at, updated_at";

const DEFAULT_SETTINGS = {
  singleton: true,
  mode: "approval_required",
  notify_telegram: true,
  include_article_image: false,
  fallback_to_text: true,
  model: normalizeLinkedInModel(process.env.OPENAI_EDITORIAL_MODEL),
  default_template: DEFAULT_LINKEDIN_POST_TEMPLATE,
  default_objective: DEFAULT_LINKEDIN_POST_OBJECTIVE,
  default_voice: DEFAULT_LINKEDIN_POST_VOICE,
  default_audience: DEFAULT_LINKEDIN_POST_AUDIENCE,
  default_custom_audience: null,
  default_cta: DEFAULT_LINKEDIN_POST_CTA,
  default_narrative: DEFAULT_LINKEDIN_POST_NARRATIVE,
  default_length: DEFAULT_LINKEDIN_POST_LENGTH,
  default_link_placement: DEFAULT_LINKEDIN_POST_LINK_PLACEMENT
};

const DEFAULT_POST_CONFIGURATION = {
  template_key: DEFAULT_LINKEDIN_POST_TEMPLATE,
  goal_key: DEFAULT_LINKEDIN_POST_OBJECTIVE,
  voice_key: DEFAULT_LINKEDIN_POST_VOICE,
  audience_key: DEFAULT_LINKEDIN_POST_AUDIENCE,
  cta_key: DEFAULT_LINKEDIN_POST_CTA,
  narrative_key: DEFAULT_LINKEDIN_POST_NARRATIVE,
  length_key: DEFAULT_LINKEDIN_POST_LENGTH,
  link_placement_key: DEFAULT_LINKEDIN_POST_LINK_PLACEMENT,
  prompt_version: LINKEDIN_PROMPT_VERSION
};

function errorCode(error) {
  return error instanceof Error ? error.message.slice(0, 1000) : String(error || "unknown_error").slice(0, 1000);
}

function articleUrl(article) {
  return `${getPublicSiteUrl()}/articole/${article.slug}`;
}

export function getLinkedInGenerationPreview(model = DEFAULT_SETTINGS.model) {
  return getLinkedInGenerationPreviewForTemplate(model, {});
}

export function getLinkedInGenerationPreviewForTemplate(model = DEFAULT_SETTINGS.model, value = {}) {
  const options = normalizeLinkedInGenerationOptions(value);
  const prompts = getLinkedInPromptPreview(options);
  return {
    model,
    timezone: "Europe/Bucharest",
    template: getLinkedInPostTemplate(options.templateKey),
    objective: getLinkedInPostObjective(options.objectiveKey),
    voice: getLinkedInPostVoice(options.voiceKey),
    promptVersion: prompts.promptVersion,
    requests: [
      { id: "linkedin-analysis", title: "Analiză, unghi și hook", reasoning: "mediu", output: "analiză structurată, 3 unghiuri și 5 hook-uri", developerPrompt: `${prompts.system}\n\n${prompts.analysis}`, userPrompt: "Articolul publicat și alegerile editoriale.", dynamicContext: "Contextul articolului este trimis numai pe server." },
      { id: "linkedin-draft", title: "Redactare", reasoning: "mediu", output: "ciornă structurată și dovezi", developerPrompt: prompts.draft, userPrompt: "Strategia selectată și dovezile articolului." },
      { id: "linkedin-critique", title: "Critică și rescriere", reasoning: "mediu", output: "12 scoruri, avertismente și varianta finală", developerPrompt: prompts.critique, userPrompt: "Ciorna, strategia și dovezile articolului." }
    ],
    publication: "Varianta finală trece validarea locală și rămâne la aprobare înainte de publicare."
  };
}

function normalizeSettings(data) {
  if (!data) return DEFAULT_SETTINGS;
  return {
    ...data,
    model: normalizeLinkedInModel(data.model),
    default_template: getLinkedInPostTemplate(data.default_template).key,
    default_objective: getLinkedInPostObjective(data.default_objective).key,
    default_voice: getLinkedInPostVoice(data.default_voice).key,
    default_audience: getLinkedInPostAudience(data.default_audience).key,
    default_custom_audience: getLinkedInPostAudience(data.default_audience).key === "custom" ? String(data.default_custom_audience || "").trim() || null : null,
    default_cta: getLinkedInPostCta(data.default_cta).key,
    default_narrative: getLinkedInPostNarrative(data.default_narrative).key,
    default_length: getLinkedInPostLength(data.default_length).key,
    default_link_placement: getLinkedInPostLinkPlacement(data.default_link_placement).key
  };
}

const SETTINGS_SELECT = "singleton, mode, notify_telegram, include_article_image, fallback_to_text, model, default_template, default_objective, default_voice, default_audience, default_custom_audience, default_cta, default_narrative, default_length, default_link_placement, updated_at";

export async function getLinkedInSettings(admin = createAdminClient()) {
  const { data, error } = await admin.from("linkedin_automation_settings").select(SETTINGS_SELECT).eq("singleton", true).maybeSingle();
  if (error) throw error;
  return normalizeSettings(data);
}

export async function getLinkedInAdminOverview() {
  const config = getLinkedInConfigStatus();
  try {
    const admin = createAdminClient();
    const [{ data: settings, error: settingsError }, { data: connections, error: connectionsError }, { data: posts, error: postsError }, { data: activity, error: activityError }] = await Promise.all([
      admin.from("linkedin_automation_settings").select(SETTINGS_SELECT).eq("singleton", true).maybeSingle(),
      admin.from("linkedin_connections").select(CONNECTION_SELECT).order("connected_at", { ascending: false }).limit(5),
      admin.from("linkedin_editorial_posts").select(`${POST_SELECT}, article:editorial_articles(id, slug, title, status, published_at)`).order("updated_at", { ascending: false }).limit(80),
      admin.from("linkedin_editorial_posts").select("article_id, status, published_at, edition_number")
    ]);
    if (settingsError) throw settingsError;
    if (connectionsError) throw connectionsError;
    if (postsError) throw postsError;
    if (activityError) throw activityError;
    const articleActivity = (activity || []).reduce((summary, post) => {
      const current = summary[post.article_id] || { total: 0, published: 0, lastPublishedAt: null, latestEdition: 0 };
      current.total += 1;
      current.latestEdition = Math.max(current.latestEdition, post.edition_number || 1);
      if (post.status === "published") {
        current.published += 1;
        if (!current.lastPublishedAt || Date.parse(post.published_at || 0) > Date.parse(current.lastPublishedAt || 0)) current.lastPublishedAt = post.published_at;
      }
      summary[post.article_id] = current;
      return summary;
    }, {});
    return {
      config,
      settings: normalizeSettings(settings),
      connection: (connections || []).find((item) => item.status !== "disconnected") || connections?.[0] || null,
      posts: posts || [],
      articleActivity,
      generationPreviews: LINKEDIN_POST_TEMPLATES.map((template) => getLinkedInGenerationPreviewForTemplate(normalizeLinkedInModel(settings?.model || DEFAULT_SETTINGS.model), { templateKey: template.key, objectiveKey: settings?.default_objective, voiceKey: settings?.default_voice, audienceKey: settings?.default_audience, customAudience: settings?.default_custom_audience, ctaKey: settings?.default_cta, narrativeKey: settings?.default_narrative, lengthKey: settings?.default_length, linkPlacementKey: settings?.default_link_placement })),
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
      articleActivity: {},
      generationPreviews: LINKEDIN_POST_TEMPLATES.map((template) => getLinkedInGenerationPreviewForTemplate(DEFAULT_SETTINGS.model, { templateKey: template.key, ...DEFAULT_SETTINGS })),
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
  const { data: existing, error: existingError } = await admin.from("linkedin_editorial_posts").select(POST_SELECT).eq("article_id", articleId).eq("connection_id", connectionId).order("edition_number", { ascending: false }).limit(1).maybeSingle();
  if (existingError) throw existingError;
  if (existing) return existing;
  const { data, error } = await admin.from("linkedin_editorial_posts").insert({ article_id: articleId, connection_id: connectionId, edition_number: 1, status: "not_generated", ...DEFAULT_POST_CONFIGURATION }).select(POST_SELECT).maybeSingle();
  if (!error && data) return data;
  if (error?.code !== "23505") throw error || new Error("linkedin_post_not_created");
  const { data: raced, error: racedError } = await admin.from("linkedin_editorial_posts").select(POST_SELECT).eq("article_id", articleId).eq("connection_id", connectionId).order("edition_number", { ascending: false }).limit(1).maybeSingle();
  if (racedError || !raced) throw racedError || new Error("linkedin_post_not_created");
  return raced;
}

async function createNextEdition(admin, post) {
  let latest = post;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const nextEdition = (latest.edition_number || 1) + 1;
    const { data, error } = await admin.from("linkedin_editorial_posts").insert({ article_id: post.article_id, connection_id: post.connection_id, edition_number: nextEdition, status: "not_generated", ...DEFAULT_POST_CONFIGURATION }).select(POST_SELECT).maybeSingle();
    if (!error && data) return data;
    if (error?.code !== "23505") throw error || new Error("linkedin_post_edition_not_created");

    const { data: raced, error: racedError } = await admin.from("linkedin_editorial_posts").select(POST_SELECT).eq("article_id", post.article_id).eq("connection_id", post.connection_id).order("edition_number", { ascending: false }).limit(1).maybeSingle();
    if (racedError || !raced) throw racedError || new Error("linkedin_post_edition_not_created");
    if ((raced.edition_number || 1) <= (latest.edition_number || 1)) throw error;
    latest = raced;
  }
  throw new Error("linkedin_post_edition_conflict");
}

async function markConnectionExpired(admin, connection, reason) {
  await admin.from("linkedin_connections").update({ status: "connection_expired", last_error: reason }).eq("id", connection.id);
}

export async function prepareLinkedInDraft(articleId, { force = false, manual = false, createNewEdition = false, templateKey, objectiveKey, voiceKey, audienceKey, customAudience, ctaKey, narrativeKey, lengthKey, linkPlacementKey } = {}) {
  const admin = createAdminClient();
  const [article, settings, connection] = await Promise.all([loadPublishedArticle(admin, articleId), getLinkedInSettings(admin), activeConnection(admin)]);
  // "Dezactivat" oprește distribuirea automată, nu pregătirea explicită din Admin.
  if (settings.mode === "disabled" && !manual) return { ok: true, skipped: true, reason: "linkedin_disabled" };
  if (!connection) return { ok: false, skipped: true, reason: "linkedin_not_connected" };
  let post = await ensurePost(admin, article.id, connection.id);
  if (createNewEdition && post.status !== "not_generated") {
    post = await createNextEdition(admin, post);
  } else if (post.status === "published") {
    if (!force) return { ok: true, skipped: true, reason: "already_published", post };
    post = await createNextEdition(admin, post);
  }
  if (post.status === "publishing") return { ok: true, skipped: true, reason: "already_publishing", post };
  if (!force && ["draft", "pending_approval", "approved", "publishing"].includes(post.status)) return { ok: true, skipped: true, reason: "already_prepared", post };

  if (!isConnectionUsable(connection)) {
    await markConnectionExpired(admin, connection, "linkedin_connection_expired");
    await admin.from("linkedin_editorial_posts").update({ status: "connection_expired", last_error: "linkedin_connection_expired" }).eq("id", post.id);
    if (settings.notify_telegram) await notifyLinkedInFailed({ postId: post.id, article, stage: "conexiune", reason: "Conexiunea LinkedIn a expirat. Reconectează profilul.", reconnect: true });
    return { ok: false, reason: "linkedin_connection_expired", postId: post.id };
  }

  const options = normalizeLinkedInGenerationOptions({
    templateKey: templateKey || settings.default_template,
    objectiveKey: objectiveKey || settings.default_objective,
    voiceKey: voiceKey || settings.default_voice,
    audienceKey: audienceKey || settings.default_audience,
    customAudience: customAudience || settings.default_custom_audience,
    ctaKey: ctaKey || settings.default_cta,
    narrativeKey: narrativeKey || settings.default_narrative,
    lengthKey: lengthKey || settings.default_length,
    linkPlacementKey: linkPlacementKey || settings.default_link_placement
  });
  const optionColumns = {
    template_key: options.templateKey,
    goal_key: options.objectiveKey,
    voice_key: options.voiceKey,
    audience_key: options.audienceKey,
    custom_audience: options.customAudience || null,
    cta_key: options.ctaKey,
    narrative_key: options.narrativeKey,
    length_key: options.lengthKey,
    link_placement_key: options.linkPlacementKey,
    prompt_version: LINKEDIN_PROMPT_VERSION,
    linkedin_comment_id: null,
    link_comment_status: options.linkPlacementKey === "first_comment" ? "pending" : "not_required",
    link_comment_error: null
  };
  await admin.from("linkedin_editorial_posts").update({ status: "not_generated", ...optionColumns, generation_started_at: new Date().toISOString(), generated_payload: {}, generated_text: null, edited_text: null, character_count: 0, claims: [], quality_score: null, generation_warnings: [], feedback: null, feedback_at: null, approved_at: null, approved_by: null, last_error: null }).eq("id", post.id);
  try {
    const draft = await generateLinkedInDraftPipeline({ article, articleUrl: articleUrl(article), model: normalizeLinkedInModel(settings.model || DEFAULT_SETTINGS.model), options });
    const nextStatus = force || settings.mode === "approval_required" ? "pending_approval" : settings.mode === "auto_publish" ? "approved" : "draft";
    const now = new Date().toISOString();
    const { data: saved, error } = await admin.from("linkedin_editorial_posts").update({
      status: nextStatus,
      generated_payload: draft.generatedPayload,
      generated_text: draft.fullPost,
      edited_text: draft.fullPost,
      character_count: draft.characterCount,
      claims: draft.claims,
      model: normalizeLinkedInModel(settings.model || DEFAULT_SETTINGS.model),
      ...optionColumns,
      quality_score: draft.qualityScore,
      generation_warnings: draft.warnings,
      generated_at: now,
      generation_started_at: null,
      approved_at: force || settings.mode !== "auto_publish" ? null : now,
      last_error: null
    }).eq("id", post.id).select(POST_SELECT).maybeSingle();
    if (error || !saved) throw error || new Error("linkedin_draft_save_failed");
    if (settings.notify_telegram) await notifyLinkedInDraftReady({ post: saved, article, mode: settings.mode });
    if (settings.mode === "auto_publish" && !force) return publishLinkedInPost(saved.id, { admin });
    return { ok: true, post: saved };
  } catch (error) {
    const reason = errorCode(error);
    await admin.from("linkedin_editorial_posts").update({ status: "failed", generation_started_at: null, last_error: reason }).eq("id", post.id);
    if (settings.notify_telegram) await notifyLinkedInFailed({ postId: post.id, article, stage: "generare", reason });
    return { ok: false, reason, postId: post.id };
  }
}

function validateManualText(text, url, linkPlacement = "end") {
  const value = String(text || "").trim();
  if (value.length < 120 || value.length > LINKEDIN_POST_MAX_CHARACTERS) throw new Error("linkedin_text_length_invalid");
  if (["natural", "end"].includes(linkPlacement) && !value.includes(url)) throw new Error("linkedin_article_url_missing");
  const hashtags = value.match(/#[\p{L}\p{N}_]+/gu) || [];
  if (hashtags.length > 4) throw new Error("linkedin_hashtag_count_invalid");
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
  const value = validateManualText(text, articleUrl(post.article), post.link_placement_key);
  const { data, error } = await admin.from("linkedin_editorial_posts").update({ edited_text: value, character_count: value.length, status: post.status === "rejected" ? "draft" : post.status, approved_at: null, approved_by: null, last_error: null }).eq("id", postId).select(POST_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_post_update_failed");
  return data;
}

function optionsFromPost(post) {
  return normalizeLinkedInGenerationOptions({
    templateKey: post.template_key,
    objectiveKey: post.goal_key,
    voiceKey: post.voice_key,
    audienceKey: post.audience_key,
    customAudience: post.custom_audience,
    ctaKey: post.cta_key,
    narrativeKey: post.narrative_key,
    lengthKey: post.length_key,
    linkPlacementKey: post.link_placement_key
  });
}

export async function refineLinkedInPost(postId, kind) {
  const admin = createAdminClient();
  const post = await postWithContext(admin, postId);
  if (["published", "publishing", "not_generated"].includes(post.status)) throw new Error("linkedin_post_not_refinable");
  const result = await refineLinkedInDraftPipeline({
    article: post.article,
    articleUrl: articleUrl(post.article),
    model: normalizeLinkedInModel(post.model || DEFAULT_SETTINGS.model),
    options: optionsFromPost(post),
    payload: post.generated_payload,
    kind
  });
  const { data, error } = await admin.from("linkedin_editorial_posts").update({
    generated_payload: result.generatedPayload,
    edited_text: result.fullPost,
    character_count: result.characterCount,
    claims: result.claims,
    quality_score: result.qualityScore,
    generation_warnings: result.warnings,
    status: "pending_approval",
    approved_at: null,
    approved_by: null,
    last_error: null
  }).eq("id", postId).select(POST_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_refinement_save_failed");
  return data;
}

export async function saveLinkedInPostFeedback(postId, feedback) {
  if (!["up", "down"].includes(feedback)) throw new Error("linkedin_feedback_invalid");
  const admin = createAdminClient();
  const { data, error } = await admin.from("linkedin_editorial_posts").update({ feedback, feedback_at: new Date().toISOString() }).eq("id", postId).select(POST_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_feedback_save_failed");
  return data;
}

export async function approveLinkedInPost(postId, userId) {
  const admin = createAdminClient();
  const post = await postWithContext(admin, postId);
  if (!["draft", "pending_approval", "rejected", "failed"].includes(post.status)) throw new Error("linkedin_post_not_approvable");
  validateManualText(post.edited_text || post.generated_text, articleUrl(post.article), post.link_placement_key);
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
  const text = validateManualText(post.edited_text || post.generated_text, articleUrl(post.article), post.link_placement_key);
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
    let { data: saved, error } = await admin.from("linkedin_editorial_posts").update({ status: "published", published_at: now, linkedin_post_urn: result.postUrn, linkedin_post_url: result.postUrl, publish_started_at: null, last_error: null }).eq("id", post.id).select(POST_SELECT).maybeSingle();
    if (error || !saved) throw new LinkedInApiError("linkedin_publish_confirmation_persistence_failed", { ambiguous: true });
    await admin.from("linkedin_connections").update({ last_published_at: now, last_error: null }).eq("id", post.connection.id);
    let warning = null;
    const firstComment = saved.generated_payload?.final?.firstComment;
    if (saved.link_placement_key === "first_comment" && firstComment) {
      try {
        const comment = await createLinkedInComment({ accessToken: token, authorUrn: post.connection.member_urn, postUrn: result.postUrn, text: firstComment });
        const commentUpdate = await admin.from("linkedin_editorial_posts").update({ linkedin_comment_id: comment.commentId, link_comment_status: "published", link_comment_error: null }).eq("id", post.id).select(POST_SELECT).maybeSingle();
        if (!commentUpdate.error && commentUpdate.data) saved = commentUpdate.data;
      } catch (commentError) {
        warning = commentError?.code || errorCode(commentError);
        const commentUpdate = await admin.from("linkedin_editorial_posts").update({ link_comment_status: commentError?.ambiguous ? "unknown" : "failed", link_comment_error: warning }).eq("id", post.id).select(POST_SELECT).maybeSingle();
        if (!commentUpdate.error && commentUpdate.data) saved = commentUpdate.data;
        if (settings.notify_telegram) await notifyLinkedInFailed({ postId: post.id, article: post.article, stage: "primul comentariu", reason: warning, published: true });
      }
    }
    if (settings.notify_telegram) await notifyLinkedInPublished({ post: saved, article: post.article });
    return { ok: true, post: saved, warning };
  } catch (error) {
    const reason = error?.code || errorCode(error);
    const expired = reason === "linkedin_connection_expired";
    await admin.from("linkedin_editorial_posts").update({ status: expired ? "connection_expired" : "failed", publish_started_at: null, last_error: reason }).eq("id", post.id);
    if (expired) await markConnectionExpired(admin, post.connection, reason);
    if (settings.notify_telegram) await notifyLinkedInFailed({ postId: post.id, article: post.article, stage: "publicare", reason, published: false, reconnect: expired });
    return { ok: false, reason, ambiguous: Boolean(error?.ambiguous) };
  }
}

export async function retryLinkedInFirstComment(postId) {
  const admin = createAdminClient();
  const post = await postWithContext(admin, postId);
  if (post.status !== "published" || post.link_placement_key !== "first_comment" || !post.linkedin_post_urn) throw new Error("linkedin_comment_not_retryable");
  if (["linkedin_comment_result_unknown", "linkedin_comment_confirmation_missing"].includes(post.link_comment_error)) throw new Error("linkedin_comment_retry_blocked_ambiguous_result");
  if (!isConnectionUsable(post.connection)) {
    await markConnectionExpired(admin, post.connection, "linkedin_connection_expired");
    throw new Error("linkedin_connection_expired");
  }
  const text = post.generated_payload?.final?.firstComment;
  if (!text) throw new Error("linkedin_comment_text_missing");
  const token = decryptLinkedInToken(post.connection.access_token_encrypted);
  const result = await createLinkedInComment({ accessToken: token, authorUrn: post.connection.member_urn, postUrn: post.linkedin_post_urn, text });
  const { data, error } = await admin.from("linkedin_editorial_posts").update({ linkedin_comment_id: result.commentId, link_comment_status: "published", link_comment_error: null }).eq("id", postId).select(POST_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_comment_save_failed");
  return data;
}

export async function disconnectLinkedInConnection(connectionId) {
  const admin = createAdminClient();
  const { data, error } = await admin.from("linkedin_connections").update({ status: "disconnected", disconnected_at: new Date().toISOString(), last_error: null }).eq("id", connectionId).select(CONNECTION_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_disconnect_failed");
  return data;
}

export async function saveLinkedInSettings(value, userId) {
  if (!LINKEDIN_MODES.includes(value.mode)) throw new Error("linkedin_mode_invalid");
  const model = normalizeLinkedInModel(value.model);
  const defaultTemplate = getLinkedInPostTemplate(value.defaultTemplate).key;
  const defaultObjective = getLinkedInPostObjective(value.defaultObjective).key;
  const defaultVoice = getLinkedInPostVoice(value.defaultVoice).key;
  const defaultAudience = getLinkedInPostAudience(value.defaultAudience).key;
  const defaultCustomAudience = defaultAudience === "custom" ? String(value.defaultCustomAudience || "").trim() || null : null;
  const defaultCta = getLinkedInPostCta(value.defaultCta).key;
  const defaultNarrative = getLinkedInPostNarrative(value.defaultNarrative).key;
  const defaultLength = getLinkedInPostLength(value.defaultLength).key;
  const defaultLinkPlacement = getLinkedInPostLinkPlacement(value.defaultLinkPlacement).key;
  const admin = createAdminClient();
  const { data, error } = await admin.from("linkedin_automation_settings").upsert({ singleton: true, mode: value.mode, notify_telegram: Boolean(value.notifyTelegram), include_article_image: false, fallback_to_text: true, model, default_template: defaultTemplate, default_objective: defaultObjective, default_voice: defaultVoice, default_audience: defaultAudience, default_custom_audience: defaultCustomAudience, default_cta: defaultCta, default_narrative: defaultNarrative, default_length: defaultLength, default_link_placement: defaultLinkPlacement, updated_by: userId }, { onConflict: "singleton" }).select(SETTINGS_SELECT).maybeSingle();
  if (error || !data) throw error || new Error("linkedin_settings_save_failed");
  return normalizeSettings(data);
}
