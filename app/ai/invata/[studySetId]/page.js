import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { LearningStudySetClient } from "@/components/learning-study-set-client";
import {
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { getLearningStudySetForUser } from "@/lib/learning/study-sets";
import { getOptionalUser } from "@/lib/supabase/guards";
import { getLearningSetupErrorMessage } from "@/lib/supabase/setup-status";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  return {
    title: `Invatare | ${resolvedParams.studySetId}`
  };
}

export default async function LearningStudySetPage({ params }) {
  const resolvedParams = await params;
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) {
    redirect(`/auth/login?next=/materiale/invata/${resolvedParams.studySetId}`);
  }

  if (demoMode) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref(`/materiale/invata/${resolvedParams.studySetId}`));
  }

  let studySet = null;
  let setupWarning = null;

  try {
    studySet = await getLearningStudySetForUser({
      studySetId: resolvedParams.studySetId,
      userId: user.id,
      academicContext
    });
  } catch (error) {
    setupWarning = getLearningSetupErrorMessage(error);
    if (!setupWarning) throw error;
  }

  if (setupWarning) {
    return (
      <main className="app-shell learning-study-page">
        <AppHeader
          action={
            <Link className="btn-back" href="/materiale/invata">
              Inapoi la invatare
            </Link>
          }
          kicker="Invata"
          title="Material indisponibil momentan"
          subtitle="Zona de invatare nu poate incarca acest material pana cand configurarea este completa."
        />
        <div className="error-state" role="alert">{setupWarning}</div>
      </main>
    );
  }

  if (!studySet) {
    notFound();
  }

  return (
    <main className="app-shell learning-study-page">
      <AppHeader
        action={
          <Link className="btn-back" href="/materiale/invata">
            Inapoi la invatare
          </Link>
        }
        kicker={studySet.isOwner ? "Materia ta" : "Din comunitate"}
        title={studySet.title}
        subtitle="Capitole, flashcards, teste si plan intr-un singur loc."
      />
      <LearningStudySetClient studySet={studySet} />
    </main>
  );
}
