"use client";

import { CheckCircle2, Cpu, ExternalLink, Eye, FilePenLine, FileText, LoaderCircle, RefreshCw, Save, Send, Settings2, ShieldCheck, ThumbsDown, ThumbsUp, Unplug, WandSparkles, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { AdminGenerationPromptPreview } from "@/components/admin-generation-prompt-preview";
import { LinkedInGenerationOptions } from "@/components/linkedin-generation-options";
import { handleTablistKeyDown } from "@/lib/ui/tablist";
import { LINKEDIN_MODEL_OPTIONS, normalizeLinkedInModel } from "@/lib/linkedin/models";
import {
  DEFAULT_LINKEDIN_POST_AUDIENCE,
  DEFAULT_LINKEDIN_POST_CTA,
  DEFAULT_LINKEDIN_POST_LENGTH,
  DEFAULT_LINKEDIN_POST_LINK_PLACEMENT,
  DEFAULT_LINKEDIN_POST_NARRATIVE,
  DEFAULT_LINKEDIN_POST_OBJECTIVE,
  DEFAULT_LINKEDIN_POST_TEMPLATE,
  DEFAULT_LINKEDIN_POST_VOICE,
  LINKEDIN_POST_TEMPLATES
} from "@/lib/linkedin/templates";

const MODE_OPTIONS = [["approval_required", "Necesită aprobare"], ["draft_only", "Doar ciornă"], ["auto_publish", "Publică automat"], ["disabled", "Dezactivat"]];
const STATUS = { not_generated: ["În pregătire", "attention"], draft: ["Ciornă", "draft"], pending_approval: ["De verificat", "attention"], approved: ["Aprobată", "ready"], publishing: ["Se publică", "attention"], published: ["Publicată", "published"], failed: ["Eșuată", "failed"], connection_expired: ["Conexiune expirată", "failed"], rejected: ["Respinsă", "rejected"] };
const REFINEMENTS = [
  ["alternate_angle", "Alt unghi"], ["alternate_hook", "Alt hook"], ["shorter", "Mai scurt"], ["more_direct", "Mai direct"],
  ["more_personal", "Mai personal"], ["less_promotional", "Mai puțin promoțional"], ["more_provocative", "Mai provocator"]
];

function formatDate(value) { return value ? new Intl.DateTimeFormat("ro-RO", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—"; }
function postArticleId(post) { return post?.article_id || post?.article?.id || ""; }
function optionsFromSettings(settings = {}) {
  return {
    templateKey: settings.default_template || DEFAULT_LINKEDIN_POST_TEMPLATE,
    objectiveKey: settings.default_objective || DEFAULT_LINKEDIN_POST_OBJECTIVE,
    voiceKey: settings.default_voice || DEFAULT_LINKEDIN_POST_VOICE,
    audienceKey: settings.default_audience || DEFAULT_LINKEDIN_POST_AUDIENCE,
    customAudience: settings.default_custom_audience || "",
    ctaKey: settings.default_cta || DEFAULT_LINKEDIN_POST_CTA,
    narrativeKey: settings.default_narrative || DEFAULT_LINKEDIN_POST_NARRATIVE,
    lengthKey: settings.default_length || DEFAULT_LINKEDIN_POST_LENGTH,
    linkPlacementKey: settings.default_link_placement || DEFAULT_LINKEDIN_POST_LINK_PLACEMENT
  };
}
function settingsFromOptions(settings, options) {
  return { ...settings, default_template: options.templateKey, default_objective: options.objectiveKey, default_voice: options.voiceKey, default_audience: options.audienceKey, default_custom_audience: options.audienceKey === "custom" ? options.customAudience : null, default_cta: options.ctaKey, default_narrative: options.narrativeKey, default_length: options.lengthKey, default_link_placement: options.linkPlacementKey };
}
function humanError(value) {
  const code = String(value || "");
  if (code.includes("invalid_generation_options") || code.includes("custom_audience_required")) return "Completează audiența personalizată sau alege o audiență din listă.";
  if (code.includes("hashtag_count_invalid")) return "Textul poate conține cel mult patru hashtaguri relevante.";
  if (code.includes("publish_result_unknown") || code.includes("confirmation_missing") || code.includes("ambiguous_result")) return "Confirmarea publicării este neclară. Verifică profilul înainte de o nouă încercare.";
  if (code.includes("comment_permission_missing")) return "Postarea a fost publicată, dar conexiunea actuală nu permite publicarea primului comentariu.";
  if (code.includes("connection_expired")) return "Conexiunea a expirat. Reconectează profilul.";
  if (code.includes("connection_changed")) return "Varianta aparține unei conexiuni LinkedIn anterioare. Creează o variantă nouă pentru profilul conectat acum.";
  if (code.includes("already_publishing")) return "Varianta este deja în curs de publicare. Așteaptă confirmarea înainte de o nouă încercare.";
  if (code.includes("already_published")) return "Varianta este deja publicată pe LinkedIn.";
  if (code.includes("already_prepared")) return "Varianta este deja pregătită și poate fi selectată din istoric.";
  if (code.includes("rate_limited")) return "Ai trimis mai multe cereri într-un interval scurt. Așteaptă câteva minute și reîncearcă.";
  if (code.includes("article_url_missing")) return "Textul trebuie să păstreze linkul articolului pentru poziționarea aleasă.";
  if (code.includes("text_length_invalid")) return "Textul trebuie să aibă între 120 și 3.000 de caractere.";
  if (code.includes("unsupported_claim") || code.includes("unsupported_personal_experience")) return "Textul conține o afirmație care nu poate fi susținută din articol. Alege o altă variantă sau reîncearcă.";
  if (code.includes("banned_language_detected")) return "Textul a fost oprit deoarece sună artificial sau folosește o formulare interzisă.";
  if (code.includes("edition")) return "Nu am putut rezerva următoarea variantă. Reîncarcă pagina și încearcă din nou.";
  return code ? "Acțiunea nu a putut fi finalizată. Detaliul tehnic este păstrat în istoric." : "";
}

export function AdminLinkedInDistribution({ data, article, initialPostId = "" }) {
  const router = useRouter();
  const [settings, setSettings] = useState(data?.settings || {});
  const [connection, setConnection] = useState(data?.connection || null);
  const [posts, setPosts] = useState(data?.posts || []);
  const [selectedId, setSelectedId] = useState(initialPostId);
  const [text, setText] = useState("");
  const [manualOptions, setManualOptions] = useState(() => optionsFromSettings(data?.settings));
  const [promptPreview, setPromptPreview] = useState(() => data?.generationPreviews?.[0] || null);
  const [editorView, setEditorView] = useState("edit");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");

  useEffect(() => setPosts(data?.posts || []), [data?.posts]);
  useEffect(() => setConnection(data?.connection || null), [data?.connection]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ template: manualOptions.templateKey, objective: manualOptions.objectiveKey, voice: manualOptions.voiceKey, audience: manualOptions.audienceKey, customAudience: manualOptions.customAudience || "", cta: manualOptions.ctaKey, narrative: manualOptions.narrativeKey, length: manualOptions.lengthKey, linkPlacement: manualOptions.linkPlacementKey, model: normalizeLinkedInModel(settings.model) });
    fetch(`/api/admin/linkedin/prompt-preview?${params}`, { signal: controller.signal }).then((response) => response.ok ? response.json() : null).then((result) => { if (!controller.signal.aborted && result?.preview) setPromptPreview(result.preview); }).catch(() => null);
    return () => controller.abort();
  }, [manualOptions, settings.model]);

  const articlePosts = useMemo(() => posts.filter((post) => postArticleId(post) === article?.id).sort((a, b) => (b.edition_number || 1) - (a.edition_number || 1)), [article?.id, posts]);
  const selected = useMemo(() => articlePosts.find((post) => post.id === selectedId) || articlePosts[0] || null, [articlePosts, selectedId]);
  const articleActivity = data?.articleActivity?.[article?.id] || { total: 0, published: 0, lastPublishedAt: null };
  const selectedStatus = STATUS[selected?.status] || [selected?.status || "Necunoscut", "draft"];
  const connected = connection?.status === "connected";
  const canPrepare = Boolean(article?.id && article?.status === "published" && connected && (manualOptions.audienceKey !== "custom" || manualOptions.customAudience.trim().length >= 2));
  const textDirty = Boolean(selected && text !== (selected.edited_text || selected.generated_text || ""));
  const publishAmbiguous = ["linkedin_publish_result_unknown", "linkedin_publish_confirmation_missing", "linkedin_publish_confirmation_persistence_failed"].includes(selected?.last_error);

  useEffect(() => {
    const preferred = articlePosts.find((post) => post.id === initialPostId) || articlePosts[0] || null;
    setSelectedId(preferred?.id || "");
    setText(preferred?.edited_text || preferred?.generated_text || "");
    setMessage("");
  }, [article?.id, initialPostId, articlePosts]);

  function patchPost(postId, patch) { setPosts((current) => current.map((post) => post.id === postId ? { ...post, ...patch } : post)); }
  function choose(post) { setSelectedId(post.id); setText(post.edited_text || post.generated_text || ""); setEditorView("edit"); setMessage(""); }
  function showMessage(text, tone = "success") { setMessage(text); setMessageTone(tone); }

  async function saveSettings() {
    if (busy) return;
    setBusy("settings"); setMessage("");
    const configuredDefaults = optionsFromSettings(settings);
    const response = await fetch("/api/admin/linkedin/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ mode: settings.mode, notifyTelegram: settings.notify_telegram, model: normalizeLinkedInModel(settings.model), defaultTemplate: configuredDefaults.templateKey, defaultObjective: configuredDefaults.objectiveKey, defaultVoice: configuredDefaults.voiceKey, defaultAudience: configuredDefaults.audienceKey, defaultCustomAudience: configuredDefaults.audienceKey === "custom" ? configuredDefaults.customAudience : null, defaultCta: configuredDefaults.ctaKey, defaultNarrative: configuredDefaults.narrativeKey, defaultLength: configuredDefaults.lengthKey, defaultLinkPlacement: configuredDefaults.linkPlacementKey }) }).catch(() => null);
    const result = await response?.json().catch(() => ({})); setBusy("");
    if (!response?.ok) return showMessage("Setările nu au putut fi salvate.", "error");
    setSettings(result.settings); showMessage("Setările LinkedIn au fost salvate.");
  }

  async function disconnect() {
    if (!connection || busy || !window.confirm("Deconectezi profilul LinkedIn? Orice publicare viitoare se oprește imediat.")) return;
    setBusy("disconnect"); setMessage("");
    const response = await fetch(`/api/admin/linkedin/connections/${connection.id}/disconnect`, { method: "POST" }).catch(() => null);
    const result = await response?.json().catch(() => ({})); setBusy("");
    if (!response?.ok) return showMessage("Profilul nu a putut fi deconectat.", "error");
    setConnection(result.connection); showMessage("Profilul a fost deconectat. Publicarea este oprită."); router.refresh();
  }

  async function generate() {
    if (!canPrepare || busy) return;
    if (articleActivity.published && !window.confirm(`Acest articol are deja ${articleActivity.published} postări publicate. Creezi o variantă nouă pentru verificare?`)) return;
    setBusy("generate"); showMessage("Analizăm articolul, alegem unghiul și verificăm varianta finală.", "info");
    const response = await fetch(`/api/admin/linkedin/articles/${article.id}/generate`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(manualOptions) }).catch(() => null);
    const result = await response?.json().catch(() => ({})); setBusy("");
    if (!response?.ok || !result?.post || result?.skipped) {
      const skippedMessage = {
        linkedin_not_connected: "Conectează profilul înainte de generare.",
        already_publishing: "O variantă este deja în curs de publicare. Așteaptă confirmarea înainte de o nouă încercare.",
        already_prepared: "Există deja o variantă pregătită pentru acest articol. Selecteaz-o din istoric.",
        already_published: "Varianta selectată este deja publicată. Creează o variantă nouă din secțiunea de generare."
      }[result?.reason];
      return showMessage(skippedMessage || humanError(result?.reason || result?.error) || "Textul nu a putut fi pregătit.", "error");
    }
    const next = { ...result.post, article: { id: article.id, slug: article.slug, title: article.title, status: article.status, published_at: article.published_at } };
    setPosts((current) => [next, ...current.filter((item) => item.id !== next.id)]); choose(next); showMessage("Varianta este pregătită pentru verificare."); router.refresh();
  }

  async function saveText() {
    if (!selected || busy) return;
    setBusy("save"); setMessage("");
    const response = await fetch(`/api/admin/linkedin/posts/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ text }) }).catch(() => null);
    const result = await response?.json().catch(() => ({})); setBusy("");
    if (!response?.ok) return showMessage(humanError(result?.error) || "Textul nu a putut fi salvat.", "error");
    patchPost(selected.id, result.post); showMessage("Textul a fost salvat. Orice aprobare anterioară a fost anulată.");
  }

  async function action(actionName, extra = {}) {
    if (!selected || busy) return;
    setBusy(actionName); setMessage("");
    const response = await fetch(`/api/admin/linkedin/posts/${selected.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action: actionName, ...extra }) }).catch(() => null);
    const result = await response?.json().catch(() => ({})); setBusy("");
    if (!response?.ok || !result?.post || result?.skipped) { showMessage(humanError(result?.reason || result?.error) || "Acțiunea nu a putut fi finalizată.", "error"); router.refresh(); return; }
    patchPost(selected.id, result.post);
    if (!["feedback"].includes(actionName)) setText(result.post.edited_text || result.post.generated_text || text);
    const messages = { approve: "Postarea este aprobată.", reject: "Postarea a fost respinsă și rămâne în istoric.", publish: result.warning ? "Postarea a fost publicată, dar primul comentariu necesită atenție." : "Postarea a fost publicată pe LinkedIn.", retry: "Postarea a fost pregătită din nou pentru aprobare.", retry_comment: "Primul comentariu a fost publicat.", feedback: "Feedbackul a fost salvat." };
    showMessage(messages[actionName] || "Varianta a fost rafinată și a revenit la aprobare.", result.warning ? "warning" : "success"); router.refresh();
  }

  const defaults = optionsFromSettings(settings);
  const finalPayload = selected?.generated_payload?.final || {};
  const quality = selected?.quality_score == null ? null : Number(selected.quality_score);
  const commentAmbiguous = ["linkedin_comment_result_unknown", "linkedin_comment_confirmation_missing"].includes(selected?.link_comment_error);

  return (
    <section className="admin-linkedin-article" aria-labelledby="linkedin-article-title">
      <header className="admin-linkedin-article-head"><div className="admin-linkedin-title-mark"><span className="admin-linkedin-brand-glyph" aria-hidden="true">in</span></div><div><span>Distribuire editorială</span><h3 id="linkedin-article-title">Postări LinkedIn</h3><p>Fiecare variantă păstrează strategia, scorul și istoricul editărilor.</p></div><span className={`admin-linkedin-connection-state is-${connected ? "connected" : "offline"}`}>{connected ? "Conectat" : connection?.status === "connection_expired" ? "Expirat" : "Neconectat"}</span></header>

      <details className="admin-linkedin-settings">
        <summary><Settings2 size={16} />Setări LinkedIn și automatizare</summary>
        <div className="admin-linkedin-controls"><label><span>Mod de lucru</span><select value={settings.mode} disabled={Boolean(busy)} onChange={(event) => setSettings((current) => ({ ...current, mode: event.target.value }))}>{MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label><label className="admin-linkedin-model"><span><Cpu size={14} />Model postare</span><select value={normalizeLinkedInModel(settings.model)} disabled={Boolean(busy)} onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}>{LINKEDIN_MODEL_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label} — {option.description}</option>)}</select></label><button type="button" className="btn-back admin-linkedin-secondary" onClick={saveSettings} disabled={Boolean(busy)}>{busy === "settings" ? <LoaderCircle className="is-spinning" size={16} /> : <Save size={16} />}Salvează setările</button>{connected ? <button type="button" className="admin-linkedin-disconnect" onClick={disconnect} disabled={Boolean(busy)}><Unplug size={16} />Deconectează</button> : <a className={`admin-linkedin-connect${data?.config?.ready ? "" : " is-disabled"}`} href={data?.config?.ready ? "/api/admin/linkedin/oauth/start" : undefined}>Conectează LinkedIn</a>}</div>
        <label className="admin-linkedin-telegram"><input type="checkbox" checked={settings.notify_telegram} disabled={Boolean(busy)} onChange={(event) => setSettings((current) => ({ ...current, notify_telegram: event.target.checked }))} /><span>Notificări Telegram</span></label>
        <LinkedInGenerationOptions value={defaults} onChange={(next) => setSettings((current) => settingsFromOptions(current, next))} disabled={Boolean(busy)} compact />
        {!data?.config?.ready ? <p className="admin-linkedin-config-note"><ShieldCheck size={16} />Completează variabilele LinkedIn și cheia de criptare înainte de conectare.</p> : null}
      </details>

      {data?.warning ? <p className="admin-linkedin-message is-error">{data.warning}</p> : null}
      {message ? <p className={`admin-linkedin-message is-${messageTone}`} role="status" aria-live="polite">{message}</p> : null}

      {article?.status !== "published" ? <div className="admin-linkedin-empty"><strong>Articolul nu este publicat încă</strong><p>Publică articolul mai întâi, apoi pregătește postarea.</p></div> : <>
        <section className="admin-linkedin-generator"><div><span>Strategia următoarei variante</span><strong>Alege intenția. Sistemul selectează un singur unghi și verifică rezultatul.</strong></div><LinkedInGenerationOptions value={manualOptions} onChange={setManualOptions} disabled={!connected || Boolean(busy)} /><div className="admin-linkedin-generator-footer"><div className="admin-linkedin-article-activity"><strong>{articleActivity.published ? `Publicată de ${articleActivity.published} ori` : "Încă nepublicată pe LinkedIn"}</strong><span>O variantă nouă nu modifică postările publicate.</span></div><button type="button" className="btn-link" onClick={generate} disabled={!canPrepare || Boolean(busy)}>{busy === "generate" ? <LoaderCircle className="is-spinning" size={16} /> : <FileText size={16} />}{busy === "generate" ? "Se pregătește…" : articleActivity.total ? "Creează variantă nouă" : "Pregătește postarea"}</button></div></section>
        <AdminGenerationPromptPreview preview={promptPreview ? { ...promptPreview, model: settings.model } : null} />

        {articlePosts.length ? <div className="admin-linkedin-workspace is-article-context"><div className="admin-linkedin-list" role="group" aria-label="Variantele postării LinkedIn">{articlePosts.map((post) => { const status = STATUS[post.status] || [post.status, "draft"]; return <button type="button" key={post.id} className={post.id === selected?.id ? "is-selected" : ""} onClick={() => choose(post)} disabled={Boolean(busy)} aria-pressed={post.id === selected?.id}><span className={`is-${status[1]}`}>{status[0]}</span><strong>Varianta {post.edition_number || 1}</strong><small>{post.quality_score == null ? formatDate(post.updated_at) : `Scor ${Number(post.quality_score).toFixed(1)} · ${formatDate(post.updated_at)}`}</small></button>; })}</div>
          {selected ? <div className="admin-linkedin-editor" aria-busy={Boolean(busy)}>
            <div className="admin-linkedin-editor-head"><div><span className={`admin-linkedin-status is-${selectedStatus[1]}`}>{selectedStatus[0]}</span><small className="admin-linkedin-template-chip">Varianta {selected.edition_number || 1} · {LINKEDIN_POST_TEMPLATES.find((item) => item.key === selected.template_key)?.label || "Format salvat"}</small><h3>{finalPayload.angle || article.title}</h3></div>{selected.status === "published" && selected.linkedin_post_url ? <a href={selected.linkedin_post_url} target="_blank" rel="noreferrer">Deschide pe LinkedIn <ExternalLink size={15} /></a> : null}</div>
            {quality != null ? <div className="admin-linkedin-quality"><span><strong>{quality.toFixed(1)}</strong>/10</span><div><strong>{quality >= 8 ? "Trece pragul editorial" : "Necesită atenție"}</strong><small>Hook, claritate, specificitate, autenticitate și fidelitate față de articol.</small></div></div> : null}
            {selected.generation_warnings?.length ? <details className="admin-linkedin-warnings"><summary>{selected.generation_warnings.length} observații editoriale</summary><ul>{selected.generation_warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></details> : null}
            <div className="admin-linkedin-editor-tabs" role="tablist" aria-label="Editarea postării" onKeyDown={handleTablistKeyDown}><button id="linkedin-editor-tab-edit" type="button" role="tab" aria-selected={editorView === "edit"} aria-controls="linkedin-editor-panel" tabIndex={editorView === "edit" ? 0 : -1} className={editorView === "edit" ? "is-active" : ""} onClick={() => setEditorView("edit")}><FilePenLine size={15} />Editează</button><button id="linkedin-editor-tab-preview" type="button" role="tab" aria-selected={editorView === "preview"} aria-controls="linkedin-editor-panel" tabIndex={editorView === "preview" ? 0 : -1} className={editorView === "preview" ? "is-active" : ""} onClick={() => setEditorView("preview")}><Eye size={15} />Previzualizare</button></div>
            <div id="linkedin-editor-panel" role="tabpanel" aria-labelledby={`linkedin-editor-tab-${editorView}`}>{editorView === "edit" ? <label className="admin-linkedin-text"><span>Textul postării <small className={text.length > 2800 ? "is-warning" : ""}>{text.length}/3.000</small></span><textarea value={text} onChange={(event) => setText(event.target.value)} disabled={["publishing", "published"].includes(selected.status) || Boolean(busy)} rows={14} /></label> : <article className="linkedin-post-preview"><header><span className="admin-linkedin-brand-glyph">in</span><div><strong>{connection?.display_name || "Profil LinkedIn"}</strong><small>Acum · Vizibil pentru oricine</small></div></header><p>{text}</p><footer><span>Apreciază</span><span>Comentează</span><span>Distribuie</span><span>Trimite</span></footer></article>}</div>
            {text.length > 2800 ? <p className="admin-linkedin-length-warning">Te apropii de limita LinkedIn. Mai ai {Math.max(0, 3000 - text.length)} caractere.</p> : null}
            {selected.last_error ? <p className="admin-linkedin-error"><XCircle size={16} />{humanError(selected.last_error)}</p> : null}
            {selected.link_comment_error ? <p className="admin-linkedin-error"><XCircle size={16} />{humanError(selected.link_comment_error)}</p> : null}
            {!['published', 'publishing', 'not_generated'].includes(selected.status) ? <details className="admin-linkedin-refinements"><summary><WandSparkles size={15} />Rafinează varianta</summary><div>{REFINEMENTS.map(([key, label]) => <button type="button" key={key} className="admin-linkedin-secondary" onClick={() => action(key)} disabled={Boolean(busy)}>{busy === key ? <LoaderCircle className="is-spinning" size={15} /> : null}{label}</button>)}</div></details> : null}
            <div className="admin-linkedin-actions">{!["published", "publishing", "not_generated"].includes(selected.status) ? <button type="button" className="btn-back admin-linkedin-secondary" onClick={saveText} disabled={!textDirty || Boolean(busy)}><Save size={16} />{textDirty ? "Salvează textul" : "Text salvat"}</button> : null}{["draft", "pending_approval", "rejected", "failed"].includes(selected.status) && !publishAmbiguous ? <button type="button" className="admin-linkedin-approve" onClick={() => action("approve")} disabled={textDirty || Boolean(busy)}><CheckCircle2 size={16} />Aprobă</button> : null}{["draft", "pending_approval", "approved", "failed"].includes(selected.status) && !publishAmbiguous ? <button type="button" className="admin-linkedin-reject" onClick={() => action("reject")} disabled={Boolean(busy)}><XCircle size={16} />Respinge</button> : null}{selected.status === "approved" ? <button type="button" className="btn-link" onClick={() => action("publish")} disabled={Boolean(busy)}><Send size={16} />{busy === "publish" ? "Se publică…" : "Publică pe LinkedIn"}</button> : null}{selected.status === "failed" && !publishAmbiguous ? <button type="button" className="btn-link" onClick={() => action("retry")} disabled={Boolean(busy)}><RefreshCw size={16} />Reîncearcă</button> : null}{selected.status === "published" && selected.link_comment_status === "failed" && !commentAmbiguous ? <button type="button" className="admin-linkedin-secondary" onClick={() => action("retry_comment")} disabled={Boolean(busy)}>Reîncearcă primul comentariu</button> : null}</div>
            <div className="admin-linkedin-feedback"><span>A fost utilă varianta?</span><button type="button" className={selected.feedback === "up" ? "is-active" : ""} onClick={() => action("feedback", { feedback: "up" })} disabled={Boolean(busy)} aria-label="Feedback pozitiv"><ThumbsUp size={15} /></button><button type="button" className={selected.feedback === "down" ? "is-active" : ""} onClick={() => action("feedback", { feedback: "down" })} disabled={Boolean(busy)} aria-label="Feedback negativ"><ThumbsDown size={15} /></button></div>
            <footer><span>Versiune: {selected.prompt_version || "—"}</span><span>Model: {selected.model || "—"}</span><span>Generată: {formatDate(selected.generated_at)}</span><span>Publicată: {formatDate(selected.published_at)}</span></footer>
          </div> : null}</div> : <div className="admin-linkedin-empty"><strong>Nicio postare pregătită</strong><p>Alege strategia și pregătește prima variantă.</p></div>}
      </>}
    </section>
  );
}
