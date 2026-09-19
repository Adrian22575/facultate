"use client";

import { moduleClassNames } from "@/lib/ui/module-class-names";
import centerStyles from "./admin-linkedin-distribution-center.module.css";
import distributionStyles from "./admin-linkedin-distribution.module.css";

import { ArrowRight, CircleAlert, Clock3, Search, Send } from "lucide-react";
import { PendingNavigationLink as Link } from "@/components/pending-navigation-link";
import { useEffect, useMemo, useState } from "react";

import { FilterSearch } from "@/components/ui/collection-controls";
import { LinkedInDistributionSettings } from "@/components/linkedin-distribution-settings";

const FILTERS = [
  { id: "attention", label: "Necesită atenție" },
  { id: "ready", label: "Pregătite" },
  { id: "published", label: "Publicate" },
  { id: "all", label: "Toate" }
];

const STATUS = {
  not_generated: { label: "În pregătire", tone: "attention" },
  draft: { label: "Ciornă", tone: "attention" },
  pending_approval: { label: "De verificat", tone: "attention" },
  approved: { label: "Aprobată", tone: "ready" },
  publishing: { label: "Se publică", tone: "attention" },
  published: { label: "Publicată", tone: "published" },
  failed: { label: "Eșuată", tone: "failed" },
  connection_expired: { label: "Conexiune expirată", tone: "failed" },
  rejected: { label: "Respinsă", tone: "failed" }
};

function formatDate(value) {
  if (!value) return "Dată indisponibilă";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Bucharest"
  }).format(new Date(value));
}

function normalize(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("ro-RO");
}

function postStatus(post) {
  return STATUS[post?.status] || { label: post?.status || "Necunoscut", tone: "attention" };
}

function matchesFilter(post, filter) {
  if (filter === "ready") return post.status === "approved";
  if (filter === "published") return post.status === "published";
  if (filter === "attention") return !["approved", "published"].includes(post.status);
  return true;
}

function articleHref(post) {
  const articleId = post.article_id || post.article?.id;
  if (!articleId) return "/admin/continut/articole";
  return `/admin/continut/articole/${articleId}?tab=linkedin&linkedin_post=${post.id}`;
}

export function AdminLinkedInDistributionCenter({ data, initialPostId = "" }) {
  const [filter, setFilter] = useState("attention");
  const [query, setQuery] = useState("");
  const posts = data?.posts || [];
  const connected = data?.connection?.status === "connected";

  useEffect(() => {
    if (initialPostId) setFilter("all");
  }, [initialPostId]);

  const counts = useMemo(() => ({
    attention: posts.filter((post) => matchesFilter(post, "attention")).length,
    ready: posts.filter((post) => matchesFilter(post, "ready")).length,
    published: posts.filter((post) => matchesFilter(post, "published")).length,
    all: posts.length
  }), [posts]);

  const visiblePosts = useMemo(() => {
    const normalizedQuery = normalize(query.trim());
    return posts.filter((post) => {
      if (!matchesFilter(post, filter)) return false;
      if (!normalizedQuery) return true;
      return normalize([
        post.article?.title,
        post.generated_payload?.final?.angle,
        post.edited_text,
        post.generated_text,
        post.status
      ].filter(Boolean).join(" ")).includes(normalizedQuery);
    });
  }, [filter, posts, query]);

  const hasActiveFilters = filter !== "attention" || Boolean(query.trim());

  return (
    <section className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-center")} aria-labelledby="linkedin-center-title">
      <header className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-center-head")}>
        <div className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-title-mark")} aria-hidden="true"><span className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-brand-glyph")}>in</span></div>
        <div>
          <span>Flux editorial</span>
          <h2 id="linkedin-center-title">Distribuire LinkedIn</h2>
          <p>Urmărește ce postări necesită atenție și deschide articolul când ai nevoie de context sau editare.</p>
        </div>
        <span className={moduleClassNames([centerStyles, distributionStyles], `admin-linkedin-connection-state is-${connected ? "connected" : "offline"}`)}>
          {connected ? "Conectat" : data?.connection?.status === "connection_expired" ? "Expirat" : "Neconectat"}
        </span>
      </header>

      <LinkedInDistributionSettings data={data} />

      {data?.warning ? <p className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-message is-error")} role="status">{data.warning}</p> : null}

      {!connected ? (
        <div className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-center-notice")}>
          <CircleAlert size={18} aria-hidden="true" />
          <div><strong>Conexiunea LinkedIn nu este disponibilă</strong><p>Poți consulta istoricul, însă pregătirea și publicarea rămân oprite până la conectare.</p></div>
        </div>
      ) : null}

      <div className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-queue-toolbar")} aria-label="Filtre pentru distribuirea LinkedIn">
        <div className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-queue-filters")} role="group" aria-label="Starea postărilor">
          {FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              className={moduleClassNames([centerStyles, distributionStyles], filter === item.id ? "is-active" : "")}
              aria-pressed={filter === item.id}
              onClick={() => setFilter(item.id)}
            >
              {item.label}<span>{counts[item.id]}</span>
            </button>
          ))}
        </div>
        <FilterSearch
          value={query}
          onChange={setQuery}
          placeholder="Caută articol sau postare"
          ariaLabel="Caută în distribuirea LinkedIn"
          clearable
          compact
          className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-queue-search")}
        />
      </div>

      {posts.length === 0 ? (
        <div className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-empty admin-linkedin-center-empty")}>
          <Send size={19} aria-hidden="true" />
          <div><strong>Nu există postări LinkedIn încă</strong><p>Postările apar după publicarea unui articol și pregătirea unei variante din pagina acelui articol.</p></div>
          <Link href="/admin/continut/articole" className={moduleClassNames([centerStyles, distributionStyles], "btn-back")}>Deschide articolele <ArrowRight size={16} /></Link>
        </div>
      ) : visiblePosts.length === 0 ? (
        <div className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-empty admin-linkedin-center-empty")}>
          <Search size={19} aria-hidden="true" />
          <div><strong>Nu există rezultate pentru filtrul ales</strong><p>Alege altă stare sau șterge căutarea pentru a vedea toate postările.</p></div>
          {hasActiveFilters ? <button type="button" className={moduleClassNames([centerStyles, distributionStyles], "btn-back")} onClick={() => { setFilter("attention"); setQuery(""); }}>Resetează</button> : null}
        </div>
      ) : (
        <div className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-queue-list")} aria-live="polite">
          {visiblePosts.map((post) => {
            const status = postStatus(post);
            const articleTitle = post.article?.title || "Articol indisponibil";
            const highlighted = post.id === initialPostId;
            return (
              <Link
                key={post.id}
                href={articleHref(post)}
                className={moduleClassNames([centerStyles, distributionStyles], `admin-linkedin-queue-item is-${status.tone}${highlighted ? " is-highlighted" : ""}`)}
                aria-label={`Deschide postarea LinkedIn pentru articolul ${articleTitle}`}
              >
                <span className={moduleClassNames([centerStyles, distributionStyles], `admin-linkedin-status is-${status.tone}`)}>{status.label}</span>
                <div className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-queue-copy")}>
                  <strong>{articleTitle}</strong>
                  <span>{post.generated_payload?.final?.angle || `Varianta ${post.edition_number || 1}`}</span>
                </div>
                <div className={moduleClassNames([centerStyles, distributionStyles], "admin-linkedin-queue-meta")}>
                  {post.quality_score == null ? null : <span>Scor {Number(post.quality_score).toFixed(1)}/10</span>}
                  <time dateTime={post.updated_at}><Clock3 size={14} aria-hidden="true" />{formatDate(post.updated_at)}</time>
                </div>
                <ArrowRight size={17} aria-hidden="true" />
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
