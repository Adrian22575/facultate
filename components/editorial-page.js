import Link from "next/link";
import { ArrowRight, BookOpenText, CalendarDays, Clock3, ExternalLink, GraduationCap, Lightbulb, ListChecks } from "lucide-react";

import { EditorialReadingTracker } from "@/components/editorial-reading-tracker";

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
    <main className="editorial-page">
      <div className="editorial-container">
        <nav className="editorial-nav" aria-label="Navigare publică">
          <Link className="nota5plus-brand" href="/"><span className="nota5plus-brand-mark">5+</span><span>Nota 5+</span></Link>
          <div>
            <Link href="/articole" className="editorial-nav-link">Articole</Link>
            <Link href="/dictionar" className="editorial-nav-link">Dicționar</Link>
            <Link href="/instrumente" className="editorial-nav-link">Instrumente gratuite</Link>
            <Link href="/auth/exit-demo?target=login" className="editorial-login-link">Intră în cont</Link>
          </div>
        </nav>
        {children}
      </div>
    </main>
  );
}

export function EditorialBreadcrumbs({ article }) {
  return (
    <nav className="editorial-breadcrumbs" aria-label="Breadcrumb">
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
    <section className="editorial-sources" id="surse">
      <div className="editorial-section-heading"><span>Documentare</span><h2>Surse folosite</h2></div>
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
    <nav className={`editorial-table-of-contents ${className}`.trim()} aria-label="În acest articol">
      <span>În acest articol</span>
      <ol>{sections.map((section) => <li key={section.id}><a href={`#${section.id}`}>{section.title}</a></li>)}</ol>
    </nav>
  );
}

function RelatedResources({ links }) {
  if (!links?.length) return null;

  return (
    <section className="editorial-related-resources" aria-labelledby="related-resources-title">
      <div className="editorial-section-heading"><span>Mai departe</span><h2 id="related-resources-title">Resurse care completează subiectul</h2></div>
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
      <article className="editorial-article">
        <header className="editorial-article-hero">
          <span className="editorial-eyebrow">Educația săptămânii</span>
          <h1>{article.title}</h1>
          <p>{article.subtitle}</p>
          <div><span><CalendarDays size={16} />{periodLabel(article)}</span><span><Clock3 size={16} />{article.reading_minutes} min de citit</span></div>
        </header>

        <section className="editorial-summary" aria-labelledby="summary-title">
          <span id="summary-title">Pe scurt</span>
          <p>{article.summary}</p>
          <ul>{(article.key_takeaways || []).map((item) => <li key={item}><ListChecks aria-hidden="true" size={17} />{item}</li>)}</ul>
        </section>

        <details className="editorial-mobile-toc">
          <summary>În acest articol</summary>
          <EditorialTableOfContents sections={sections} />
        </details>

        <div className="editorial-article-layout">
          <div className="editorial-article-body">
            {sections.map((section) => (
              <section key={section.id} id={section.id}>
                <h2>{section.title}</h2>
                <p>{section.content}</p>
                <div className="editorial-section-note"><Lightbulb aria-hidden="true" size={17} /><div><strong>De ce contează</strong><span>{section.implication}</span><small>Limită: {section.limitations}</small></div></div>
              </section>
            ))}
            <section className="editorial-student-implications"><GraduationCap aria-hidden="true" size={23} /><div><h2>Ce înseamnă pentru elevi și studenți</h2><ul>{(article.student_implications || []).map((item) => <li key={item}>{item}</li>)}</ul></div></section>
            <section className="editorial-weekly-term"><BookOpenText aria-hidden="true" size={22} /><div><span>Termenul săptămânii</span><h2>{article.weekly_term?.term}</h2><p>{article.weekly_term?.explanation}</p>{article.weekly_term?.dictionarySlug ? <Link href={`/dictionar/${article.weekly_term.dictionarySlug}`}>Vezi explicația în Dicționar <ArrowRight aria-hidden="true" size={15} /></Link> : null}</div></section>
            <section className="editorial-conclusion"><span>Concluzie</span><p>{article.conclusion}</p></section>
            {article.correction_note ? <section className="editorial-correction"><strong>Actualizare editorială</strong><p>{article.correction_note}</p></section> : null}
          </div>
          <aside className="editorial-article-aside">
            <div className="editorial-aside-topic"><span>În această ediție</span><strong>{article.primary_topic}</strong><p>{(article.categories || []).join(" · ")}</p></div>
            <EditorialTableOfContents sections={sections} />
            <a href="#surse">Consultă sursele <ArrowRight aria-hidden="true" size={15} /></a>
            <Link href="/instrumente/plan-de-invatare" data-usage-event="editorial_tools_clicked">Calculează un plan de învățare <ArrowRight aria-hidden="true" size={15} /></Link>
          </aside>
        </div>

        <SourceList sources={article.sources || []} />
        <RelatedResources links={article.internal_links} />
        <section className="editorial-next-step">
          <div><span>Pas practic</span><h2>Transformă informația într-un plan de recapitulare.</h2><p>Pornește cu un calculator simplu și stabilește ce poți parcurge până la următorul examen.</p></div>
          <Link href="/instrumente/plan-de-invatare" data-usage-event="editorial_cta_clicked">Calculează un plan de învățare <ArrowRight aria-hidden="true" size={17} /></Link>
        </section>
      </article>
    </>
  );
}
