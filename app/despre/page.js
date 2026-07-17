import Link from "next/link";

import { getPublicSiteUrl } from "@/lib/site";
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  FileQuestion,
  GraduationCap,
  Layers3,
  School,
  Target,
  Timer,
  UploadCloud,
  UsersRound
} from "lucide-react";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { hasSupabasePublicEnv } from "@/lib/env/public";

const siteUrl = getPublicSiteUrl();
const pageUrl = `${siteUrl}/despre`;
const homeHref = "/auth/exit-demo?next=/";
const loginHref = "/auth/exit-demo?target=login";

const audienceCards = [
  {
    icon: GraduationCap,
    title: "Studenti si masteranzi",
    text: "Repeti grile pentru colocvii, examene, restante sau sesiuni scurte de recapitulare pe materii."
  },
  {
    icon: FileQuestion,
    title: "Licenta cu seturi de intrebari",
    text: "Urca seturi cu intrebari si raspunsuri, verifica banca finala si lucreaza simulari clare pentru examenul de licenta."
  },
  {
    icon: School,
    title: "Elevi",
    text: "Incarci materia, o transformi in exercitii usor de parcurs si inveti in moduri diferite, fara sa sari intre fisiere."
  }
];

const workflowSteps = [
  {
    icon: UploadCloud,
    title: "Incarci materia",
    text: "Cursuri, notite, grile, variante rezolvate sau seturi pentru licenta."
  },
  {
    icon: ClipboardList,
    title: "Verifici intrebarile",
    text: "Pastrezi raspunsurile corecte, corectezi rapid greselile si organizezi continutul pe materii."
  },
  {
    icon: Target,
    title: "Repeti tintit",
    text: "Lucrezi in Studiu, Interactiv sau Test, apoi revii la intrebarile care au nevoie de atentie."
  }
];

const learningModes = [
  {
    icon: BookOpenCheck,
    title: "Studiu",
    text: "Vezi toate intrebarile cu raspunsul corect marcat si parcurgi materia in ritmul tau."
  },
  {
    icon: CheckCircle2,
    title: "Interactiv",
    text: "Raspunzi pe rand si afli imediat daca ai ales corect, fara sa astepti finalul testului."
  },
  {
    icon: Timer,
    title: "Test",
    text: "Lucrezi contra timp, vezi scorul final si intelegi rapid unde mai ai de repetat."
  }
];

const searchTopics = [
  "teste grila pe materii",
  "invatare rapida pentru studenti",
  "simulare examen licenta",
  "recapitulare pentru elevi",
  "intrebari si raspunsuri pentru examen",
  "mod studiu cu raspunsuri corecte",
  "teste pentru restante",
  "platforma de invatare online"
];

const faqItems = [
  {
    question: "Ce este Nota 5+?",
    answer:
      "Nota 5+ este o platforma de invatare online pentru elevi, studenti si masteranzi, construita pentru teste grila, recapitulare, mod studiu si simulari de licenta."
  },
  {
    question: "Pot folosi Nota 5+ daca am deja intrebarile si raspunsurile?",
    answer:
      "Da. Poti incarca seturi de intrebari si raspunsuri, le poti verifica, apoi le poti lucra in modurile Studiu, Interactiv si Test."
  },
  {
    question: "Ajuta platforma la pregatirea pentru licenta?",
    answer:
      "Da. Daca ai seturi de intrebari pentru licenta, le poti organiza intr-o banca de lucru si poti porni simulari pentru recapitulare."
  },
  {
    question: "Este utila si pentru elevi?",
    answer:
      "Da. Elevii pot incarca materiale pentru o materie si pot repeta prin intrebari, feedback imediat si teste scurte."
  }
];

export const metadata = {
  title: "Despre Nota 5+ | Teste grila, invatare rapida si licenta",
  description:
    "Nota 5+ ajuta elevii, studentii si masteranzii sa invete din grile, raspunsuri, mod studiu, teste si simulari de licenta.",
  keywords: [
    "Nota 5+",
    "teste grila",
    "invatare rapida",
    "simulare licenta",
    "teste pentru studenti",
    "recapitulare elevi",
    "mod studiu",
    "intrebari si raspunsuri examen"
  ],
  alternates: {
    canonical: "/despre"
  },
  openGraph: {
    title: "Despre Nota 5+",
    description:
      "Platforma pentru teste grila, recapitulare, mod studiu si simulari de licenta pentru elevi si studenti.",
    url: pageUrl,
    siteName: "Nota 5+",
    locale: "ro_RO",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Despre Nota 5+",
    description:
      "Invata din grile, raspunsuri si teste scurte. Pentru elevi, studenti, masteranzi si licenta."
  }
};

function AboutStructuredData() {
  const graph = [
    {
      "@type": "AboutPage",
      "@id": `${pageUrl}#about`,
      url: pageUrl,
      name: "Despre Nota 5+",
      inLanguage: "ro-RO",
      description: metadata.description,
      isPartOf: {
        "@id": `${siteUrl}/#website`
      },
      about: {
        "@id": `${siteUrl}/#app`
      }
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Nota 5+",
      url: siteUrl,
      inLanguage: "ro-RO"
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
        "Aplicatie web pentru teste grila, recapitulare, mod studiu si simulari de licenta.",
      audience: [
        {
          "@type": "EducationalAudience",
          educationalRole: "student"
        },
        {
          "@type": "EducationalAudience",
          educationalRole: "school student"
        }
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "RON",
        availability: "https://schema.org/InStock"
      }
    },
    {
      "@type": "FAQPage",
      "@id": `${pageUrl}#faq`,
      mainEntity: faqItems.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer
        }
      }))
    },
    {
      "@type": "BreadcrumbList",
      "@id": `${pageUrl}#breadcrumb`,
      itemListElement: [
        {
          "@type": "ListItem",
          position: 1,
          name: "Nota 5+",
          item: siteUrl
        },
        {
          "@type": "ListItem",
          position: 2,
          name: "Despre",
          item: pageUrl
        }
      ]
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

function IconCard({ item, className = "" }) {
  const Icon = item.icon;

  return (
    <article className={`about-icon-card ${className}`}>
      <span className="about-icon-card-mark" aria-hidden="true">
        <Icon size={22} strokeWidth={2.2} />
      </span>
      <div>
        <h3>{item.title}</h3>
        <p>{item.text}</p>
      </div>
    </article>
  );
}

export default function DesprePage() {
  const isConfigured = hasSupabasePublicEnv();

  return (
    <main className="about-page">
      <AboutStructuredData />
      <div className="about-container">
        <nav className="about-nav" aria-label="Navigare pagina despre">
          <Link className="nota5plus-brand" href={homeHref}>
            <span className="nota5plus-brand-mark">5+</span>
            <span>Nota 5+</span>
          </Link>
          <div className="about-nav-actions">
            <Link href="#cum-functioneaza" className="nota5plus-nav-link">
              Cum functioneaza
            </Link>
            <Link href="#intrebari" className="nota5plus-nav-link">
              Intrebari
            </Link>
            <Link href={loginHref} className="about-login-link">
              Intra in cont
            </Link>
          </div>
        </nav>

        <section className="about-hero" aria-labelledby="about-title">
          <div className="about-hero-copy">
            <p className="about-kicker">Despre Nota 5+</p>
            <h1 id="about-title">
              Platforma pentru teste grila, recapitulare si licenta, facuta pentru sesiuni scurte de invatat.
            </h1>
            <p className="about-lead">
              Nota 5+ ii ajuta pe elevi, studenti si masteranzi sa lucreze direct cu intrebari si raspunsuri:
              incarci materia, verifici continutul si inveti prin Studiu, Interactiv sau Test.
            </p>
            <div className="about-actions">
              <GoogleSignInButton
                next="/"
                disabled={!isConfigured}
                className="about-google-wrap"
                buttonClassName="nota5plus-btn nota5plus-btn-secondary nota5plus-google-btn"
                errorClassName="nota5plus-inline-error"
              >
                <span>Incepe gratuit cu Google</span>
              </GoogleSignInButton>
              <Link className="nota5plus-btn about-secondary-action" href="/auth/demo-login?next=/demo">
                Vezi demo
              </Link>
            </div>
          </div>

          <aside className="about-hero-panel" aria-label="Rezumat Nota 5+">
            <div className="about-panel-top">
              <span>Invatare aplicata</span>
              <strong>Din material la test, fara pasi inutili.</strong>
            </div>
            <div className="about-signal-grid">
              <div>
                <strong>3</strong>
                <span>moduri de lucru</span>
              </div>
              <div>
                <strong>Elevi</strong>
                <span>materii si exercitii</span>
              </div>
              <div>
                <strong>Studenti</strong>
                <span>grile, restante, licenta</span>
              </div>
              <div>
                <strong>Rapid</strong>
                <span>recapitulare clara</span>
              </div>
            </div>
          </aside>
        </section>

        <section className="about-audience" aria-label="Pentru cine este Nota 5+">
          {audienceCards.map((item) => (
            <IconCard key={item.title} item={item} />
          ))}
        </section>

        <section className="about-split-section" id="cum-functioneaza">
          <div>
            <p className="about-section-label">Cum functioneaza</p>
            <h2>O rutina simpla pentru invatare cu intrebari si raspunsuri.</h2>
            <p>
              Pagina este gandita pentru cautari reale: studenti care au grile, elevi care au materiale,
              masteranzi care repeta pentru examene si absolventi care se pregatesc pentru licenta.
            </p>
          </div>
          <div className="about-step-list">
            {workflowSteps.map((item) => (
              <IconCard key={item.title} item={item} className="about-step-card" />
            ))}
          </div>
        </section>

        <section className="about-mode-section" aria-labelledby="about-modes-title">
          <div className="about-section-head">
            <p className="about-section-label">Moduri de invatare</p>
            <h2 id="about-modes-title">Alegi ritmul potrivit pentru materia ta.</h2>
          </div>
          <div className="about-mode-grid">
            {learningModes.map((item) => (
              <IconCard key={item.title} item={item} className="about-mode-card" />
            ))}
          </div>
        </section>

        <section className="about-search-section" aria-label="Subiecte acoperite de Nota 5+">
          <div>
            <p className="about-section-label">Subiecte importante</p>
            <h2>Nota 5+ acopera felul in care oamenii cauta ajutor pentru invatat.</h2>
          </div>
          <div className="about-topic-list">
            {searchTopics.map((topic) => (
              <span key={topic}>{topic}</span>
            ))}
          </div>
        </section>

        <section className="about-depth-section">
          <div className="about-depth-copy">
            <p className="about-section-label">De ce exista</p>
            <h2>Invatatul devine mai clar cand lucrezi direct cu intrebarea.</h2>
            <p>
              In multe examene, diferenta nu este cat de mult ai citit, ci cat de repede recunosti intrebarea,
              raspunsul corect si capcanele din variante. Nota 5+ transforma materialul intr-un spatiu de lucru
              repetabil: parcurgi, raspunzi, verifici si revii unde ai gresit.
            </p>
          </div>
          <div className="about-depth-points">
            <div>
              <Layers3 size={21} aria-hidden="true" />
              <span>Materii separate, usor de reluat</span>
            </div>
            <div>
              <UsersRound size={21} aria-hidden="true" />
              <span>Potrivit pentru elevi, studenti si comunitati academice</span>
            </div>
            <div>
              <Timer size={21} aria-hidden="true" />
              <span>Sesiuni scurte, bune pentru zile aglomerate</span>
            </div>
          </div>
        </section>

        <section className="about-faq" id="intrebari" aria-labelledby="about-faq-title">
          <div className="about-section-head">
            <p className="about-section-label">Intrebari frecvente</p>
            <h2 id="about-faq-title">Raspunsuri rapide despre Nota 5+.</h2>
          </div>
          <div className="about-faq-grid">
            {faqItems.map((item) => (
              <article key={item.question}>
                <h3>{item.question}</h3>
                <p>{item.answer}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="about-final">
          <div>
            <p className="about-section-label">Start rapid</p>
            <h2>Intra in Nota 5+ si lucreaza materia ca pe un set clar de pasi.</h2>
          </div>
          <Link className="nota5plus-btn about-final-action" href="/auth/demo-login?next=/demo">
            Incearca demo
          </Link>
        </section>
      </div>
    </main>
  );
}
