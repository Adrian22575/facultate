import { createHash } from "node:crypto";

import { z } from "zod";

export const LINKEDIN_POST_MAX_CHARACTERS = 3000;
export const LINKEDIN_MODES = ["disabled", "draft_only", "auto_publish", "approval_required"];
export const LINKEDIN_POST_STATUSES = ["not_generated", "draft", "pending_approval", "approved", "publishing", "published", "failed", "connection_expired", "rejected"];

export const linkedInDraftSchema = z.object({
  hook: z.string().trim().min(20).max(280),
  body: z.string().trim().min(120).max(1800),
  // URL format validation runs locally below. The Responses API accepts the
  // plain string schema reliably, while its Structured Output validator does
  // not currently accept JSON Schema's `uri` format.
  articleUrl: z.string().trim().min(8).max(1200),
  closingCta: z.string().trim().min(12).max(260),
  // OpenAI Structured Outputs accepts the simple string constraints below.
  // The Unicode hashtag rule is deliberately validated after parsing because
  // JSON Schema regex support differs from JavaScript's `\p{…}` syntax.
  hashtags: z.array(z.string().trim().min(2).max(60)).min(1).max(3),
  fullPost: z.string().trim().min(200).max(LINKEDIN_POST_MAX_CHARACTERS),
  characterCount: z.number().int().min(1).max(LINKEDIN_POST_MAX_CHARACTERS),
  tone: z.enum(["direct", "profesor-practician", "analitic", "conversațional"]),
  claims: z.array(z.string().trim().min(12).max(500)).min(2).max(6),
  sourceArticleId: z.string().uuid()
});

const bannedPatterns = [
  /sunt (?:încântat|incantat) să (?:vă |va )?împărtășesc/i,
  /în lumea dinamică de astăzi/i,
  /educația este într-o continuă transformare/i,
  /game[ -]?changer/i,
  /revoluționar/i,
  /viitorul este deja aici/i,
  /am (?:cercetat|scris|documentat) (?:personal )?(?:acest |articolul)/i,
  /let that sink in|full stop|plot twist|spoiler/i
];

const genericQuestions = [
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

export function buildLinkedInFullPost({ hook, body, articleUrl, closingCta }) {
  return [hook, body, closingCta, articleUrl]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n\n");
}

export function validateLinkedInDraft(payload, { article, articleUrl, objective = "credibility" }) {
  const parsed = linkedInDraftSchema.safeParse(payload);
  if (!parsed.success) return { valid: false, reasons: ["structured_output_invalid"], draft: null };

  const value = parsed.data;
  const fullPost = buildLinkedInFullPost(value);
  const evidence = normalizeEvidence(buildArticleEvidence(article));
  const reasons = [];

  if (value.sourceArticleId !== article?.id) reasons.push("source_article_mismatch");
  if (value.articleUrl !== articleUrl) reasons.push("article_url_mismatch");
  if (fullPost.length > LINKEDIN_POST_MAX_CHARACTERS) reasons.push("character_limit_exceeded");
  // `characterCount` is returned for transparency, but the canonical text is
  // rebuilt on the server. Count it here so a model's different Unicode/newline
  // counting convention can never reject an otherwise valid draft.
  if (objective === "conversation" && !value.closingCta.endsWith("?")) reasons.push("conversation_cta_must_be_question");
  if (genericQuestions.some((pattern) => pattern.test(value.closingCta))) reasons.push("generic_closing_cta");
  if (/\[[^\]]*(?:link|url|titlu|nume|placeholder)[^\]]*\]|\{\{.+\}\}|<[^>]+>/i.test(fullPost)) reasons.push("placeholder_detected");
  if (bannedPatterns.some((pattern) => pattern.test(fullPost))) reasons.push("banned_language_detected");
  if (value.hashtags.some((tag) => !/^#[\p{L}\p{N}_]+$/u.test(tag))) reasons.push("invalid_hashtag");
  if (new Set(value.hashtags.map((tag) => tag.toLocaleLowerCase("ro"))).size !== value.hashtags.length) reasons.push("duplicate_hashtags");
  if (value.hashtags.some((tag) => !fullPost.includes(tag))) reasons.push("hashtag_not_integrated");
  if (value.hook.includes("\n") || value.hook.length > 220) reasons.push("weak_hook_structure");
  if (value.body.split(/\n\s*\n/).some((block) => block.trim().length > 520)) reasons.push("long_body_block");

  for (const claim of value.claims) {
    const normalizedClaim = normalizeEvidence(claim);
    if (!normalizedClaim || !evidence.includes(normalizedClaim)) {
      reasons.push(`unsupported_claim:${createHash("sha256").update(claim).digest("hex").slice(0, 12)}`);
    }
  }

  return {
    valid: reasons.length === 0,
    reasons,
    draft: { ...value, fullPost, characterCount: fullPost.length }
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
