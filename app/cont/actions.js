"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { getPostLoginNextPath } from "@/lib/auth/password-auth";
import { isDemoUser } from "@/lib/demo-user";
import { activateReadyReferralReward } from "@/lib/referrals";
import { requireUser } from "@/lib/supabase/guards";
import { activateWelcomePremiumClaim } from "@/lib/welcome-pack";

function getSafeReturnPath(formData) {
  const returnTo = formData.get("returnTo");
  const safePath = getPostLoginNextPath(returnTo);
  return safePath === "/" && returnTo !== "/" ? "/cont?section=plans" : safePath;
}

function withState(path, key, value) {
  const url = new URL(path, "https://nota5.internal");
  url.searchParams.set(key, value);
  return `${url.pathname}${url.search}${url.hash}`;
}

function isRedirectError(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT;")
  );
}

export async function activateWelcomePremiumAction(formData) {
  const user = await requireUser("/cont");

  if (isDemoUser(user)) {
    redirect("/cont?section=plans&welcome=error");
  }

  const returnTo = getSafeReturnPath(formData);

  try {
    const result = await activateWelcomePremiumClaim({
      userId: user.id
    });

    revalidatePath("/cont");

    if (result.activated || result.alreadyActivated) {
      redirect(withState(returnTo, "welcome", "activated"));
    }

    redirect(withState(returnTo, "welcome", "missing"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect(withState(returnTo, "welcome", "error"));
  }
}

export async function activateReferralRewardAction(formData) {
  const user = await requireUser("/cont");

  if (isDemoUser(user)) {
    redirect("/cont?section=plans&referral=error");
  }

  const returnTo = getSafeReturnPath(formData);

  try {
    const result = await activateReadyReferralReward({
      userId: user.id
    });

    revalidatePath("/cont");

    if (result.activated) {
      redirect(withState(returnTo, "referral", "activated"));
    }

    redirect(withState(returnTo, "referral", "missing"));
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect(withState(returnTo, "referral", "error"));
  }
}
