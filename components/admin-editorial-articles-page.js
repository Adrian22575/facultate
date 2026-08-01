"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  FilePenLine,
  FlaskConical,
  Newspaper,
  Settings2,
  ShieldCheck
} from "lucide-react";
import Link from "next/link";

import { LoadingSpinner } from "@/components/loading-spinner";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminEditorialAutomationSettings } from "@/components/admin-editorial-automation-settings";
import { FilterSearch } from "@/components/filter-controls";

const ACTIVE_RUN_STATUSES = new Set([
  "started",
  "researching",
  "validated_research",
  "drafted",
  "fact_checked"
]);
const RUN_PROGRESS = {
  started: 8,
  researching: 32,
  validated_research: 56,
  drafted: 78,
  fact_checked: 92
};
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

function frequencyLabel(settings) {
  const days = Number(settings?.frequency_days || 0);
  if (days === 1) return "Zilnic";
  if (days === 7) return "Săptămânal";
  if (days === 14) return "La 2 săptămâni";
  return days > 1 ? `La ${days} zile` : "Neprogramat";
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
      return undefined;
    }

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
  const scoredArticles = articles.filter((article) => Number.isFinite(Number(article.quality_score)));
  const averageScore = scoredArticles.length
    ? Math.round(
        scoredArticles.reduce((sum, article) => sum + Number(article.quality_score), 0) /
          scoredArticles.length
      )
    : 0;

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
    <section className="admin-articles-index">
      <div className="admin-articles-primary-row">
        <div>
          <span>Flux editorial</span>
          <strong>Gestionează articolele de la ciornă la publicare</strong>
          <p>Prioritizează articolele care necesită verificare și deschide editorul doar când ai nevoie.</p>
        </div>
        <button
          type="button"
          className="btn-link admin-articles-generate"
          onClick={generateDraft}
          disabled={Boolean(busy) || Boolean(activeRun)}
        >
          {liveRun ? (
            <LoadingSpinner size={17} />
          ) : (
            <FlaskConical size={17} aria-hidden="true" />
          )}
          {liveRun ? "Generare în curs" : "Generează un articol"}
        </button>
      </div>

      <section className="admin-articles-automation" aria-label="Generare automată">
        <div className="admin-articles-automation-summary">
          <span className="admin-articles-automation-icon" aria-hidden="true">
            <Clock3 size={20} />
          </span>
          <div>
            <strong>Generare automată</strong>
            <p>Programarea pregătește articole noi și păstrează controlul editorial în această listă.</p>
            <div>
              <span className={automationSettings?.enabled ? "is-active" : ""}>
                {automationSettings?.enabled ? "Activă" : "Oprită"}
              </span>
              <span>{frequencyLabel(automationSettings)}</span>
              {automationSettings?.model ? <span>{automationSettings.model}</span> : null}
              {automationSettings?.notify_telegram ? <span>Telegram activ</span> : null}
            </div>
          </div>
        </div>
        <details className="admin-articles-automation-settings">
          <summary>
            <Settings2 size={16} aria-hidden="true" />
            Configurează
          </summary>
          <AdminEditorialAutomationSettings
            workflow="editorial"
            settings={automationSettings}
            generationPreview={generationPreview}
          />
        </details>
      </section>

      {liveRun ? (
        <section className="admin-editorial-live-run" aria-live="polite">
          <LoadingSpinner size={23} />
          <div>
            <span>Generare în curs</span>
            <strong>{runStatusLabel(liveRun.status)}</strong>
            <p>Poți părăsi pagina. Starea se actualizează automat când revii.</p>
          </div>
          <div
            className="admin-editorial-live-progress"
            aria-label={`Progres estimat ${RUN_PROGRESS[liveRun.status] || 8}%`}
          >
            <span>{RUN_PROGRESS[liveRun.status] || 8}%</span>
            <i style={{ width: `${RUN_PROGRESS[liveRun.status] || 8}%` }} />
          </div>
        </section>
      ) : null}

      {persistedGenerationMessage ? (
        <p
          className={`admin-editorial-action-message is-${persistedGenerationMessage.tone}`}
          role="status"
        >
          {persistedGenerationMessage.text}
        </p>
      ) : null}
      {warning ? <p className="admin-dictionary-message is-error">{warning}</p> : null}

      <div className="admin-articles-stats" aria-label="Rezumat articole">
        <article>
          <span>Publicate</span>
          <strong>{counts.published}</strong>
          <small>vizibile în secțiunea publică</small>
        </article>
        <article className={counts.review ? "is-attention" : ""}>
          <span>Necesită revizuire</span>
          <strong>{counts.review}</strong>
          <small>{counts.review ? "articole care cer intervenție" : "nimic urgent acum"}</small>
        </article>
        <article>
          <span>Scor editorial mediu</span>
          <strong>{averageScore || "—"}</strong>
          <small>pragul de publicare este 85</small>
        </article>
      </div>

      <section className="admin-articles-library" aria-labelledby="admin-articles-library-title">
        <div className="admin-articles-library-head">
          <div>
            <span>Bibliotecă editorială</span>
            <h2 id="admin-articles-library-title">Toate articolele</h2>
          </div>
          <FilterSearch
            value={query}
            onChange={setQuery}
            placeholder="Caută după titlu sau subiect"
            ariaLabel="Caută articole"
            compact
            loading={searchBusy}
            clearable
            className="admin-articles-search"
          />
        </div>

        <div className="admin-articles-filter-tabs" role="group" aria-label="Filtrează articolele">
          {ARTICLE_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={filter === item.id}
              className={filter === item.id ? "is-active" : ""}
              onClick={() => setFilter(item.id)}
            >
              {item.label}
              <span>{counts[item.id]}</span>
            </button>
          ))}
        </div>

        {visibleArticles.length ? (
          <div className="admin-articles-list">
            {visibleArticles.map((article) => {
              const status = articleStatus(article);
              const reviewRequired = needsReview(article);
              return (
                <article className="admin-article-row" key={article.id}>
                  <span className="admin-article-row-icon" aria-hidden="true">
                    <Newspaper size={20} />
                  </span>
                  <div className="admin-article-row-copy">
                    <div>
                      <span className={`admin-article-status is-${status.tone}`}>{status.label}</span>
                      {reviewRequired ? (
                        <span className="admin-article-status is-review">Necesită revizuire</span>
                      ) : null}
                    </div>
                    <h3>{article.title}</h3>
                    <p>{article.summary || article.subtitle || "Articol fără rezumat."}</p>
                    <small>
                      {formatDate(article.updated_at)}
                      <i aria-hidden="true">·</i>
                      {(article.sources || []).length} surse
                      <i aria-hidden="true">·</i>
                      {article.primary_topic || "Fără subiect principal"}
                    </small>
                    {reviewRequired ? (
                      <span className="admin-article-row-warning">
                        <AlertTriangle size={14} aria-hidden="true" />
                        Verificarea factuală trebuie revizuită înainte de publicare.
                      </span>
                    ) : null}
                  </div>
                  <div className="admin-article-row-actions">
                    <span>
                      <strong>{article.quality_score ?? "—"}</strong>
                      <small>scor</small>
                    </span>
                    <Link href={`/admin/continut/articole/${article.id}`}>
                      <FilePenLine size={16} aria-hidden="true" />
                      Deschide articolul
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="admin-articles-empty">
            <ShieldCheck size={22} aria-hidden="true" />
            <strong>Nu am găsit articole potrivite</strong>
            <p>Schimbă filtrul sau șterge termenul de căutare.</p>
            <button
              type="button"
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
            >
              Resetează lista
            </button>
          </div>
        )}
      </section>

      <details
        className="admin-run-history admin-articles-run-history"
        open={runs.some((run) => ["rejected", "failed"].includes(run.status))}
      >
        <summary>Istoric generări ({runs.length})</summary>
        {runs.length ? (
          <div className="admin-editorial-runs">
            {runs.map((run) => (
              <article key={run.id}>
                <strong>{run.run_date || `${run.week_start} – ${run.week_end}`}</strong>
                <span>
                  {run.trigger_source === "cron" ? "Programat" : "Manual"} ·{" "}
                  {runStatusLabel(run.status)} · {run.quality_score ?? "—"}/100
                </span>
                <small>
                  {run.source_count ?? 0} surse verificate · {run.topic_count ?? 0} subiecte
                </small>
              </article>
            ))}
          </div>
        ) : (
          <p>Nu există rulări încă.</p>
        )}
      </details>
    </section>
  );
}
