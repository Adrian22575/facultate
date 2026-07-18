"use client";

import {
  AlertTriangle,
  CheckCircle2,
  Eye,
  FilePenLine,
  FlaskConical,
  LoaderCircle,
  Save,
  Search,
  Send,
  ShieldCheck,
  Undo2
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminEditorialAutomationSettings } from "@/components/admin-editorial-automation-settings";
import { AdminLinkedInDistribution } from "@/components/admin-linkedin-distribution";

const ACTIVE_RUN_STATUSES = new Set(["started", "researching", "validated_research", "drafted", "fact_checked"]);
const RUN_PROGRESS = { started: 8, researching: 32, validated_research: 56, drafted: 78, fact_checked: 92 };

function formFrom(article) {
  return {
    title: article.title,
    subtitle: article.subtitle || "",
    summary: article.summary,
    primaryTopic: article.primary_topic,
    categories: (article.categories || []).join(", "),
    keyTakeaways: JSON.stringify(article.key_takeaways || [], null, 2),
    sections: JSON.stringify(article.sections || [], null, 2),
    studentImplications: JSON.stringify(article.student_implications || [], null, 2),
    weeklyTerm: JSON.stringify(article.weekly_term || {}, null, 2),
    conclusion: article.conclusion,
    sources: JSON.stringify(article.sources || [], null, 2),
    internalLinks: JSON.stringify(article.internal_links || [], null, 2),
    seoTitle: article.seo_title,
    metaDescription: article.meta_description,
    socialDescription: article.social_description,
    correctionNote: article.correction_note || ""
  };
}

function parseJson(value, label) {
  try {
    return JSON.parse(value);
  } catch {
    throw new Error(`${label} trebuie să fie JSON valid.`);
  }
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

function articleStatus(status) {
  return {
    draft: { label: "Ciornă", help: "Vizibilă numai în Admin.", tone: "draft" },
    published: { label: "Publicat", help: "Vizibil pe site.", tone: "published" },
    withdrawn: { label: "Retras", help: "Ascuns de pe site, păstrat în Admin.", tone: "withdrawn" },
    rejected: { label: "Respins", help: "Necesită corecturi înainte de publicare.", tone: "rejected" }
  }[status] || { label: status || "Necunoscut", help: "", tone: "draft" };
}

function factCheckStatus(status) {
  return {
    passed: { label: "Verificare trecută", help: "Afirmațiile sunt susținute de sursele salvate.", tone: "passed" },
    failed: { label: "Necesită corecturi", help: "Au fost găsite afirmații care trebuie revizuite.", tone: "failed" },
    needs_review: { label: "Verificare necesară", help: "Conținutul s-a modificat după ultima verificare.", tone: "pending" },
    pending: { label: "Neverificat", help: "Rulează verificarea înainte de publicare.", tone: "pending" }
  }[status] || { label: "Neverificat", help: "Rulează verificarea înainte de publicare.", tone: "pending" };
}

function researchAttemptLabel(attempt, index) {
  const label = attempt?.strategy === "recent_fallback" ? "Cercetare alternativă" : "Cercetare săptămânală";
  const returnedSourceCount = attempt?.returnedSourceCount ?? attempt?.validatedSourceCount ?? 0;
  const eligibleSourceCount = attempt?.eligibleSourceCount ?? attempt?.validatedSourceCount ?? 0;
  const verifiedUrlCount = attempt?.verifiedUrlCount ?? attempt?.validatedSourceCount ?? 0;
  const topicCount = attempt?.topicCount ?? 0;
  return `${index + 1}. ${label}: ${returnedSourceCount} surse găsite → ${eligibleSourceCount} eligibile → ${verifiedUrlCount} linkuri confirmate; ${topicCount} subiecte.`;
}

function ActionMessage({ message }) {
  if (!message) return null;
  return <p className={`admin-editorial-action-message is-${message.tone || "info"}`} role="status" aria-live="polite" aria-atomic="true">{message.text}</p>;
}

export function AdminEditorialPanel({ articles = [], runs = [], automationSettings, generationPreview, warning, linkedIn, initialLinkedInPostId = "" }) {
  const router = useRouter();
  const initialLinkedInPost = linkedIn?.posts?.find((post) => post.id === initialLinkedInPostId) || null;
  const [selectedId, setSelectedId] = useState(initialLinkedInPost?.article_id || initialLinkedInPost?.article?.id || articles[0]?.id || "");
  const [activePane, setActivePane] = useState(initialLinkedInPost ? "linkedin" : "article");
  const [articleQuery, setArticleQuery] = useState("");
  const [searchedArticles, setSearchedArticles] = useState([]);
  const [loadedArticles, setLoadedArticles] = useState([]);
  const [searchBusy, setSearchBusy] = useState(false);
  const allArticles = useMemo(() => {
    const known = new Set(articles.map((article) => article.id));
    return [...articles, ...loadedArticles.filter((article) => !known.has(article.id))];
  }, [articles, loadedArticles]);
  const selected = useMemo(() => allArticles.find((article) => article.id === selectedId) || null, [allArticles, selectedId]);
  const [articlePatches, setArticlePatches] = useState({});
  const effectiveSelected = selected ? { ...selected, ...(articlePatches[selected.id] || {}) } : null;
  const [form, setForm] = useState(() => selected ? formFrom(selected) : null);
  const [formArticleId, setFormArticleId] = useState(selected?.id || "");
  const [dirty, setDirty] = useState(false);
  const [articleMessage, setArticleMessage] = useState(null);
  const [generationMessage, setGenerationMessage] = useState(null);
  const [busy, setBusy] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const activeRun = useMemo(() => runs.find((run) => ACTIVE_RUN_STATUSES.has(run.status)) || null, [runs]);
  const liveRun = activeRun || (busy === "generate" ? { status: "started", started_at: new Date().toISOString() } : null);
  const latestRun = runs[0] || null;
  const persistedGenerationMessage = generationMessage || (!liveRun && ["failed", "rejected"].includes(latestRun?.status)
    ? { tone: "error", text: latestRun.rejection_reason || latestRun.error_message || "Ultima generare nu a produs o ciornă. Vezi detaliile în istoric." }
    : null);
  const filteredArticles = useMemo(() => {
    const query = articleQuery.trim().toLocaleLowerCase("ro-RO");
    if (!query) return articles;
    if (query.length >= 2) return searchedArticles;
    return articles.filter((article) => [article.title, article.primary_topic, article.summary, ...(article.categories || [])]
      .filter(Boolean)
      .join(" ")
      .toLocaleLowerCase("ro-RO")
      .includes(query));
  }, [articleQuery, articles, searchedArticles]);

  useEffect(() => {
    const query = articleQuery.trim();
    if (query.length < 2) {
      setSearchedArticles([]);
      setSearchBusy(false);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setSearchBusy(true);
      const response = await fetch(`/api/admin/editorial/articles/search?q=${encodeURIComponent(query)}`, { signal: controller.signal }).catch(() => null);
      const result = await response?.json().catch(() => ({}));
      if (!controller.signal.aborted && response?.ok) {
        const next = result.articles || [];
        setSearchedArticles(next);
        setLoadedArticles((current) => {
          const known = new Set(current.map((article) => article.id));
          return [...current, ...next.filter((article) => !known.has(article.id))];
        });
      }
      if (!controller.signal.aborted) setSearchBusy(false);
    }, 250);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [articleQuery]);

  useEffect(() => {
    if (!selected) return;
    if (formArticleId !== selected.id) {
      setForm(formFrom(selected));
      setFormArticleId(selected.id);
      setDirty(false);
    }
  }, [formArticleId, selected]);

  useEffect(() => {
    if (!liveRun) return undefined;
    const timer = window.setInterval(() => router.refresh(), 4500);
    return () => window.clearInterval(timer);
  }, [liveRun?.status, liveRun?.id, router]);

  function patchArticle(articleId, patch) {
    setArticlePatches((current) => ({ ...current, [articleId]: { ...(current[articleId] || {}), ...patch } }));
  }

  function select(article) {
    if (dirty && !window.confirm("Ai modificări nesalvate. Vrei să alegi alt articol și să renunți la ele?")) return;
    setSelectedId(article.id);
    setForm(formFrom(article));
    setFormArticleId(article.id);
    setDirty(false);
    setActivePane("article");
    setArticleMessage(null);
    setConfirmation("");
  }

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setArticleMessage(null);
    setConfirmation("");
  }

  async function generateDraft() {
    if (activeRun || busy) return;
    setBusy("generate");
    setGenerationMessage(null);
    const response = await fetch("/api/admin/editorial/generate", { method: "POST" }).catch(() => null);
    const result = await response?.json().catch(() => ({}));

    if (!response) {
      setGenerationMessage({ tone: "error", text: "Nu am putut contacta serviciul de generare. Încearcă din nou." });
      setBusy("");
      return;
    }

    if (response.ok && result?.article?.id) {
      setSelectedId(result.article.id);
      setFormArticleId("");
      setForm(null);
      setGenerationMessage({ tone: "success", text: "Ciorna este pregătită. Am deschis-o pentru revizuire." });
    } else if (result?.reason === "research_validation_failed") {
      setGenerationMessage({ tone: "error", text: "Cercetarea s-a încheiat fără suficiente surse verificabile. Detaliile sunt în istoric." });
    } else {
      setGenerationMessage({ tone: "error", text: "Generarea s-a încheiat fără o ciornă. Detaliile sunt în istoric." });
    }

    setBusy("");
    router.refresh();
  }

  async function runAction(action) {
    if (!effectiveSelected || dirty || busy) return;
    setBusy(action);
    setArticleMessage(null);
    const response = await fetch(`/api/admin/editorial/articles/${effectiveSelected.id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    setConfirmation("");

    if (!response) {
      setArticleMessage({ tone: "error", text: "Nu am putut contacta serviciul. Încearcă din nou." });
      return;
    }

    if (!response.ok) {
      const text = result?.error === "publication_quality_not_met"
        ? "Publicarea este blocată până când verificarea trece și scorul articolului este cel puțin 85."
        : result?.error === "fact_check_failed"
          ? "Verificarea nu a putut fi terminată. Conținutul nu a fost modificat."
          : "Acțiunea nu a fost salvată. Încearcă din nou.";
      setArticleMessage({ tone: "error", text });
      return;
    }

    if (action === "fact_check") {
      patchArticle(effectiveSelected.id, { fact_check_status: result.factCheckStatus, fact_check_report: result.report });
      const verified = Number(result.report?.verifiedClaimCount || 0);
      const unsupported = Number(result.report?.unsupportedClaimCount || 0);
      setArticleMessage({
        tone: result.factCheckStatus === "passed" ? "success" : "warning",
        text: result.factCheckStatus === "passed"
          ? `Verificarea a trecut. ${verified} afirmații au fost confirmate din sursele articolului.`
          : `Verificarea cere corecturi: ${unsupported} afirmații nu au suficient suport. Vezi rezumatul verificării de mai jos.`
      });
    } else if (action === "publish") {
      patchArticle(effectiveSelected.id, { status: "published" });
      setArticleMessage({ tone: "success", text: "Articolul este publicat și poate fi deschis pe site." });
    } else {
      patchArticle(effectiveSelected.id, { status: "withdrawn" });
      setArticleMessage({ tone: "success", text: "Articolul a fost retras de pe site. Ciorna rămâne disponibilă în Admin." });
    }

    router.refresh();
  }

  async function save() {
    if (!effectiveSelected || !form || busy) return;
    setBusy("save");
    setArticleMessage(null);
    try {
      const body = {
        ...form,
        categories: form.categories.split(",").map((item) => item.trim()).filter(Boolean),
        keyTakeaways: parseJson(form.keyTakeaways, "Ideile principale"),
        sections: parseJson(form.sections, "Secțiunile"),
        studentImplications: parseJson(form.studentImplications, "Implicațiile"),
        weeklyTerm: parseJson(form.weeklyTerm, "Termenul săptămânii"),
        sources: parseJson(form.sources, "Sursele"),
        internalLinks: parseJson(form.internalLinks, "Linkurile interne"),
        correctionNote: form.correctionNote || null
      };
      const response = await fetch(`/api/admin/editorial/articles/${effectiveSelected.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));

      if (response.ok) {
        patchArticle(effectiveSelected.id, { status: result.article.status, fact_check_status: result.article.fact_check_status });
        setDirty(false);
        setArticleMessage({
          tone: "success",
          text: effectiveSelected.status === "published"
            ? "Modificările au fost salvate. Articolul a fost retras temporar și trebuie verificat din nou înainte de republicare."
            : "Modificările au fost salvate. Rulează verificarea înainte de publicare."
        });
        router.refresh();
      } else {
        setArticleMessage({
          tone: "error",
          text: result?.error === "unknown_source_reference"
            ? "O secțiune folosește un ID care nu există în lista de surse."
            : "Nu am putut salva. Verifică toate câmpurile și structura JSON."
        });
      }
    } catch (error) {
      setArticleMessage({ tone: "error", text: error instanceof Error ? error.message : "Date invalide." });
    } finally {
      setBusy("");
    }
  }

  const statusInfo = articleStatus(effectiveSelected?.status);
  const factInfo = factCheckStatus(effectiveSelected?.fact_check_status);
  const score = Number(effectiveSelected?.quality_score || 0);
  const isPublished = effectiveSelected?.status === "published";
  const canPublish = !dirty && effectiveSelected?.fact_check_status === "passed" && score >= 85 && !isPublished;
  const factReport = effectiveSelected?.fact_check_report || {};

  return (
    <section className="surface admin-editorial-panel">
      <div className="admin-content-toolbar">
        <AdminEditorialAutomationSettings workflow="editorial" settings={automationSettings} generationPreview={generationPreview} />
        <button type="button" className="btn-link" onClick={generateDraft} disabled={Boolean(busy) || Boolean(activeRun)}>
          {liveRun ? <LoaderCircle className="is-spinning" size={16} /> : <FlaskConical size={16} />}
          {liveRun ? "Generare în curs" : "Generează un articol"}
        </button>
      </div>

      {liveRun ? (
        <section className="admin-editorial-live-run" aria-live="polite">
          <LoaderCircle className="is-spinning" aria-hidden="true" size={23} />
          <div>
            <span>Generare în curs</span>
            <strong>{runStatusLabel(liveRun.status)}</strong>
            <p>Poți părăsi pagina. Starea rămâne salvată și se actualizează automat când revii.</p>
          </div>
          <div className="admin-editorial-live-progress" aria-label={`Progres estimat ${RUN_PROGRESS[liveRun.status] || 8}%`}>
            <span>{RUN_PROGRESS[liveRun.status] || 8}%</span>
            <i style={{ width: `${RUN_PROGRESS[liveRun.status] || 8}%` }} />
          </div>
        </section>
      ) : null}
      {persistedGenerationMessage ? <ActionMessage message={persistedGenerationMessage} /> : null}
      {warning ? <p className="admin-dictionary-message is-error">{warning}</p> : null}

      <div id="editorial-workspace" className="admin-editorial-layout">
        <div className="admin-editorial-list">
          <label className="admin-editorial-search" aria-label="Caută articole">
            {searchBusy ? <LoaderCircle className="is-spinning" size={16} aria-hidden="true" /> : <Search size={16} aria-hidden="true" />}
            <input value={articleQuery} onChange={(event) => setArticleQuery(event.target.value)} placeholder="Caută după titlu" />
          </label>
          <p className="admin-editorial-list-count">{articleQuery.trim().length >= 2 ? searchBusy ? "Căutăm articole…" : `${filteredArticles.length} rezultate` : `${articles.length} articole recente`}</p>
          {filteredArticles.map((article) => {
            const displayed = { ...article, ...(articlePatches[article.id] || {}) };
            const displayedStatus = articleStatus(displayed.status);
            return (
              <button type="button" key={article.id} className={article.id === selectedId ? "is-selected" : ""} onClick={() => select(displayed)} disabled={Boolean(busy)}>
                <FilePenLine size={16} />
                <span>
                  <strong>{displayed.title}</strong>
                  <small>{displayedStatus.label} · {displayed.quality_score ?? "—"}/100</small>
                </span>
              </button>
            );
          })}
          {filteredArticles.length === 0 ? <div className="admin-editorial-list-empty">Nu am găsit niciun articol pentru această căutare.</div> : null}
        </div>

        {effectiveSelected && form ? (
          <div className="admin-editorial-editor" aria-busy={Boolean(busy)} inert={busy ? true : undefined}>
            <nav className="admin-editorial-tabs" aria-label="Spațiul articolului">
              <button type="button" className={activePane === "article" ? "is-active" : ""} onClick={() => setActivePane("article")} disabled={Boolean(busy)}><FilePenLine size={16} />Articol</button>
              <button type="button" className={activePane === "linkedin" ? "is-active" : ""} onClick={() => setActivePane("linkedin")} disabled={Boolean(busy)}><Send size={16} />LinkedIn</button>
            </nav>
            {activePane === "article" ? <>
            <div className="admin-editorial-statebar">
              <div className={`is-${statusInfo.tone}`}><span>Stare</span><strong>{statusInfo.label}</strong><small>{statusInfo.help}</small></div>
              <div className={`is-${factInfo.tone}`}><span>Verificare</span><strong>{dirty ? "Modificări nesalvate" : factInfo.label}</strong><small>{dirty ? "Salvează înainte de verificare sau previzualizare." : factInfo.help}</small></div>
              <div><span>Scor editorial</span><strong>{score}/100</strong><small>Pragul de publicare este 85.</small></div>
            </div>

            <div className="admin-editorial-row"><label>Titlu<input value={form.title} onChange={(event) => setField("title", event.target.value)} /></label><label>Subiect<input value={form.primaryTopic} onChange={(event) => setField("primaryTopic", event.target.value)} /></label></div>
            <label>Subtitlu<textarea value={form.subtitle} onChange={(event) => setField("subtitle", event.target.value)} /></label>
            <label>Rezumat<textarea value={form.summary} onChange={(event) => setField("summary", event.target.value)} /></label>
            <div className="admin-editorial-row"><label>Categorii <small>separate prin virgulă</small><input value={form.categories} onChange={(event) => setField("categories", event.target.value)} /></label><label>Notă de corecție <small>opțional</small><input value={form.correctionNote} onChange={(event) => setField("correctionNote", event.target.value)} /></label></div>
            <details><summary>Conținut editorial, surse și SEO</summary><div><label>Idei principale <textarea value={form.keyTakeaways} onChange={(event) => setField("keyTakeaways", event.target.value)} /></label><label>Secțiuni <textarea value={form.sections} onChange={(event) => setField("sections", event.target.value)} /></label><label>Implicații pentru elevi și studenți <textarea value={form.studentImplications} onChange={(event) => setField("studentImplications", event.target.value)} /></label><label>Termenul săptămânii <textarea value={form.weeklyTerm} onChange={(event) => setField("weeklyTerm", event.target.value)} /></label><label>Concluzie<textarea value={form.conclusion} onChange={(event) => setField("conclusion", event.target.value)} /></label><label>Surse <small>fiecare secțiune trebuie să păstreze ID-uri valide</small><textarea value={form.sources} onChange={(event) => setField("sources", event.target.value)} /></label><label>Linkuri interne<textarea value={form.internalLinks} onChange={(event) => setField("internalLinks", event.target.value)} /></label><label>Titlu SEO<input value={form.seoTitle} onChange={(event) => setField("seoTitle", event.target.value)} /></label><label>Descriere SEO<textarea value={form.metaDescription} onChange={(event) => setField("metaDescription", event.target.value)} /></label><label>Descriere distribuire<textarea value={form.socialDescription} onChange={(event) => setField("socialDescription", event.target.value)} /></label></div></details>

            <section className="admin-editorial-workflow" aria-labelledby="editorial-workflow-title">
              <div className="admin-editorial-workflow-head">
                <div><span>Flux editorial</span><h3 id="editorial-workflow-title">Salvează, verifică, previzualizează și publică</h3></div>
                <button type="button" className="btn-back" onClick={save} disabled={!dirty || Boolean(busy)}><Save size={16} />{busy === "save" ? "Se salvează…" : dirty ? "Salvează modificările" : "Modificări salvate"}</button>
              </div>

              {isPublished && dirty ? <p className="admin-editorial-edit-warning"><AlertTriangle size={16} />Salvarea modificărilor va retrage temporar articolul până la o nouă verificare.</p> : null}

              <div className="admin-editorial-workflow-steps">
                <article className={`is-${factInfo.tone}`}>
                  <ShieldCheck aria-hidden="true" size={20} />
                  <div><span>1. Verificare</span><strong>{factInfo.label}</strong><p>Compară afirmațiile articolului cu sursele salvate. Nu publică și nu retrage articolul.</p>{factReport?.summary ? <small>{factReport.summary}</small> : null}</div>
                  <button type="button" className="btn-back" onClick={() => runAction("fact_check")} disabled={dirty || Boolean(busy)}>{busy === "fact_check" ? "Se verifică…" : effectiveSelected.fact_check_status === "passed" ? "Verifică din nou" : "Rulează verificarea"}</button>
                </article>

                <article>
                  <Eye aria-hidden="true" size={20} />
                  <div><span>2. Previzualizare</span><strong>Pagină privată</strong><p>Deschide articolul exact cum va arăta, fără să îl publici.</p></div>
                  {dirty ? <span className="admin-editorial-disabled-action">Salvează mai întâi</span> : <a className="btn-back" href={`/admin/articole/${effectiveSelected.id}/preview`} target="_blank" rel="noreferrer">Deschide previzualizarea</a>}
                </article>

                <article className={isPublished ? "is-published" : ""}>
                  {isPublished ? <CheckCircle2 aria-hidden="true" size={20} /> : <Send aria-hidden="true" size={20} />}
                  <div><span>3. Publicare</span><strong>{isPublished ? "Articol publicat" : canPublish ? "Pregătit pentru publicare" : "Publicare indisponibilă"}</strong><p>{isPublished ? "Articolul este vizibil pentru toți utilizatorii." : canPublish ? "Confirmarea îl face vizibil în secțiunea Articole." : "Salvează și treci verificarea cu un scor de cel puțin 85."}</p></div>
                  <div className="admin-editorial-step-actions">
                    {isPublished ? <a className="btn-back" href={`/articole/${effectiveSelected.slug}`} target="_blank" rel="noreferrer">Vezi articolul public</a> : <button type="button" className="btn-link" onClick={() => setConfirmation("publish")} disabled={!canPublish || Boolean(busy)}>Publică articolul</button>}
                    {isPublished ? <button type="button" className="admin-editorial-withdraw" onClick={() => setConfirmation("withdraw")} disabled={Boolean(busy)}><Undo2 size={15} />Retrage din site</button> : null}
                  </div>
                </article>
              </div>

              {confirmation ? (
                <div className={`admin-editorial-confirmation is-${confirmation}`}>
                  <div><strong>{confirmation === "publish" ? "Publici articolul acum?" : "Retragi articolul de pe site?"}</strong><p>{confirmation === "publish" ? "Articolul va deveni vizibil public imediat." : "Articolul va fi ascuns public, dar va rămâne în Admin și poate fi republicat."}</p></div>
                  <div><button type="button" className={confirmation === "publish" ? "btn-link" : "admin-editorial-withdraw is-confirm"} onClick={() => runAction(confirmation)} disabled={Boolean(busy)}>{busy === confirmation ? "Se salvează…" : confirmation === "publish" ? "Da, publică" : "Da, retrage"}</button><button type="button" className="btn-back" onClick={() => setConfirmation("")} disabled={Boolean(busy)}>Anulează</button></div>
                </div>
              ) : null}

              <ActionMessage message={articleMessage} />
            </section>
            </> : <AdminLinkedInDistribution data={linkedIn} article={effectiveSelected} initialPostId={initialLinkedInPostId} />}
          </div>
        ) : <div className="admin-editorial-editor is-empty">Alege un articol pentru editare.</div>}
      </div>

      <details className="admin-run-history" open={runs.some((run) => ["rejected", "failed"].includes(run.status))}>
        <summary>Istoric generări ({runs.length})</summary>
        {runs.length ? (
          <div className="admin-editorial-runs">
            {runs.map((run) => {
              const attempts = run.validation_report?.researchAttempts || [];
              return (
                <article key={run.id}>
                  <strong>{run.run_date || `${run.week_start} – ${run.week_end}`}</strong>
                  <span>{run.trigger_source === "cron" ? "Programat" : "Manual"} · {runStatusLabel(run.status)} · {run.model || "model necunoscut"} · {run.quality_score ?? "—"}/100</span>
                  <small>{`${run.source_count ?? 0} surse verificate · ${run.topic_count ?? 0} subiecte selectate`}</small>
                  {attempts.length ? <div className="admin-editorial-run-attempts">{attempts.map((attempt, index) => <small key={`${attempt.strategy}-${index}`}>{researchAttemptLabel(attempt, index)}</small>)}</div> : null}
                  {run.rejection_reason || run.error_message ? <small>{run.rejection_reason || run.error_message}</small> : null}
                </article>
              );
            })}
          </div>
        ) : <p>Nu există rulări încă.</p>}
      </details>
    </section>
  );
}
