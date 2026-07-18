"use client";

import { BellRing, CalendarClock, Check, Cpu, LoaderCircle, Power, Save } from "lucide-react";
import { useState } from "react";

const MODEL_OPTIONS = [
  ["gpt-5.6-sol", "GPT-5.6 Sol — calitate maximă"],
  ["gpt-5.6-terra", "GPT-5.6 Terra — echilibru calitate/cost"],
  ["gpt-5.6-luna", "GPT-5.6 Luna — volum mare, cost redus"],
  ["gpt-5.4", "GPT-5.4 — echilibru"],
  ["gpt-5.4-mini", "GPT-5.4 mini — mai rapid"]
];

function initialState(workflow, settings) {
  return {
    enabled: settings?.enabled ?? true,
    frequencyDays: String(settings?.frequency_days ?? (workflow === "editorial" ? 7 : 1)),
    model: settings?.model ?? "gpt-5.4",
    notifyTelegram: settings?.notify_telegram ?? true
  };
}

function frequencyCopy(value) {
  const days = Number(value || 1);
  if (days === 1) return "o dată pe zi";
  if (days === 7) return "o dată pe săptămână";
  return `o dată la ${days} zile`;
}

export function AdminEditorialAutomationSettings({ workflow, settings }) {
  const [form, setForm] = useState(() => initialState(workflow, settings));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const title = workflow === "dictionary" ? "Termen nou" : "Articol nou";

  async function save() {
    setSaving(true);
    setStatus("");
    const response = await fetch(`/api/admin/editorial/automation/${workflow}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: form.enabled,
        frequencyDays: Number(form.frequencyDays),
        model: form.model,
        notifyTelegram: form.notifyTelegram
      })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setSaving(false);
    if (!response?.ok) {
      setStatus("Nu am putut salva setările. Încearcă din nou.");
      return;
    }
    setForm(initialState(workflow, result.settings));
    setStatus("Setările au fost salvate.");
  }

  return (
    <section className="admin-automation-card" aria-label={`Automatizare ${title.toLowerCase()}`}>
      <div className="admin-automation-title">
        <div className="admin-automation-icon"><CalendarClock size={19} /></div>
        <div>
          <span className="ui-section-label">Rulare automată</span>
          <h3>{title}</h3>
          <p>Verificarea programului are loc zilnic. Alegi cât de des se pornește o generare nouă.</p>
        </div>
        <span className={form.enabled ? "admin-automation-state is-on" : "admin-automation-state"}>{form.enabled ? "Activă" : "Oprită"}</span>
      </div>

      <div className="admin-automation-controls">
        <label className="admin-automation-toggle">
          <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
          <span><Power size={16} />Generează automat</span>
        </label>
        <label>
          <span><CalendarClock size={16} />Frecvență</span>
          <select value={form.frequencyDays} disabled={!form.enabled} onChange={(event) => setForm((current) => ({ ...current, frequencyDays: event.target.value }))}>
            <option value="1">O dată pe zi</option>
            <option value="2">O dată la 2 zile</option>
            <option value="3">O dată la 3 zile</option>
            <option value="7">O dată pe săptămână</option>
            <option value="14">O dată la 2 săptămâni</option>
          </select>
        </label>
        <label>
          <span><Cpu size={16} />Model de generare</span>
          <select value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}>
            {MODEL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="admin-automation-toggle">
          <input type="checkbox" checked={form.notifyTelegram} onChange={(event) => setForm((current) => ({ ...current, notifyTelegram: event.target.checked }))} />
          <span><BellRing size={16} />Rezumat pe Telegram</span>
        </label>
      </div>

      <div className="admin-automation-footer">
        <p>{form.enabled ? `Program: ${frequencyCopy(form.frequencyDays)}.` : "Programarea automată este oprită. Generarea manuală rămâne disponibilă."}</p>
        <button type="button" className="btn-link" onClick={save} disabled={saving}>
          {saving ? <LoaderCircle size={16} className="is-spinning" /> : status ? <Check size={16} /> : <Save size={16} />}
          {saving ? "Se salvează…" : "Salvează setările"}
        </button>
      </div>
      {status ? <p className="admin-automation-message">{status}</p> : null}
    </section>
  );
}
