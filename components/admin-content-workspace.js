"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Settings2 } from "lucide-react";
import { AdminEditorialAutomationSettings } from "@/components/admin-editorial-automation-settings";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { LoadingSpinner } from "@/components/loading-spinner";
import { Button } from "@/components/ui/action";
import { FilterSearch, FiltersToolbar, Pagination, ResultsSummary } from "@/components/ui/collection-controls";
import { EmptyState } from "@/components/ui/state";
import { InlineFeedback, StatusPill } from "@/components/ui/status";
import styles from "./admin-content-workspace.module.css";

const PAGE_SIZE = 15;

export function AdminContentTools({ label, onGenerate, generating, workflow, settings, generationPreview }) {
  return (
    <div className={styles.tools}>
      <Button onClick={onGenerate} disabled={generating} aria-busy={generating || undefined}>
        {generating ? <LoadingSpinner size={17} /> : null}
        {generating ? "Generare în curs" : label}
      </Button>
      <details className={styles.settings}>
        <summary><Settings2 size={16} aria-hidden="true" />Automatizare <span>· {settings?.enabled ? "activă" : "oprită"}</span></summary>
        <div className={styles.settingsBody}>
          <AdminEditorialAutomationSettings workflow={workflow} settings={settings} generationPreview={generationPreview} />
        </div>
      </details>
    </div>
  );
}

export function AdminContentProgress({ label }) {
  return <InlineFeedback tone="info" className={styles.progress}>
    <LoadingSpinner size={18} />
    <span>{label}. Starea se actualizează automat.</span>
  </InlineFeedback>;
}

export function AdminContentList({ id, title, items, filters, counts, filter, onFilter, query, onQuery, searchLabel, placeholder, searching, searchError }) {
  const [page, setPage] = useState(1);
  const headingRef = useRef(null);
  useEffect(() => setPage(1), [query, filter]);
  const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const offset = (currentPage - 1) * PAGE_SIZE;
  const pageItems = items.slice(offset, offset + PAGE_SIZE);
  const hasFilters = Boolean(query.trim()) || filter !== "all";

  return (
    <section className={styles.collection} aria-labelledby={id}>
      <h2 id={id} ref={headingRef} tabIndex={-1}>{title}</h2>
      <FiltersToolbar className={styles.toolbar} ariaLabel={searchLabel}>
        <FilterSearch value={query} onChange={onQuery} placeholder={placeholder} ariaLabel={searchLabel} loading={searching} clearable />
        <div className={styles.filters} role="group" aria-label={`Filtre: ${title.toLocaleLowerCase("ro-RO")}`}>
          {filters.map((item) => <Button key={item.id} variant="text" size="compact" aria-pressed={filter === item.id} className={styles.filter} onClick={() => onFilter(item.id)}>
            {item.label}<span>{counts[item.id]}</span>
          </Button>)}
        </div>
      </FiltersToolbar>
      <ResultsSummary className={styles.summary} aria-atomic="true">
        {searching ? "Se caută…" : searchError ? "Rezultatele nu sunt disponibile" : items.length ? `${offset + 1}–${offset + pageItems.length} din ${items.length} rezultate` : "0 rezultate"}
      </ResultsSummary>
      {searchError ? <InlineFeedback tone="error">Căutarea nu a răspuns. Modifică sau șterge căutarea pentru a încerca din nou.</InlineFeedback> : null}
      <div aria-busy={searching || undefined}>
        {searching ? <div className={styles.searchPending}><LoadingSpinner size={20} /><span>Se caută în bibliotecă…</span></div> : searchError ? null : pageItems.length ? (
          <ul className={styles.list}>
            {pageItems.map((item) => <li className={styles.row} key={item.id}>
              <div className={styles.rowCopy}>
                <h3><PendingNavigationLink href={item.href} pendingMode="replace" pendingLabel="Se deschide…">{item.title}<ArrowRight size={16} aria-hidden="true" /></PendingNavigationLink></h3>
                <p>{item.description}</p>
                <div className={styles.metadata}><span>{item.date}</span>{item.meta ? <span>{item.meta}</span> : null}</div>
                {item.warning ? <p className={styles.warning}>{item.warning}</p> : null}
              </div>
              <StatusPill tone={item.warning ? "warning" : "neutral"} className={styles.status}>{item.status}</StatusPill>
            </li>)}
          </ul>
        ) : <EmptyState title={hasFilters ? "Niciun rezultat pentru filtrele alese" : "Biblioteca este goală"} description={hasFilters ? "Schimbă filtrul sau șterge căutarea." : "Folosește generarea pentru a adăuga prima ciornă."} actions={hasFilters ? <Button variant="text" onClick={() => { onFilter("all"); onQuery(""); }}>Resetează lista</Button> : null} />}
      </div>
      {!searching && !searchError ? <Pagination page={currentPage} totalPages={totalPages} onPageChange={(nextPage) => { setPage(nextPage); headingRef.current?.focus(); }} /> : null}
    </section>
  );
}
