"use client";

import Link from "next/link";
import { BookOpenText, Search, X } from "lucide-react";
import { useMemo, useState } from "react";

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

function TermCard({ term }) {
  return (
    <Link className="dictionary-term-card" href={`/dictionar/${term.slug}`} data-usage-event="dictionary_term_opened">
      <span className="dictionary-term-card-letter" aria-hidden="true">{term.initial}</span>
      <span className="dictionary-term-card-copy">
        <strong>{term.term}</strong>
        <span>{term.short_definition}</span>
        <small>{term.category?.name}</small>
      </span>
      <span className="dictionary-term-card-arrow" aria-hidden="true">→</span>
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
      <section className="dictionary-hero" aria-labelledby="dictionary-title">
        <div>
          <span className="dictionary-eyebrow">Bibliotecă publică Nota 5+</span>
          <h1 id="dictionary-title">Dicționar pentru învățare și examene</h1>
          <p>Înțelege simplu termenii pe care îi întâlnești când înveți, te pregătești pentru examene sau îți organizezi materia.</p>
        </div>
        <div className="dictionary-total" aria-label={`${total} termeni publicați`}>
          <BookOpenText aria-hidden="true" size={23} />
          <strong>{total}</strong>
          <span>termeni explicați clar</span>
        </div>
      </section>

      <section className="dictionary-search-panel" aria-label="Caută în dicționar">
        <label className="dictionary-search-field">
          <Search aria-hidden="true" size={20} />
          <span className="sr-only">Caută un termen</span>
          <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Caută un termen sau o expresie" data-usage-event="dictionary_search_used" />
          {query ? <button type="button" onClick={() => setQuery("")} aria-label="Șterge căutarea"><X size={17} /></button> : null}
        </label>
        <div className="dictionary-letter-filter" aria-label="Filtrează după literă">
          {letters.map((letter) => {
            const available = letter === "Toate" || availableLetters.has(letter);
            return <button key={letter} type="button" disabled={!available} className={activeLetter === letter ? "is-active" : ""} onClick={() => setActiveLetter(letter)} data-usage-event="dictionary_letter_filtered">{letter}</button>;
          })}
        </div>
        <div className="dictionary-category-filter" aria-label="Filtrează după categorie">
          <button type="button" className={activeCategory === "toate" ? "is-active" : ""} onClick={() => setActiveCategory("toate")} data-usage-event="dictionary_category_filtered">Toate categoriile</button>
          {categories.map((category) => <button key={category.slug} type="button" className={activeCategory === category.slug ? "is-active" : ""} onClick={() => setActiveCategory(category.slug)} data-usage-event="dictionary_category_filtered">{category.name}</button>)}
        </div>
      </section>

      {recent.length ? (
        <section className="dictionary-recent-section" aria-labelledby="dictionary-recent-title">
          <div className="dictionary-section-head"><div><span>Adăugate recent</span><h2 id="dictionary-recent-title">Termeni utili pentru următoarea sesiune</h2></div></div>
          <div className="dictionary-recent-grid">{recent.map((term) => <TermCard key={term.id} term={term} />)}</div>
        </section>
      ) : null}

      <section className="dictionary-list-section" aria-labelledby="dictionary-list-title">
        <div className="dictionary-section-head"><div><span>Toți termenii</span><h2 id="dictionary-list-title">Alege un termen</h2></div><strong>{filteredTerms.length} {filteredTerms.length === 1 ? "rezultat" : "rezultate"}</strong></div>
        {filteredTerms.length ? <div className="dictionary-term-list">{filteredTerms.map((term) => <TermCard key={term.id} term={term} />)}</div> : <div className="dictionary-empty"><Search aria-hidden="true" size={23} /><h2>Nu am găsit un termen potrivit</h2><p>Încearcă un cuvânt mai scurt sau elimină unul dintre filtre.</p><button type="button" onClick={clearFilters}>Resetează filtrele</button></div>}
      </section>
    </>
  );
}
