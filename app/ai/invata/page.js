import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarDays } from "lucide-react";

import { AppHeader } from "@/components/app-header";
import { LearningUploadForm } from "@/components/learning-upload-form";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import {
  getAcademicCommunityLabel,
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { getBillingSnapshot } from "@/lib/billing";
import { isDemoUser } from "@/lib/demo-user";
import { getCommunityLearningStudySets, getUserLearningStudySets } from "@/lib/learning/study-sets";
import { getOptionalUser } from "@/lib/supabase/guards";
import { getLearningSetupErrorMessage } from "@/lib/supabase/setup-status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invata din materia ta | Nota 5+"
};

function statusLabel(status) {
  if (status === "ready") return "Gata";
  if (status === "ready_with_warnings") return "Gata cu atentionari";
  if (status === "failed") return "Oprit";
  return "In pregatire";
}

const uploadGuidance = [
  {
    title: "Materiale potrivite",
    items: ["Cursuri cu titluri sau capitole", "Notite complete", "Prezentari cu idei explicate"]
  },
  {
    title: "Materiale de evitat",
    items: ["Poze scanate fara text selectabil", "Fragmente foarte scurte", "Fisiere doar cu bibliografie"]
  },
  {
    title: "Daca materialul e dezordonat",
    items: ["Da-i un titlu clar", "Adauga obiectivul examenului", "Publica pentru colegi doar dupa verificare"]
  }
];

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
  let communitySets = [];
  let setupWarning = null;

  try {
    [billingSnapshot, recentSets, communitySets] = await Promise.all([
      getBillingSnapshot(user.id),
      getUserLearningStudySets(user.id, 6),
      getCommunityLearningStudySets({ userId: user.id, academicContext, limit: 6 })
    ]);
  } catch (error) {
    setupWarning =
      getLearningSetupErrorMessage(error) ||
      "Pagina nu a putut fi pregatita complet momentan. Incearca din nou.";
  }

  const error =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : null;
  const message =
    typeof resolvedSearchParams?.message === "string" ? resolvedSearchParams.message : null;
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

      {setupWarning ? <div className="error-state" role="alert">{setupWarning}</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}
      {message ? <div className="learning-upload-success" role="status">{message}</div> : null}

      <section className="learning-upload-hero">
        <div className="learning-upload-hero-copy">
          <span className="ui-section-label">Materia ta</span>
          <h1>Incarca materia ta si transform-o in teste, flashcards si plan de invatare.</h1>
          <p>
            Poti incarca PDF, DOCX, PPTX, TXT sau poti lipi textul direct. Dupa procesare vezi capitolele,
            conceptele importante si de unde merita sa incepi.
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
        <LearningUploadForm billingSnapshot={billingSnapshot} setupWarning={setupWarning} />

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
                      <span>{`${item.chapterCount} capitole - ${item.flashcardCount} flashcards - ${item.questionCount} intrebari`}</span>
                    </div>
                    <em>{statusLabel(item.status)}</em>
                  </PendingNavigationLink>
                ))}
              </div>
            ) : (
              <div className="learning-upload-empty">
                <CalendarDays aria-hidden="true" size={22} strokeWidth={2.2} />
                <strong>Nu ai inca materii procesate.</strong>
                <p>Primul set de invatare apare aici dupa ce trimiti materialul.</p>
              </div>
            )}
          </section>

          <section className="surface learning-upload-side-card">
            <div className="learning-upload-section-head">
              <div>
                <span className="ui-section-label">Comunitate</span>
                <h2>Materiale de la colegi</h2>
              </div>
            </div>

            {communitySets.length ? (
              <div className="learning-upload-recent-list">
                {communitySets.map((item) => (
                  <PendingNavigationLink
                    key={item.id}
                    className="learning-upload-recent-item"
                    href={`/materiale/invata/${item.id}`}
                    pendingLabel="Se deschide materialul..."
                  >
                    <div>
                      <strong>{item.title}</strong>
                      <span>{`${item.chapterCount} capitole - ${item.flashcardCount} flashcards - ${item.questionCount} intrebari`}</span>
                    </div>
                    <em>Publicat</em>
                  </PendingNavigationLink>
                ))}
              </div>
            ) : (
              <div className="learning-upload-empty">
                <CalendarDays aria-hidden="true" size={22} strokeWidth={2.2} />
                <strong>Nu sunt inca materiale publicate.</strong>
                <p>Cand un coleg publica un set bun, apare aici pentru comunitatea ta.</p>
              </div>
            )}
          </section>

          <section className="surface learning-upload-side-card learning-upload-guidance-card">
            <div className="learning-upload-section-head">
              <div>
                <span className="ui-section-label">Ghid rapid</span>
                <h2>Ce sa incarci</h2>
              </div>
            </div>

            <div className="learning-upload-guidance-list">
              {uploadGuidance.map((group) => (
                <article key={group.title}>
                  <strong>{group.title}</strong>
                  <ul>
                    {group.items.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>
        </aside>
      </section>
    </main>
  );
}
