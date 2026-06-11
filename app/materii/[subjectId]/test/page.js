import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { TestPageClient } from "@/components/test-page-client";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getQuestionsForSubject } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { hasLearningModesAccess, LEARNING_MODES_LOCK_HREF } from "@/lib/learning-access";
import { getOptionalUser } from "@/lib/supabase/guards";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const data = await getQuestionsForSubject(resolvedParams.subjectId);
  return {
    title: data ? `Test · ${data.subject.title}` : "Test"
  };
}

export default async function TestPage({ params }) {
  const resolvedParams = await params;
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
    redirect(LEARNING_MODES_LOCK_HREF);
  }

  const data = await getQuestionsForSubject(
    resolvedParams.subjectId,
    !demoMode && academicContext?.membership
      ? { userId: user.id, membership: academicContext.membership }
      : {}
  );
  if (!data || !data.questions.length) notFound();

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <Link className="btn-back" href={`/materii/${data.subject.id}`}>
            Inapoi
          </Link>
        }
        kicker="Test pe materie"
        title={`Test — ${data.subject.title}`}
        subtitle="Alege durata testului si modul de amestecare."
      />
      <TestPageClient subject={data.subject} initialQuestions={data.questions} />
    </main>
  );
}
