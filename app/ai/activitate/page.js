import { Upload } from "lucide-react";
import { redirect } from "next/navigation";

import { AIActivityCenterClient } from "@/components/ai-activity-center-client";
import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { getUserImportJobs, getUserLicentaImportSessions } from "@/lib/ai/import-pipeline";
import {
  getUserQuestionBankJobs,
  getUserQuestionBankMaterials
} from "@/lib/ai/question-bank-pipeline";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { getPrivateGeneratedTests } from "@/lib/private-tests";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Activitate materiale | Nota 5+"
};

function getActivityTimestamp(item) {
  const parsed = Date.parse(item?.updatedAt || item?.completedAt || item?.createdAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

function IconText({ icon: Icon, children }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

export default async function AIActivityPage() {
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) {
    redirect("/auth/login?next=/materiale/activitate");
  }

  if (demoMode) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);

  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/materiale/activitate"));
  }

  let materials = [];
  let activityJobs = [];
  let licentaSessions = [];
  let testGroups = { active: [], drafts: [] };
  let setupWarning = null;

  try {
    const [jobs, importJobs, licentaSessionRows, materialRows, tests] = await Promise.all([
      getUserQuestionBankJobs(user.id, 16),
      getUserImportJobs(user.id, 16),
      getUserLicentaImportSessions(user.id, 12),
      getUserQuestionBankMaterials(user.id, 60),
      getPrivateGeneratedTests(user.id)
    ]);

    activityJobs = [...jobs, ...importJobs].sort(
      (left, right) => getActivityTimestamp(right) - getActivityTimestamp(left)
    );
    licentaSessions = licentaSessionRows;
    materials = materialRows;
    testGroups = tests;
  } catch (error) {
    setupWarning = "Activitatea nu a putut fi incarcata momentan. Incearca din nou.";
  }

  const hasAnyActivity =
    materials.length ||
    activityJobs.length ||
    licentaSessions.length ||
    testGroups.active.length ||
    testGroups.drafts.length;

  return (
    <main className="app-shell ai-workspace-page ai-activity-page">
      <AppHeader
        title="Activitate materiale"
        subtitle="Materialele, importurile si testele tale intr-un singur loc."
        hidePageTitle
      />

      <section className="ai-workspace-header ai-activity-header">
        <div className="ai-workspace-header-copy">
          <span className="ui-section-label">Activitate</span>
          <h1 className="ai-workspace-title">Materialele si procesarile tale.</h1>
          <p className="ai-workspace-subtitle">
            Revii la importuri, verifici materialele salvate si deschizi testele pregatite fara sa
            incarci din nou fisierele.
          </p>
        </div>
        <PendingNavigationLink
          className="btn-link secondary ai-activity-back-link"
          href="/materiale"
          pendingLabel="Se deschide uploadul..."
          pendingMode="replace"
        >
          <IconText icon={Upload}>Incarca alt material</IconText>
        </PendingNavigationLink>
      </section>

      {setupWarning ? <div className="error-state">{setupWarning}</div> : null}

      {hasAnyActivity ? (
        <AIActivityCenterClient
          materials={materials}
          activityJobs={activityJobs}
          licentaSessions={licentaSessions}
          testGroups={testGroups}
        />
      ) : (
        <section className="surface ai-workspace-activity-surface">
          <article className="ui-panel-card ai-workspace-activity-empty">
            <strong>Nu ai activitate inca.</strong>
            <p className="page-copy">
              Incarca primul material si il vei vedea aici dupa procesare.
            </p>
            <PendingNavigationLink
              className="btn-back"
              href="/materiale"
              pendingLabel="Se deschide uploadul..."
              pendingMode="replace"
            >
              <IconText icon={Upload}>Incarca material</IconText>
            </PendingNavigationLink>
          </article>
        </section>
      )}
    </main>
  );
}
