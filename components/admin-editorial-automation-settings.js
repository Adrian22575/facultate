"use client";

import { BellRing, Check, Cpu, LoaderCircle, Save } from "lucide-react";
import { useState } from "react";

const MODEL_OPTIONS = [
  ["gpt-5.6-sol", "GPT-5.6 Sol"],
  ["gpt-5.6-terra", "GPT-5.6 Terra"],
  ["gpt-5.6-luna", "GPT-5.6 Luna"],
  ["gpt-5.4", "GPT-5.4"],
  ["gpt-5.4-mini", "GPT-5.4 mini"]
];

function initialState(workflow, settings) {
  return {
    enabled: settings?.enabled ?? true,
    scheduledHour: String(settings?.scheduled_hour ?? 10),
    frequencyDays: String(settings?.frequency_days ?? (workflow === "editorial" ? 7 : 1)),
    model: settings?.model ?? "gpt-5.4",
    notifyTelegram: settings?.notify_telegram ?? true
  };
}

const hourLabel = (value) => `${String(value).padStart(2, "0")}:00`;

export function AdminEditorialAutomationSettings({ workflow, settings }) {
  const [form, setForm] = useState(() => initialState(workflow, settings));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    setStatus("");
    const response = await fetch(`/api/admin/editorial/automation/${workflow}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: form.enabled,
        scheduledHour: Number(form.scheduledHour),
        frequencyDays: Number(form.frequencyDays),
        model: form.model,
        notifyTelegram: form.notifyTelegram
      })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setSaving(false);
    if (!response?.ok) {
      setStatus("Setările nu au putut fi salvate. Încearcă din nou.");
      return;
    }
    setForm(initialState(workflow, result.settings));
    setStatus("Salvat.");
  }

  return (
    <div className="admin-automation-compact" aria-label="Programare automată">
      <label className="admin-automation-switch">
        <input type="checkbox" checked={form.enabled} onChange={(event) => setForm((current) => ({ ...current, enabled: event.target.checked }))} />
        <span>Automat</span>
      </label>
      <label>
        <span>Ora (România)</span>
        <select value={form.scheduledHour} disabled={!form.enabled} onChange={(event) => setForm((current) => ({ ...current, scheduledHour: event.target.value }))}>
          {Array.from({ length: 24 }, (_, hour) => <option key={hour} value={hour}>{hourLabel(hour)}</option>)}
        </select>
      </label>
      <label>
        <span>Frecvență</span>
        <select value={form.frequencyDays} disabled={!form.enabled} onChange={(event) => setForm((current) => ({ ...current, frequencyDays: event.target.value }))}>
          <option value="1">Zilnic</option>
          <option value="2">La 2 zile</option>
          <option value="3">La 3 zile</option>
          <option value="7">Săptămânal</option>
          <option value="14">La 2 săptămâni</option>
        </select>
      </label>
      <label>
        <span><Cpu size={14} />Model</span>
        <select value={form.model} onChange={(event) => setForm((current) => ({ ...current, model: event.target.value }))}>
          {MODEL_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label>
      <label className="admin-automation-switch">
        <input type="checkbox" checked={form.notifyTelegram} onChange={(event) => setForm((current) => ({ ...current, notifyTelegram: event.target.checked }))} />
        <span><BellRing size={14} />Telegram</span>
      </label>
      <button type="button" className="btn-link" onClick={save} disabled={saving}>
        {saving ? <LoaderCircle size={16} className="is-spinning" /> : status ? <Check size={16} /> : <Save size={16} />}
        {saving ? "Se salvează…" : "Salvează"}
      </button>
      {status ? <span className="admin-automation-compact-message" role="status">{status}</span> : null}
    </div>
  );
}
