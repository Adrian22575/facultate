import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen, CalendarDays, FileText, Layers3, StickyNote, Upload } from "lucide-react";

import { createLearningStudySetAction } from "@/app/ai/invata/actions";
import { AppHeader } from "@/components/app-header";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import {
  getAcademicCommunityLabel,
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { getBillingSnapshot } from "@/lib/billing";
import { isDemoUser } from "@/lib/demo-user";
import { getUserLearningStudySets } from "@/lib/learning/study-sets";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invata din materia ta | Nota 5+"
};

function IconText({ icon: Icon, children }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

function SourceOption({ icon: Icon, title, copy, active = false }) {
  return (
    <div className={`learning-upload-source-option${active ? " is-active" : ""}`}>
      <span aria-hidden="true">
        <Icon size={18} strokeWidth={2.3} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{copy}</small>
      </div>
    </div>
  );
}

function statusLabel(status) {
  if (status === "ready") return "Gata";
  if (status === "ready_with_warnings") return "Gata cu atentionari";
  if (status === "failed") return "Oprit";
  return "In pregatire";
}

export default async function LearningUploadPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) {
    redirect("/auth/login?next=/materiale/invata");
  }

  if (demoMode) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/materiale/invata"));
  }

  let billingSnapshot = { aiCredits: 0 };
  let recentSets = [];
  let setupWarning = null;

  try {
    [billingSnapshot, recentSets] = await Promise.all([
      getBillingSnapshot(user.id),
      getUserLearningStudySets(user.id, 6)
    ]);
  } catch {
    setupWarning = "Pagina nu a putut fi pregatita complet momentan. Incearca din nou.";
  }

  const error =
    typeof resolvedSearchParams?.error === "string" ? decodeURIComponent(resolvedSearchParams.error) : null;
  const communityLabel = getAcademicCommunityLabel(academicContext);

  return (
    <main className="app-shell learning-upload-page">
      <AppHeader
        action={
          <Link className="btn-back" href="/materiale">
            Inapoi la Workspace
          </Link>
        }
        kicker="Invata"
        title="Incarca materia ta"
        subtitle="Transforma notitele intr-un spatiu de invatare cu capitole, flashcards, teste si plan."
      />

      {setupWarning ? <div className="error-state">{setupWarning}</div> : null}
      {error ? <div className="error-state">{error}</div> : null}

      <section className="learning-upload-hero">
        <div className="learning-upload-hero-copy">
          <span className="ui-section-label">Materia ta</span>
          <h1>Incarca materia ta si transform-o in teste, flashcards si plan de invatare.</h1>
          <p>
            Prima versiune pregateste materia din text lipit. PDF, DOCX si PowerPoint intra in acelasi
            flow dupa ce legam extractorul complet.
          </p>
          <div className="learning-upload-meta">
            <span>{`${billingSnapshot.aiCredits || 0} incarcari disponibile`}</span>
            {communityLabel ? <span>{communityLabel}</span> : null}
          </div>
        </div>
        <div className="learning-upload-hero-panel">
          <strong>Ce primesti dupa procesare</strong>
          <div>
            <span>Capitole</span>
            <span>Flashcards</span>
            <span>Test grila</span>
            <span>Plan simplu</span>
          </div>
        </div>
      </section>

      <section className="learning-upload-layout">
        <form action={createLearningStudySetAction} className="surface learning-upload-form">
          <div className="learning-upload-section-head">
            <div>
              <span className="ui-section-label">Sursa</span>
              <h2>Pune aici cursul, notitele sau materialul primit.</h2>
            </div>
            <span className="status-pill is-muted">1 incarcare</span>
          </div>

          <div className="learning-upload-source-grid" aria-label="Tipuri sursa">
            <SourceOption icon={StickyNote} title="Text lipit" copy="Activ acum" active />
            <SourceOption icon={FileText} title="PDF" copy="Urmatorul pas" />
            <SourceOption icon={BookOpen} title="DOCX" copy="Urmatorul pas" />
            <SourceOption icon={Layers3} title="PowerPoint" copy="Dupa extractor" />
          </div>

          <label className="learning-upload-field">
            Titlu materie
            <input
              className="input-search"
              name="title"
              placeholder="Ex: Management strategic"
              type="text"
            />
          </label>

          <label className="learning-upload-field">
            Textul materiei
            <textarea
              className="input-search learning-upload-textarea"
              name="manualText"
              placeholder="Lipeste aici cursul, notitele sau continutul capitolului..."
              required
              minLength={600}
            />
          </label>

          <div className="learning-upload-detail-grid">
            <label className="learning-upload-field">
              Data examenului
              <input className="input-search" name="examDate" type="date" />
            </label>
            <label className="learning-upload-field">
              Minute pe zi
              <select className="input-search" name="minutesPerDay" defaultValue="30">
                <option value="20">20 minute</option>
                <option value="30">30 minute</option>
                <option value="45">45 minute</option>
                <option value="60">60 minute</option>
                <option value="90">90 minute</option>
              </select>
            </label>
          </div>

          <label className="learning-upload-field">
            Obiectiv optional
            <input
              className="input-search"
              name="objective"
              placeholder="Ex: vreau recapitulare rapida pentru colocviu"
              type="text"
            />
          </label>

          <div className="learning-upload-submit-row">
            <p>
              Vom pregati un study set privat. Il poti publica manual pentru comunitatea ta mai tarziu.
            </p>
            <button type="submit" disabled={Boolean(setupWarning) || billingSnapshot.aiCredits < 1}>
              <IconText icon={Upload}>Proceseaza materia</IconText>
            </button>
          </div>
        </form>

        <aside className="learning-upload-side">
          <section className="surface learning-upload-side-card">
            <div className="learning-upload-section-head">
              <div>
                <span className="ui-section-label">Continua</span>
                <h2>Materiile tale</h2>
              </div>
            </div>

            {recentSets.length ? (
              <div className="learning-upload-recent-list">
                {recentSets.map((item) => (
                  <PendingNavigationLink
                    key={item.id}
                    className="learning-upload-recent-item"
                    href={`/materiale/invata/${item.id}`}
                    pendingLabel="Se deschide materia..."
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <span>{`${item.chapterCount} capitole · ${item.flashcardCount} flashcards · ${item.questionCount} intrebari`}</span>
                    </div>
                    <em>{statusLabel(item.status)}</em>
                  </PendingNavigationLink>
                ))}
              </div>
            ) : (
              <div className="learning-upload-empty">
                <CalendarDays aria-hidden="true" size={22} strokeWidth={2.2} />
                <strong>Nu ai inca materii procesate.</strong>
                <p>Primul study set apare aici dupa ce trimiti textul.</p>
              </div>
            )}
          </section>
        </aside>
      </section>
    </main>
  );
}
