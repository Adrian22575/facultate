import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { StudyPageClient } from "@/components/study-page-client";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getQuestionsForSubject, getSubjectProgressSnapshot } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getLearningModesLockHref, hasLearningModesAccess } from "@/lib/learning-access";
import { getOptionalUser } from "@/lib/supabase/guards";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const data = await getQuestionsForSubject(resolvedParams.subjectId);
  return {
    title: data ? `Studiu · ${data.subject.title}` : "Mod Studiu"
  };
}

export default async function StudyPage({ params }) {
  const resolvedParams = await params;
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);
  let academicContext = null;

  if (!user) {
    redirect(`/auth/login?next=/materii/${resolvedParams.subjectId}/studiu`);
  }

  if (!demoMode) {
    academicContext = await getAcademicContext(user.id);
    if (!isAcademicContextComplete(academicContext)) {
      redirect(getOnboardingHref(`/materii/${resolvedParams.subjectId}/studiu`));
    }
  }

  const canUseLearningModes = await hasLearningModesAccess({ user, demoMode });
  if (!canUseLearningModes) {
    redirect(getLearningModesLockHref(`/materii/${resolvedParams.subjectId}/studiu`));
  }

  const data = await getQuestionsForSubject(
    resolvedParams.subjectId,
    !demoMode && academicContext?.membership
      ? { userId: user.id, membership: academicContext.membership }
      : {}
  );
  if (!data || !data.questions.length) notFound();
  const progress = demoMode
    ? null
    : await getSubjectProgressSnapshot(user.id, data.subject.id);

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <PendingNavigationLink
            className="btn-back"
            href={`/materii/${data.subject.id}`}
            pendingLabel="Se revine la materie..."
            pendingMode="replace"
          >
            Inapoi
          </PendingNavigationLink>
        }
        kicker="Recapitulare completa"
        title={`Mod Studiu - ${data.subject.title}`}
        subtitle="Parcurge toate intrebarile cu raspunsurile corecte evidentiate si explicatiile disponibile."
      />
      <StudyPageClient
        subject={data.subject}
        questions={data.questions}
        initialViewedIndexes={progress?.study_viewed_question_ids || []}
      />
    </main>
  );
}
