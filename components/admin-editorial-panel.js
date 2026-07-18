"use client";

import { FilePenLine, FlaskConical, Save, Send, ShieldCheck } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEditorialAutomationSettings } from "@/components/admin-editorial-automation-settings";

function formFrom(article) {
  return { title: article.title, subtitle: article.subtitle || "", summary: article.summary, primaryTopic: article.primary_topic, categories: (article.categories || []).join(", "), keyTakeaways: JSON.stringify(article.key_takeaways || [], null, 2), sections: JSON.stringify(article.sections || [], null, 2), studentImplications: JSON.stringify(article.student_implications || [], null, 2), weeklyTerm: JSON.stringify(article.weekly_term || {}, null, 2), conclusion: article.conclusion, sources: JSON.stringify(article.sources || [], null, 2), internalLinks: JSON.stringify(article.internal_links || [], null, 2), seoTitle: article.seo_title, metaDescription: article.meta_description, socialDescription: article.social_description, correctionNote: article.correction_note || "" };
}

function parseJson(value, label) {
  try { return JSON.parse(value); } catch { throw new Error(`${label} trebuie să fie JSON valid.`); }
}

export function AdminEditorialPanel({ articles = [], runs = [], automationSettings, warning }) {
  const [selectedId, setSelectedId] = useState(articles[0]?.id || "");
  const selected = useMemo(() => articles.find((article) => article.id === selectedId) || null, [articles, selectedId]);
  const [form, setForm] = useState(() => selected ? formFrom(selected) : null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState("");

  function select(article) {
    setSelectedId(article.id);
    setForm(formFrom(article));
    setMessage("");
  }

  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  async function generateDraft() {
    setBusy("generate");
    setMessage("");
    const response = await fetch("/api/admin/editorial/generate", { method: "POST" }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    setMessage(response?.ok ? "Ciorna a fost creată. Reîncarcă pagina pentru a o edita sau publica." : result?.reason === "research_validation_failed" ? "Cercetarea nu a avut suficiente surse verificabile. Detaliile sunt în istoric." : "Rularea nu s-a finalizat. Verifică istoricul.");
  }

  async function runAction(action) {
    if (!selected) return;
    setBusy(action);
    setMessage("");
    const response = await fetch(`/api/admin/editorial/articles/${selected.id}/actions`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ action }) }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    setMessage(response?.ok ? (action === "fact_check" ? `Verificare terminată: ${result.factCheckStatus === "passed" ? "trecută" : "necesită corecturi"}.` : action === "publish" ? "Articol publicat. Reîncarcă pagina." : "Articol retras din zona publică.") : result?.error === "publication_quality_not_met" ? "Publicarea rămâne blocată până trece verificarea și scorul este cel puțin 85." : "Acțiunea nu a reușit.");
  }

  async function save() {
    if (!selected || !form) return;
    setBusy("save");
    setMessage("");
    try {
      const body = { ...form, categories: form.categories.split(",").map((item) => item.trim()).filter(Boolean), keyTakeaways: parseJson(form.keyTakeaways, "Ideile principale"), sections: parseJson(form.sections, "Secțiunile"), studentImplications: parseJson(form.studentImplications, "Implicațiile"), weeklyTerm: parseJson(form.weeklyTerm, "Termenul săptămânii"), sources: parseJson(form.sources, "Sursele"), internalLinks: parseJson(form.internalLinks, "Linkurile interne"), correctionNote: form.correctionNote || null };
      const response = await fetch(`/api/admin/editorial/articles/${selected.id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({}));
      setMessage(response.ok ? "Salvat. Reîncarcă pagina pentru conținutul actualizat." : result?.error === "unknown_source_reference" ? "O secțiune folosește un ID de sursă care nu există în lista de surse." : "Nu am putut salva. Verifică structura JSON.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Date invalide.");
    } finally {
      setBusy("");
    }
  }

  return (
    <section className="surface admin-editorial-panel">
      <div className="admin-editorial-head">
        <div><span className="ui-section-label">Articole publice</span><h2>Cercetare, verificare și publicare</h2><p>O rulare manuală creează doar o ciornă. Publicarea rămâne blocată până când verificarea trece și scorul este cel puțin 85.</p></div>
        <button type="button" className="btn-link" onClick={generateDraft} disabled={Boolean(busy)}><FlaskConical size={16} />{busy === "generate" ? "Se cercetează…" : "Testează cercetarea"}</button>
      </div>
      <AdminEditorialAutomationSettings workflow="editorial" settings={automationSettings} />
      {warning ? <p className="admin-dictionary-message is-error">{warning}</p> : null}
      {message ? <p className="admin-dictionary-message">{message}</p> : null}
      <div className="admin-editorial-layout">
        <div className="admin-editorial-list">{articles.map((article) => <button type="button" key={article.id} className={article.id === selectedId ? "is-selected" : ""} onClick={() => select(article)}><FilePenLine size={16} /><span><strong>{article.title}</strong><small>{article.status} · {article.quality_score}/100</small></span></button>)}</div>
        {selected && form ? <div className="admin-editorial-editor">
          <div className="admin-editorial-row"><label>Titlu<input value={form.title} onChange={(event) => setField("title", event.target.value)} /></label><label>Subiect<input value={form.primaryTopic} onChange={(event) => setField("primaryTopic", event.target.value)} /></label></div>
          <label>Subtitlu<textarea value={form.subtitle} onChange={(event) => setField("subtitle", event.target.value)} /></label><label>Rezumat<textarea value={form.summary} onChange={(event) => setField("summary", event.target.value)} /></label>
          <div className="admin-editorial-row"><label>Categorii <small>separate prin virgulă</small><input value={form.categories} onChange={(event) => setField("categories", event.target.value)} /></label><label>Notă de corecție <small>opțional</small><input value={form.correctionNote} onChange={(event) => setField("correctionNote", event.target.value)} /></label></div>
          <details><summary>Conținut editorial, surse și SEO</summary><div><label>Idei principale <textarea value={form.keyTakeaways} onChange={(event) => setField("keyTakeaways", event.target.value)} /></label><label>Secțiuni <textarea value={form.sections} onChange={(event) => setField("sections", event.target.value)} /></label><label>Implicații pentru elevi și studenți <textarea value={form.studentImplications} onChange={(event) => setField("studentImplications", event.target.value)} /></label><label>Termenul săptămânii <textarea value={form.weeklyTerm} onChange={(event) => setField("weeklyTerm", event.target.value)} /></label><label>Concluzie<textarea value={form.conclusion} onChange={(event) => setField("conclusion", event.target.value)} /></label><label>Surse <small>poți adăuga sau elimina obiecte; fiecare secțiune trebuie să păstreze ID-uri valide</small><textarea value={form.sources} onChange={(event) => setField("sources", event.target.value)} /></label><label>Linkuri interne<textarea value={form.internalLinks} onChange={(event) => setField("internalLinks", event.target.value)} /></label><label>Titlu SEO<input value={form.seoTitle} onChange={(event) => setField("seoTitle", event.target.value)} /></label><label>Descriere SEO<textarea value={form.metaDescription} onChange={(event) => setField("metaDescription", event.target.value)} /></label><label>Descriere distribuire<textarea value={form.socialDescription} onChange={(event) => setField("socialDescription", event.target.value)} /></label></div></details>
          <div className="admin-editorial-actions"><button type="button" className="btn-link" onClick={save} disabled={Boolean(busy)}><Save size={16} />{busy === "save" ? "Se salvează…" : "Salvează"}</button><button type="button" className="btn-back" onClick={() => runAction("fact_check")} disabled={Boolean(busy)}><ShieldCheck size={16} />{busy === "fact_check" ? "Se verifică…" : "Verifică faptele"}</button><button type="button" className="btn-link" onClick={() => runAction("publish")} disabled={Boolean(busy)}><Send size={16} />Publică</button><button type="button" className="btn-text" onClick={() => runAction("withdraw")} disabled={Boolean(busy)}>Retrage</button><a href={`/articole/${selected.slug}`} target="_blank" rel="noreferrer">Vezi pagina</a></div>
        </div> : <div className="admin-editorial-editor is-empty">Alege un articol pentru editare.</div>}
      </div>
      <div className="admin-editorial-runs"><h3>Istoric rulări</h3>{runs.length ? runs.map((run) => <article key={run.id}><strong>{run.run_date || `${run.week_start} – ${run.week_end}`}</strong><span>{run.trigger_source === "cron" ? "Programat" : "Manual"} · {run.status} · {run.model || "model necunoscut"} · {run.quality_score ?? "—"}/100</span>{run.rejection_reason || run.error_message ? <small>{run.rejection_reason || run.error_message}</small> : null}</article>) : <p>Nu există rulări încă.</p>}</div>
    </section>
  );
}
