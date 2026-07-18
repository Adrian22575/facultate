"use client";

import {
  BellRing,
  CheckCircle2,
  Cpu,
  ExternalLink,
  FileText,
  LoaderCircle,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Unplug,
  XCircle
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { AdminGenerationPromptPreview } from "@/components/admin-generation-prompt-preview";
import { LINKEDIN_MODEL_OPTIONS, normalizeLinkedInModel } from "@/lib/linkedin/models";
import { DEFAULT_LINKEDIN_POST_TEMPLATE, LINKEDIN_POST_TEMPLATES } from "@/lib/linkedin/templates";

const MODE_OPTIONS = [
  ["approval_required", "Necesită aprobare"],
  ["draft_only", "Doar ciornă"],
  ["auto_publish", "Publică automat"],
  ["disabled", "Dezactivat"]
];

const STATUS = {
  not_generated: ["Se pregătește", "working"],
  draft: ["Ciornă", "draft"],
  pending_approval: ["De aprobat", "attention"],
  approved: ["Aprobată", "ready"],
  publishing: ["Se publică", "working"],
  published: ["Publicată", "published"],
  failed: ["Eroare", "failed"],
  connection_expired: ["Reconectare necesară", "failed"],
  rejected: ["Respinsă", "rejected"]
};

function formatDate(value) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function humanError(value) {
  const code = String(value || "");
  if (code.includes("hashtag_count_invalid")) return "Textul trebuie să conțină între 1 și 3 hashtaguri integrate firesc în text.";
  if (code.includes("linkedin_publish_result_unknown") || code.includes("linkedin_publish_confirmation_missing") || code.includes("linkedin_publish_confirmation_persistence_failed")) return "Confirmarea publicării nu este completă. Verifică profilul înainte de orice nouă publicare.";
  if (code.includes("connection_expired")) return "Conexiunea a expirat. Reconectează profilul.";
  if (code.includes("article_url_missing")) return "Textul trebuie să păstreze linkul articolului.";
  if (code.includes("hashtag_count_invalid")) return "Textul trebuie să conțină între 3 și 5 hashtaguri.";
  if (code.includes("text_length_invalid")) return "Textul trebuie să aibă între 120 și 3.000 de caractere.";
  return code ? "Acțiunea nu a putut fi finalizată. Detaliul tehnic este păstrat în istoric." : "";
}

export function AdminLinkedInDistribution({ data, articles = [], initialPostId = "" }) {
  const router = useRouter();
  const [settings, setSettings] = useState(() => ({ ...(data?.settings || { mode: "approval_required", notify_telegram: true, default_template: DEFAULT_LINKEDIN_POST_TEMPLATE }), model: normalizeLinkedInModel(data?.settings?.model), default_template: data?.settings?.default_template || DEFAULT_LINKEDIN_POST_TEMPLATE }));
  const [connection, setConnection] = useState(data?.connection || null);
  const [posts, setPosts] = useState(data?.posts || []);
  const [selectedId, setSelectedId] = useState(initialPostId || data?.posts?.[0]?.id || "");
  const selected = useMemo(() => posts.find((post) => post.id === selectedId) || posts[0] || null, [posts, selectedId]);
  const [text, setText] = useState(selected?.edited_text || selected?.generated_text || "");
  const [articleId, setArticleId] = useState(articles.find((article) => article.status === "published")?.id || "");
  const [manualTemplate, setManualTemplate] = useState(data?.settings?.default_template || DEFAULT_LINKEDIN_POST_TEMPLATE);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const publishedArticles = articles.filter((article) => article.status === "published");
  const articleActivity = data?.articleActivity || {};
  const selectedArticleActivity = articleActivity[articleId] || { total: 0, published: 0, lastPublishedAt: null, latestEdition: 0 };
  const selectedStatus = STATUS[selected?.status] || [selected?.status || "Necunoscut", "draft"];

  function patchPost(postId, patch) {
    setPosts((current) => current.map((post) => post.id === postId ? { ...post, ...patch } : post));
  }

  function choose(post) {
    setSelectedId(post.id);
    setText(post.edited_text || post.generated_text || "");
    setMessage("");
  }

  async function saveSettings() {
    if (busy) return;
    setBusy("settings");
    setMessage("");
    const response = await fetch("/api/admin/linkedin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ mode: settings.mode, notifyTelegram: settings.notify_telegram, model: normalizeLinkedInModel(settings.model), defaultTemplate: settings.default_template })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    if (!response?.ok) return setMessage("Setările nu au putut fi salvate.");
    setSettings(result.settings);
    setMessage("Setările LinkedIn au fost salvate.");
  }

  async function disconnect() {
    if (!connection || busy || !window.confirm("Deconectezi profilul LinkedIn? Orice publicare viitoare se oprește imediat.")) return;
    setBusy("disconnect");
    setMessage("");
    const response = await fetch(`/api/admin/linkedin/connections/${connection.id}/disconnect`, { method: "POST" }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    if (!response?.ok) return setMessage("Profilul nu a putut fi deconectat.");
    setConnection(result.connection);
    setMessage("Profilul a fost deconectat. Publicarea este oprită.");
    router.refresh();
  }

  async function generate() {
    if (!articleId || busy) return;
    if (selectedArticleActivity.published && !window.confirm(`Acest articol are deja ${selectedArticleActivity.published} postări publicate. Creezi o variantă nouă pentru verificare?`)) return;
    setBusy("generate");
    setMessage(selectedArticleActivity.published ? "Pregătim o variantă nouă. Nu modifică și nu republică postările existente." : "Pregătim textul. Poți reveni în această zonă după finalizare.");
    const response = await fetch(`/api/admin/linkedin/articles/${articleId}/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ templateKey: manualTemplate }) }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    if (!response?.ok || !result?.post) {
      setMessage(result?.reason === "linkedin_not_connected" ? "Conectează profilul înainte de generare." : humanError(result?.reason || result?.error) || "Textul nu a putut fi pregătit.");
      return;
    }
    const article = publishedArticles.find((item) => item.id === articleId);
    const next = { ...result.post, article: article ? { id: article.id, slug: article.slug, title: article.title, status: article.status, published_at: article.published_at } : null };
    setPosts((current) => [next, ...current.filter((item) => item.id !== next.id)]);
    choose(next);
    setMessage("Textul este pregătit pentru verificare.");
    router.refresh();
  }

  async function saveText() {
    if (!selected || busy) return;
    setBusy("save");
    setMessage("");
    const response = await fetch(`/api/admin/linkedin/posts/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    if (!response?.ok) return setMessage(humanError(result?.error) || "Textul nu a putut fi salvat.");
    patchPost(selected.id, result.post);
    setMessage("Textul a fost salvat. Aprobarea anterioară a fost anulată dacă textul s-a schimbat.");
  }

  async function action(action) {
    if (!selected || busy) return;
    setBusy(action);
    setMessage("");
    const response = await fetch(`/api/admin/linkedin/posts/${selected.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action, templateKey: manualTemplate }) }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    if (!response?.ok || !result?.post) {
      setMessage(humanError(result?.reason || result?.error) || "Acțiunea nu a putut fi finalizată.");
      router.refresh();
      return;
    }
    patchPost(selected.id, result.post);
    setText(result.post.edited_text || result.post.generated_text || text);
    setMessage(action === "approve" ? "Postarea este aprobată. O poți publica acum." : action === "reject" ? "Postarea a fost respinsă și rămâne în istoric." : action === "publish" || action === "retry" ? "Postarea a fost publicată pe LinkedIn." : "Postarea a fost actualizată.");
    router.refresh();
  }

  const connected = connection?.status === "connected";
  const textDirty = Boolean(selected && text !== (selected.edited_text || selected.generated_text || ""));
  const ambiguous = ["linkedin_publish_result_unknown", "linkedin_publish_confirmation_missing", "linkedin_publish_confirmation_persistence_failed"].includes(selected?.last_error);

  return (
    <section id="linkedin-distribution" className="admin-linkedin-section" aria-labelledby="linkedin-title">
      <header className="admin-linkedin-head">
        <div className="admin-linkedin-title-mark"><span className="admin-linkedin-brand-glyph" aria-hidden="true">in</span></div>
        <div><span>Distribuire după publicare</span><h2 id="linkedin-title">LinkedIn</h2><p>Pregătești, verifici și publici o singură postare pentru fiecare articol.</p></div>
        <span className={`admin-linkedin-connection-state is-${connected ? "connected" : "offline"}`}>{connected ? "Conectat" : connection?.status === "connection_expired" ? "Expirat" : "Neconectat"}</span>
      </header>

      <div className="admin-linkedin-controls">
        <label><span>Mod de lucru</span><select value={settings.mode} disabled={Boolean(busy)} onChange={(event) => setSettings((current) => ({ ...current, mode: event.target.value }))}>{MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
        <label className="admin-linkedin-model"><span><Cpu size={14} />Model postare</span><select value={normalizeLinkedInModel(settings.model)} disabled={Boolean(busy)} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}>{LINKEDIN_MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}</select></label>
        <label className="admin-linkedin-telegram"><input type="checkbox" checked={settings.notify_telegram} disabled={Boolean(busy)} onChange={(event) => setSettings((current) => ({ ...current, notify_telegram: event.target.checked }))} /><BellRing size={15} /><span>Notificări Telegram</span></label>
        <button type="button" className="btn-back admin-linkedin-secondary" onClick={saveSettings} disabled={Boolean(busy)}>{busy === "settings" ? <LoaderCircle className="is-spinning" size={16} /> : <Save size={16} />}Salvează setările</button>
        {connected ? <button type="button" className="admin-linkedin-disconnect" onClick={disconnect} disabled={Boolean(busy)}>{busy === "disconnect" ? <LoaderCircle className="is-spinning" size={16} /> : <Unplug size={16} />}Deconectează</button> : <a className={`admin-linkedin-connect${data?.config?.ready ? "" : " is-disabled"}`} href={data?.config?.ready ? "/api/admin/linkedin/oauth/start" : undefined}><span className="admin-linkedin-brand-glyph is-small" aria-hidden="true">in</span>Conectează LinkedIn</a>}
      </div>

      {!data?.config?.ready ? <p className="admin-linkedin-config-note"><ShieldCheck size={16} />Completează variabilele LinkedIn și cheia de criptare înainte de conectare. Interfața rămâne inactivă până atunci.</p> : null}
      {connection ? <div className="admin-linkedin-profile"><div><span className="admin-linkedin-brand-glyph is-small" aria-hidden="true">in</span></div><span><strong>{connection.display_name || "Profil LinkedIn"}</strong><small>{connected ? `Acces valabil până la ${formatDate(connection.token_expires_at)}` : "Publicarea este oprită"}</small></span>{connection.last_published_at ? <small>Ultima publicare: {formatDate(connection.last_published_at)}</small> : null}</div> : null}
      {data?.warning ? <p className="admin-linkedin-message is-error">{data.warning}</p> : null}
      {message ? <p className="admin-linkedin-message" role="status" aria-live="polite">{message}</p> : null}

      <div className="admin-linkedin-template-bar">
        <label><span>Format implicit pentru automatizare</span><select value={settings.default_template} disabled={Boolean(busy)} onChange={(event) => setSettings((current) => ({ ...current, default_template: event.target.value }))}>{LINKEDIN_POST_TEMPLATES.map((template) => <option key={template.key} value={template.key}>{template.label} — {template.description}</option>)}</select></label>
        <label><span>Format pentru următoarea postare</span><select value={manualTemplate} disabled={Boolean(busy)} onChange={(event) => setManualTemplate(event.target.value)}>{LINKEDIN_POST_TEMPLATES.map((template) => <option key={template.key} value={template.key}>{template.label} — {template.description}</option>)}</select></label>
        <p><strong>Automatizare:</strong> la publicarea automată se folosește formatul implicit salvat în setările de mai sus. Aici poți alege temporar alt format pentru generarea manuală.</p>
        <AdminGenerationPromptPreview preview={{ ...(data?.generationPreviews?.find((preview) => preview.template?.key === manualTemplate) || null), model: settings.model }} />
      </div>

      <div className="admin-linkedin-create-row">
        <label><span>Articol publicat</span><select value={articleId} disabled={!connected || Boolean(busy)} onChange={(event) => setArticleId(event.target.value)}><option value="">Alege articolul</option>{publishedArticles.map((article) => <option key={article.id} value={article.id}>{article.title}</option>)}</select></label>
        {articleId ? <p className="admin-linkedin-article-activity"><strong>{selectedArticleActivity.published ? `Publicată de ${selectedArticleActivity.published} ori` : "Încă nepublicată pe LinkedIn"}</strong><span>{selectedArticleActivity.lastPublishedAt ? `Ultima: ${formatDate(selectedArticleActivity.lastPublishedAt)}` : "Va intra la aprobare înainte de publicare."}</span></p> : null}
        <button type="button" className="btn-link" onClick={generate} disabled={!connected || !articleId || Boolean(busy)}>{busy === "generate" ? <LoaderCircle className="is-spinning" size={16} /> : <FileText size={16} />}{busy === "generate" ? "Se pregătește…" : selectedArticleActivity.published ? "Creează variantă nouă" : "Pregătește postarea"}</button>
      </div>

      {posts.length ? (
        <div className="admin-linkedin-workspace">
          <nav className="admin-linkedin-list" aria-label="Postări LinkedIn">
            {posts.map((post) => {
              const status = STATUS[post.status] || [post.status, "draft"];
              return <button type="button" key={post.id} className={post.id === selected?.id ? "is-selected" : ""} onClick={() => choose(post)} disabled={Boolean(busy)}><span className={`is-${status[1]}`}>{status[0]}</span><strong>{post.article?.title || "Articol"}</strong><small>{formatDate(post.updated_at)}</small></button>;
            })}
          </nav>

          {selected ? <div className="admin-linkedin-editor" aria-busy={Boolean(busy)}>
            <div className="admin-linkedin-editor-head"><div><span className={`admin-linkedin-status is-${selectedStatus[1]}`}>{selectedStatus[0]}</span><small className="admin-linkedin-template-chip">Varianta {selected.edition_number || 1} · {LINKEDIN_POST_TEMPLATES.find((template) => template.key === selected.template_key)?.label || "Format salvat"}</small><h3>{selected.article?.title || "Postare LinkedIn"}</h3></div>{selected.status === "published" && selected.linkedin_post_url ? <a href={selected.linkedin_post_url} target="_blank" rel="noreferrer">Deschide pe LinkedIn <ExternalLink size={15} /></a> : null}</div>
            {selected.generation_started_at && selected.status === "not_generated" ? <div className="admin-linkedin-generating"><LoaderCircle className="is-spinning" size={18} /><span><strong>Textul se pregătește</strong><small>Poți părăsi pagina. Starea rămâne salvată.</small></span></div> : null}
            <label className="admin-linkedin-text"><span>Textul postării <small>{text.length}/3.000</small></span><textarea value={text} onChange={(event) => setText(event.target.value)} disabled={["publishing", "published"].includes(selected.status) || Boolean(busy)} rows={14} /></label>
            {selected.last_error ? <p className="admin-linkedin-error"><XCircle size={16} />{humanError(selected.last_error)}</p> : null}
            <div className="admin-linkedin-actions">
              {!['published', 'publishing', 'not_generated'].includes(selected.status) ? <button type="button" className="btn-back admin-linkedin-secondary" onClick={saveText} disabled={!textDirty || Boolean(busy)}>{busy === "save" ? <LoaderCircle className="is-spinning" size={16} /> : <Save size={16} />}{textDirty ? "Salvează textul" : "Text salvat"}</button> : null}
              {["draft", "pending_approval", "rejected", "failed"].includes(selected.status) && !ambiguous ? <button type="button" className="admin-linkedin-approve" onClick={() => action("approve")} disabled={textDirty || Boolean(busy)}>{busy === "approve" ? <LoaderCircle className="is-spinning" size={16} /> : <CheckCircle2 size={16} />}Aprobă</button> : null}
              {["draft", "pending_approval", "approved", "failed"].includes(selected.status) && !ambiguous ? <button type="button" className="admin-linkedin-reject" onClick={() => action("reject")} disabled={Boolean(busy)}><XCircle size={16} />Respinge</button> : null}
              {selected.status === "approved" ? <button type="button" className="btn-link" onClick={() => action("publish")} disabled={Boolean(busy)}>{busy === "publish" ? <LoaderCircle className="is-spinning" size={16} /> : <Send size={16} />}{busy === "publish" ? "Se publică…" : "Publică pe LinkedIn"}</button> : null}
              {selected.status === "failed" && !ambiguous ? <button type="button" className="btn-link" onClick={() => action("retry")} disabled={Boolean(busy)}>{busy === "retry" ? <LoaderCircle className="is-spinning" size={16} /> : <RefreshCw size={16} />}Reîncearcă</button> : null}
            </div>
            <footer><span>Varianta: {selected.edition_number || 1}</span><span>Format: {LINKEDIN_POST_TEMPLATES.find((template) => template.key === selected.template_key)?.label || "—"}</span><span>Model: {selected.model || "—"}</span><span>Generată: {formatDate(selected.generated_at)}</span><span>Aprobată: {formatDate(selected.approved_at)}</span><span>Publicată: {formatDate(selected.published_at)}</span></footer>
          </div> : null}
        </div>
      ) : <div className="admin-linkedin-empty"><span className="admin-linkedin-brand-glyph" aria-hidden="true">in</span><div><strong>Nicio postare pregătită</strong><p>Conectează profilul și alege un articol publicat. Modul implicit cere aprobarea ta înainte de publicare.</p></div></div>}
    </section>
  );
}
