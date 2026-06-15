import { NextResponse } from "next/server";

import { REFERRAL_COOKIE_NAME, getReferralCookieOptions } from "@/lib/referrals";

function normalizeReferralCode(code) {
  return String(code || "")
    .trim()
    .replace(/[^a-z0-9]/gi, "")
    .toUpperCase()
    .slice(0, 16);
}

export async function GET(request, { params }) {
  const resolvedParams = await params;
  const requestUrl = new URL(request.url);
  const referralCode = normalizeReferralCode(resolvedParams?.code);
  const destination = new URL("/auth/login", requestUrl.origin);

  destination.searchParams.set("next", "/");

  if (referralCode) {
    destination.searchParams.set("ref", "1");
  }

  const response = NextResponse.redirect(destination);

  if (referralCode) {
    response.cookies.set(REFERRAL_COOKIE_NAME, referralCode, getReferralCookieOptions());
  }

  return response;
}
