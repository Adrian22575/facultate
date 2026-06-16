import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { LicentaSessionWorkspaceClient } from "@/components/licenta-session-workspace-client";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getLicentaImportSessionSnapshot } from "@/lib/ai/import-pipeline";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Licenta in lucru | Nota 5+"
};

export default async function LicentaImportSessionPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/auth/login?next=/materiale/licenta/${resolvedParams.sessionId}`);
  }

  if (isDemoUser(user)) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref(`/materiale/licenta/${resolvedParams.sessionId}`));
  }

  let snapshot = null;
  try {
    snapshot = await getLicentaImportSessionSnapshot({
      sessionId: resolvedParams.sessionId,
      userId: user.id,
      activeImportJobId: typeof resolvedSearchParams?.set === "string" ? resolvedSearchParams.set : null
    });
  } catch {
    notFound();
  }

  if (!snapshot) {
    notFound();
  }

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <PendingNavigationLink
            className="btn-back"
            href="/materiale"
            pendingLabel="Se revine..."
            pendingMode="replace"
          >
            Inapoi
          </PendingNavigationLink>
        }
        kicker="Import licenta"
        title="Licenta pe seturi"
        subtitle="Adaugi seturile pe rand, revii la ele cand ai nevoie si finalizezi o singura data."
      />

      <LicentaSessionWorkspaceClient initialSnapshot={snapshot} />
    </main>
  );
}
