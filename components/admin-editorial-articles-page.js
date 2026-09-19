"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { moduleClassNames } from "@/lib/ui/module-class-names";
import { InlineFeedback } from "@/components/ui/status";
import { AdminContentTools, AdminContentProgress, AdminContentList } from "@/components/admin-content-workspace";
import libraryStyles from "./admin-content-library.module.css";
import pageStyles from "./admin-editorial-articles-page.module.css";

const ACTIVE_RUN_STATUSES = new Set([
  "started",
  "researching",
  "validated_research",
  "drafted",
  "fact_checked"
]);
const ARTICLE_FILTERS = [
  { id: "all", label: "Toate" },
  { id: "review", label: "Necesită revizuire" },
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

function runStatusLabel(status) {
  return {
    started: "Pregătim generarea",
    researching: "Căutăm și verificăm sursele",
    validated_research: "Construim structura articolului",
    drafted: "Redactăm și verificăm ciorna",
    fact_checked: "Finalizăm verificarea",
    draft: "Ciornă pregătită",
    published: "Publicat",
    rejected: "Necesită revizuire",
    failed: "Generarea s-a oprit"
  }[status] || status;
}

function articleStatus(article) {
  if (article.status === "published") return { label: "Publicat", tone: "published" };
  if (article.status === "withdrawn") return { label: "Retras", tone: "withdrawn" };
  if (article.status === "rejected") return { label: "Respins", tone: "review" };
  return { label: "Ciornă", tone: "draft" };
}

function needsReview(article) {
  return (
    article.status === "rejected" ||
    ["failed", "needs_review", "pending"].includes(article.fact_check_status)
  );
}

function filterMatches(article, filter) {
  if (filter === "review") return needsReview(article);
  if (filter === "draft") return ["draft", "withdrawn"].includes(article.status);
  if (filter === "published") return article.status === "published";
  return true;
}

function generationStatusMessage(latestRun) {
  if (!latestRun || !["failed", "rejected"].includes(latestRun.status)) return null;
  return {
    tone: "error",
    text:
      latestRun.rejection_reason ||
      latestRun.error_message ||
      "Ultima generare nu a produs o ciornă. Detaliile sunt disponibile în istoric."
  };
}

export function AdminEditorialArticlesPage({
  articles = [],
  runs = [],
  automationSettings,
  generationPreview,
  warning
}) {
  const router = useRouter();
  const [filter, setFilter] = useState("all");
  const [query, setQuery] = useState("");
  const [searchedArticles, setSearchedArticles] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [busy, setBusy] = useState("");
  const [generationMessage, setGenerationMessage] = useState(null);
  const activeRun = useMemo(
    () => runs.find((run) => ACTIVE_RUN_STATUSES.has(run.status)) || null,
    [runs]
  );
  const liveRun =
    activeRun || (busy === "generate" ? { status: "started", started_at: new Date().toISOString() } : null);
  const latestRun = runs[0] || null;
  const persistedGenerationMessage = generationMessage || generationStatusMessage(latestRun);

  useEffect(() => {
    const value = query.trim();
    if (value.length < 2) {
      setSearchedArticles([]);
      setSearchBusy(false);
      setSearchError(false);
      return undefined;
    }

    setSearchBusy(true);
    setSearchError(false);
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      const response = await fetch(
        `/api/admin/editorial/articles/search?q=${encodeURIComponent(value)}`,
        { signal: controller.signal }
      ).catch(() => null);
      const result = await response?.json().catch(() => ({}));
      if (!controller.signal.aborted && response?.ok) {
        setSearchedArticles(result.articles || []);
      } else if (!controller.signal.aborted) {
        setSearchedArticles([]);
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

  const sourceArticles =
    query.trim().length >= 2
      ? searchedArticles
      : query.trim()
        ? articles.filter((article) =>
            normalize(
              [
                article.title,
                article.primary_topic,
                article.summary,
                ...(article.categories || [])
              ].join(" ")
            ).includes(normalize(query))
          )
        : articles;
  const visibleArticles = sourceArticles.filter((article) => filterMatches(article, filter));

  const counts = useMemo(
    () => ({
      all: articles.length,
      review: articles.filter(needsReview).length,
      draft: articles.filter((article) => ["draft", "withdrawn"].includes(article.status)).length,
      published: articles.filter((article) => article.status === "published").length
    }),
    [articles]
  );

  async function generateDraft() {
    if (activeRun || busy) return;
    setBusy("generate");
    setGenerationMessage(null);
    const response = await fetch("/api/admin/editorial/generate", { method: "POST" }).catch(
      () => null
    );
    const result = await response?.json().catch(() => ({}));

    if (!response) {
      setGenerationMessage({
        tone: "error",
        text: "Nu am putut contacta serviciul de generare. Încearcă din nou."
      });
      setBusy("");
      return;
    }

    if (response.ok && result?.article?.id) {
      router.push(`/admin/continut/articole/${result.article.id}`);
      return;
    }

    setGenerationMessage({
      tone: "error",
      text:
        result?.reason === "research_validation_failed"
          ? "Cercetarea s-a încheiat fără suficiente surse verificabile."
          : "Generarea s-a încheiat fără o ciornă. Detaliile sunt în istoric."
    });
    setBusy("");
    router.refresh();
  }

  return (
    <div className={moduleClassNames(pageStyles, "admin-articles-index")}>
      <AdminContentTools label="Generează un articol" onGenerate={generateDraft} generating={Boolean(liveRun)} workflow="editorial" settings={automationSettings} generationPreview={generationPreview} />
      {liveRun ? <AdminContentProgress label={runStatusLabel(liveRun.status)} /> : null}
      {persistedGenerationMessage ? <InlineFeedback tone={persistedGenerationMessage.tone}>{persistedGenerationMessage.text}</InlineFeedback> : null}
      {warning ? <InlineFeedback tone="error">{warning}</InlineFeedback> : null}
      <AdminContentList
        id="admin-articles-library-title" title="Toate articolele"
        query={query} onQuery={setQuery} filter={filter} onFilter={setFilter}
        filters={ARTICLE_FILTERS} counts={counts}
        searching={searchBusy} searchError={searchError}
        searchLabel="Caută articole" placeholder="Caută după titlu sau subiect"
        items={visibleArticles.map((article) => ({
          id: article.id, title: article.title, href: `/admin/continut/articole/${article.id}`,
          description: article.summary || article.subtitle || "Articol fără rezumat.",
          date: formatDate(article.updated_at), meta: article.primary_topic || "Fără subiect principal",
          status: articleStatus(article).label,
          warning: needsReview(article) ? "Verificarea factuală trebuie revizuită înainte de publicare." : ""
        }))}
      />
      <details className={moduleClassNames(libraryStyles, "admin-run-history")}>
        <summary>Istoric generări ({runs.length})</summary>
        {runs.length ? <div className={moduleClassNames(libraryStyles, "admin-editorial-runs")}>
          {runs.map((run) => <article key={run.id}>
            <span>{run.run_date || `${run.week_start} – ${run.week_end}`}</span>
            <span>{run.trigger_source === "cron" ? "Programat" : "Manual"} · {runStatusLabel(run.status)} · {run.quality_score ?? "—"}/100</span>
            <span>{run.source_count ?? 0} surse verificate · {run.topic_count ?? 0} subiecte</span>
            {run.rejection_reason || run.error_message ? <span>{run.rejection_reason || run.error_message}</span> : null}
          </article>)}
        </div> : <p>Nu există rulări încă.</p>}
      </details>
    </div>
  );
}
