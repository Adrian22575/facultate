"use client";

import { moduleClassNames } from "@/lib/ui/module-class-names";
import libraryStyles from "./admin-content-library.module.css";
import pageStyles from "./admin-editorial-article-page.module.css";
import workflowStyles from "./admin-editorial-article-workflow.module.css";
import listStyles from "./admin-editorial-library-list.module.css";

import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Clock3,
  Eye,
  FileText,
  History,
  Link2,
  Save,
  SearchCheck,
  Send,
  ShieldCheck,
  Undo2
} from "lucide-react";
import Link from "next/link";

import { LoadingSpinner } from "@/components/loading-spinner";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { AdminLinkedInDistribution } from "@/components/admin-linkedin-distribution";
import { LinkedInGenerationOptions } from "@/components/linkedin-generation-options";
import {
  DEFAULT_LINKEDIN_POST_AUDIENCE,
  DEFAULT_LINKEDIN_POST_CTA,
  DEFAULT_LINKEDIN_POST_LENGTH,
  DEFAULT_LINKEDIN_POST_LINK_PLACEMENT,
  DEFAULT_LINKEDIN_POST_NARRATIVE,
  DEFAULT_LINKEDIN_POST_OBJECTIVE,
  DEFAULT_LINKEDIN_POST_TEMPLATE,
  DEFAULT_LINKEDIN_POST_VOICE
} from "@/lib/linkedin/templates";
import { handleTablistKeyDown } from "@/lib/ui/tablist";

const EDITOR_TABS = [
  { id: "overview", label: "Prezentare", icon: FileText },
  { id: "content", label: "Conținut", icon: FileText },
  { id: "sources", label: "Surse și SEO", icon: Link2 },
  { id: "quality", label: "Calitate", icon: SearchCheck },
  { id: "linkedin", label: "LinkedIn", icon: Send },
  { id: "history", label: "Istoric", icon: History }
];

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

function articleStatus(status) {
  return {
    draft: { label: "Ciornă", help: "Vizibilă numai în Admin.", tone: "draft" },
    published: { label: "Publicat", help: "Vizibil pe site.", tone: "published" },
    withdrawn: {
      label: "Retras",
      help: "Ascuns de pe site, păstrat în Admin.",
      tone: "withdrawn"
    },
    rejected: {
      label: "Respins",
      help: "Necesită corecturi înainte de publicare.",
      tone: "rejected"
    }
  }[status] || { label: status || "Necunoscut", help: "", tone: "draft" };
}

function factCheckStatus(status) {
  return {
    passed: {
      label: "Verificare trecută",
      help: "Afirmațiile sunt susținute de sursele salvate.",
      tone: "passed"
    },
    failed: {
      label: "Necesită corecturi",
      help: "Au fost găsite afirmații care trebuie revizuite.",
      tone: "failed"
    },
    needs_review: {
      label: "Verificare necesară",
      help: "Conținutul s-a modificat după ultima verificare.",
      tone: "pending"
    },
    pending: {
      label: "Neverificat",
      help: "Rulează verificarea înainte de publicare.",
      tone: "pending"
    }
  }[status] || {
    label: "Neverificat",
    help: "Rulează verificarea înainte de publicare.",
    tone: "pending"
  };
}

function formatDateTime(value) {
  if (!value) return "Dată indisponibilă";
  return new Intl.DateTimeFormat("ro-RO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function runStatusLabel(status) {
  return {
    started: "Generare pornită",
    researching: "Cercetare în curs",
    validated_research: "Surse validate",
    drafted: "Ciornă redactată",
    fact_checked: "Verificare finalizată",
    draft: "Ciornă pregătită",
    published: "Publicat",
    rejected: "Necesită revizuire",
    failed: "Generarea s-a oprit"
  }[status] || status;
}

function autoLinkedInOptions(settings) {
  return {
    templateKey: settings?.default_template || DEFAULT_LINKEDIN_POST_TEMPLATE,
    objectiveKey: settings?.default_objective || DEFAULT_LINKEDIN_POST_OBJECTIVE,
    voiceKey: settings?.default_voice || DEFAULT_LINKEDIN_POST_VOICE,
    audienceKey: settings?.default_audience || DEFAULT_LINKEDIN_POST_AUDIENCE,
    customAudience: settings?.default_custom_audience || "",
    ctaKey: settings?.default_cta || DEFAULT_LINKEDIN_POST_CTA,
    narrativeKey: settings?.default_narrative || DEFAULT_LINKEDIN_POST_NARRATIVE,
    lengthKey: settings?.default_length || DEFAULT_LINKEDIN_POST_LENGTH,
    linkPlacementKey:
      settings?.default_link_placement || DEFAULT_LINKEDIN_POST_LINK_PLACEMENT
  };
}

function ActionMessage({ message }) {
  if (!message) return null;
  return (
    <p
      className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], `admin-editorial-action-message is-${message.tone || "info"}`)}
      role="status"
      aria-live="polite"
    >
      {message.text}
    </p>
  );
}

function EditorField({ label, hint, children, full = false }) {
  return (
    <label className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], `admin-article-editor-field${full ? " is-full" : ""}`)}>
      <span>{label}</span>
      {children}
      {hint ? <small>{hint}</small> : null}
    </label>
  );
}

export function AdminEditorialArticlePage({
  initialArticle,
  runs = [],
  linkedIn,
  initialTab = "",
  initialLinkedInPostId = ""
}) {
  const router = useRouter();
  const [article, setArticle] = useState(initialArticle);
  const [form, setForm] = useState(() => formFrom(initialArticle));
  const requestedTab = initialTab === "linkedin" || initialLinkedInPostId ? "linkedin" : "overview";
  const [activeTab, setActiveTab] = useState(requestedTab);

  useEffect(() => {
    setActiveTab(requestedTab);
  }, [initialTab, initialLinkedInPostId, requestedTab]);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState(null);
  const [confirmation, setConfirmation] = useState("");
  const [publicationLinkedIn, setPublicationLinkedIn] = useState(() =>
    autoLinkedInOptions(linkedIn?.settings)
  );

  useEffect(() => {
    if (!dirty) return undefined;
    function handleBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = "";
    }
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  function setField(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
    setDirty(true);
    setMessage(null);
    setConfirmation("");
  }

  function handleBack(event) {
    if (!dirty) return;
    if (!window.confirm("Ai modificări nesalvate. Revii la lista de articole fără să le salvezi?")) {
      event.preventDefault();
    }
  }

  async function save() {
    if (!form || busy) return;
    setBusy("save");
    setMessage(null);
    try {
      const body = {
        ...form,
        categories: form.categories
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
        keyTakeaways: parseJson(form.keyTakeaways, "Ideile principale"),
        sections: parseJson(form.sections, "Secțiunile"),
        studentImplications: parseJson(form.studentImplications, "Implicațiile"),
        weeklyTerm: parseJson(form.weeklyTerm, "Termenul săptămânii"),
        sources: parseJson(form.sources, "Sursele"),
        internalLinks: parseJson(form.internalLinks, "Linkurile interne"),
        correctionNote: form.correctionNote || null
      };
      const response = await fetch(`/api/admin/editorial/articles/${article.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body)
      });
      const result = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage({
          tone: "error",
          text:
            result?.error === "unknown_source_reference"
              ? "O secțiune folosește un ID care nu există în lista de surse."
              : "Nu am putut salva. Verifică toate câmpurile și structura JSON."
        });
        return;
      }

      setArticle((current) => ({
        ...current,
        title: form.title,
        subtitle: form.subtitle,
        summary: form.summary,
        primary_topic: form.primaryTopic,
        categories: body.categories,
        key_takeaways: body.keyTakeaways,
        sections: body.sections,
        student_implications: body.studentImplications,
        weekly_term: body.weeklyTerm,
        conclusion: body.conclusion,
        sources: body.sources,
        internal_links: body.internalLinks,
        seo_title: body.seoTitle,
        meta_description: body.metaDescription,
        social_description: body.socialDescription,
        correction_note: body.correctionNote,
        status: result.article.status,
        fact_check_status: result.article.fact_check_status,
        updated_at: new Date().toISOString()
      }));
      setDirty(false);
      setMessage({
        tone: "success",
        text:
          article.status === "published"
            ? "Modificările au fost salvate. Articolul a fost retras temporar și trebuie verificat din nou."
            : "Modificările au fost salvate. Rulează verificarea înainte de publicare."
      });
      router.refresh();
    } catch (error) {
      setMessage({
        tone: "error",
        text: error instanceof Error ? error.message : "Date invalide."
      });
    } finally {
      setBusy("");
    }
  }

  async function runAction(action) {
    if (dirty || busy) return;
    if (
      action === "publish" &&
      publicationLinkedIn.audienceKey === "custom" &&
      publicationLinkedIn.customAudience.trim().length < 2
    ) {
      setMessage({
        tone: "error",
        text: "Completează audiența personalizată pentru postarea LinkedIn."
      });
      return;
    }

    setBusy(action);
    setMessage(null);
    const response = await fetch(`/api/admin/editorial/articles/${article.id}/actions`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(action === "publish" ? { action, linkedin: publicationLinkedIn } : { action })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    setConfirmation("");

    if (!response?.ok) {
      setMessage({
        tone: "error",
        text:
          result?.error === "publication_quality_not_met"
            ? "Publicarea este blocată până când verificarea trece și scorul este cel puțin 85."
            : result?.error === "fact_check_failed"
              ? "Verificarea nu a putut fi terminată. Conținutul nu a fost modificat."
              : "Acțiunea nu a fost salvată. Încearcă din nou."
      });
      return;
    }

    if (action === "fact_check") {
      setArticle((current) => ({
        ...current,
        fact_check_status: result.factCheckStatus,
        fact_check_report: result.report,
        last_reviewed_at: new Date().toISOString()
      }));
      setMessage({
        tone: result.factCheckStatus === "passed" ? "success" : "warning",
        text:
          result.factCheckStatus === "passed"
            ? "Verificarea a trecut. Afirmațiile au fost confirmate din sursele articolului."
            : "Verificarea cere corecturi. Deschide tabul Calitate pentru detalii."
      });
    } else if (action === "publish") {
      setArticle((current) => ({
        ...current,
        status: "published",
        published_at: current.published_at || new Date().toISOString()
      }));
      setMessage({ tone: "success", text: "Articolul este publicat și vizibil pe site." });
    } else {
      setArticle((current) => ({ ...current, status: "withdrawn" }));
      setMessage({
        tone: "success",
        text: "Articolul a fost retras. Rămâne disponibil în Admin."
      });
    }
    router.refresh();
  }

  const statusInfo = articleStatus(article.status);
  const factInfo = factCheckStatus(article.fact_check_status);
  const score = Number(article.quality_score || 0);
  const isPublished = article.status === "published";
  const canPublish =
    !dirty && article.fact_check_status === "passed" && score >= 85 && !isPublished;
  const factReport = article.fact_check_report || {};
  const qualityIssueCount =
    ["failed", "needs_review", "pending"].includes(article.fact_check_status) ? 1 : 0;
  const articleRuns = useMemo(
    () => runs.filter((run) => !run.article_id || run.article_id === article.id),
    [article.id, runs]
  );

  return (
    <section className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-page")}>
      <header className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-hero")}>
        <div>
          <span>
            {statusInfo.label} · {formatDateTime(article.published_at || article.updated_at)}
          </span>
          <h1>{article.title}</h1>
          <p>
            {statusInfo.help} Ultima actualizare: {formatDateTime(article.updated_at)}.
          </p>
        </div>
        <span className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], `admin-article-hero-status is-${factInfo.tone}`)}>
          {factInfo.label}
        </span>
      </header>

      {isPublished && dirty ? (
        <p className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-editorial-edit-warning")}>
          <AlertTriangle size={16} aria-hidden="true" />
          Salvarea modificărilor va retrage temporar articolul până la o nouă verificare.
        </p>
      ) : null}
      <ActionMessage message={message} />

      <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-editor-shell")}>
        <div
          className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-tabs")}
          role="tablist"
          aria-label="Secțiunile articolului"
          onKeyDown={handleTablistKeyDown}
        >
          {EDITOR_TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              aria-controls="admin-article-tab-panel"
              tabIndex={activeTab === id ? 0 : -1}
              className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], activeTab === id ? "is-active" : "")}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
              {id === "quality" && qualityIssueCount ? (
                <span aria-label={`${qualityIssueCount} problemă`}>{qualityIssueCount}</span>
              ) : null}
            </button>
          ))}
        </div>

        <div
          id="admin-article-tab-panel"
          className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-tab-panel")}
          role="tabpanel"
          aria-label={EDITOR_TABS.find((tab) => tab.id === activeTab)?.label}
        >
          {activeTab === "overview" ? (
            <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-overview")}>
              <section className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-next-action")}>
                <span>Următoarea acțiune recomandată</span>
                <h2>
                  {dirty
                    ? "Salvează modificările înainte de verificare"
                    : article.fact_check_status !== "passed"
                      ? "Verifică afirmațiile și sursele articolului"
                      : isPublished
                        ? "Articolul este publicat și monitorizat"
                        : "Articolul este pregătit pentru publicare"}
                </h2>
                <p>
                  {dirty
                    ? "Verificarea și previzualizarea sunt blocate cât timp există modificări nesalvate."
                    : factInfo.help}
                </p>
                {dirty ? (
                  <button type="button" className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "btn-link")} onClick={save} disabled={Boolean(busy)}>
                    <Save size={16} aria-hidden="true" />
                    Salvează acum
                  </button>
                ) : article.fact_check_status !== "passed" ? (
                  <button
                    type="button"
                    className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "btn-link")}
                    onClick={() => setActiveTab("quality")}
                  >
                    Vezi verificarea
                  </button>
                ) : null}
              </section>

              <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-overview-side")}>
                <article>
                  <span>Scor editorial</span>
                  <strong>{score || "—"}</strong>
                  <p>{score >= 85 ? "Peste pragul de publicare." : "Sub pragul de publicare 85."}</p>
                </article>
                <article>
                  <span>Rezumat articol</span>
                  <dl>
                    <div><dt>Stare</dt><dd>{statusInfo.label}</dd></div>
                    <div><dt>Surse</dt><dd>{(article.sources || []).length}</dd></div>
                    <div><dt>Cuvinte</dt><dd>{article.word_count || "—"}</dd></div>
                    <div><dt>Model</dt><dd>{article.generation_model || "—"}</dd></div>
                  </dl>
                </article>
              </div>

              <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-flow")}>
                <article className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "is-complete")}>
                  <Check size={16} aria-hidden="true" />
                  <strong>Generat</strong>
                  <span>{formatDateTime(article.created_at)}</span>
                </article>
                <article className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], `is-${factInfo.tone}`)}>
                  {article.fact_check_status === "passed" ? (
                    <Check size={16} aria-hidden="true" />
                  ) : (
                    <AlertTriangle size={16} aria-hidden="true" />
                  )}
                  <strong>Verificat</strong>
                  <span>{factInfo.label}</span>
                </article>
                <article className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], !dirty ? "is-complete" : "")}>
                  <Eye size={16} aria-hidden="true" />
                  <strong>Previzualizare</strong>
                  <span>{dirty ? "Salvează mai întâi" : "Disponibilă"}</span>
                </article>
                <article className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], isPublished ? "is-complete" : "")}>
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <strong>Publicare</strong>
                  <span>{isPublished ? formatDateTime(article.published_at) : "În așteptare"}</span>
                </article>
              </div>
            </div>
          ) : null}

          {activeTab === "content" ? (
            <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-form-grid")}>
              <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-section-heading is-full")}>
                <div>
                  <span>Conținut public</span>
                  <h2>Textul și structura articolului</h2>
                  <p>Editează informația care apare în pagina publică.</p>
                </div>
              </div>
              <EditorField label="Titlu" full>
                <input aria-label="Titlu" value={form.title} onChange={(event) => setField("title", event.target.value)} />
              </EditorField>
              <EditorField label="Subiect principal">
                <input
                  aria-label="Subiect principal"
                  value={form.primaryTopic}
                  onChange={(event) => setField("primaryTopic", event.target.value)}
                />
              </EditorField>
              <EditorField label="Categorii" hint="Separate prin virgulă">
                <input
                  aria-label="Categorii"
                  value={form.categories}
                  onChange={(event) => setField("categories", event.target.value)}
                />
              </EditorField>
              <EditorField label="Subtitlu" full>
                <textarea
                  aria-label="Subtitlu"
                  value={form.subtitle}
                  onChange={(event) => setField("subtitle", event.target.value)}
                />
              </EditorField>
              <EditorField label="Rezumat" full>
                <textarea
                  aria-label="Rezumat"
                  value={form.summary}
                  onChange={(event) => setField("summary", event.target.value)}
                />
              </EditorField>
              <EditorField label="Idei principale" hint="Listă JSON validă" full>
                <textarea
                  aria-label="Idei principale"
                  className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "is-code")}
                  value={form.keyTakeaways}
                  onChange={(event) => setField("keyTakeaways", event.target.value)}
                />
              </EditorField>
              <EditorField label="Secțiunile articolului" hint="Structură JSON validă" full>
                <textarea
                  aria-label="Secțiunile articolului"
                  className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "is-code is-long")}
                  value={form.sections}
                  onChange={(event) => setField("sections", event.target.value)}
                />
              </EditorField>
              <EditorField label="Implicații pentru elevi și studenți" full>
                <textarea
                  aria-label="Implicații pentru elevi și studenți"
                  className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "is-code")}
                  value={form.studentImplications}
                  onChange={(event) => setField("studentImplications", event.target.value)}
                />
              </EditorField>
              <EditorField label="Termenul săptămânii">
                <textarea
                  aria-label="Termenul săptămânii"
                  className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "is-code")}
                  value={form.weeklyTerm}
                  onChange={(event) => setField("weeklyTerm", event.target.value)}
                />
              </EditorField>
              <EditorField label="Concluzie">
                <textarea
                  aria-label="Concluzie"
                  value={form.conclusion}
                  onChange={(event) => setField("conclusion", event.target.value)}
                />
              </EditorField>
            </div>
          ) : null}

          {activeTab === "sources" ? (
            <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-form-grid")}>
              <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-section-heading is-full")}>
                <div>
                  <span>Proveniență și indexare</span>
                  <h2>Surse, metadate și SEO</h2>
                  <p>Păstrează referințele verificabile și descrierile pentru distribuire.</p>
                </div>
              </div>
              <EditorField
                label="Surse"
                hint="Fiecare secțiune trebuie să păstreze ID-uri existente aici"
                full
              >
                <textarea
                  aria-label="Surse"
                  className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "is-code is-long")}
                  value={form.sources}
                  onChange={(event) => setField("sources", event.target.value)}
                />
              </EditorField>
              <EditorField label="Linkuri interne" hint="Listă JSON validă" full>
                <textarea
                  aria-label="Linkuri interne"
                  className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "is-code")}
                  value={form.internalLinks}
                  onChange={(event) => setField("internalLinks", event.target.value)}
                />
              </EditorField>
              <EditorField label="Titlu SEO" full>
                <input
                  aria-label="Titlu SEO"
                  value={form.seoTitle}
                  onChange={(event) => setField("seoTitle", event.target.value)}
                />
              </EditorField>
              <EditorField label="Descriere SEO" full>
                <textarea
                  aria-label="Descriere SEO"
                  value={form.metaDescription}
                  onChange={(event) => setField("metaDescription", event.target.value)}
                />
              </EditorField>
              <EditorField label="Descriere pentru distribuire">
                <textarea
                  aria-label="Descriere pentru distribuire"
                  value={form.socialDescription}
                  onChange={(event) => setField("socialDescription", event.target.value)}
                />
              </EditorField>
              <EditorField label="Notă de corecție" hint="Opțională">
                <textarea
                  aria-label="Notă de corecție"
                  value={form.correctionNote}
                  onChange={(event) => setField("correctionNote", event.target.value)}
                />
              </EditorField>
            </div>
          ) : null}

          {activeTab === "quality" ? (
            <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-quality")}>
              <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-section-heading")}>
                <div>
                  <span>Control editorial și factual</span>
                  <h2>Calitatea articolului</h2>
                  <p>Verificarea compară afirmațiile cu sursele salvate.</p>
                </div>
                <button
                  type="button"
                  className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "btn-link")}
                  onClick={() => runAction("fact_check")}
                  disabled={dirty || Boolean(busy)}
                >
                  {busy === "fact_check" ? (
                    <LoadingSpinner size={16} />
                  ) : (
                    <ShieldCheck size={16} aria-hidden="true" />
                  )}
                  {article.fact_check_status === "passed" ? "Verifică din nou" : "Rulează verificarea"}
                </button>
              </div>
              {dirty ? (
                <p className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-quality-note")}>
                  Salvează modificările înainte de o nouă verificare.
                </p>
              ) : null}
              <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-quality-grid")}>
                <article>
                  <span>Scor editorial</span>
                  <strong>{score || "—"}</strong>
                  <i><span style={{ width: `${Math.min(score, 100)}%` }} /></i>
                  <p>Pragul pentru publicare este 85/100.</p>
                </article>
                <article className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], `is-${factInfo.tone}`)}>
                  <span>Verificare factuală</span>
                  <strong>{factInfo.label}</strong>
                  <p>{factInfo.help}</p>
                </article>
                <article>
                  <span>Afirmații confirmate</span>
                  <strong>{factReport.verifiedClaimCount ?? "—"}</strong>
                  <p>Afirmații susținute de sursele articolului.</p>
                </article>
                <article className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], Number(factReport.unsupportedClaimCount) ? "is-failed" : "")}>
                  <span>Afirmații fără suport</span>
                  <strong>{factReport.unsupportedClaimCount ?? "—"}</strong>
                  <p>{factReport.summary || "Rulează verificarea pentru un rezumat actualizat."}</p>
                </article>
              </div>
            </div>
          ) : null}

          {activeTab === "linkedin" ? (
            <AdminLinkedInDistribution
              data={linkedIn}
              article={article}
              initialPostId={initialLinkedInPostId}
            />
          ) : null}

          {activeTab === "history" ? (
            <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-history")}>
              <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-section-heading")}>
                <div>
                  <span>Activitate</span>
                  <h2>Istoricul articolului</h2>
                  <p>Generări, verificări și publicări asociate articolului.</p>
                </div>
              </div>
              {articleRuns.length ? (
                <div>
                  {articleRuns.map((run) => (
                    <article key={run.id}>
                      <time>{formatDateTime(run.finished_at || run.started_at)}</time>
                      <span aria-hidden="true" />
                      <div>
                        <strong>{runStatusLabel(run.status)}</strong>
                        <p>
                          {run.trigger_source === "cron" ? "Programat" : "Manual"} ·{" "}
                          {run.source_count ?? 0} surse · scor {run.quality_score ?? "—"}/100
                        </p>
                        {run.rejection_reason || run.error_message ? (
                          <small>{run.rejection_reason || run.error_message}</small>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-articles-empty")}>Nu există activitate salvată pentru acest articol.</p>
              )}
            </div>
          ) : null}
        </div>
      </div>

      {confirmation ? (
        <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], `admin-editorial-confirmation is-${confirmation}`)}>
          <div>
            <strong>
              {confirmation === "publish" ? "Publici articolul acum?" : "Retragi articolul de pe site?"}
            </strong>
            <p>
              {confirmation === "publish"
                ? "Articolul va deveni vizibil public imediat."
                : "Articolul va fi ascuns public, dar va rămâne în Admin."}
            </p>
          </div>
          <div>
            <button
              type="button"
              className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], confirmation === "publish" ? "btn-link" : "admin-editorial-withdraw is-confirm")}
              onClick={() => runAction(confirmation)}
              disabled={Boolean(busy)}
            >
              {busy === confirmation
                ? "Se salvează…"
                : confirmation === "publish"
                  ? "Da, publică"
                  : "Da, retrage"}
            </button>
            <button
              type="button"
              className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "btn-back")}
              onClick={() => setConfirmation("")}
              disabled={Boolean(busy)}
            >
              Anulează
            </button>
          </div>
        </div>
      ) : null}

      {!isPublished ? (
        <details className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-publication-options")}>
          <summary>Opțiuni LinkedIn după publicare</summary>
          <LinkedInGenerationOptions
            value={publicationLinkedIn}
            onChange={setPublicationLinkedIn}
            disabled={Boolean(busy)}
            compact
          />
        </details>
      ) : null}

      <div className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-sticky-actions")}>
        <Link href="/admin/continut/articole" onClick={handleBack}>
          Înapoi la articole
        </Link>
        <span>
          {dirty ? (
            <>
              <Clock3 size={15} aria-hidden="true" />
              Modificări nesalvate
            </>
          ) : (
            <>
              <Check size={15} aria-hidden="true" />
              Toate modificările sunt salvate
            </>
          )}
        </span>
        <div>
          {dirty ? (
            <span className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-article-disabled-preview")}>Salvează pentru previzualizare</span>
          ) : (
            <a
              className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "btn-back")}
              href={`/admin/articole/${article.id}/preview`}
              target="_blank"
              rel="noreferrer"
            >
              <Eye size={15} aria-hidden="true" />
              Previzualizează
            </a>
          )}
          {isPublished ? (
            <>
              <a
                className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "btn-back")}
                href={`/articole/${article.slug}`}
                target="_blank"
                rel="noreferrer"
              >
                Vezi articolul
              </a>
              <button
                type="button"
                className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "admin-editorial-withdraw")}
                onClick={() => setConfirmation("withdraw")}
                disabled={Boolean(busy)}
              >
                <Undo2 size={15} aria-hidden="true" />
                Retrage
              </button>
            </>
          ) : (
            <button
              type="button"
              className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "btn-back")}
              onClick={() => setConfirmation("publish")}
              disabled={!canPublish || Boolean(busy)}
            >
              <Send size={15} aria-hidden="true" />
              Publică
            </button>
          )}
          <button
            type="button"
            className={moduleClassNames([libraryStyles, pageStyles, workflowStyles, listStyles], "btn-link")}
            onClick={save}
            disabled={!dirty || Boolean(busy)}
          >
            {busy === "save" ? (
              <LoadingSpinner size={16} />
            ) : (
              <Save size={16} aria-hidden="true" />
            )}
            {busy === "save" ? "Se salvează…" : dirty ? "Salvează modificările" : "Salvat"}
          </button>
        </div>
      </div>
    </section>
  );
}
