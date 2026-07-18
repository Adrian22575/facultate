import "server-only";

import { getLinkedInEnvStatus } from "@/lib/env/server";
import { hasValidLinkedInEncryptionKey } from "@/lib/linkedin/crypto";

export const LINKEDIN_OAUTH_SCOPES = ["openid", "profile", "w_member_social"];

export function getLinkedInConfigStatus() {
  const env = getLinkedInEnvStatus();
  const encryptionKeyValid = env.encryptionKeyPresent && hasValidLinkedInEncryptionKey();
  return { ...env, encryptionKeyValid, ready: env.ready && encryptionKeyValid };
}

export function getLinkedInConfig() {
  const status = getLinkedInConfigStatus();
  if (!status.ready) throw new Error("linkedin_not_configured");
  return {
    clientId: process.env.LINKEDIN_CLIENT_ID.trim(),
    clientSecret: process.env.LINKEDIN_CLIENT_SECRET.trim(),
    redirectUri: process.env.LINKEDIN_REDIRECT_URI.trim(),
    apiVersion: status.apiVersion
  };
}

export function buildLinkedInAuthorizationUrl(state) {
  const config = getLinkedInConfig();
  const url = new URL("https://www.linkedin.com/oauth/v2/authorization");
  url.searchParams.set("response_type", "code");
  url.searchParams.set("client_id", config.clientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("state", state);
  url.searchParams.set("scope", LINKEDIN_OAUTH_SCOPES.join(" "));
  return url;
}
