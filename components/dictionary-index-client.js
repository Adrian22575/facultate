"use client";

import Link from "next/link";
import styles from "@/components/dictionary-page.module.css";
import { BookOpenText, Brain, Search, Sparkles, Tags } from "lucide-react";
import { useMemo, useState } from "react";

import {
  FilterSearch,
  FilterSelect,
  FiltersToolbar,
  ResultsSummary
} from "@/components/ui/collection-controls";

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function matches(term, query) {
  const needle = normalize(query);
  if (!needle) return true;
  return normalize([term.term, term.short_definition, term.category?.name, ...(term.synonyms || [])].join(" ")).includes(needle);
}

function TermCard({ term, featured = false }) {
  return (
    <Link className={`${styles.termCard}${featured ? ` ${styles.featured}` : ""}`} href={`/dictionar/${term.slug}`} data-usage-event="dictionary_term_opened">
      <span className={styles.termCardLetter} aria-hidden="true">{term.initial}</span>
      <span className={styles.termCardCopy}>
        <strong>{term.term}</strong>
        <span>{term.short_definition}</span>
        <small>{term.category?.name}</small>
      </span>
      <span className={styles.termCardArrow} aria-hidden="true">→</span>
    </Link>
  );
}

export function DictionaryIndexClient({ categories, terms, recent, total }) {
  const [query, setQuery] = useState("");
  const [activeLetter, setActiveLetter] = useState("Toate");
  const [activeCategory, setActiveCategory] = useState("toate");
  const availableLetters = useMemo(() => new Set(terms.map((term) => term.initial)), [terms]);
  const letters = ["Toate", ..."ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("")];
  const filteredTerms = useMemo(() => terms.filter((term) => {
    const matchesLetter = activeLetter === "Toate" || term.initial === activeLetter;
    const matchesCategory = activeCategory === "toate" || term.category?.slug === activeCategory;
    return matchesLetter && matchesCategory && matches(term, query);
  }), [activeCategory, activeLetter, query, terms]);

  function clearFilters() {
    setQuery("");
    setActiveLetter("Toate");
    setActiveCategory("toate");
  }

  return (
    <>
      <section className={styles.hero} aria-labelledby="dictionary-title">
        <div>
          <span className={styles.eyebrow}><Sparkles aria-hidden="true" size={14} />Bibliotecă publică Nota 5+</span>
          <h1 id="dictionary-title">Dicționar pentru învățare și examene</h1>
          <p>Înțelege simplu termenii pe care îi întâlnești când înveți, te pregătești pentru examene sau îți organizezi materia.</p>
        </div>
        <div className={styles.heroVisual} aria-hidden="true"><Brain size={74} strokeWidth={1.45} /><span className={`${styles.visualCard} ${styles.top}`}>întrebare</span><span className={`${styles.visualCard} ${styles.bottom}`}>înțelegere</span></div>
      </section>

      {recent.length ? (
        <section className={styles.recentSection} aria-labelledby="dictionary-recent-title">
          <div className={styles.sectionHead}><div><span>De explorat</span><h2 id="dictionary-recent-title">Adăugate recent</h2></div><p>Idei noi, separate de rezultatele căutării.</p></div>
          <div className={styles.recentGrid}>{recent.map((term) => <TermCard key={term.id} term={term} featured />)}</div>
        </section>
      ) : null}

      <section className={styles.searchPanel} aria-labelledby="dictionary-search-title">
        <div className={styles.searchHead}><div><span>Găsește rapid</span><h2 id="dictionary-search-title">Caută în dicționar</h2></div><span><BookOpenText aria-hidden="true" size={16} />{total} termeni</span></div>
        <FiltersToolbar layout="two" ariaLabel="Cautare si filtrare dictionar">
          <FilterSearch
            value={query}
            onChange={setQuery}
            placeholder="Caută un termen sau o expresie"
            ariaLabel="Caută un termen"
            clearable
            inputProps={{ "data-usage-event": "dictionary_search_used" }}
          />
          <FilterSelect
            label="Categorie"
            value={activeCategory}
            onChange={setActiveCategory}
            icon={Tags}
            ariaLabel="Filtrează după categorie"
            dataUsageEvent="dictionary_category_filtered"
            options={[
              { value: "toate", label: "Toate categoriile" },
              ...categories.map((category) => ({
                value: category.slug,
                label: category.name
              }))
            ]}
          />
        </FiltersToolbar>
        <div className={styles.letterFilter} aria-label="Filtrează după literă">
          {letters.map((letter) => {
            const available = letter === "Toate" || availableLetters.has(letter);
            return <button key={letter} type="button" disabled={!available} className={activeLetter === letter ? styles.active : ""} onClick={() => setActiveLetter(letter)} data-usage-event="dictionary_letter_filtered">{letter}</button>;
          })}
        </div>
      </section>

      <section className={styles.listSection} aria-labelledby="dictionary-list-title">
        <div className={styles.sectionHead}><div><span>Rezultatele tale</span><h2 id="dictionary-list-title">Alege un termen</h2></div><ResultsSummary as="strong">{filteredTerms.length} {filteredTerms.length === 1 ? "rezultat" : "rezultate"}</ResultsSummary></div>
        {filteredTerms.length ? <div className={styles.termList}>{filteredTerms.map((term) => <TermCard key={term.id} term={term} />)}</div> : <div className={styles.empty}><Search aria-hidden="true" size={23} /><h2>Nu am găsit un termen potrivit</h2><p>Încearcă un cuvânt mai scurt sau elimină unul dintre filtre.</p><button type="button" onClick={clearFilters}>Resetează filtrele</button></div>}
      </section>
    </>
  );
}
