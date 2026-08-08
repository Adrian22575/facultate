import Link from "next/link";
import { ArrowRight, BookOpenText, CalendarDays, Clock3, ExternalLink, GraduationCap, Lightbulb, ListChecks } from "lucide-react";

import { EditorialReadingTracker } from "@/components/editorial-reading-tracker";
import styles from "@/components/editorial-page.module.css";

function dateLabel(value) {
  return value ? new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : "";
}

function periodLabel(article) {
  return `${dateLabel(article.period_start)} – ${dateLabel(article.period_end)}`;
}

function sectionId(title, index) {
  const slug = String(title || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return `sectiune-${index + 1}-${slug || "articol"}`;
}

export function EditorialShell({ children }) {
  return (
    <main className={styles.page}>
      <div className={styles.container}>
        <nav className={styles.nav} aria-label="Navigare publică">
          <Link className="nota5plus-brand" href="/"><span className="nota5plus-brand-mark">5+</span><span>Nota 5+</span></Link>
          <div>
            <Link href="/articole" className={styles.navLink}>Articole</Link>
            <Link href="/dictionar" className={styles.navLink}>Dicționar</Link>
            <Link href="/instrumente" className={styles.navLink}>Instrumente gratuite</Link>
            <Link href="/auth/exit-demo?target=login" className={styles.loginLink}>Intră în cont</Link>
          </div>
        </nav>
        {children}
      </div>
    </main>
  );
}

export function EditorialBreadcrumbs({ article }) {
  return (
    <nav className={styles.breadcrumbs} aria-label="Breadcrumb">
      <Link href="/">Acasă</Link><span>›</span><Link href="/articole">Articole</Link>
      {article ? <><span>›</span><span aria-current="page">{article.title}</span></> : null}
    </nav>
  );
}

function ArticleStructuredData({ article, siteUrl }) {
  const url = `${siteUrl}/articole/${article.slug}`;
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({ "@context": "https://schema.org", "@type": "Article", headline: article.title, description: article.meta_description, datePublished: article.published_at, dateModified: article.updated_at, mainEntityOfPage: url, publisher: { "@type": "Organization", name: "Nota 5+", url: siteUrl }, author: { "@type": "Organization", name: "Nota 5+" } }) }} />;
}

function SourceList({ sources }) {
  return (
    <section className={styles.sources} id="surse">
      <div className={styles.sectionHeading}><span>Documentare</span><h2>Surse folosite</h2></div>
      <ol>{sources.map((source) => (
        <li key={source.id}>
          <a href={source.url} target="_blank" rel="noopener noreferrer">
            <strong>{source.publisher}</strong><span>{source.title}</span>
            <small>{source.publishedAt ? dateLabel(source.publishedAt) : "Dată neprecizată"} · {source.sourceType}</small><ExternalLink aria-hidden="true" size={15} />
          </a>
        </li>
      ))}</ol>
    </section>
  );
}

function EditorialTableOfContents({ sections, className = "" }) {
  if (!sections.length) return null;

  return (
    <nav className={`${styles.tableOfContents} ${className}`.trim()} aria-label="În acest articol">
      <span>În acest articol</span>
      <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
    </nav>
  );
}

function RelatedResources({ links }) {
  if (!links?.length) return null;

  return (
    <section className={styles.relatedResources} aria-labelledby="related-resources-title">
      <div className={styles.sectionHeading}><span>Mai departe</span><h2 id="related-resources-title">Resurse care completează subiectul</h2></div>
      <div>{links.slice(0, 3).map((item) => (
        <Link key={`${item.href}-${item.label}`} href={item.href} data-usage-event="editorial_internal_link_opened">
          <span>{item.context}</span><strong>{item.label}</strong><ArrowRight aria-hidden="true" size={16} />
        </Link>
      ))}</div>
    </section>
  );
}

export function EditorialArticlePage({ article, siteUrl, isPreview = false }) {
  const sections = (article.sections || []).map((section, index) => ({ ...section, id: sectionId(section.title, index) }));

  return (
    <>
      {isPreview ? null : <EditorialReadingTracker />}
      {isPreview ? null : <ArticleStructuredData article={article} siteUrl={siteUrl} />}
      <EditorialBreadcrumbs article={article} />
      <article className={styles.article}>
        <header className={styles.articleHero}>
          <span className={styles.eyebrow}>Educația săptămânii</span>
          <h1>{article.title}</h1>
          <p>{article.subtitle}</p>
          <div><span><CalendarDays size={16} />{periodLabel(article)}</span><span><Clock3 size={16} />{article.reading_minutes} min de citit</span></div>
        </header>

        <section className={styles.summary} aria-labelledby="summary-title">
          <span id="summary-title">Pe scurt</span>
          <p>{article.summary}</p>
          <ul>{(article.key_takeaways || []).map((item) => <li key={item}><ListChecks aria-hidden="true" size={17} />{item}</li>)}</ul>
        </section>

        <details className={styles.mobileToc}>
          <summary>În acest articol</summary>
          <EditorialTableOfContents sections={sections} />
        </details>

        <div className={styles.articleLayout}>
          <div className={styles.articleBody}>
            {sections.map((section) => (
              <section key={section.id} id={section.id}>
                <h2>{section.title}</h2>
                <p>{section.content}</p>
                <div className={styles.sectionNote}><Lightbulb aria-hidden="true" size={17} /><div><strong>De ce contează</strong><span>{section.implication}</span><small>Limită: {section.limitations}</small></div></div>
              </section>
            ))}
            <section className={styles.studentImplications}><GraduationCap aria-hidden="true" size={23} /><div><h2>Ce înseamnă pentru elevi și studenți</h2><ul>{(article.student_implications || []).map((item) => <li key={item}>{item}</li>)}</ul></div></section>
            <section className={styles.weeklyTerm}><BookOpenText aria-hidden="true" size={22} /><div><span>Termenul săptămânii</span><h2>{article.weekly_term?.term}</h2><p>{article.weekly_term?.explanation}</p>{article.weekly_term?.dictionarySlug ? <Link href={`/dictionar/${article.weekly_term.dictionarySlug}`}>Vezi explicația în Dicționar <ArrowRight aria-hidden="true" size={15} /></Link> : null}</div></section>
            <section className={styles.conclusion}><span>Concluzie</span><p>{article.conclusion}</p></section>
            {article.correction_note ? <section className={styles.correction}><strong>Actualizare editorială</strong><p>{article.correction_note}</p></section> : null}
          </div>
          <aside className={styles.articleAside}>
            <div><span>În această ediție</span><strong>{article.primary_topic}</strong><p>{(article.categories || []).join(" · ")}</p></div>
            <EditorialTableOfContents sections={sections} />
            <a href="#surse">Consultă sursele <ArrowRight aria-hidden="true" size={15} /></a>
            <Link href="/instrumente/plan-de-invatare" data-usage-event="editorial_tools_clicked">Calculează un plan de învățare <ArrowRight aria-hidden="true" size={15} /></Link>
          </aside>
        </div>

        <SourceList sources={article.sources || []} />
        <RelatedResources links={article.internal_links} />
        <section className={styles.nextStep}>
          <div><span>Pas practic</span><h2>Transformă informația într-un plan de recapitulare.</h2><p>Pornește cu un calculator simplu și stabilește ce poți parcurge până la următorul examen.</p></div>
          <Link href="/instrumente/plan-de-invatare" data-usage-event="editorial_cta_clicked">Calculează un plan de învățare <ArrowRight aria-hidden="true" size={17} /></Link>
        </section>
      </article>
    </>
  );
}
