"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { isDemoUser } from "@/lib/demo-user";
import { requireUser } from "@/lib/supabase/guards";
import { TESTIMONIAL_REWARD_QUESTIONS } from "@/lib/testimonial-reward-copy";
import { activateApprovedTestimonialReward, submitTestimonialReward } from "@/lib/testimonial-rewards";

function isRedirectError(error) {
  return (
    typeof error === "object" &&
    error !== null &&
    "digest" in error &&
    typeof error.digest === "string" &&
    error.digest.startsWith("NEXT_REDIRECT;")
  );
}

function parseAnswers(formData) {
  return Object.fromEntries(
    TESTIMONIAL_REWARD_QUESTIONS.map((question) => [
      question.key,
      String(formData.get(question.key) || "")
    ])
  );
}

function getSafeReturnPath(formData) {
  const returnTo = formData.get("returnTo");
  if (
    typeof returnTo === "string" &&
    returnTo.startsWith("/") &&
    !returnTo.startsWith("//") &&
    !returnTo.includes("\\") &&
    !returnTo.includes("\n")
  ) {
    return returnTo.slice(0, 300);
  }

  return "/review-reward";
}

export async function submitTestimonialRewardAction(formData) {
  const user = await requireUser("/review-reward");

  if (isDemoUser(user)) {
    redirect("/review-reward?status=demo");
  }

  try {
    const result = await submitTestimonialReward({
      userId: user.id,
      userEmail: user.email,
      rewardType: String(formData.get("rewardType") || "ai_upload_1"),
      answers: parseAnswers(formData)
    });

    revalidatePath("/review-reward");
    revalidatePath("/admin");

    if (result.submitted) {
      redirect("/review-reward?status=saved");
    }

    redirect(`/review-reward?status=${encodeURIComponent(result.reason || "error")}`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect("/review-reward?status=error");
  }
}

export async function activateTestimonialRewardAction(formData) {
  const user = await requireUser("/review-reward");
  const returnTo = getSafeReturnPath(formData);

  if (isDemoUser(user)) {
    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}testimonial=error&status=reward_error`);
  }

  const submissionId = String(formData.get("submissionId") || "");

  try {
    const result = await activateApprovedTestimonialReward({
      userId: user.id,
      submissionId: submissionId || null
    });

    revalidatePath("/review-reward");
    revalidatePath("/cont");
    revalidatePath("/admin");

    if (result.activated || result.alreadyActivated) {
      redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}testimonial=activated&status=reward_activated`);
    }

    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}testimonial=missing&status=reward_missing`);
  } catch (error) {
    if (isRedirectError(error)) {
      throw error;
    }

    redirect(`${returnTo}${returnTo.includes("?") ? "&" : "?"}testimonial=error&status=reward_error`);
  }
}
