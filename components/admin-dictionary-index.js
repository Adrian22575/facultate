"use client";

import {
  AlertTriangle,
  BookOpenCheck,
  CheckCircle2,
  Clock3,
  FilePenLine,
  RefreshCw,
  Settings2,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";

import { LoadingSpinner } from "@/components/loading-spinner";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminEditorialAutomationSettings } from "@/components/admin-editorial-automation-settings";
import { FilterSearch } from "@/components/filter-controls";

const ACTIVE_RUN_STATUSES = new Set(["started", "generated", "validated"]);
const RUN_PROGRESS = { started: 12, generated: 62, validated: 88 };
const DICTIONARY_FILTERS = [
  { id: "all", label: "Toate" },
  { id: "attention", label: "Necesită atenție" },
  { id: "draft", label: "Ciorne" },
  { id: "published", label: "Publicate" }
];

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO");
}

function formatDate(value) {
  if (!value) return "Dată indisponibilă";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric"
  }).format(new Date(value));
}

function termStatus(term) {
  if (term.status === "published") return { label: "Publicat", tone: "published" };
  if (term.status === "withdrawn") return { label: "Retras", tone: "withdrawn" };
  if (term.status === "rejected") return { label: "Respins", tone: "review" };
  return { label: "Ciornă", tone: "draft" };
}

function needsAttention(term) {
  return term.status === "rejected" || Number(term.quality_score || 0) < 82;
}

function filterMatches(term, filter) {
  if (filter === "attention") return needsAttention(term);
  if (filter === "draft") return ["draft", "withdrawn"].includes(term.status);
  if (filter === "published") return term.status === "published";
  return true;
}

function frequencyLabel(settings) {
  const days = Number(settings?.frequency_days || 0);
  if (days === 1) return "Zilnic";
  if (days === 7) return "Săptămânal";
  if (days === 14) return "La 2 săptămâni";
  return days > 1 ? `La ${days} zile` : "Neprogramat";
}

function runStatusLabel(status) {
  return {
    started: "Pregătim termenul nou",
    generated: "Verificăm unicitatea și conținutul",
    validated: "Salvăm termenul și legăturile",
    published: "Termen publicat",
    notification_failed: "Termen publicat, notificare netrimisă",
    failed: "Generarea s-a oprit",
    skipped: "Generare omisă"
  }[status] || status;
}

export function AdminDictionaryIndex({
  terms = [],
  runs = [],
  automationSettings,
  generationPreview,
  warning
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [searchedTerms, setSearchedTerms] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [busy, setBusy] = useState("");
  const [generationMessage, setGenerationMessage] = useState(null);
  const activeRun = useMemo(
    () => runs.find((run) => ACTIVE_RUN_STATUSES.has(run.status)) || null,
    [runs]
  );
  const liveRun = activeRun || (busy === "generate" ? { status: "started" } : null);
  const latestRun = runs[0] || null;

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setSearchedTerms([]);
      setSearchBusy(false);
      setSearchError(false);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      setSearchError(false);
      const response = await fetch(
        `/api/admin/dictionary/terms/search?q=${encodeURIComponent(value)}`,
        { signal: controller.signal }
      ).catch(() => null);
      const result = await response?.json().catch(() => ({}));
      if (!controller.signal.aborted && response?.ok) {
        setSearchedTerms(result.terms || []);
      } else if (!controller.signal.aborted) {
        setSearchedTerms([]);
        setSearchError(true);
      }
      if (!controller.signal.aborted) setSearchBusy(false);
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [query]);

  useEffect(() => {
    if (!liveRun) return undefined;
    const timer = window.setInterval(() => router.refresh(), 4500);
    return () => window.clearInterval(timer);
  }, [liveRun?.id, liveRun?.status, router]);

  const sourceTerms = query.trim().length >= 2
    ? searchedTerms
    : query.trim()
      ? terms.filter((term) => normalize([
          term.term,
          term.short_definition,
          term.category?.name,
          ...(term.synonyms || [])
        ].join(" ")).includes(normalize(query)))
      : terms;
  const visibleTerms = sourceTerms.filter((term) => filterMatches(term, filter));
  const counts = useMemo(() => ({
    all: terms.length,
    attention: terms.filter(needsAttention).length,
    draft: terms.filter((term) => ["draft", "withdrawn"].includes(term.status)).length,
    published: terms.filter((term) => term.status === "published").length
  }), [terms]);
  const scoredTerms = terms.filter((term) => Number.isFinite(Number(term.quality_score)));
  const averageScore = scoredTerms.length
    ? Math.round(scoredTerms.reduce((sum, term) => sum + Number(term.quality_score), 0) / scoredTerms.length)
    : 0;
  const persistedGenerationMessage = generationMessage || (
    latestRun && ["failed", "notification_failed"].includes(latestRun.status)
      ? {
          tone: latestRun.status === "failed" ? "error" : "warning",
          text: latestRun.error_message || latestRun.rejection_reason || "Ultima generare necesită verificare în istoric."
        }
      : null
  );

  async function generateTerm() {
    if (activeRun || busy) return;
    setBusy("generate");
    setGenerationMessage(null);
    const response = await fetch("/api/admin/dictionary/generate", { method: "POST" }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    if (!response) {
      setGenerationMessage({ tone: "error", text: "Nu am putut contacta serviciul. Încearcă din nou." });
      setBusy("");
      return;
    }
    if (response.ok && result?.term?.id) {
      router.push(`/admin/continut/dictionar/${result.term.id}`);
      return;
    }
    setGenerationMessage({
      tone: "error",
      text: "Generarea nu a produs un termen. Motivul este disponibil în istoric."
    });
    setBusy("");
    router.refresh();
  }

  return (
    <section className="admin-articles-index admin-dictionary-index">
      <div className="admin-articles-primary-row">
        <div>
          <span>Flux editorial</span>
          <strong>Gestionează termenii din Dicționar</strong>
          <p>Prioritizează termenii care cer corecturi și deschide editorul doar când ai nevoie.</p>
        </div>
        <button
          type="button"
          className="btn-link admin-articles-generate"
          onClick={generateTerm}
          disabled={Boolean(busy) || Boolean(activeRun)}
        >
          {liveRun ? <LoadingSpinner size={17} /> : <RefreshCw size={17} aria-hidden="true" />}
          {liveRun ? "Generare în curs" : "Generează un termen"}
        </button>
      </div>

      <section className="admin-articles-automation" aria-label="Generare automată">
        <div className="admin-articles-automation-summary">
          <span className="admin-articles-automation-icon" aria-hidden="true"><Clock3 size={20} /></span>
          <div>
            <strong>Generare automată</strong>
            <p>Programarea pregătește termeni noi, iar controlul editorial rămâne în această bibliotecă.</p>
            <div>
              <span className={automationSettings?.enabled ? "is-active" : ""}>{automationSettings?.enabled ? "Activă" : "Oprită"}</span>
              <span>{frequencyLabel(automationSettings)}</span>
              {automationSettings?.model ? <span>{automationSettings.model}</span> : null}
              {automationSettings?.notify_telegram ? <span>Telegram activ</span> : null}
            </div>
          </div>
        </div>
        <details className="admin-articles-automation-settings">
          <summary><Settings2 size={16} aria-hidden="true" />Configurează</summary>
          <AdminEditorialAutomationSettings workflow="dictionary" settings={automationSettings} generationPreview={generationPreview} />
        </details>
      </section>

      {liveRun ? (
        <section className="admin-editorial-live-run" aria-live="polite">
          <LoadingSpinner size={23} />
          <div><span>Generare în curs</span><strong>{runStatusLabel(liveRun.status)}</strong><p>Poți părăsi pagina. Starea se actualizează automat când revii.</p></div>
          <div className="admin-editorial-live-progress" aria-label={`Progres estimat ${RUN_PROGRESS[liveRun.status] || 12}%`}>
            <span>{RUN_PROGRESS[liveRun.status] || 12}%</span><i style={{ width: `${RUN_PROGRESS[liveRun.status] || 12}%` }} />
          </div>
        </section>
      ) : null}
      {persistedGenerationMessage ? <p className={`admin-editorial-action-message is-${persistedGenerationMessage.tone}`} role="status">{persistedGenerationMessage.text}</p> : null}
      {warning ? <p className="admin-dictionary-message is-error">{warning}</p> : null}

      <div className="admin-articles-stats" aria-label="Rezumat dicționar">
        <article><span>Publicate</span><strong>{counts.published}</strong><small>vizibile în Dicționar</small></article>
        <article className={counts.attention ? "is-attention" : ""}><span>Necesită atenție</span><strong>{counts.attention}</strong><small>{counts.attention ? "termeni care cer intervenție" : "nimic urgent acum"}</small></article>
        <article><span>Scor editorial mediu</span><strong>{averageScore || "—"}</strong><small>pragul de publicare este 82</small></article>
      </div>

      <section className="admin-articles-library" aria-labelledby="admin-dictionary-library-title">
        <div className="admin-articles-library-head">
          <div><span>Bibliotecă editorială</span><h2 id="admin-dictionary-library-title">Toți termenii</h2></div>
          <FilterSearch value={query} onChange={setQuery} placeholder="Caută după termen sau categorie" ariaLabel="Caută termeni" compact loading={searchBusy} clearable className="admin-articles-search" />
        </div>
        <div className="admin-articles-filter-tabs" role="group" aria-label="Filtrează termenii">
          {DICTIONARY_FILTERS.map((item) => <button key={item.id} type="button" aria-pressed={filter === item.id} className={filter === item.id ? "is-active" : ""} onClick={() => setFilter(item.id)}>{item.label}<span>{counts[item.id]}</span></button>)}
        </div>

        {visibleTerms.length ? (
          <div className="admin-articles-list admin-dictionary-term-list">
            {visibleTerms.map((term) => {
              const status = termStatus(term);
              const attention = needsAttention(term);
              return (
                <article className="admin-article-row" key={term.id}>
                  <span className="admin-article-row-icon" aria-hidden="true"><BookOpenCheck size={20} /></span>
                  <div className="admin-article-row-copy">
                    <div><span className={`admin-article-status is-${status.tone}`}>{status.label}</span>{attention ? <span className="admin-article-status is-review">Necesită atenție</span> : null}</div>
                    <h3>{term.term}</h3>
                    <p>{term.short_definition || "Termen fără definiție scurtă."}</p>
                    <small>{formatDate(term.updated_at || term.created_at)}<i aria-hidden="true">·</i>{term.category?.name || "Fără categorie"}{(term.synonyms || []).length ? <><i aria-hidden="true">·</i>{term.synonyms.length} sinonime</> : null}</small>
                    {attention ? <span className="admin-article-row-warning"><AlertTriangle size={14} aria-hidden="true" />Scorul trebuie să fie cel puțin 82 înainte de publicare.</span> : null}
                  </div>
                  <div className="admin-article-row-actions">
                    <span><strong>{term.quality_score ?? "—"}</strong><small>scor</small></span>
                    <Link href={`/admin/continut/dictionar/${term.id}`}><FilePenLine size={16} aria-hidden="true" />Deschide termenul</Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="admin-articles-empty">
            <ShieldCheck size={22} aria-hidden="true" />
            <strong>{searchError ? "Căutarea nu a răspuns" : "Nu am găsit termeni potriviți"}</strong>
            <p>{searchError ? "Încearcă din nou. Termenii recenți rămân disponibili." : "Schimbă filtrul sau șterge termenul de căutare."}</p>
            {!searchError ? <button type="button" onClick={() => { setFilter("all"); setQuery(""); }}>Resetează lista</button> : null}
          </div>
        )}
      </section>

      <details className="admin-run-history admin-articles-run-history" open={runs.some((run) => ["failed", "notification_failed"].includes(run.status))}>
        <summary>Istoric generări ({runs.length})</summary>
        {runs.length ? <div className="admin-editorial-runs">{runs.map((run) => <article key={run.id}><strong>{run.candidate_term || "Fără termen"}</strong><span>{run.trigger_source === "cron" ? "Programat" : "Manual"} · {runStatusLabel(run.status)} · {run.quality_score ?? "—"}/100</span><small>{run.model || "Model indisponibil"}</small>{run.rejection_reason || run.error_message ? <small>{run.rejection_reason || run.error_message}</small> : null}</article>)}</div> : <p>Nu există rulări încă.</p>}
      </details>
    </section>
  );
}
