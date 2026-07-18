import { randomBytes } from "node:crypto";

import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { buildLinkedInAuthorizationUrl, getLinkedInConfigStatus } from "@/lib/linkedin/config";
import { hashOAuthState } from "@/lib/linkedin/shared";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.redirect(new URL("/auth/login?next=/admin%3Fadmin_tab%3Deditorial", request.url));
  if (!getLinkedInConfigStatus().ready) return NextResponse.redirect(new URL("/admin?admin_tab=editorial&linkedin_error=not_configured#editorial-workspace", request.url));

  try {
    await assertRateLimit({ action: "linkedin_oauth_start", subject: `user:${user.id}`, windowSeconds: 600, maxRequests: 8 });
    const state = randomBytes(32).toString("base64url");
    const admin = createAdminClient();
    const { error } = await admin.from("linkedin_oauth_states").insert({
      state_hash: hashOAuthState(state),
      admin_user_id: user.id,
      return_path: "/admin?admin_tab=editorial#editorial-workspace",
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString()
    });
    if (error) throw error;
    return NextResponse.redirect(buildLinkedInAuthorizationUrl(state));
  } catch (error) {
    const code = error?.code === "RATE_LIMITED" ? "rate_limited" : "oauth_start_failed";
    return NextResponse.redirect(new URL(`/admin?admin_tab=editorial&linkedin_error=${code}#editorial-workspace`, request.url));
  }
}
