"use client";

import Link from "next/link";
import styles from "@/components/editorial-page.module.css";
import { ArrowRight, CalendarDays, Clock3, ShieldCheck, Tags } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import {
  FilterSearch,
  FilterSelect,
  FiltersToolbar,
  ResultsSummary
} from "@/components/ui/collection-controls";

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
      className={`${styles.card}${featured ? ` ${styles.featured}` : ""}`}
      data-usage-event="editorial_article_opened"
    >
      <span className={styles.cardVisual} aria-hidden="true">
        <i />
        <i />
        <small>{article.primary_topic}</small>
        <b>{topicInitial}</b>
      </span>
      <span className={styles.cardCopy}>
        <span className={styles.cardMeta}>
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
      <ArrowRight className={styles.cardArrow} aria-hidden="true" size={19} />
    </Link>
  );
}

function EditorialEmptyHub() {
  return (
    <section className={styles.emptyHub} aria-labelledby="empty-editorial-title">
      <div>
        <span className={styles.eyebrow}>Publicăm cu grijă</span>
        <h2 id="empty-editorial-title">Prima ediție este în pregătire.</h2>
        <p>Articolele apar doar după ce subiectele, informațiile și sursele trec verificarea editorială.</p>
      </div>
      <ul aria-label="Ce vei găsi în articole">
        <li><ShieldCheck aria-hidden="true" size={18} />Noutăți explicate simplu</li>
        <li><ShieldCheck aria-hidden="true" size={18} />Surse la vedere</li>
        <li><ShieldCheck aria-hidden="true" size={18} />Un pas practic pentru învățare</li>
      </ul>
      <div className={styles.emptyActions}>
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
      <section className={styles.hero} aria-labelledby="editorial-title">
        <div>
          <span className={styles.eyebrow}>Educația săptămânii</span>
          <h1 id="editorial-title">Schimbările care merită înțelese, nu doar citite.</h1>
          <p>O selecție săptămânală de noutăți verificate despre învățare, școli, universități și tehnologie — explicată pentru România.</p>
        </div>
        <div className={styles.heroMark} aria-hidden="true">
          <span>{featured ? "Nou" : "Curând"}</span>
          <i />
          <b>{featured ? "EDIȚIA CURENTĂ" : "PRIMA EDIȚIE"}</b>
        </div>
      </section>

      {featured ? (
        <section className={styles.featuredSection} aria-labelledby="featured-article">
          <div className={styles.sectionHeading}>
            <span>Ediția curentă</span>
            <h2 id="featured-article">Ce s-a schimbat recent</h2>
          </div>
          <EditorialCard article={featured} featured />
        </section>
      ) : <EditorialEmptyHub />}

      {hasArchive ? (
        <section className={styles.archive} aria-labelledby="archive-title">
          <div className={styles.sectionHeading}>
            <span>Arhivă</span>
            <h2 id="archive-title">Ediții anterioare</h2>
          </div>
          <div className={styles.filterPanel}>
            <FiltersToolbar layout="three" ariaLabel="Cautare si filtrare articole">
              <FilterSearch
                value={query}
                onChange={setQuery}
                placeholder="Caută un subiect"
                ariaLabel="Caută în articole"
                clearable
                inputProps={{ "data-usage-event": "editorial_search_used" }}
              />
              <FilterSelect
                label="Categorie"
                value={category}
                onChange={setCategory}
                icon={Tags}
                ariaLabel="Filtrează după categorie"
                dataUsageEvent="editorial_category_filtered"
                options={["Toate", ...categories].map((item) => ({
                  value: item,
                  label: item === "Toate" ? "Toate categoriile" : item
                }))}
              />
              <FilterSelect
                label="Perioada"
                value={period}
                onChange={setPeriod}
                icon={CalendarDays}
                ariaLabel="Filtrează după perioadă"
                options={[
                  { value: "toate", label: "Oricând" },
                  { value: "30", label: "Ultimele 30 zile" },
                  { value: "90", label: "Ultimele 3 luni" }
                ]}
              />
            </FiltersToolbar>
          </div>
          <ResultsSummary className={styles.resultsCount}>{filtered.length} {filtered.length === 1 ? "ediție găsită" : "ediții găsite"}</ResultsSummary>
          {filtered.length ? (
            <>
              <div className={styles.cardGrid}>{filtered.slice(0, visibleCount).map((article) => <EditorialCard article={article} key={article.id} />)}</div>
              {visibleCount < filtered.length ? <button type="button" className={styles.loadMore} onClick={() => setVisibleCount((count) => count + 10)} data-usage-event="editorial_load_more">Încarcă mai multe articole</button> : null}
            </>
          ) : (
            <div className={styles.emptyEditorial}>
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
