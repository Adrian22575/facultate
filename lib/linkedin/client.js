import "server-only";

import { getLinkedInConfig } from "@/lib/linkedin/config";
import { createLinkedInPostWithConfig, exchangeLinkedInCodeWithConfig, getLinkedInUserInfoWithFetch, LinkedInApiError } from "@/lib/linkedin/client-core";

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
