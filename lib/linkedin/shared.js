import { createHash } from "node:crypto";

import { z } from "zod";

import { findBannedLinkedInLanguage, LINKEDIN_PROMPT_VERSION } from "./prompts/banned-phrases.js";
import { LINKEDIN_POST_LINK_PLACEMENT_KEYS } from "./templates.js";

export const LINKEDIN_POST_MAX_CHARACTERS = 3000;
export const LINKEDIN_MODES = ["disabled", "draft_only", "auto_publish", "approval_required"];
export const LINKEDIN_POST_STATUSES = ["not_generated", "draft", "pending_approval", "approved", "publishing", "published", "failed", "connection_expired", "rejected"];

export const linkedInDraftSchema = z.object({
  hook: z.string().trim().min(15).max(240),
  body: z.string().trim().min(80).max(2400),
  cta: z.string().trim().min(8).max(320).nullable(),
  linkSentence: z.string().trim().min(8).max(500).nullable(),
  articleUrl: z.string().trim().min(8).max(1200),
  linkPlacement: z.enum(LINKEDIN_POST_LINK_PLACEMENT_KEYS),
  hashtags: z.array(z.string().trim().min(2).max(60)).max(4),
  angle: z.string().trim().min(10).max(500),
  objective: z.string().trim().min(2).max(80),
  qualityScore: z.number().min(0).max(10),
  warnings: z.array(z.string().trim().min(2).max(300)).max(20),
  promptVersion: z.literal(LINKEDIN_PROMPT_VERSION),
  claims: z.array(z.string().trim().min(12).max(500)).min(2).max(8),
  sourceArticleId: z.string().uuid()
});

const genericQuestions = [
  /tu ce părere ai\??$/i,
  /ce părere aveți(?: despre (?:asta|acest subiect))?\??$/i,
  /voi ce credeți\??$/i,
  /sunteți de acord\??$/i,
  /cum vi se pare\??$/i,
  /ce credeți despre asta\??$/i
];

function normalizeEvidence(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function buildArticleEvidence(article) {
  return [
    article?.title,
    article?.subtitle,
    article?.summary,
    ...(article?.key_takeaways || []),
    ...(article?.sections || []).flatMap((section) => [section?.title, section?.content, ...(section?.keyClaims || [])]),
    ...(article?.student_implications || []),
    article?.conclusion
  ].filter(Boolean).join("\n");
}

export function buildLinkedInFullPost({ hook, body, cta, closingCta, articleUrl, linkSentence, linkPlacement = "end", hashtags = [] }) {
  const closing = cta ?? closingCta ?? null;
  const linkBlock = linkPlacement === "natural" ? linkSentence : linkPlacement === "end" ? articleUrl : null;
  const hashtagBlock = hashtags.length ? hashtags.join(" ") : null;
  return [hook, body, closing, linkBlock, hashtagBlock]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function buildLinkedInFirstComment({ linkPlacement, linkSentence }) {
  return linkPlacement === "first_comment" ? String(linkSentence || "").trim() || null : null;
}

export function validateLinkedInDraft(payload, { article, articleUrl, objective = "authority" }) {
  const parsed = linkedInDraftSchema.safeParse(payload);
  if (!parsed.success) return { valid: false, reasons: ["structured_output_invalid"], draft: null };

  const value = parsed.data;
  const fullPost = buildLinkedInFullPost(value);
  const firstComment = buildLinkedInFirstComment(value);
  const evidence = normalizeEvidence(buildArticleEvidence(article));
  const reasons = [];

  if (value.sourceArticleId !== article?.id) reasons.push("source_article_mismatch");
  if (value.articleUrl !== articleUrl) reasons.push("article_url_mismatch");
  if (fullPost.length < 120 || fullPost.length > LINKEDIN_POST_MAX_CHARACTERS) reasons.push("character_limit_exceeded");
  if (["comments"].includes(objective) && (!value.cta || !value.cta.endsWith("?"))) reasons.push("conversation_cta_must_be_question");
  if (value.cta && genericQuestions.some((pattern) => pattern.test(value.cta))) reasons.push("generic_closing_cta");
  if (/\[[^\]]*(?:link|url|titlu|nume|placeholder)[^\]]*\]|\{\{.+\}\}|<[^>]+>/i.test(fullPost)) reasons.push("placeholder_detected");
  if (findBannedLinkedInLanguage(fullPost).length) reasons.push("banned_language_detected");
  if (value.hashtags.some((tag) => !/^#[\p{L}\p{N}_]+$/u.test(tag))) reasons.push("invalid_hashtag");
  if (new Set(value.hashtags.map((tag) => tag.toLocaleLowerCase("ro"))).size !== value.hashtags.length) reasons.push("duplicate_hashtags");
  if (value.hook.includes("\n") || value.hook.length > 220) reasons.push("weak_hook_structure");
  if (value.body.split(/\n\s*\n/).some((block) => block.trim().length > 620)) reasons.push("long_body_block");
  if (["natural", "end"].includes(value.linkPlacement) && !fullPost.includes(articleUrl)) reasons.push("article_url_missing");
  if (value.linkPlacement === "first_comment" && !firstComment?.includes(articleUrl)) reasons.push("first_comment_url_missing");
  if (value.linkPlacement === "none" && fullPost.includes(articleUrl)) reasons.push("unexpected_article_url");
  const personalExperience = fullPost.match(/\b(?:am observat|am învățat|în proiectele mele|din experiența mea)\b/i);
  if (personalExperience && !evidence.includes(normalizeEvidence(personalExperience[0]))) reasons.push("unsupported_personal_experience");

  for (const claim of value.claims) {
    const normalizedClaim = normalizeEvidence(claim);
    if (!normalizedClaim || !evidence.includes(normalizedClaim)) {
      reasons.push(`unsupported_claim:${createHash("sha256").update(claim).digest("hex").slice(0, 12)}`);
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
    draft: { ...value, fullPost, firstComment, characterCount: fullPost.length }
  };
}

export function isConnectionUsable(connection, now = new Date()) {
  if (!connection || connection.status !== "connected") return false;
  if (!Array.isArray(connection.scopes) || !connection.scopes.includes("w_member_social")) return false;
  const expiresAt = Date.parse(connection.token_expires_at || "");
  return Number.isFinite(expiresAt) && expiresAt > now.getTime() + 60_000;
}

export function linkedInPostUrl(postUrn) {
  const match = String(postUrn || "").match(/^urn:li:(?:share|ugcPost):(\d+)$/);
  return match ? `https://www.linkedin.com/feed/update/${postUrn}` : null;
}

export function hashOAuthState(value) {
  return createHash("sha256").update(String(value || "")).digest("hex");
}
