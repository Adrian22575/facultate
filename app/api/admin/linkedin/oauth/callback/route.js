import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { exchangeLinkedInCode, getLinkedInUserInfo } from "@/lib/linkedin/client";
import { LINKEDIN_OAUTH_SCOPES } from "@/lib/linkedin/config";
import { encryptLinkedInToken } from "@/lib/linkedin/crypto";
import { hashOAuthState } from "@/lib/linkedin/shared";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function adminRedirect(request, key, value) {
  const url = new URL("/admin", request.url);
  url.searchParams.set("admin_tab", "editorial");
  url.searchParams.set(key, value);
  url.hash = "editorial-workspace";
  return NextResponse.redirect(url);
}

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return adminRedirect(request, "linkedin_error", "unauthorized");

  const url = new URL(request.url);
  const state = url.searchParams.get("state") || "";
  const code = url.searchParams.get("code") || "";
  if (url.searchParams.get("error")) return adminRedirect(request, "linkedin_error", "authorization_cancelled");
  if (!state || !code) return adminRedirect(request, "linkedin_error", "invalid_callback");

  const admin = createAdminClient();
  try {
    await assertRateLimit({ action: "linkedin_oauth_callback", subject: `user:${user.id}`, windowSeconds: 600, maxRequests: 12 });
    const now = new Date().toISOString();
    const { data: consumed, error: stateError } = await admin.from("linkedin_oauth_states")
      .update({ used_at: now })
      .eq("state_hash", hashOAuthState(state))
      .eq("admin_user_id", user.id)
      .is("used_at", null)
      .gt("expires_at", now)
      .select("id")
      .maybeSingle();
    if (stateError || !consumed) return adminRedirect(request, "linkedin_error", "invalid_state");

    const token = await exchangeLinkedInCode(code);
    const scopes = token.scopes.length ? token.scopes : [];
    if (!scopes.includes("w_member_social")) return adminRedirect(request, "linkedin_error", "missing_scope");
    const profile = await getLinkedInUserInfo(token.accessToken);
    const expiresAt = new Date(Date.now() + Math.max(60, token.expiresIn) * 1000).toISOString();
    const { error: previousConnectionError } = await admin.from("linkedin_connections").update({ status: "disconnected", disconnected_at: now }).neq("member_subject", profile.subject).neq("status", "disconnected");
    if (previousConnectionError) throw previousConnectionError;
    const { error } = await admin.from("linkedin_connections").upsert({
      member_subject: profile.subject,
      member_urn: profile.memberUrn,
      display_name: profile.name,
      profile_picture_url: profile.picture,
      access_token_encrypted: encryptLinkedInToken(token.accessToken),
      token_expires_at: expiresAt,
      scopes: [...new Set(scopes.filter((scope) => LINKEDIN_OAUTH_SCOPES.includes(scope)))],
      status: "connected",
      last_error: null,
      connected_by: user.id,
      connected_at: now,
      disconnected_at: null
    }, { onConflict: "member_subject" });
    if (error) throw error;
    return adminRedirect(request, "linkedin_connected", "1");
  } catch (error) {
    console.error("linkedin_oauth_callback_failed", { code: error?.code || error?.message || "unknown_error" });
    return adminRedirect(request, "linkedin_error", "callback_failed");
  }
}
