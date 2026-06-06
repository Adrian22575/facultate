import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { ModeGrid } from "@/components/mode-grid";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getBillingSnapshot } from "@/lib/billing";
import { getAccessibleSubjectById, getDemoSubject, getSubjectById } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { hasLearningModesAccess, LEARNING_MODES_LOCK_HREF } from "@/lib/learning-access";
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
  const canUseLearningModes = await hasLearningModesAccess({ user, demoMode });
  if (!demoMode) {
    try {
      billingSnapshot = await getBillingSnapshot(user.id);
    } catch {
      billingSnapshot = null;
    }
  }

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
        kicker="Alege modul"
        title={subject.title}
        subtitle="Alege cum vrei sa lucrezi materia acum."
      />
      <ModeGrid
        subject={subject}
        locked={!canUseLearningModes}
        lockHref={LEARNING_MODES_LOCK_HREF}
        showWelcomePremium={hasAvailableWelcomePremium}
        welcomeReturnTo={`/materii/${subject.id}`}
        welcomeState={welcomeState}
      />
    </main>
  );
}
