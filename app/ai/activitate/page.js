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
import {
  getCommunityLearningStudySets,
  getUserLearningStudySets
} from "@/lib/learning/study-sets";
import { getUserLearningStudySetJobs } from "@/lib/learning/study-set-pipeline";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getAccessibleSubjectsForUser } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getPrivateGeneratedTests } from "@/lib/private-tests";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Materiale de studiu | Nota 5+"
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

export default async function AIActivityPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const requestedTab = typeof resolvedSearchParams?.tab === "string" ? resolvedSearchParams.tab : "learning";
  const initialTab = ["learning", "subjects", "licenta", "activity", "tests"].includes(requestedTab)
    ? requestedTab
    : "learning";
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
  let learningStudySets = [];
  let communityLearningStudySets = [];
  let subjects = [];
  let activityJobs = [];
  let licentaSessions = [];
  let testGroups = { active: [], drafts: [] };
  let setupWarning = null;

  try {
    const [jobs, importJobs, learningJobs, ownedStudySets, communityStudySets, catalog, licentaSessionRows, materialRows, tests] = await Promise.all([
      getUserQuestionBankJobs(user.id, 16),
      getUserImportJobs(user.id, 16),
      getUserLearningStudySetJobs(user.id, 16),
      getUserLearningStudySets(user.id, 24),
      getCommunityLearningStudySets({ userId: user.id, academicContext, limit: 24 }),
      getAccessibleSubjectsForUser({
        userId: user.id,
        membership: academicContext.membership,
        userType: academicContext.profile?.user_type === "elev" ? "elev" : "student"
      }),
      getUserLicentaImportSessions(user.id, 12),
      getUserQuestionBankMaterials(user.id, 60),
      getPrivateGeneratedTests(user.id)
    ]);

    activityJobs = [...jobs, ...importJobs, ...learningJobs].sort(
      (left, right) => getActivityTimestamp(right) - getActivityTimestamp(left)
    );
    licentaSessions = licentaSessionRows;
    materials = materialRows;
    learningStudySets = ownedStudySets;
    communityLearningStudySets = communityStudySets;
    subjects = catalog.subjects;
    testGroups = tests;
  } catch (error) {
    setupWarning = "Activitatea nu a putut fi incarcata momentan. Incearca din nou.";
  }

  const hasAnyActivity =
    materials.length ||
    learningStudySets.length ||
    communityLearningStudySets.length ||
    activityJobs.length ||
    licentaSessions.length ||
    testGroups.active.length ||
    testGroups.drafts.length;

  return (
    <main className="app-shell ai-workspace-page ai-activity-page">
      <AppHeader
        title="Materiale de studiu"
        subtitle="Materialele, importurile si testele tale intr-un singur loc."
        hidePageTitle
      />

      <section className="ai-workspace-header ai-activity-header">
        <div className="ai-workspace-header-copy">
          <h1 className="ai-workspace-title">Materialele mele</h1>
          <p className="ai-workspace-subtitle">
            Deschide un material salvat sau urmareste o procesare in curs.
          </p>
        </div>
        <PendingNavigationLink
          className="btn-link secondary ai-activity-back-link"
          href="/materiale/invata"
          pendingLabel="Se deschide incarcarea..."
          pendingMode="replace"
        >
          <IconText icon={Upload}>Incarca alt material</IconText>
        </PendingNavigationLink>
      </section>

      {setupWarning ? <div className="error-state" role="alert">{setupWarning}</div> : null}

      {hasAnyActivity ? (
        <AIActivityCenterClient
          key={`activity-${initialTab}`}
          materials={materials}
          learningStudySets={learningStudySets}
          communityLearningStudySets={communityLearningStudySets}
          subjects={subjects}
          activityJobs={activityJobs}
          licentaSessions={licentaSessions}
          testGroups={testGroups}
          initialTab={initialTab}
        />
      ) : (
        <section className="surface ai-workspace-activity-surface">
          <article className="ui-panel-card ai-workspace-activity-empty">
            <strong>Biblioteca nu are materiale inca.</strong>
            <p className="page-copy">Adauga primul material pentru a incepe.</p>
            <PendingNavigationLink
              className="btn-back"
              href="/materiale/invata"
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
