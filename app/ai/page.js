import { Activity, ArrowRight, BookOpen, ClipboardList } from "lucide-react";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import {
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Materiale de studiu | Nota 5+",
  description: "Incarca materia sau importa intrebari existente din Materiale."
};

function WorkspaceChoiceCard({ icon: Icon, title, copy, actionLabel, href, primary = false }) {
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

export default async function AIWorkspacePage() {
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) redirect("/auth/login?next=/materiale");
  if (demoMode) redirect("/demo");

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/materiale"));
  }

  return (
    <main className="app-shell ai-workspace-page ai-workspace-page--simple">
      <AppHeader title="Materiale de studiu" hidePageTitle />

      <section className="ai-workspace-header">
        <div className="ai-workspace-header-copy">
          <h1 className="ai-workspace-title">Alege cum inveti</h1>
          <p className="ai-workspace-subtitle">Porneste cu materia ta sau cu un set de grile pe care il ai deja.</p>
        </div>
        <PendingNavigationLink
          className="btn-link secondary ai-workspace-header-action"
          href="/materiale/activitate"
          pendingLabel="Se deschide activitatea..."
          pendingMode="replace"
        >
          <IconText icon={Activity}>Materialele mele</IconText>
        </PendingNavigationLink>
      </section>

      <section className="ai-workspace-choice-grid" aria-label="Alege ce vrei sa faci">
        <WorkspaceChoiceCard
          icon={BookOpen}
          title="Invata dintr-un material"
          copy="Incarca un curs sau notite, apoi invata cu capitole, flashcards si teste."
          actionLabel="Adauga material"
          href="/materiale/invata"
          primary
        />
        <WorkspaceChoiceCard
          icon={ClipboardList}
          title="Importa grile"
          copy="Adauga intrebari cu raspunsuri deja stabilite si pregateste un test pentru materie."
          actionLabel="Importa grile"
          href="/materiale/importa"
        />
      </section>

      <p className="ai-workspace-secondary-path">
        Ai seturi mari pentru examenul de licenta?{" "}
        <PendingNavigationLink href="/materiale/licenta" pendingLabel="Se deschide licenta...">
          Pregateste licenta
        </PendingNavigationLink>
      </p>
    </main>
  );
}
