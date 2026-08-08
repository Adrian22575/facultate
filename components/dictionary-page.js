import Link from "next/link";
import styles from "@/components/dictionary-page.module.css";
import { ArrowRight, BookOpenText, Brain, ChevronRight, GraduationCap, ListChecks, Upload } from "lucide-react";

function DictionaryNav() {
  return <nav className={styles.nav} aria-label="Navigare publică"><Link className="nota5plus-brand" href="/"><span className="nota5plus-brand-mark">5+</span><span>Nota 5+</span></Link><div><Link href="/articole" className={styles.navLink}>Articole</Link><Link href="/dictionar" className={styles.navLink}>Dicționar</Link><Link href="/instrumente" className={styles.navLink}>Instrumente gratuite</Link><Link href="/auth/exit-demo?target=login" className={styles.loginLink}>Intră în cont</Link></div></nav>;
}

export function DictionaryShell({ children }) {
  return <main className={styles.page}><div className={styles.container}><DictionaryNav />{children}</div></main>;
}

export function DictionaryBreadcrumbs({ term }) {
  return <nav className={styles.breadcrumbs} aria-label="Breadcrumb"><Link href="/">Acasă</Link><ChevronRight aria-hidden="true" size={15} /><Link href="/dictionar">Dicționar</Link>{term ? <><ChevronRight aria-hidden="true" size={15} /><span aria-current="page">{term.term}</span></> : null}</nav>;
}

function DictionaryStructuredData({ term, siteUrl }) {
  const url = `${siteUrl}/dictionar/${term.slug}`;
  const graph = [
    { "@type": "DefinedTerm", "@id": `${url}#term`, name: term.term, description: term.short_definition, inDefinedTermSet: `${siteUrl}/dictionar#defined-term-set`, url },
    { "@type": "BreadcrumbList", itemListElement: [{ "@type": "ListItem", position: 1, name: "Acasă", item: siteUrl }, { "@type": "ListItem", position: 2, name: "Dicționar", item: `${siteUrl}/dictionar` }, { "@type": "ListItem", position: 3, name: term.term, item: url }] },
    { "@type": "FAQPage", mainEntity: (term.faqs || []).map((item) => ({ "@type": "Question", name: item.question, acceptedAnswer: { "@type": "Answer", text: item.answer } })) }
  ];
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@graph": graph }) }} />;
}

function DictionaryTermVisual({ term }) {
  const category = term.category?.slug || "";
  const Icon = category.includes("facultate") ? GraduationCap : category.includes("teste") || category.includes("examene") ? ListChecks : Brain;
  return <div className={styles.termVisual} aria-hidden="true"><div className={`${styles.termVisualOrbit} ${styles.one}`} /><div className={`${styles.termVisualOrbit} ${styles.two}`} /><div className={styles.termVisualCore}><Icon size={46} strokeWidth={1.5} /></div><span>{term.category?.name}</span><small>{term.term}</small></div>;
}

export function DictionaryTermPage({ term, siteUrl, isPreview = false }) {
  return <>
    {isPreview ? null : <DictionaryStructuredData term={term} siteUrl={siteUrl} />}
    <DictionaryBreadcrumbs term={term} />
    <article className={styles.termPage}>
      <header className={styles.termHero}><div><span>{term.category?.name}</span><h1>Ce înseamnă {term.term}?</h1><p>{term.short_definition}</p><small>{isPreview ? "Previzualizare privată" : `Publicat ${new Intl.DateTimeFormat("ro-RO", { dateStyle: "long" }).format(new Date(term.published_at || term.created_at))}`} · Actualizat {new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium" }).format(new Date(term.updated_at))}</small></div><DictionaryTermVisual term={term} /></header>
      <div className={styles.termLayout}><div className={styles.termContent}><section><h2>Explicația simplă</h2><p>{term.simple_explanation}</p></section>{term.analogy ? <section className={styles.analogy}><span>O analogie simplă</span><p>{term.analogy}</p></section> : null}<section><h2>Exemplu concret</h2><p>{term.example}</p></section><section><h2>De ce este important</h2><p>{term.why_it_matters}</p></section>{term.how_to_apply?.length ? <section><h2>Cum se aplică</h2><ol>{term.how_to_apply.map((step) => <li key={step}>{step}</li>)}</ol></section> : null}<section><h2>Întrebări frecvente</h2><div className={styles.faqList}>{term.faqs.map((item) => <details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</div></section></div><aside className={styles.termAside}><div><BookOpenText aria-hidden="true" size={21} /><strong>Pe scurt</strong><p>{term.short_definition}</p></div><Link href="/dictionar" data-usage-event="dictionary_back_clicked">Vezi toți termenii <ArrowRight size={16} /></Link></aside></div>
      {term.relatedTerms?.length ? <section className={styles.relatedSection}><div className={styles.sectionHead}><div><span>Mai departe</span><h2>Termeni asemănători</h2></div></div><div className={styles.relatedGrid}>{term.relatedTerms.slice(0, 6).map((related) => <Link key={related.id} href={`/dictionar/${related.slug}`} data-usage-event="dictionary_related_opened"><strong>{related.term}</strong><span>{related.short_definition}</span><ArrowRight aria-hidden="true" size={16} /></Link>)}</div></section> : null}
      <section className={styles.cta}><div><span>Aplică ideea</span><h2>{term.cta.label}</h2><p>{term.cta.copy}</p></div><Link href={term.cta.href} data-usage-event="dictionary_cta_clicked"><Upload aria-hidden="true" size={18} />{term.cta.label}</Link></section>
    </article>
  </>;
}
