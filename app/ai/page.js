import { Activity, ArrowRight, BookOpen, ClipboardList, CreditCard, GraduationCap, Upload } from "lucide-react";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { AIWorkspaceHighlightCard } from "@/components/ai-workspace-highlight-card";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { getUserImportJobs } from "@/lib/ai/import-pipeline";
import { getUserQuestionBankJobs } from "@/lib/ai/question-bank-pipeline";
import {
  getAcademicCommunityLabel,
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { getBillingSnapshot } from "@/lib/billing";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Materiale de studiu | Nota 5+",
  description: "Incarca materia, importa intrebari existente sau pregateste licenta din Materiale."
};

function WorkspaceHeaderIcon({ type }) {
  const svgProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  };

  switch (type) {
    case "community":
      return (
        <svg {...svgProps}>
          <path d="m3 8.5 9-4.5 9 4.5-9 4.5-9-4.5Z" />
          <path d="M7 10.5v4.25c0 .82 2.24 2.25 5 2.25s5-1.43 5-2.25V10.5" />
        </svg>
      );
    case "credits":
      return (
        <svg {...svgProps}>
          <path d="M12 3.5v17" />
          <path d="M16 7.5c0-1.66-1.79-3-4-3s-4 1.34-4 3 1.79 3 4 3 4 1.34 4 3-1.79 3-4 3-4-1.34-4-3" />
        </svg>
      );
    case "file":
      return (
        <svg {...svgProps}>
          <path d="M8 3.75h6l3.25 3.25v10A2.25 2.25 0 0 1 15 19.25H9A2.25 2.25 0 0 1 6.75 17V6A2.25 2.25 0 0 1 9 3.75Z" />
          <path d="M14 3.75V7h3.25" />
        </svg>
      );
    case "history":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 8v4l2.75 1.5" />
        </svg>
      );
    default:
      return null;
  }
}

function WorkspaceSummaryCard({ icon, label, value, accent, action }) {
  return (
    <article className="ai-workspace-summary-card ui-panel-card">
      <div className="ai-workspace-summary-head">
        <span className="ui-icon-box" aria-hidden="true">
          {icon}
        </span>
        {accent ? (
          <span className={`ui-chip ${accent}`}>
            {accent === "is-good" ? "Disponibil" : "Atentie"}
          </span>
        ) : null}
      </div>
      <div className="ai-workspace-summary-copy">
        <span className="ai-workspace-summary-label">{label}</span>
        <strong>{value}</strong>
      </div>
      {action}
    </article>
  );
}

function WorkspaceChoiceCard({ icon: Icon, title, copy, bullets = [], actionLabel, href, primary = false }) {
  return (
    <PendingNavigationLink
      className={`ai-workspace-choice-card${primary ? " is-primary" : ""}`}
      href={href}
      pendingLabel={`Se deschide ${title.toLowerCase()}...`}
      pendingMode="silent"
    >
      <span className="ai-workspace-choice-icon" aria-hidden="true">
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <div className="ai-workspace-choice-copy">
        <strong>{title}</strong>
        <p>{copy}</p>
        <div>
          {bullets.map((bullet) => (
            <span key={bullet}>{bullet}</span>
          ))}
        </div>
        <span className="ai-workspace-choice-action">
          <span>{actionLabel}</span>
          <ArrowRight aria-hidden="true" size={17} strokeWidth={2.3} />
        </span>
      </div>
    </PendingNavigationLink>
  );
}

function IconText({ icon: Icon, children }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

function getActivityTimestamp(item) {
  const parsed = Date.parse(item?.updatedAt || item?.completedAt || item?.createdAt || "");
  return Number.isFinite(parsed) ? parsed : 0;
}

export default async function AIWorkspacePage() {
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) {
    redirect("/auth/login?next=/materiale");
  }

  if (demoMode) {
    redirect("/demo");
  }

  const academicContext = !demoMode ? await getAcademicContext(user.id) : null;

  if (!demoMode && !isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/materiale"));
  }

  let billingSnapshot = { aiCredits: 0 };
  let setupWarning = null;

  if (!demoMode) {
    try {
      billingSnapshot = await getBillingSnapshot(user.id);
    } catch (error) {
      setupWarning = "Pagina nu a putut fi pregatita complet momentan. Incearca din nou.";
    }
  }

  let jobs = [];
  let importJobs = [];
  if (!demoMode && !setupWarning) {
    try {
      [jobs, importJobs] = await Promise.all([
        getUserQuestionBankJobs(user.id, 8),
        getUserImportJobs(user.id, 8)
      ]);
    } catch (error) {
      setupWarning = "Activitatea recenta nu a putut fi incarcata momentan.";
    }
  }

  const communityLabel = academicContext ? getAcademicCommunityLabel(academicContext) : null;
  const activityJobs = [...jobs, ...importJobs].sort(
    (left, right) => getActivityTimestamp(right) - getActivityTimestamp(left)
  );
  const validJobs = activityJobs.filter(
    (job) =>
      job.activityState !== "deleted" &&
      (job.reviewHref || job.resultHref || job.status !== "succeeded")
  );
  const highlightedJob =
    validJobs.find(
      (job) =>
        job.status === "processing" || job.status === "pending" || job.status === "failed"
    ) ||
    validJobs[0] ||
    null;
  const creditsAction =
    billingSnapshot.aiCredits < 1 ? (
      <PendingNavigationLink
        className="ai-workspace-summary-link"
        href="/cont?section=credits"
        pendingLabel="Se deschid pachetele..."
        pendingMode="replace"
      >
        <IconText icon={CreditCard}>Adauga incarcari</IconText>
      </PendingNavigationLink>
    ) : (
      <PendingNavigationLink
        className="ai-workspace-summary-link"
        href="/cont?section=credits"
        pendingLabel="Se deschid pachetele..."
        pendingMode="replace"
      >
        <IconText icon={CreditCard}>Vezi pachetele</IconText>
      </PendingNavigationLink>
    );

  return (
    <main className="app-shell ai-workspace-page">
      <AppHeader
        title="Materiale de studiu"
        subtitle="Incarca materia, importa intrebari existente sau pregateste licenta."
        hidePageTitle
      />

      {setupWarning ? <div className="error-state" role="alert">{setupWarning}</div> : null}

      <section className="ai-workspace-header">
        <div className="ai-workspace-header-copy">
          <span className="ui-section-label">Materiale</span>
          <h1 className="ai-workspace-title">
            Alege cum vrei sa transformi materialele in invatare.
          </h1>
          <p className="ai-workspace-subtitle">
            Incarca materia ca sa primesti capitole, flashcards si teste, importa grile existente
            sau pregateste seturi mari pentru licenta si comunitatea ta.
          </p>
        </div>
        <PendingNavigationLink
          className="btn-link secondary ai-workspace-header-action"
          href="/materiale/activitate"
          pendingLabel="Se deschide activitatea..."
          pendingMode="replace"
        >
          <IconText icon={Activity}>Vezi activitatea</IconText>
        </PendingNavigationLink>
      </section>

      <section className="ai-workspace-hero">
        <div className="ai-workspace-hero-grid">
          <div className="ai-workspace-summary-grid">
            {communityLabel ? (
              <WorkspaceSummaryCard
                icon={<WorkspaceHeaderIcon type="community" />}
                label="Comunitatea ta"
                value={communityLabel}
              />
            ) : null}

            <WorkspaceSummaryCard
              icon={<WorkspaceHeaderIcon type="credits" />}
              label="Incarcari disponibile"
              value={String(billingSnapshot.aiCredits)}
              accent={billingSnapshot.aiCredits > 0 ? "is-good" : "is-warning"}
              action={creditsAction}
            />
          </div>

          {highlightedJob ? (
            <AIWorkspaceHighlightCard initialJob={highlightedJob} />
          ) : (
            <article className="ai-workspace-highlight-card ui-dark-cta-panel ai-workspace-empty-panel">
              <div className="ai-workspace-empty-copy">
                <div className="ai-workspace-empty-kicker">Gata de upload</div>
                <h2>Incepe cu un fisier bun sau cu text clar si continui in doi pasi simpli.</h2>
                <p>
                  PDF, DOCX, PPTX, TXT sau text lipit direct. Alege mai jos daca vrei sa inveti
                  din materie sau sa pregatesti intrebari existente.
                </p>
                <span className="ui-icon-text ai-workspace-empty-iconline">
                  <Upload aria-hidden="true" size={17} strokeWidth={2.2} />
                  <span>Alege metoda de incarcare mai jos</span>
                </span>
              </div>
            </article>
          )}
        </div>
      </section>

      <section className="ai-workspace-choice-grid" aria-label="Alege ce vrei sa faci">
        <WorkspaceChoiceCard
          icon={BookOpen}
          title="Invata din materia ta"
          copy="Incarca materia si primesti capitole, flashcards, test si plan de invatare."
          bullets={["Capitole", "Flashcards", "Plan"]}
          actionLabel="Deschide modul"
          href="/materiale/invata"
          primary
        />
        <WorkspaceChoiceCard
          icon={ClipboardList}
          title="Importa intrebari existente"
          copy="Pentru grile care au deja variante si raspunsuri marcate."
          bullets={["Review", "Materii", "Teste"]}
          actionLabel="Importa grile"
          href="/materiale/importa"
        />
        <WorkspaceChoiceCard
          icon={GraduationCap}
          title="Pregateste licenta"
          copy="Pentru seturi mari de licenta si simulari centralizate."
          bullets={["Licenta", "Review", "Simulari"]}
          actionLabel="Pregateste licenta"
          href="/materiale/licenta"
        />
      </section>
    </main>
  );
}
