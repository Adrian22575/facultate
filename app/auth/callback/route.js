import { NextResponse } from "next/server";

import { getAcademicContext, isAcademicContextComplete } from "@/lib/academic/server";
import { clearDemoSession } from "@/lib/demo-session";
import { ensurePremiumGrantFromAllowlist } from "@/lib/free-access";
import { notifyAdminUserCreated } from "@/lib/notifications/telegram";
import {
  REFERRAL_COOKIE_NAME,
  captureReferralForUser,
  getExpiredReferralCookieOptions,
  markReferralReadyAfterAccountConfirmation
} from "@/lib/referrals";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const NEW_AUTH_USER_WINDOW_MS = 10 * 60 * 1000;

function getSafeInternalPath(path, fallback = "/") {
  if (typeof path === "string" && path.startsWith("/") && !path.startsWith("//")) {
    return path;
  }

  return fallback;
}

function isRecentlyCreatedAuthUser(user) {
  const createdAt = Date.parse(user?.created_at || "");
  return Number.isFinite(createdAt) && Date.now() - createdAt <= NEW_AUTH_USER_WINDOW_MS;
}

function getSafeAuthErrorDetails(error) {
  if (!error || typeof error !== "object") {
    return { message: "Unknown auth error" };
  }

  const details = {};

  if ("message" in error && typeof error.message === "string") {
    details.message = error.message;
  }

  if ("status" in error && error.status) {
    details.status = error.status;
  }

  if ("code" in error && error.code) {
    details.code = error.code;
  }

  if ("name" in error && typeof error.name === "string") {
    details.name = error.name;
  }

  return details;
}

export async function GET(request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const nextPath = requestUrl.searchParams.get("next");
  const safeNext = getSafeInternalPath(nextPath);
  const referralCode = request.cookies.get(REFERRAL_COOKIE_NAME)?.value || "";

  if (!code) {
    return NextResponse.redirect(
      new URL("/auth/login?error=missing_code", requestUrl.origin)
    );
  }

  try {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error(
        "Google OAuth code exchange failed:",
        getSafeAuthErrorDetails(error)
      );

      return NextResponse.redirect(
        new URL("/auth/login?error=oauth_exchange_failed", requestUrl.origin)
      );
    }

    await clearDemoSession();

    const {
      data: { user }
    } = await supabase.auth.getUser();

    if (user) {
      const admin = createAdminClient();
      const fullName =
        user.user_metadata?.full_name || user.user_metadata?.name || null;
      const avatarUrl =
        user.user_metadata?.avatar_url || user.user_metadata?.picture || null;

      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: user.id,
          email: user.email || null,
          full_name: fullName,
          avatar_url: avatarUrl
        },
        {
          onConflict: "id"
        }
      );

      if (profileError) {
        console.error("Profile sync after Google OAuth failed:", profileError.message);
      }

      const isNewUser = isRecentlyCreatedAuthUser(user);

      if (!profileError && isNewUser) {
        await notifyAdminUserCreated({ user, source: "google_oauth" });
      }

      if (isNewUser && referralCode) {
        try {
          const referralCapture = await captureReferralForUser({
            referredUserId: user.id,
            referralCode,
            source: "google_oauth"
          });
          if (referralCapture?.referralId) {
            await markReferralReadyAfterAccountConfirmation({
              referredUserId: user.id,
              reason: "google_oauth_login"
            });
          }
        } catch (referralError) {
          console.error("Referral capture after Google OAuth failed:", referralError);
        }
      }

      try {
        await markReferralReadyAfterAccountConfirmation({
          referredUserId: user.id,
          reason: "authenticated_callback"
        });
      } catch (referralReadyError) {
        console.error("Referral readiness after auth callback failed:", referralReadyError);
      }

      try {
        await ensurePremiumGrantFromAllowlist({
          userId: user.id,
          email: user.email || null
        });
      } catch (allowlistError) {
        console.error("Free access allowlist grant failed:", allowlistError);
      }
    }

    const onboardingDestination =
      safeNext === "/" || safeNext.startsWith("/onboarding")
        ? "/onboarding"
        : `/onboarding?next=${encodeURIComponent(safeNext)}`;
    const destination =
      user && isAcademicContextComplete(await getAcademicContext(user.id))
        ? safeNext
        : onboardingDestination;

    const response = NextResponse.redirect(new URL(destination, requestUrl.origin));
    if (referralCode) {
      response.cookies.set(REFERRAL_COOKIE_NAME, "", getExpiredReferralCookieOptions());
    }

    return response;
  } catch (error) {
    console.error(
      "Google OAuth callback failed unexpectedly:",
      getSafeAuthErrorDetails(error)
    );

    return NextResponse.redirect(
      new URL("/auth/login?error=unexpected", requestUrl.origin)
    );
  }
}
