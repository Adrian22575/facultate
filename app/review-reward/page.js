import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { TestimonialRewardForm } from "@/components/testimonial-reward-form";
import {
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { requireUser } from "@/lib/supabase/guards";
import { getUserTestimonialRewardStatus } from "@/lib/testimonial-rewards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "ReviewReward | Nota 5+"
};

export default async function ReviewRewardPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const user = await requireUser("/review-reward");

  if (isDemoUser(user)) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/review-reward"));
  }

  const latestSubmission = await getUserTestimonialRewardStatus(user.id);
  const status = typeof resolvedSearchParams?.status === "string" ? resolvedSearchParams.status : "";

  return (
    <main className="app-shell testimonial-reward-page">
      <AppHeader
        action={
          <Link className="btn-back" href="/cont">
            Inapoi la cont
          </Link>
        }
        title="ReviewReward"
        subtitle="Un review scurt, verificat, cu recompensa dupa aprobare."
      />

      <TestimonialRewardForm latestSubmission={latestSubmission} status={status} />
    </main>
  );
}
