import Link from "next/link";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { hasSupabasePublicEnv } from "@/lib/env/public";

const featureCards = [
  {
    title: "Inveti din grile, nu din haos",
    copy: "Materialele tale devin intrebari clare, variante de raspuns si sesiuni de recapitulare pe care le poti parcurge rapid."
  },
  {
    title: "Licenta pe seturi",
    copy: "Urca seturile pe rand, verifica raspunsurile, apoi porneste o simulare generala de licenta cand banca este gata."
  },
  {
    title: "Comunitate academica",
    copy: "Studentii si elevii pot lucra pe materiale potrivite pentru universitatea, facultatea, specializarea sau clasa lor."
  }
];

const useCases = [
  "pregatire rapida pentru examen",
  "teste grila pe materii",
  "simulare examen licenta",
  "recapitulare din cursuri si notite",
  "intrebari gresite salvate pentru repetare",
  "materiale comune pentru grupa sau specializare"
];

const faqItems = [
  {
    question: "Ce este Nota 5+?",
    answer:
      "Nota 5+ este o platforma de invatare pentru elevi si studenti, construita pentru recapitulare rapida, teste grila, mod studiu si simulare de licenta."
  },
  {
    question: "Pentru cine este potrivita platforma?",
    answer:
      "Este potrivita pentru studenti, elevi si comunitati academice care vor sa repete repede materia inainte de examen, colocviu, restanta sau licenta."
  },
  {
    question: "Pot invata pentru licenta?",
    answer:
      "Da. Poti pregati licenta pe seturi de intrebari, poti verifica raspunsurile si poti lucra o simulare generala cu intrebari din banca finala."
  },
  {
    question: "Cum ajuta la invatare rapida?",
    answer:
      "Platforma organizeaza materialele in intrebari, raspunsuri, teste si recapitulare, astfel incat sa repeti direct continutul important fara sa cauti prin fisiere lungi."
  }
];

function getSiteUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL || "https://nota5plus.ro";
}

function StructuredData() {
  const siteUrl = getSiteUrl();
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Nota 5+",
      url: siteUrl,
      inLanguage: "ro-RO",
      description:
        "Platforma de invatare rapida pentru studenti si elevi: teste grila, recapitulare, mod studiu si simulare de licenta."
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#app`,
      name: "Nota 5+",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: siteUrl,
      inLanguage: "ro-RO",
      description:
        "Aplicatie web pentru invatare rapida, teste grila pe materii, recapitulare si simulare examen licenta.",
      audience: {
        "@type": "EducationalAudience",
        educationalRole: "student"
      },
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "RON",
        availability: "https://schema.org/InStock"
      }
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/#faq`,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    }
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph
        })
      }}
    />
  );
}

export function PublicHomePage() {
  const isConfigured = hasSupabasePublicEnv();

  return (
    <main className="public-home-page">
      <StructuredData />
      <div className="public-home-container">
        <nav className="public-home-nav" aria-label="Navigare principala">
          <Link className="nota5plus-brand" href="/">
            <span className="nota5plus-brand-mark">5+</span>
            <span>Nota 5+</span>
          </Link>
          <div className="public-home-nav-actions">
            <Link href="#cum-functioneaza" className="nota5plus-nav-link">
              Cum functioneaza
            </Link>
            <Link href="#intrebari" className="nota5plus-nav-link">
              Intrebari
            </Link>
            <Link href="/auth/login?next=/" className="public-home-login-link">
              Intra in cont
            </Link>
          </div>
        </nav>

        <section className="public-home-hero" aria-labelledby="public-home-title">
          <div className="public-home-hero-copy">
            <p className="public-home-kicker">Invatare rapida pentru examene, restante si licenta</p>
            <h1 id="public-home-title">
              Nota 5+ te ajuta sa inveti mai repede din cursuri, grile si materiale de facultate.
            </h1>
            <p className="public-home-lead">
              Platforma organizeaza materia in teste grila, mod studiu, intrebari gresite si simulare de licenta,
              ca sa repeti direct ce conteaza atunci cand examenul este aproape.
            </p>
            <div className="public-home-actions">
              <GoogleSignInButton
                next="/"
                disabled={!isConfigured}
                className="public-home-google-wrap"
                buttonClassName="nota5plus-btn nota5plus-btn-secondary nota5plus-google-btn"
                errorClassName="nota5plus-inline-error"
              >
                <span>Incepe gratuit cu Google</span>
              </GoogleSignInButton>
              <Link className="nota5plus-btn public-home-secondary-action" href="/demo">
                Vezi demo
              </Link>
            </div>
            <ul className="public-home-proof-list" aria-label="Beneficii cheie">
              <li>Teste pe materii</li>
              <li>Mod studiu cu raspunsuri corecte</li>
              <li>Simulare examen licenta</li>
            </ul>
          </div>

          <div className="public-home-preview" aria-label="Previzualizare Nota 5+">
            <div className="public-home-preview-header">
              <span>Plan rapid</span>
              <strong>30 minute de recapitulare</strong>
            </div>
            <div className="public-home-preview-list">
              <article>
                <span>1</span>
                <div>
                  <strong>Incarci materialul</strong>
                  <p>Curs, notite, grile sau seturi pentru licenta.</p>
                </div>
              </article>
              <article>
                <span>2</span>
                <div>
                  <strong>Verifici intrebarile</strong>
                  <p>Corectezi rapid raspunsurile si pastrezi doar continutul bun.</p>
                </div>
              </article>
              <article>
                <span>3</span>
                <div>
                  <strong>Lucrezi testul</strong>
                  <p>Repeti pana cand greselile importante dispar.</p>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section className="public-home-search-panel" aria-label="Cautari pentru care este util Nota 5+">
          <div>
            <span className="public-home-section-label">Pentru ce cautari este relevant</span>
            <h2>O solutie pentru invatare usoara, rapida si aplicata.</h2>
          </div>
          <div className="public-home-keyword-list">
            {useCases.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        </section>

        <section className="public-home-feature-grid" id="cum-functioneaza" aria-label="Cum functioneaza Nota 5+">
          {featureCards.map((card) => (
            <article key={card.title}>
              <h2>{card.title}</h2>
              <p>{card.copy}</p>
            </article>
          ))}
        </section>

        <section className="public-home-content-section">
          <div>
            <span className="public-home-section-label">Moduri de invatare</span>
            <h2>De la material brut la sesiune de lucru.</h2>
            <p>
              Nota 5+ este construita pentru sesiuni scurte si dese: citesti raspunsul corect in mod studiu,
              raspunzi interactiv, apoi faci un test cu scor. Pentru licenta poti lucra o simulare dedicata.
            </p>
          </div>
          <div className="public-home-mode-stack">
            <article>
              <strong>Studiu</strong>
              <span>Vezi toate intrebarile cu raspunsul corect marcat.</span>
            </article>
            <article>
              <strong>Interactiv</strong>
              <span>Raspunzi pe rand si primesti feedback imediat.</span>
            </article>
            <article>
              <strong>Test</strong>
              <span>Lucrezi contra timp si vezi scorul final.</span>
            </article>
          </div>
        </section>

        <section className="public-home-faq" id="intrebari" aria-labelledby="public-home-faq-title">
          <div className="public-home-faq-head">
            <span className="public-home-section-label">Intrebari frecvente</span>
            <h2 id="public-home-faq-title">Raspunsuri clare pentru studenti si elevi.</h2>
          </div>
          <div className="public-home-faq-list">
            {faqItems.map((item) => (
              <article key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="public-home-final">
          <div>
            <span className="public-home-section-label">Start rapid</span>
            <h2>Intra in Nota 5+ si transforma invatatul in sesiuni scurte, clare si masurabile.</h2>
          </div>
          <GoogleSignInButton
            next="/"
            disabled={!isConfigured}
            className="public-home-google-wrap"
            buttonClassName="nota5plus-btn nota5plus-btn-secondary nota5plus-google-btn"
            errorClassName="nota5plus-inline-error"
          >
            <span>Incepe cu Google</span>
          </GoogleSignInButton>
        </section>
      </div>
    </main>
  );
}
