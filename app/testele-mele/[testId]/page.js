import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { PrivateTestPlayer } from "@/components/private-test-player";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { getPrivateGeneratedTestById } from "@/lib/private-tests";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export default async function MyTestDetailPage({ params }) {
  const resolvedParams = await params;
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/auth/login?next=/testele-mele/${resolvedParams.testId}`);
  }

  if (isDemoUser(user)) {
    redirect("/testele-mele");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref(`/testele-mele/${resolvedParams.testId}`));
  }

  const payload = await getPrivateGeneratedTestById(user.id, resolvedParams.testId);
  if (!payload) {
    notFound();
  }

  if (payload.test.status !== "active") {
    redirect(`/materiale/drafts/${resolvedParams.testId}`);
  }

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <PendingNavigationLink
            className="btn-back"
            href="/testele-mele"
            pendingLabel="Se incarca testele..."
            pendingMode="replace"
          >
            Inapoi la testele mele
          </PendingNavigationLink>
        }
        kicker="Test activ"
        title={payload.test.title}
        subtitle={
          payload.test.isCommunityShared
            ? "Parcurge un test publicat pentru comunitatea ta."
            : "Parcurge testul tau activ exact ca intr-un mod de lucru dedicat."
        }
      />
      <PrivateTestPlayer test={payload.test} questions={payload.questions} />
    </main>
  );
}
