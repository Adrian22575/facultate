"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isDemoUser } from "@/lib/demo-user";
import { activateReadyReferralReward } from "@/lib/referrals";
import { requireUser } from "@/lib/supabase/guards";
import { activateWelcomePremiumClaim } from "@/lib/welcome-pack";

function getSafeReturnPath(formData) {
  const returnTo = formData.get("returnTo");
  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("\\") &&
    !returnTo.includes("\n")
  ) {
    return returnTo;
  }

  return "/cont?section=plans";
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
      redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}welcome=activated`);
    }

    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}welcome=missing`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}welcome=error`);
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
      redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}referral=activated`);
    }

    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}referral=missing`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}referral=error`);
  }
}
