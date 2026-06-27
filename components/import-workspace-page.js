import Link from "next/link";
import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { LicentaImportWorkspaceClient } from "@/components/licenta-import-workspace-client";
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
    kicker: "Importa",
    title: "Importa intrebari existente",
    subtitle: "Incarca grilele, verifica intrebarile extrase si publica testul la materia potrivita.",
    heroLabel: "Grile gata facute",
    heroTitle: "Incarca intrebari existente si transforma-le intr-un test curat.",
    heroCopy:
      "Potrivit pentru PDF, DOCX, TXT sau text lipit care are deja intrebari, variante si raspunsuri corecte. Dupa procesare verifici rezultatul si il legi de materia potrivita.",
    panelTitle: "Ce faci aici",
    panelItems: ["Urcare grile", "Review intrebari", "Publicare test", "Statistici"],
    guidance: [
      {
        title: "Materiale potrivite",
        items: ["Banci de grile existente", "Teste cu variante A-E", "Barem la final sau dupa intrebare"]
      },
      {
        title: "Ce verifici dupa import",
        items: ["Raspunsul corect", "Variantele incomplete", "Intrebarile care au nevoie de atentie"]
      },
      {
        title: "Urmatorul pas",
        items: ["Alegi materia", "Verifici lista", "Publici testul cand arata bine"]
      }
    ]
  },
  licenta: {
    path: "/materiale/licenta",
    kicker: "Licenta",
    title: "Pregateste licenta",
    subtitle: "Adauga seturile intr-o singura licenta, verifica raspunsurile si pregateste simularea.",
    heroLabel: "Simulare pe seturi",
    heroTitle: "Adauga seturile de licenta in acelasi spatiu de verificare.",
    heroCopy:
      "Incarci pe rand seturile, le verifici fara dialoguri inutile si finalizezi simularea cand toate intrebarile au raspunsurile corecte.",
    panelTitle: "Ce primesti",
    panelItems: ["Seturi salvate", "Review raspunsuri", "Simulare", "Greseli"],
    guidance: [
      {
        title: "Recomandat",
        items: ["Seturi mai mici, incarcate pe rand", "Intrebari cu variante clare", "Raspunsuri marcate sau barem separat"]
      },
      {
        title: "De evitat",
        items: ["Fisier foarte mare neordonat", "Poze scanate fara text", "Seturi amestecate fara delimitare"]
      },
      {
        title: "Regula importanta",
        items: ["Tot ce urci pentru aceeasi licenta ramane in aceeasi sesiune", "Finalizezi doar dupa review"]
      }
    ]
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

  return (
    <main className="app-shell learning-upload-page workspace-flow-page">
      <AppHeader
        action={
          <Link className="btn-back" href="/materiale">
            Inapoi la Workspace
          </Link>
        }
        kicker={page.kicker}
        title={page.title}
        subtitle={page.subtitle}
      />

      <section className="learning-upload-hero">
        <div className="learning-upload-hero-copy">
          <span className="ui-section-label">{page.heroLabel}</span>
          <h1>{page.heroTitle}</h1>
          <p>{page.heroCopy}</p>
          <div className="learning-upload-meta">
            <span>{`${billingSnapshot.aiCredits || 0} incarcari disponibile`}</span>
            {communityLabel ? <span>{communityLabel}</span> : null}
          </div>
        </div>
        <div className="learning-upload-hero-panel">
          <strong>{page.panelTitle}</strong>
          <div>
            {page.panelItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </div>
      </section>

      <section className="learning-upload-layout workspace-flow-layout">
        <section className="workspace-flow-main" aria-label={page.title}>
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

        <aside className="learning-upload-side workspace-flow-side">
          <section className="surface learning-upload-side-card learning-upload-guidance-card">
            <div className="learning-upload-section-head">
              <div>
                <span className="ui-section-label">Ghid rapid</span>
                <h2>Cum pregatesti materialul</h2>
              </div>
            </div>

            <div className="learning-upload-guidance-list">
              {page.guidance.map((group) => (
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
