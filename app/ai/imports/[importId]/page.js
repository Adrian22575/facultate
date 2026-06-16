import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { ImportJobStatusClient } from "@/components/import-job-status-client";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getImportStatus } from "@/lib/ai/import-pipeline";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Import grile | Nota 5+"
};

export default async function AIImportPage({ params }) {
  const resolvedParams = await params;
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/auth/login?next=/materiale/imports/${resolvedParams.importId}`);
  }

  if (isDemoUser(user)) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref(`/materiale/imports/${resolvedParams.importId}`));
  }

  let initialStatus = null;
  try {
    initialStatus = await getImportStatus({
      importJobId: resolvedParams.importId,
      userId: user.id
    });
  } catch {
    notFound();
  }

  if (!initialStatus) {
    notFound();
  }

  if (initialStatus.licentaSessionId) {
    redirect(`/materiale/licenta/${initialStatus.licentaSessionId}?set=${initialStatus.importJobId}`);
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
        title="Pregatim intrebarile"
        subtitle="Procesarea continua aici. Cand importul este gata, verifici rezultatul si il salvezi."
      />

      <ImportJobStatusClient initialStatus={initialStatus} />
    </main>
  );
}
