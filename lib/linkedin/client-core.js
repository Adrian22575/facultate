import { linkedInPostUrl } from "./shared.js";

const REQUEST_TIMEOUT_MS = 12_000;

export class LinkedInApiError extends Error {
  constructor(code, { status = null, retryable = false, ambiguous = false } = {}) {
    super(code);
    this.name = "LinkedInApiError";
    this.code = code;
    this.status = status;
    this.retryable = retryable;
    this.ambiguous = ambiguous;
  }
}

async function safeJson(response) {
  const body = await response.json().catch(() => null);
  return body && typeof body === "object" ? body : {};
}

export async function exchangeLinkedInCodeWithConfig(code, config, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl("https://www.linkedin.com/oauth/v2/accessToken", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "authorization_code", code, client_id: config.clientId, client_secret: config.clientSecret, redirect_uri: config.redirectUri }),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    cache: "no-store"
  });
  const body = await safeJson(response);
  if (!response.ok || !body.access_token) throw new LinkedInApiError("linkedin_token_exchange_failed", { status: response.status });
  return { accessToken: body.access_token, expiresIn: Number(body.expires_in || 0), scopes: String(body.scope || "").split(/[ ,]+/).filter(Boolean) };
}

export async function getLinkedInUserInfoWithFetch(accessToken, { fetchImpl = fetch } = {}) {
  const response = await fetchImpl("https://api.linkedin.com/v2/userinfo", { headers: { authorization: `Bearer ${accessToken}` }, signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), cache: "no-store" });
  const body = await safeJson(response);
  if (!response.ok || !body.sub) throw new LinkedInApiError("linkedin_profile_lookup_failed", { status: response.status });
  return { subject: String(body.sub), memberUrn: `urn:li:person:${body.sub}`, name: typeof body.name === "string" ? body.name.trim() : null, picture: typeof body.picture === "string" ? body.picture.trim() : null };
}

export async function createLinkedInPostWithConfig({ accessToken, authorUrn, text }, config, { fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl("https://api.linkedin.com/rest/posts", {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", "x-restli-protocol-version": "2.0.0", "linkedin-version": config.apiVersion },
      body: JSON.stringify({ author: authorUrn, commentary: text, visibility: "PUBLIC", distribution: { feedDistribution: "MAIN_FEED", targetEntities: [], thirdPartyDistributionChannels: [] }, lifecycleState: "PUBLISHED", isReshareDisabledByAuthor: false }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store"
    });
  } catch {
    throw new LinkedInApiError("linkedin_publish_result_unknown", { retryable: false, ambiguous: true });
  }
  if (!response.ok) {
    const expired = response.status === 401 || response.status === 403;
    throw new LinkedInApiError(expired ? "linkedin_connection_expired" : "linkedin_publish_failed", { status: response.status, retryable: !expired && (response.status === 429 || response.status >= 500) });
  }
  const postUrn = response.headers.get("x-restli-id");
  if (!postUrn) throw new LinkedInApiError("linkedin_publish_confirmation_missing", { ambiguous: true });
  return { postUrn, postUrl: linkedInPostUrl(postUrn) };
}

export async function createLinkedInCommentWithConfig({ accessToken, authorUrn, postUrn, text }, config, { fetchImpl = fetch } = {}) {
  let response;
  try {
    response = await fetchImpl(`https://api.linkedin.com/rest/socialActions/${encodeURIComponent(postUrn)}/comments`, {
      method: "POST",
      headers: { authorization: `Bearer ${accessToken}`, "content-type": "application/json", "x-restli-protocol-version": "2.0.0", "linkedin-version": config.apiVersion },
      body: JSON.stringify({ actor: authorUrn, object: postUrn, message: { text } }),
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      cache: "no-store"
    });
  } catch {
    throw new LinkedInApiError("linkedin_comment_result_unknown", { retryable: false, ambiguous: true });
  }
  if (!response.ok) {
    const expired = response.status === 401 || response.status === 403;
    throw new LinkedInApiError(expired ? "linkedin_comment_permission_missing" : "linkedin_comment_failed", { status: response.status, retryable: !expired && (response.status === 429 || response.status >= 500) });
  }
  const commentId = response.headers.get("x-restli-id");
  if (!commentId) throw new LinkedInApiError("linkedin_comment_confirmation_missing", { ambiguous: true });
  return { commentId };
}
