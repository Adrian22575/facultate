import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { ModeGrid } from "@/components/mode-grid";
import { SubjectLearningHub } from "@/components/subject-learning-hub";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getBillingSnapshot } from "@/lib/billing";
import { getAccessibleSubjectById, getDemoSubject, getSubjectById, getSubjectProgressSnapshot } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getLearningModesLockHref, hasLearningModesAccess } from "@/lib/learning-access";
import { getLearningStudySetsForSubject } from "@/lib/learning/study-sets";
import { getOptionalUser } from "@/lib/supabase/guards";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  const subject = await getSubjectById(resolvedParams.subjectId);
  return {
    title: subject ? `${subject.title} · Teste Facultate` : "Materia"
  };
}

export default async function SubjectPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);
  let academicContext = null;
  let billingSnapshot = null;

  if (!user) {
    redirect(`/auth/login?next=/materii/${resolvedParams.subjectId}`);
  }

  if (!demoMode) {
    academicContext = await getAcademicContext(user.id);
    if (!isAcademicContextComplete(academicContext)) {
      redirect(getOnboardingHref(`/materii/${resolvedParams.subjectId}`));
    }
  }

  if (demoMode) {
    const demoSubject = await getDemoSubject();
    if (!demoSubject || resolvedParams.subjectId !== demoSubject.id) {
      redirect("/demo");
    }
  }

  const subject = demoMode
    ? await getSubjectById(resolvedParams.subjectId)
    : await getAccessibleSubjectById({
        subjectId: resolvedParams.subjectId,
        userId: user.id,
        membership: academicContext?.membership
      });
  if (!subject) notFound();
  if (!demoMode) {
    billingSnapshot = await getBillingSnapshot(user.id);
  }
  const canUseLearningModes = await hasLearningModesAccess({ user, demoMode, billingSnapshot });
  const [progress, studySets] = demoMode
    ? [null, []]
    : await Promise.all([
        getSubjectProgressSnapshot(user.id, subject.id),
        getLearningStudySetsForSubject({
          subjectId: subject.id,
          userId: user.id,
          academicContext,
          limit: 6
        })
      ]);

  const hasAvailableWelcomePremium =
    !demoMode && !billingSnapshot?.activePremium && billingSnapshot?.welcomePremiumStatus === "available";
  const welcomeState =
    typeof resolvedSearchParams?.welcome === "string" ? resolvedSearchParams.welcome : null;

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <Link className="btn-back" href={demoMode ? "/demo" : "/materii"}>
            {demoMode ? "Inapoi la demo" : "Înapoi la materii"}
          </Link>
        }
        kicker="Materia ta"
        title={subject.title}
        subtitle="Materiale, teste si progres pentru aceeasi materie."
      />
      <SubjectLearningHub
        subject={subject}
        studySets={studySets}
        progress={progress}
        locked={!canUseLearningModes}
        lockHref={getLearningModesLockHref(`/materii/${subject.id}`)}
      />
      <ModeGrid
        subject={subject}
        locked={!canUseLearningModes}
        lockHref={getLearningModesLockHref(`/materii/${subject.id}`)}
        showWelcomePremium={hasAvailableWelcomePremium}
        welcomeReturnTo={`/materii/${subject.id}`}
        welcomeState={welcomeState}
      />
    </main>
  );
}
