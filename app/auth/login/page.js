import { redirect } from "next/navigation";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { hasSupabasePublicEnv } from "@/lib/env/public";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Login | Nota 5+",
  description: "Invata rapid pentru examen alaturi de comunitatea ta cu Nota 5+."
};

export default async function LoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const nextPath =
    typeof resolvedSearchParams?.next === "string" &&
    resolvedSearchParams.next.startsWith("/") &&
    !resolvedSearchParams.next.startsWith("//")
      ? resolvedSearchParams.next
      : "/";
  const error =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : undefined;
  const hasReferralInvite = resolvedSearchParams?.ref === "1";
  const emailLoginHref = `/auth/email-login?next=${encodeURIComponent(nextPath)}${hasReferralInvite ? "&ref=1" : ""}`;

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
      icon: "\uD83D\uDCE4",
      title: "Incarci materia",
      copy: "PDF, curs, notite sau material primit de la colegi. Totul porneste dintr-un singur upload."
    },
    {
      icon: "\uD83E\uDDE0",
      title: "Primesti teste",
      copy: "Platforma genereaza intrebari, grile, flashcarduri si recapitulari clare."
    },
    {
      icon: "\uD83C\uDFAF",
      title: "Repeti greselile",
      copy: "Vezi unde ai probleme si revii exact pe intrebarile importante inainte de examen."
    }
  ];

  const antiPoints = [
    {
      icon: "\uD83D\uDE24",
      copy: "vrei sa vezi colegi mai slabi decat tine trecand inaintea ta;"
    },
    {
      icon: "\uD83C\uDF34",
      copy: "vrei sa-ti faci planuri de vara in jurul restantelor;"
    },
    {
      icon: "\u26A1",
      copy: "iti place adrenalina aia proasta din noaptea dinaintea examenului;"
    },
    {
      icon: "\uD83D\uDCDA",
      copy: "vrei sa inveti 200 de pagini ca sa pice fix cele 3 pe care nu le-ai citit."
    }
  ];

  const communityIcons = ["\uD83D\uDCDA", "\uD83D\uDC65", "\u2705", "\uD83D\uDE80"];

  return (
    <main className="nota5plus-page">
      <div className="nota5plus-container">
        <nav className="nota5plus-nav">
          <a className="nota5plus-brand" href="/auth/login">
            <span className="nota5plus-brand-mark">5+</span>
            <span>Nota 5+</span>
          </a>

          <a className="nota5plus-nav-link" href="/despre">
            Despre platforma
          </a>
        </nav>

        <section className="nota5plus-hero">
          <div className="nota5plus-hero-copy">
            <div className="nota5plus-eyebrow">
              <span className="nota5plus-dot" />
              Pentru sesiune, restante si examene apropiate
            </div>

            <h1 className="nota5plus-title">
              Invata rapid. <span>Treci examenul.</span>
            </h1>

            <p className="nota5plus-subtitle">
              Incarci materia, iar platforma o transforma in <strong>intrebari, teste si recapitulare</strong>.
              Repeti exact ce conteaza, fara PDF-uri pierdute si conversatii vechi.
            </p>

            {error || !isConfigured ? (
              <div className="nota5plus-alert-stack">
                {error ? (
                  <div className="nota5plus-inline-error">
                    {errorLabels[error] || "Autentificarea nu a putut fi completata."}
                  </div>
                ) : null}

                {!isConfigured ? (
                  <div className="nota5plus-inline-error">
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

            <div className="nota5plus-actions">
              <form action="/auth/demo-login" method="post" className="nota5plus-demo-form">
                <input type="hidden" name="next" value="/demo" />
                <button type="submit" className="nota5plus-btn nota5plus-btn-primary">
                  Incearca demo
                </button>
              </form>
              <GoogleSignInButton
                next={nextPath}
                disabled={!isConfigured}
                className="nota5plus-google-wrap"
                buttonClassName="nota5plus-btn nota5plus-btn-secondary nota5plus-google-btn"
                errorClassName="nota5plus-inline-error"
              >
                Continua cu Google
              </GoogleSignInButton>
            </div>

            <p className="nota5plus-microcopy">Fara cont pentru demo &middot; Gandit pentru studenti</p>
            <a className="nota5plus-email-link" href={emailLoginHref}>
              Nu ai cont Google? Intra cu email
            </a>

            <div className="nota5plus-proof-note">
              <div className="nota5plus-proof-icon">✓</div>
              <div>
                <strong>
                  Toti studentii care au folosit Nota 5+ pentru recapitulare in 2026 au trecut examenele.
                </strong>
                <span>Experienta reala din comunitatea noastra.</span>
              </div>
            </div>

            <div className="nota5plus-stats-line" aria-label="Beneficii rapide">
              <span className="nota5plus-pill">30 min recapitulare</span>
              <span className="nota5plus-pill">1 upload</span>
              <span className="nota5plus-pill">0 haos</span>
            </div>
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
                <div className="nota5plus-mockup-badge">Generare in progres</div>
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
                  <span>Analiza material</span>
                  <span>78%</span>
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
          {flowCards.map((card) => (
            <article key={card.title} className="nota5plus-flow-card">
              <div className="nota5plus-flow-icon" aria-hidden="true">
                {card.icon}
              </div>
              <h3>{card.title}</h3>
              <p>{card.copy}</p>
            </article>
          ))}
        </section>

        <section className="nota5plus-anti-section" aria-label="Cand sa nu folosesti Nota 5+">
          <div className="nota5plus-anti-heading">
            <div className="nota5plus-anti-kicker">Fara menajamente</div>
            <h2>Cand sa NU folosesti Nota 5+</h2>
            <p>Nu e pentru tine daca iti place sa traiesti sesiunea pe modul supravietuire.</p>
          </div>

          <ul className="nota5plus-anti-list">
            {antiPoints.map((point) => (
              <li key={point.copy}>
                <span className="nota5plus-anti-symbol" aria-hidden="true">
                  {point.icon}
                </span>
                <span>{point.copy}</span>
              </li>
            ))}
          </ul>
        </section>

        <section className="nota5plus-community" id="comunitate">
          <div className="nota5plus-community-content">
            <div className="nota5plus-community-label">Comunitate</div>
            <h2>Un coleg incarca materialul. Toti pot invata mai usor.</h2>
            <p>
              Dupa login alegi universitatea, facultatea si specializarea. Vezi materialele disponibile
              pentru comunitatea ta si contribui cand ai ceva util.
            </p>
          </div>

          <div className="nota5plus-community-visual" aria-hidden="true">
            {communityIcons.map((icon, index) => (
              <div key={`${icon}-${index}`} className="nota5plus-avatar">
                {icon}
              </div>
            ))}
          </div>
        </section>

        <section className="nota5plus-final-cta">
          <div className="nota5plus-final-cta-copy">
            <div className="nota5plus-final-cta-kicker">Pasul urmator</div>
            <h2>Intra acum si invata cu comunitatea ta.</h2>
            <p>
              Pastrezi progresul, vezi materialele utile pentru facultatea ta si repeti exact ce
              conteaza cand examenul e aproape.
            </p>
          </div>

          <GoogleSignInButton
            next={nextPath}
            disabled={!isConfigured}
            className="nota5plus-final-cta-actions"
            buttonClassName="nota5plus-btn nota5plus-btn-secondary nota5plus-google-btn"
            errorClassName="nota5plus-inline-error"
          >
            Continua cu Google
          </GoogleSignInButton>
        </section>
      </div>
    </main>
  );
}
