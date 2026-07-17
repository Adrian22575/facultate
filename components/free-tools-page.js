import Link from "next/link";
import { ArrowRight, Calculator, CalendarClock, CalendarDays, ListChecks, TrendingUp } from "lucide-react";

import { FreeToolsCalculator } from "@/components/free-tools-calculator";
import { FREE_TOOLS_LAST_UPDATED, freeTools } from "@/lib/free-tools";
import { getPublicSiteUrl } from "@/lib/site";

const icons = { ListChecks, CalendarClock, CalendarDays, Calculator, TrendingUp };

const toolFaq = {
  "cate-grile-pe-zi": [
    ["Trebuie să repet toate grilele greșite?", "Nu neapărat. Calculatorul îți permite să alegi numărul de repetări, ca să poți începe cu un ritm realist."],
    ["De ce folosim zile de studiu, nu toate zilele?", "Planul este mai util când ține cont de zilele în care chiar poți învăța. Astfel volumul zilnic nu este artificial mic."],
    ["Ce procent de greșeli aleg?", "Dacă nu ai un istoric, 20% este un punct de plecare prudent. După primele sesiuni, înlocuiește-l cu procentul tău real." ]
  ],
  "in-cate-zile-termin-materia": [
    ["Pot folosi pagini, capitole sau grile?", "Da. Calculatorul folosește o singură unitate; alege una și păstreaz-o pentru total, progres și ritmul zilnic."],
    ["Data finală include recapitularea?", "Rezultatul arată atât data la care termini materia, cât și data de final după zilele rezervate pentru recapitulare."],
    ["Ce fac dacă depășesc examenul?", "Crește ritmul zilnic, adaugă zile de studiu sau micșorează numărul de zile rezervate pentru recapitulare." ]
  ],
  "plan-de-invatare": [
    ["Planul se schimbă dacă aleg dificultate mare?", "Da. Pentru același timp disponibil, un material dificil primește un volum zilnic mai mic decât unul mediu sau ușor."],
    ["De ce există zi tampon?", "Ziua dinaintea examenului rămâne liberă pentru odihnă, pregătiri sau o recuperare neprevăzută."],
    ["Pot recalcula după fiecare săptămână?", "Da. Actualizează progresul și generează din nou planul. Nu trebuie să reiei formularul de la zero." ]
  ],
  "calculator-punctaj-examen": [
    ["Cum funcționează penalizarea?", "Din fiecare răspuns greșit se scade valoarea introdusă. Lasă 0 dacă examenul nu penalizează răspunsurile greșite."],
    ["De ce trebuie să însumeze toate răspunsurile totalul?", "Pentru ca punctajul să fie corect, fiecare întrebare trebuie să fie încadrată ca corectă, greșită sau necompletată."],
    ["Câte întrebări trebuie să corectez pentru nota următoare?", "Estimarea presupune că transformi un răspuns greșit într-unul corect; de aceea ia în calcul și penalizarea." ]
  ],
  "scor-necesar-simulare": [
    ["Scorul necesar este același cu media necesară?", "La prima simulare rămasă, scorul recomandat este media de care ai nevoie pentru toate simulările rămase. Poți compensa ulterior cu rezultate mai mari sau mai mici."],
    ["Ce înseamnă că ținta nu este posibilă?", "Chiar și cu scor 100 la toate simulările rămase, media finală nu ar mai ajunge la obiectivul ales."],
    ["Ce scoruri pot introduce?", "Introduce scoruri între 0 și 100, separate prin virgulă. Calculatorul ignoră valorile invalide." ]
  ]
};

function ToolIcon({ tool, size = 22 }) {
  const Icon = icons[tool.icon] || Calculator;
  return <Icon size={size} strokeWidth={1.9} aria-hidden="true" />;
}

function JsonLd({ data }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }} />;
}

export function ToolsStructuredData({ tool = null }) {
  const siteUrl = getPublicSiteUrl();
  const items = tool ? [["Acasă", siteUrl], ["Instrumente gratuite", `${siteUrl}/instrumente`], [tool.title, `${siteUrl}/instrumente/${tool.slug}`]] : [["Acasă", siteUrl], ["Instrumente gratuite", `${siteUrl}/instrumente`]];
  const graph = [{
    "@type": "BreadcrumbList",
    itemListElement: items.map(([name, item], index) => ({ "@type": "ListItem", position: index + 1, name, item }))
  }];

  if (tool) {
    graph.push({
      "@type": "SoftwareApplication",
      name: tool.title,
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      isAccessibleForFree: true,
      url: `${siteUrl}/instrumente/${tool.slug}`,
      inLanguage: "ro-RO",
      description: tool.seoDescription,
      offers: { "@type": "Offer", price: "0", priceCurrency: "RON" }
    });
    graph.push({
      "@type": "FAQPage",
      mainEntity: (toolFaq[tool.slug] || []).map(([question, answer]) => ({
        "@type": "Question",
        name: question,
        acceptedAnswer: { "@type": "Answer", text: answer }
      }))
    });
  }

  return <JsonLd data={{ "@context": "https://schema.org", "@graph": graph }} />;
}

function ToolsNavigation() {
  return <nav className="free-tools-nav" aria-label="Navigare principală">
    <Link className="nota5plus-brand" href="/">
      <span className="nota5plus-brand-mark">5+</span>
      <span>Nota 5+</span>
    </Link>
    <div>
      <Link href="/instrumente" className="free-tools-nav-link">Instrumente gratuite</Link>
      <Link href="/auth/login?next=/" className="free-tools-login" data-usage-event="free_tools_login_clicked">Intră în cont</Link>
    </div>
  </nav>;
}

function Breadcrumbs({ tool }) {
  return <nav className="free-tools-breadcrumbs" aria-label="Breadcrumb"><Link href="/">Acasă</Link><span aria-hidden="true">/</span><Link href="/instrumente">Instrumente gratuite</Link>{tool ? <><span aria-hidden="true">/</span><span aria-current="page">{tool.shortTitle}</span></> : null}</nav>;
}

function ToolCard({ tool, featured = false }) {
  return <article className={`free-tools-card${featured ? " is-featured" : ""}`}>
    <div className="free-tools-card-icon"><ToolIcon tool={tool} /></div>
    <div><span>{tool.category}</span><h2>{tool.title}</h2><p>{tool.description}</p></div>
    <Link href={`/instrumente/${tool.slug}`} data-usage-event="free_tool_opened">Deschide instrumentul <ArrowRight size={17} aria-hidden="true" /></Link>
  </article>;
}

export function FreeToolsIndexPage() {
  const groups = ["Planificare", "Examene și simulări"].map((category) => ({ category, tools: freeTools.filter((tool) => tool.category === category) }));

  return <main className="free-tools-page">
    <ToolsStructuredData />
    <div className="free-tools-container">
      <ToolsNavigation />
      <Breadcrumbs />
      <header className="free-tools-hero">
        <span className="free-tools-eyebrow">Instrumente gratuite</span>
        <h1>Planifică mai simplu. Învață cu un obiectiv clar.</h1>
        <p>Cinci calculatoare rapide pentru grile, materie, simulări și punctaj. Funcționează direct, fără cont.</p>
      </header>
      {groups.map(({ category, tools }) => <section className="free-tools-group" key={category} aria-labelledby={`group-${category}`}><div className="free-tools-group-head"><span>{category}</span><p>{category === "Planificare" ? "Începe cu ce ai de parcurs și timpul pe care îl ai." : "Verifică scorul și ajustează următoarea sesiune."}</p></div><div className="free-tools-grid">{tools.map((tool, index) => <ToolCard tool={tool} featured={category === "Planificare" && index === 0} key={tool.slug} />)}</div></section>)}
      <section className="free-tools-faq" aria-labelledby="tools-faq-title"><div><span className="free-tools-eyebrow">Întrebări frecvente</span><h2 id="tools-faq-title">Rezultatele sunt gratuite și rămân la tine.</h2></div><div>{[["Trebuie să îmi fac cont?", "Nu. Instrumentele sunt publice, iar calculele se fac direct în browser."], ["Sunt formulele exacte?", "Rezultatele respectă formulele afișate pe fiecare pagină. Le poți ajusta imediat prin valorile din formular."], ["Ce fac după ce am un plan?", "Poți intra în Nota 5+ pentru a lucra pe materia ta, grile și simulări într-un singur loc."]].map(([question, answer]) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div></section>
      <section className="free-tools-final"><div><span className="free-tools-eyebrow">Următorul pas</span><h2>Ai planul. Acum lucrează materia într-un ritm care se vede.</h2></div><Link href="/auth/login?next=/materiale/invata" className="free-tools-final-link" data-usage-event="free_tools_cta_clicked">Începe cu materialul tău <ArrowRight size={17} /></Link></section>
    </div>
  </main>;
}

export function FreeToolPage({ tool }) {
  const related = freeTools.filter((item) => item.slug !== tool.slug).slice(0, 3);
  const faq = toolFaq[tool.slug] || [];

  return <main className="free-tools-page">
    <ToolsStructuredData tool={tool} />
    <div className="free-tools-container">
      <ToolsNavigation />
      <Breadcrumbs tool={tool} />
      <header className="free-tool-hero"><div className="free-tool-hero-icon"><ToolIcon tool={tool} size={28} /></div><div><span className="free-tools-eyebrow">{tool.category}</span><h1>{tool.title}</h1><p>{tool.description}</p></div></header>
      <FreeToolsCalculator tool={tool} />
      <section className="free-tool-content" aria-label="Explicații pentru calculator"><article><h2>Ce înseamnă rezultatul?</h2><p>{tool.directAnswer}</p></article><article><h2>Cum se calculează?</h2><p>Rezultatul folosește exclusiv valorile din formular și o formulă fixă, afișată după calcul. Nu sunt folosite estimări ascunse.</p></article><article><h2>Exemplu completat</h2><p>{tool.example}</p></article></section>
      <section className="free-tool-faq" aria-labelledby="tool-faq-title"><div><span className="free-tools-eyebrow">Întrebări frecvente</span><h2 id="tool-faq-title">Răspunsuri scurte înainte să începi.</h2></div><div className="free-tool-faq-list">{faq.map(([question, answer]) => <article key={question}><h3>{question}</h3><p>{answer}</p></article>)}</div></section>
      <section className="free-tool-related" aria-labelledby="related-title"><div className="free-tools-group-head"><span id="related-title">Instrumente similare</span><p>Alege următoarea întrebare practică.</p></div><div className="free-tools-grid">{related.map((item) => <ToolCard key={item.slug} tool={item} />)}</div></section>
      <p className="free-tools-updated">Ultima actualizare: {new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(`${FREE_TOOLS_LAST_UPDATED}T12:00:00`))}</p>
    </div>
  </main>;
}
