import "server-only";

import { getLinkedInConfig } from "@/lib/linkedin/config";
import { createLinkedInCommentWithConfig, createLinkedInPostWithConfig, exchangeLinkedInCodeWithConfig, getLinkedInUserInfoWithFetch, LinkedInApiError } from "@/lib/linkedin/client-core";

export { LinkedInApiError };

export async function exchangeLinkedInCode(code, { fetchImpl = fetch } = {}) {
  return exchangeLinkedInCodeWithConfig(code, getLinkedInConfig(), { fetchImpl });
}

export async function getLinkedInUserInfo(accessToken, { fetchImpl = fetch } = {}) {
  return getLinkedInUserInfoWithFetch(accessToken, { fetchImpl });
}

export async function createLinkedInPost({ accessToken, authorUrn, text }, { fetchImpl = fetch } = {}) {
  return createLinkedInPostWithConfig({ accessToken, authorUrn, text }, getLinkedInConfig(), { fetchImpl });
}

export async function createLinkedInComment({ accessToken, authorUrn, postUrn, text }, { fetchImpl = fetch } = {}) {
  return createLinkedInCommentWithConfig({ accessToken, authorUrn, postUrn, text }, getLinkedInConfig(), { fetchImpl });
}
