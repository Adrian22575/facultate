"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { moduleClassNames } from "@/lib/ui/module-class-names";
import { InlineFeedback } from "@/components/ui/status";
import { AdminContentTools, AdminContentProgress, AdminContentList } from "@/components/admin-content-workspace";
import libraryStyles from "./admin-content-library.module.css";
import pageStyles from "./admin-editorial-articles-page.module.css";

const ACTIVE_RUN_STATUSES = new Set(["started", "generated", "validated"]);
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

    setSearchBusy(true);
    setSearchError(false);
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
    <div className={moduleClassNames(pageStyles, "admin-articles-index")}>
      <AdminContentTools label="Generează un termen" onGenerate={generateTerm} generating={Boolean(liveRun)} workflow="dictionary" settings={automationSettings} generationPreview={generationPreview} />
      {liveRun ? <AdminContentProgress label={runStatusLabel(liveRun.status)} /> : null}
      {persistedGenerationMessage ? <InlineFeedback tone={persistedGenerationMessage.tone}>{persistedGenerationMessage.text}</InlineFeedback> : null}
      {warning ? <InlineFeedback tone="error">{warning}</InlineFeedback> : null}
      <AdminContentList
        id="admin-dictionary-library-title" title="Toți termenii"
        query={query} onQuery={setQuery} filter={filter} onFilter={setFilter}
        filters={DICTIONARY_FILTERS} counts={counts}
        searching={searchBusy} searchError={searchError}
        searchLabel="Caută termeni" placeholder="Caută după termen sau categorie"
        items={visibleTerms.map((term) => ({
          id: term.id, title: term.term, href: `/admin/continut/dictionar/${term.id}`,
          description: term.short_definition || "Termen fără definiție scurtă.",
          date: formatDate(term.updated_at || term.created_at), meta: term.category?.name || "Fără categorie",
          status: termStatus(term).label,
          warning: needsAttention(term) ? "Scorul trebuie să fie cel puțin 82 înainte de publicare." : ""
        }))}
      />
      <details className={moduleClassNames(libraryStyles, "admin-run-history")}>
        <summary>Istoric generări ({runs.length})</summary>
        {runs.length ? <div className={moduleClassNames(libraryStyles, "admin-editorial-runs")}>
          {runs.map((run) => <article key={run.id}>
            <span>{run.candidate_term || "Fără termen"}</span>
            <span>{run.trigger_source === "cron" ? "Programat" : "Manual"} · {runStatusLabel(run.status)} · {run.quality_score ?? "—"}/100</span>
            <span>{run.model || "Model indisponibil"}</span>
            {run.rejection_reason || run.error_message ? <span>{run.rejection_reason || run.error_message}</span> : null}
          </article>)}
        </div> : <p>Nu există rulări încă.</p>}
      </details>
    </div>
  );
}
