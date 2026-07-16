import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { TestPageClient } from "@/components/test-page-client";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getQuestionsForSubject, getSubjectProgressSnapshot } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getLearningModesLockHref, hasLearningModesAccess } from "@/lib/learning-access";
import { getOptionalUser } from "@/lib/supabase/guards";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const data = await getQuestionsForSubject(resolvedParams.subjectId);
  return {
    title: data ? `Test · ${data.subject.title}` : "Test"
  };
}

export default async function TestPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);
  let academicContext = null;

  if (!user) {
    redirect(`/auth/login?next=/materii/${resolvedParams.subjectId}/test`);
  }

  if (!demoMode) {
    academicContext = await getAcademicContext(user.id);
    if (!isAcademicContextComplete(academicContext)) {
      redirect(getOnboardingHref(`/materii/${resolvedParams.subjectId}/test`));
    }
  }

  const canUseLearningModes = await hasLearningModesAccess({ user, demoMode });
  if (!canUseLearningModes) {
    redirect(getLearningModesLockHref(`/materii/${resolvedParams.subjectId}/test`));
  }

  const data = await getQuestionsForSubject(
    resolvedParams.subjectId,
    !demoMode && academicContext?.membership
      ? { userId: user.id, membership: academicContext.membership }
      : {}
  );
  if (!data || !data.questions.length) notFound();

  const progress = demoMode ? null : await getSubjectProgressSnapshot(user.id, data.subject.id);
  const initialMode = resolvedSearchParams?.mode === "mistakes" ? "mistakes" : "";

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
        kicker="Test pe materie"
        title={`Test — ${data.subject.title}`}
        subtitle="Alege durata testului si modul de amestecare."
      />
      <TestPageClient
        subject={data.subject}
        initialQuestions={data.questions}
        initialMistakeQuestionIds={progress?.mistake_question_ids || []}
        initialMode={initialMode}
      />
    </main>
  );
}
