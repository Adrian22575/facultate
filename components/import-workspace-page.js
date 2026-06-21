import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { LicentaImportWorkspaceClient } from "@/components/licenta-import-workspace-client";
import { getActiveLicentaImportSession } from "@/lib/ai/import-pipeline";
import {
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
    subtitle: "Incarca grilele, verifica intrebarile extrase si publica testul la materia potrivita."
  },
  licenta: {
    path: "/materiale/licenta",
    title: "Pregateste licenta",
    subtitle: "Adauga seturile intr-o singura licenta, verifica raspunsurile si pregateste simularea."
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

  return (
    <main className="app-shell ai-workspace-page ai-workspace-dedicated-page">
      <AppHeader
        action={
          <Link className="btn-back" href="/materiale">
            Inapoi la Workspace
          </Link>
        }
        title={page.title}
        subtitle={page.subtitle}
      />

      <section className="surface workspace-upload-surface ai-workspace-upload-surface">
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
      </section>
    </main>
  );
}
