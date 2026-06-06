import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AIJobStatusClient } from "@/components/ai-job-status-client";
import { AppHeader } from "@/components/app-header";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getQuestionBankJobSnapshot } from "@/lib/ai/question-bank-pipeline";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";
import { getAIQuestionBankSetupErrorMessage } from "@/lib/supabase/setup-status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Procesare fisier | Nota 5+"
};

export default async function AIJobPage({ params }) {
  const resolvedParams = await params;
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) {
    redirect(`/auth/login?next=/materiale/jobs/${resolvedParams.jobId}`);
  }

  if (demoMode) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref(`/materiale/jobs/${resolvedParams.jobId}`));
  }

  let job = null;
  try {
    job = await getQuestionBankJobSnapshot({
      jobId: resolvedParams.jobId,
      userId: user.id
    });
  } catch (error) {
    const setupMessage = getAIQuestionBankSetupErrorMessage(error);
    if (setupMessage) {
      redirect(`/materiale?error=${encodeURIComponent(setupMessage)}`);
    }

    throw error;
  }

  if (!job) {
    notFound();
  }

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <Link className="btn-back" href="/materiale">
            Inapoi
          </Link>
        }
        kicker="Fisierul tau"
        title="Pregatim intrebarile"
        subtitle="Procesarea continua aici. Cand rezultatul este gata, verifici intrebarile si confirmi publicarea."
      />

      <AIJobStatusClient initialJob={job} />
    </main>
  );
}
