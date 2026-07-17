"use client";

import Link from "next/link";
import { ArrowRight, CalendarDays, Clock3, Search, ShieldCheck, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

function dateLabel(value) {
  return value ? new Intl.DateTimeFormat("ro-RO", { day: "numeric", month: "long", year: "numeric" }).format(new Date(value)) : "";
}

function normalize(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function periodLabel(article) {
  return `${dateLabel(article.period_start)} – ${dateLabel(article.period_end)}`;
}

function EditorialCard({ article, featured = false }) {
  const topicInitial = String(article.primary_topic || "Educație").trim().slice(0, 1).toUpperCase();

  return (
    <Link
      href={`/articole/${article.slug}`}
      className={`editorial-card${featured ? " is-featured" : ""}`}
      data-usage-event="editorial_article_opened"
    >
      <span className="editorial-card-visual" aria-hidden="true">
        <i />
        <i />
        <small>{article.primary_topic}</small>
        <b>{topicInitial}</b>
      </span>
      <span className="editorial-card-copy">
        <span className="editorial-card-meta">
          <CalendarDays size={14} />
          {periodLabel(article)}
          <span>·</span>
          <Clock3 size={14} />
          {article.reading_minutes} min
        </span>
        <strong>{article.title}</strong>
        <span>{article.summary}</span>
        <small>{(article.categories || []).slice(0, 2).join(" · ")}</small>
      </span>
      <ArrowRight className="editorial-card-arrow" aria-hidden="true" size={19} />
    </Link>
  );
}

function EditorialEmptyHub() {
  return (
    <section className="editorial-empty-hub" aria-labelledby="empty-editorial-title">
      <div>
        <span className="editorial-eyebrow">Publicăm cu grijă</span>
        <h2 id="empty-editorial-title">Prima ediție este în pregătire.</h2>
        <p>Articolele apar doar după ce subiectele, informațiile și sursele trec verificarea editorială.</p>
      </div>
      <ul aria-label="Ce vei găsi în articole">
        <li><ShieldCheck aria-hidden="true" size={18} />Noutăți explicate simplu</li>
        <li><ShieldCheck aria-hidden="true" size={18} />Surse la vedere</li>
        <li><ShieldCheck aria-hidden="true" size={18} />Un pas practic pentru învățare</li>
      </ul>
      <div className="editorial-empty-actions">
        <Link href="/dictionar">Explorează Dicționarul <ArrowRight aria-hidden="true" size={16} /></Link>
        <Link href="/instrumente">Vezi instrumentele gratuite <ArrowRight aria-hidden="true" size={16} /></Link>
      </div>
    </section>
  );
}

export function EditorialIndexClient({ featured, articles, categories }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("Toate");
  const [period, setPeriod] = useState("toate");
  const [visibleCount, setVisibleCount] = useState(10);
  const hasArchive = articles.length > 0;
  const filtered = useMemo(() => articles.filter((article) => {
    const haystack = normalize([article.title, article.summary, article.primary_topic, ...(article.categories || [])].join(" "));
    const matchesSearch = !query || haystack.includes(normalize(query));
    const matchesCategory = category === "Toate" || article.categories?.includes(category);
    const age = Date.now() - new Date(article.published_at || article.period_end).getTime();
    const matchesPeriod = period === "toate" || (period === "30" ? age <= 30 * 86400000 : age <= 90 * 86400000);
    return matchesSearch && matchesCategory && matchesPeriod;
  }), [articles, category, period, query]);

  useEffect(() => setVisibleCount(10), [category, period, query]);

  return (
    <>
      <section className="editorial-hero" aria-labelledby="editorial-title">
        <div>
          <span className="editorial-eyebrow">Educația săptămânii</span>
          <h1 id="editorial-title">Schimbările care merită înțelese, nu doar citite.</h1>
          <p>O selecție săptămânală de noutăți verificate despre învățare, școli, universități și tehnologie — explicată pentru România.</p>
        </div>
        <div className="editorial-hero-mark" aria-hidden="true">
          <span>{featured ? "Nou" : "Curând"}</span>
          <i />
          <b>{featured ? "EDIȚIA CURENTĂ" : "PRIMA EDIȚIE"}</b>
        </div>
      </section>

      {featured ? (
        <section className="editorial-featured" aria-labelledby="featured-article">
          <div className="editorial-section-heading">
            <span>Ediția curentă</span>
            <h2 id="featured-article">Ce s-a schimbat recent</h2>
          </div>
          <EditorialCard article={featured} featured />
        </section>
      ) : <EditorialEmptyHub />}

      {hasArchive ? (
        <section className="editorial-archive" aria-labelledby="archive-title">
          <div className="editorial-section-heading">
            <span>Arhivă</span>
            <h2 id="archive-title">Ediții anterioare</h2>
          </div>
          <div className="editorial-filter-panel">
            <label className="editorial-search">
              <Search size={19} />
              <span className="sr-only">Caută în articole</span>
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută un subiect" data-usage-event="editorial_search_used" />
              {query ? <button type="button" aria-label="Șterge căutarea" onClick={() => setQuery("")}><X size={16} /></button> : null}
            </label>
            <div className="editorial-filter-row">
              <div>{["Toate", ...categories].map((item) => <button key={item} className={category === item ? "is-active" : ""} type="button" onClick={() => setCategory(item)} data-usage-event="editorial_category_filtered">{item}</button>)}</div>
              <select value={period} onChange={(event) => setPeriod(event.target.value)} aria-label="Filtrează după perioadă">
                <option value="toate">Oricând</option>
                <option value="30">Ultimele 30 zile</option>
                <option value="90">Ultimele 3 luni</option>
              </select>
            </div>
          </div>
          <p className="editorial-results-count" aria-live="polite">{filtered.length} {filtered.length === 1 ? "ediție găsită" : "ediții găsite"}</p>
          {filtered.length ? (
            <>
              <div className="editorial-card-grid">{filtered.slice(0, visibleCount).map((article) => <EditorialCard article={article} key={article.id} />)}</div>
              {visibleCount < filtered.length ? <button type="button" className="editorial-load-more" onClick={() => setVisibleCount((count) => count + 10)} data-usage-event="editorial_load_more">Încarcă mai multe articole</button> : null}
            </>
          ) : (
            <div className="editorial-empty-editorial">
              <strong>Nu am găsit o ediție potrivită</strong>
              <p>Încearcă un termen mai general sau elimină unul dintre filtre.</p>
              <button type="button" onClick={() => { setQuery(""); setCategory("Toate"); setPeriod("toate"); }}>Resetează filtrele</button>
            </div>
          )}
        </section>
      ) : null}
    </>
  );
}
