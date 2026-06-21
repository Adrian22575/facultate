import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { InteractiveQuiz } from "@/components/interactive-quiz";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getQuestionsForSubject } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getLearningModesLockHref, hasLearningModesAccess } from "@/lib/learning-access";
import { getOptionalUser } from "@/lib/supabase/guards";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const data = await getQuestionsForSubject(resolvedParams.subjectId);
  return {
    title: data ? `Interactiv · ${data.subject.title}` : "Mod Interactiv"
  };
}

export default async function InteractivePage({ params }) {
  const resolvedParams = await params;
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);
  let academicContext = null;

  if (!user) {
    redirect(`/auth/login?next=/materii/${resolvedParams.subjectId}/interactiv`);
  }

  if (!demoMode) {
    academicContext = await getAcademicContext(user.id);
    if (!isAcademicContextComplete(academicContext)) {
      redirect(getOnboardingHref(`/materii/${resolvedParams.subjectId}/interactiv`));
    }
  }

  const canUseLearningModes = await hasLearningModesAccess({ user, demoMode });
  if (!canUseLearningModes) {
    redirect(getLearningModesLockHref(`/materii/${resolvedParams.subjectId}/interactiv`));
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
        kicker="Feedback instant"
        title={`Mod Interactiv - ${data.subject.title}`}
        subtitle="Raspunde pe rand si vezi imediat varianta corecta."
      />
      <InteractiveQuiz subject={data.subject} initialQuestions={data.questions} />
    </main>
  );
}
