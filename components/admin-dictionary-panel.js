"use client";

import { BookOpenCheck, RefreshCw, Save } from "lucide-react";
import { useMemo, useState } from "react";

import { AdminEditorialAutomationSettings } from "@/components/admin-editorial-automation-settings";

const splitLines = (value) => String(value || "").split("\n").map((item) => item.trim()).filter(Boolean);

function formFromTerm(term) {
  return {
    status: term.status,
    categoryId: term.category_id,
    term: term.term,
    shortDefinition: term.short_definition,
    simpleExplanation: term.simple_explanation,
    analogy: term.analogy || "",
    example: term.example,
    whyItMatters: term.why_it_matters,
    howToApply: (term.how_to_apply || []).join("\n"),
    faqs: JSON.stringify(term.faqs || [], null, 2),
    ctaType: term.cta_type,
    synonyms: (term.synonyms || []).join(", ")
  };
}

export function AdminDictionaryPanel({ categories = [], terms = [], runs = [], automationSettings, warning }) {
  const [selectedId, setSelectedId] = useState(terms[0]?.id || "");
  const selected = useMemo(() => terms.find((term) => term.id === selectedId) || null, [selectedId, terms]);
  const [form, setForm] = useState(() => selected ? formFromTerm(selected) : null);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const setField = (key, value) => setForm((current) => ({ ...current, [key]: value }));

  function select(term) {
    setSelectedId(term.id);
    setForm(formFromTerm(term));
    setMessage("");
  }

  async function save() {
    if (!selected || !form) return;
    let faqs;
    try {
      faqs = JSON.parse(form.faqs);
    } catch {
      setMessage("Întrebările frecvente trebuie să aibă format JSON valid.");
      return;
    }
    setSaving(true);
    setMessage("");
    const response = await fetch(`/api/admin/dictionary/terms/${selected.id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ ...form, analogy: form.analogy || null, howToApply: splitLines(form.howToApply), faqs, synonyms: form.synonyms.split(",").map((item) => item.trim()).filter(Boolean) })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setSaving(false);
    setMessage(response?.ok ? "Salvat. Reîncarcă pagina pentru lista actualizată." : result?.error === "quality_check_failed" ? "Conținutul nu a trecut verificarea de calitate." : "Nu am putut salva modificările.");
  }

  async function generate() {
    setGenerating(true);
    setMessage("");
    const response = await fetch("/api/admin/dictionary/generate", { method: "POST" }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setGenerating(false);
    setMessage(response?.ok ? `Termenul „${result?.term?.term || "nou"}” a fost publicat. Reîncarcă pagina pentru editare.` : "Generarea nu s-a finalizat. Verifică istoricul de mai jos.");
  }

  return (
    <section className="surface admin-dictionary-panel">
      <div className="admin-content-toolbar">
        <AdminEditorialAutomationSettings workflow="dictionary" settings={automationSettings} />
        <button type="button" className="btn-link" onClick={generate} disabled={generating}><RefreshCw size={16} className={generating ? "is-spinning" : ""} />{generating ? "Se pregătește…" : "Generează un termen"}</button>
      </div>
      {warning ? <p className="admin-dictionary-message is-error">{warning}</p> : null}
      {message ? <p className="admin-dictionary-message">{message}</p> : null}
      <div className="admin-dictionary-grid">
        <div className="admin-dictionary-list">
          {terms.map((term) => <button type="button" key={term.id} className={term.id === selectedId ? "is-selected" : ""} onClick={() => select(term)}><BookOpenCheck size={16} /><span><strong>{term.term}</strong><small>{term.status === "published" ? "Publicat" : term.status}</small></span></button>)}
        </div>
        {selected && form ? <div className="admin-dictionary-editor">
          <div className="admin-dictionary-row"><label>Termen<input value={form.term} onChange={(event) => setField("term", event.target.value)} /></label><label>Categorie<select value={form.categoryId} onChange={(event) => setField("categoryId", event.target.value)}>{categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label><label>Status<select value={form.status} onChange={(event) => setField("status", event.target.value)}><option value="draft">Ciornă</option><option value="published">Publicat</option><option value="withdrawn">Retras</option><option value="rejected">Respins</option></select></label></div>
          <label>Definiție scurtă<textarea value={form.shortDefinition} onChange={(event) => setField("shortDefinition", event.target.value)} /></label><label>Explicație simplă<textarea value={form.simpleExplanation} onChange={(event) => setField("simpleExplanation", event.target.value)} /></label><label>Analogie<textarea value={form.analogy} onChange={(event) => setField("analogy", event.target.value)} /></label><label>Exemplu<textarea value={form.example} onChange={(event) => setField("example", event.target.value)} /></label><label>De ce contează<textarea value={form.whyItMatters} onChange={(event) => setField("whyItMatters", event.target.value)} /></label><label>Pași <small>un pas pe rând</small><textarea value={form.howToApply} onChange={(event) => setField("howToApply", event.target.value)} /></label><label>Sinonime <small>separate prin virgulă</small><input value={form.synonyms} onChange={(event) => setField("synonyms", event.target.value)} /></label><label>Întrebări frecvente <small>format JSON</small><textarea className="admin-dictionary-json" value={form.faqs} onChange={(event) => setField("faqs", event.target.value)} /></label>
          <div className="admin-dictionary-actions"><button type="button" className="btn-link" onClick={save} disabled={saving}><Save size={16} />{saving ? "Se salvează…" : "Salvează"}</button><a href={`/dictionar/${selected.slug}`} target="_blank" rel="noreferrer">Vezi pagina publică</a></div>
        </div> : <div className="admin-dictionary-editor is-empty">Alege un termen pentru editare.</div>}
      </div>
      <details className="admin-run-history"><summary>Istoric ({runs.length})</summary>{runs.length ? <div className="admin-dictionary-runs">{runs.map((run) => <article key={run.id}><strong>{run.candidate_term || "Fără termen"}</strong><span>{run.trigger_source === "cron" ? "Programat" : "Manual"} · {run.status} · {run.model || "model necunoscut"}</span>{run.error_message ? <small>{run.error_message}</small> : null}</article>)}</div> : <p>Nu există rulări încă.</p>}</details>
    </section>
  );
}
