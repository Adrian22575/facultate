import { redirect } from "next/navigation";

import { LicentaImportWorkspaceClient } from "@/components/licenta-import-workspace-client";
import { WorkspaceUploadShell } from "@/components/workspace-upload-shell";
import { getActiveLicentaImportSession } from "@/lib/ai/import-pipeline";
import {
  getAcademicCommunityLabel,
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { getBillingSnapshot } from "@/lib/billing";
import { getSubjectAllocations, getSubjects } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";

const PAGE_CONTENT = {
  test: {
    path: "/materiale/importa",
    title: "Importa intrebari existente",
    subtitle: "Urca grilele, verifica rapid intrebarile si publica testul la materia potrivita."
  },
  licenta: {
    path: "/materiale/licenta",
    title: "Pregateste licenta",
    subtitle: "Adauga seturile, corecteaza ce trebuie si finalizeaza simularea cand totul este verificat."
  }
};

export async function ImportWorkspacePage({ mode, searchParams }) {
  const page = PAGE_CONTENT[mode];
  if (!page) redirect("/materiale");

  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) redirect(`/auth/login?next=${encodeURIComponent(page.path)}`);
  if (demoMode) redirect("/demo");

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref(page.path));
  }

  let billingSnapshot = { aiCredits: 0 };
  let subjects = [];
  let subjectAllocations = [];
  let activeLicentaSession = null;
  let setupWarning = null;

  try {
    const results = await Promise.all([
      getBillingSnapshot(user.id),
      mode === "test" ? getSubjects() : Promise.resolve([]),
      mode === "test" ? getSubjectAllocations() : Promise.resolve([]),
      mode === "licenta" ? getActiveLicentaImportSession(user.id) : Promise.resolve(null)
    ]);
    [billingSnapshot, subjects, subjectAllocations, activeLicentaSession] = results;
  } catch {
    setupWarning = "Pagina nu a putut fi pregatita complet momentan. Incearca din nou.";
  }

  const message =
    typeof resolvedSearchParams?.message === "string"
      ? resolvedSearchParams.message
      : null;
  const error =
    typeof resolvedSearchParams?.error === "string"
      ? resolvedSearchParams.error
      : null;
  const userType = academicContext?.profile?.user_type === "elev" ? "elev" : "student";
  const communityLabel = getAcademicCommunityLabel(academicContext);
  const meta = [
    `${billingSnapshot.aiCredits || 0} incarcari disponibile`,
    communityLabel
  ].filter(Boolean);

  return (
    <WorkspaceUploadShell
      title={page.title}
      subtitle={page.subtitle}
      meta={meta}
    >
      <LicentaImportWorkspaceClient
        fixedMode={mode}
        userType={userType}
        subjects={subjects}
        subjectAllocations={subjectAllocations}
        demoMode={demoMode}
        setupWarning={setupWarning}
        billingSnapshot={billingSnapshot}
        activeLicentaSession={activeLicentaSession}
        message={message}
        error={error}
      />
    </WorkspaceUploadShell>
  );
}
