import { redirect } from "next/navigation";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Rocket,
  Target,
  Upload,
  Users
} from "lucide-react";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getPostLoginNextPath } from "@/lib/auth/password-auth";
import { isDemoUser } from "@/lib/demo-user";
import { hasSupabasePublicEnv } from "@/lib/env/public";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Învață mai ușor | Nota 5+",
  description: "Alege cum vrei să înveți pentru următorul examen, cu materia ta sau cu grile."
};

export default async function LoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const nextPath = getPostLoginNextPath(resolvedSearchParams?.next);
  const error =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : undefined;
  const hasReferralInvite = resolvedSearchParams?.ref === "1";
  const emailLoginHref = `/auth/email-login?next=${encodeURIComponent(nextPath)}${hasReferralInvite ? "&ref=1" : ""}`;
  const materialStartPath = nextPath === "/" ? "/materiale/invata" : nextPath;
  const gridsStartPath = nextPath === "/" ? "/materii" : nextPath;

  const isConfigured = hasSupabasePublicEnv();
  const user = await getOptionalUser();

  if (user) {
    if (!isDemoUser(user) && !nextPath.startsWith("/onboarding")) {
      const academicContext = await getAcademicContext(user.id);
      if (!isAcademicContextComplete(academicContext)) {
        redirect(getOnboardingHref(nextPath));
      }
    }

    redirect(nextPath);
  }

  const errorLabels = {
    missing_code: "Lipseste codul de autentificare intors de Google.",
    oauth_exchange_failed: "Autentificarea nu a putut fi finalizata. Incearca din nou.",
    unexpected: "A aparut o eroare neasteptata in timpul autentificarii."
  };

  const mockupStats = [
    {
      value: "42",
      title: "intrebari generate",
      copy: "din materia incarcata"
    },
    {
      value: "8",
      title: "greseli salvate",
      copy: "pentru recapitulare"
    },
    {
      value: "18",
      title: "flashcarduri",
      copy: "pentru memorare rapida"
    },
    {
      value: "3",
      title: "teste rapide",
      copy: "cu rezultat imediat"
    }
  ];

  const flowCards = [
    {
      icon: Upload,
      title: "Incarci materia",
      copy: "PDF, curs, notite sau material primit de la colegi. Totul porneste dintr-un singur upload."
    },
    {
      icon: Brain,
      title: "Primesti teste",
      copy: "Platforma genereaza intrebari, grile, flashcarduri si recapitulari clare."
    },
    {
      icon: Target,
      title: "Repeti greselile",
      copy: "Vezi unde ai probleme si revii exact pe intrebarile importante inainte de examen."
    }
  ];

  const communityIcons = [BookOpen, Users, CheckCircle2, Rocket];

  return (
    <main className="nota5plus-page">
      <div className="nota5plus-container">
        <nav className="nota5plus-nav">
          <a className="nota5plus-brand" href="/auth/login">
            <span className="nota5plus-brand-mark">5+</span>
            <span>Nota 5+</span>
          </a>

          <div className="nota5plus-nav-links">
            <a className="nota5plus-nav-link" href="/preturi">
              Preturi
            </a>
            <a className="nota5plus-nav-link" href="/despre">
              Despre platforma
            </a>
          </div>
        </nav>

        <section className="nota5plus-hero">
          <div className="nota5plus-hero-copy">
            <div className="nota5plus-eyebrow">
              <span className="nota5plus-dot" />
              Pentru liceu, facultate și examene apropiate
            </div>

            <h1 className="nota5plus-title">
              Învață mai ușor. <span>Începe cu ce ai acum.</span>
            </h1>

            <p className="nota5plus-subtitle">
              Alege dacă pornești de la materia ta sau de la grile. Noi îți arătăm imediat următorul pas.
            </p>

            {error || !isConfigured ? (
              <div className="nota5plus-alert-stack">
                {error ? (
                  <div className="nota5plus-inline-error" role="alert">
                    {errorLabels[error] || "Autentificarea nu a putut fi completata."}
                  </div>
                ) : null}

                {!isConfigured ? (
                  <div className="nota5plus-inline-error" role="alert">
                    Autentificarea nu este disponibila momentan. Incearca putin mai tarziu.
                  </div>
                ) : null}
              </div>
            ) : null}

            {hasReferralInvite ? (
              <div className="nota5plus-referral-entry" role="status">
                <span aria-hidden="true">24h</span>
                <strong>Ai link de la un coleg.</strong>
                <small>Fa cont, confirma emailul, iar colegul poate porni 24h.</small>
              </div>
            ) : null}

            <div className="nota5plus-path-grid" aria-label="Alege cum vrei să înveți">
              <GoogleSignInButton
                next={materialStartPath}
                disabled={!isConfigured}
                icon={Upload}
                className="nota5plus-path-wrap"
                buttonClassName="nota5plus-path-card is-material"
                errorClassName="nota5plus-inline-error"
              >
                <span className="nota5plus-path-copy">
                  <strong>Învață din materia ta</strong>
                  <small>Încarcă un curs sau niște notițe și primești un mod clar de a continua.</small>
                </span>
              </GoogleSignInButton>
              <GoogleSignInButton
                next={gridsStartPath}
                disabled={!isConfigured}
                icon={Target}
                className="nota5plus-path-wrap"
                buttonClassName="nota5plus-path-card is-grids"
                errorClassName="nota5plus-inline-error"
              >
                <span className="nota5plus-path-copy">
                  <strong>Exersează cu grile</strong>
                  <small>Alege materia și repetă cu întrebări, teste și greșeli salvate.</small>
                </span>
              </GoogleSignInButton>
            </div>

            <div className="nota5plus-start-options">
              <form action="/auth/demo-login" method="post" className="nota5plus-demo-form">
                <input type="hidden" name="next" value="/demo" />
                <button type="submit" className="nota5plus-demo-link">
                  Vezi un exemplu fără cont
                </button>
              </form>
              <span aria-hidden="true">·</span>
              <a className="nota5plus-email-link" href={emailLoginHref}>
                Intră cu email
              </a>
            </div>

            <p className="nota5plus-microcopy">Creezi cont doar când alegi una dintre opțiuni.</p>
          </div>

          <div className="nota5plus-mockup-wrap" aria-label="Previzualizare aplicatie">
            <div className="nota5plus-mockup-glow" />
            <div className="nota5plus-mockup">
              <div className="nota5plus-mockup-top">
                <div className="nota5plus-window-dots" aria-hidden="true">
                  <span />
                  <span />
                  <span />
                </div>
                <div className="nota5plus-mockup-badge">Gata de învățat</div>
              </div>

              <div className="nota5plus-upload-card">
                <div className="nota5plus-file-row">
                  <div className="nota5plus-file-icon">PDF</div>
                  <div>
                    <div className="nota5plus-file-title">Management strategic.pdf</div>
                    <div className="nota5plus-file-meta">Curs incarcat de comunitate</div>
                  </div>
                </div>
                <div className="nota5plus-progress-label">
                  <span>Material pregătit</span>
                  <span>100%</span>
                </div>
                <div className="nota5plus-progress">
                  <span />
                </div>
              </div>

              <div className="nota5plus-result-grid">
                {mockupStats.map((stat) => (
                  <div key={stat.title} className="nota5plus-mini-card">
                    <div className="nota5plus-mini-number">{stat.value}</div>
                    <div className="nota5plus-mini-text">{stat.title}</div>
                    <div className="nota5plus-mini-muted">{stat.copy}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="nota5plus-flow" aria-label="Cum functioneaza">
          {flowCards.map(({ icon: Icon, title, copy }) => (
            <article key={title} className="nota5plus-flow-card">
              <div className="nota5plus-flow-icon" aria-hidden="true">
                <Icon size={24} strokeWidth={2} />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </section>

        <section className="nota5plus-materials-lab" aria-label="Invata din materia ta">
          <div className="nota5plus-materials-copy">
            <div className="nota5plus-community-label">Mod nou</div>
            <h2>Transforma materia ta intr-un plan clar de invatat.</h2>
            <p>
              Urca PDF, DOCX, PPTX, TXT sau lipeste notitele. Primesti capitole, concepte importante,
              flashcards, test rapid, greseli salvate si un plan pe zile.
            </p>
            <div className="nota5plus-materials-actions">
              <GoogleSignInButton
                next="/materiale/invata"
                disabled={!isConfigured}
                className="nota5plus-google-wrap"
                buttonClassName="nota5plus-btn nota5plus-btn-primary nota5plus-google-btn"
                errorClassName="nota5plus-inline-error"
              >
                Incarca materia ta
              </GoogleSignInButton>
              <a className="nota5plus-materials-link" href="/despre#cum-functioneaza">
                Vezi cum functioneaza
              </a>
            </div>
          </div>

          <div className="nota5plus-materials-board" aria-hidden="true">
            <div className="nota5plus-materials-file">
              <span>PDF</span>
              <strong>Curs management</strong>
              <small>128 pagini detectate</small>
            </div>
            <div className="nota5plus-materials-result is-main">
              <span>7</span>
              <strong>capitole</strong>
            </div>
            <div className="nota5plus-materials-result">
              <span>85</span>
              <strong>flashcards</strong>
            </div>
            <div className="nota5plus-materials-result">
              <span>120</span>
              <strong>intrebari</strong>
            </div>
            <div className="nota5plus-materials-plan">
              <strong>Ziua 1</strong>
              <span>Capitolul 1 + test rapid</span>
            </div>
          </div>
        </section>

        <section className="nota5plus-community" id="comunitate">
          <div className="nota5plus-community-content">
            <div className="nota5plus-community-label">Comunitate</div>
            <h2>Un coleg incarca materialul. Toti pot invata mai usor.</h2>
            <p>
              Dupa login alegi scoala sau universitatea si comunitatea ta. Vezi materialele disponibile
              pentru clasa, grupa ori programul tau si contribui cand ai ceva util.
            </p>
          </div>

          <div className="nota5plus-community-visual" aria-hidden="true">
            {communityIcons.map((Icon, index) => (
              <div key={Icon.displayName || Icon.name || index} className="nota5plus-avatar">
                <Icon size={30} strokeWidth={1.8} />
              </div>
            ))}
          </div>
        </section>

        <footer className="nota5plus-legal-footer">
          <span>Nota 5+</span>
          <nav aria-label="Informatii juridice">
            <a href="/despre">Despre</a>
            <a href="/preturi">Preturi</a>
            <a href="/confidentialitate">Confidentialitate</a>
            <a href="/termeni">Termeni</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
