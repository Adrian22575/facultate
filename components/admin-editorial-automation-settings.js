"use client";

import { BellRing, Check, Cpu, Save } from "lucide-react";
import { useState } from "react";

import { AdminGenerationPromptPreview } from "@/components/admin-generation-prompt-preview";
import { LoadingSpinner } from "@/components/loading-spinner";

const MODEL_OPTIONS = [
  ["gpt-5.6-sol", "GPT-5.6 Sol"],
  ["gpt-5.6-terra", "GPT-5.6 Terra"],
  ["gpt-5.6-luna", "GPT-5.6 Luna"],
  ["gpt-5.4", "GPT-5.4"],
  ["gpt-5.4-mini", "GPT-5.4 mini"]
];

const WEEKDAY_OPTIONS = [
  ["1", "Luni"],
  ["2", "Marți"],
  ["3", "Miercuri"],
  ["4", "Joi"],
  ["5", "Vineri"],
  ["6", "Sâmbătă"],
  ["7", "Duminică"]
];

function initialState(workflow, settings) {
  return {
    enabled: settings?.enabled ?? true,
    scheduledHour: String(settings?.scheduled_hour ?? 10),
    frequencyDays: String(settings?.frequency_days ?? (workflow === "editorial" ? 7 : 1)),
    weeklyDay: settings?.weekly_day == null ? "" : String(settings.weekly_day),
    lastScheduledFor: settings?.last_scheduled_for ?? null,
    model: settings?.model ?? "gpt-5.4",
    notifyTelegram: settings?.notify_telegram ?? true
  };
}

const hourLabel = (value) => `${String(value).padStart(2, "0")}:00`;

function nextWeeklyPublication(weeklyDay, scheduledHour, lastScheduledFor) {
  if (!weeklyDay) return "Alege ziua pentru a stabili următoarea publicare.";
  const now = new Date();
  const dateParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(now).reduce((parts, item) => ({ ...parts, [item.type]: item.value }), {});
  const weekday = new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Bucharest", weekday: "short" }).format(now);
  const weekdayNumber = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[weekday];
  let daysUntil = (Number(weeklyDay) - weekdayNumber + 7) % 7;
  const today = `${dateParts.year}-${dateParts.month}-${dateParts.day}`;
  const currentHour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/Bucharest", hour: "2-digit", hourCycle: "h23" }).format(now));
  if (daysUntil === 0 && (currentHour >= Number(scheduledHour) || lastScheduledFor === today)) daysUntil = 7;
  const nextDate = new Date(Date.UTC(Number(dateParts.year), Number(dateParts.month) - 1, Number(dateParts.day) + daysUntil, 12));
  const label = new Intl.DateTimeFormat("ro-RO", { timeZone: "Europe/Bucharest", weekday: "long", day: "numeric", month: "long" }).format(nextDate);
  return `Următoarea publicare: ${label}, la ${hourLabel(scheduledHour)} (ora României).`;
}

export function AdminEditorialAutomationSettings({ workflow, settings, generationPreview }) {
  const [form, setForm] = useState(() => initialState(workflow, settings));
  const [status, setStatus] = useState("");
  const [saving, setSaving] = useState(false);
  const weeklySchedule = form.frequencyDays === "7";
  const nextPublication = weeklySchedule
    ? nextWeeklyPublication(form.weeklyDay, form.scheduledHour, form.lastScheduledFor)
    : null;

  async function save() {
    if (weeklySchedule && !form.weeklyDay) {
      setStatus("Alege ziua săptămânii pentru programarea săptămânală.");
      return;
    }

    setSaving(true);
    setStatus("");
    const response = await fetch(`/api/admin/editorial/automation/${workflow}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        enabled: form.enabled,
        scheduledHour: Number(form.scheduledHour),
        frequencyDays: Number(form.frequencyDays),
        weeklyDay: weeklySchedule ? Number(form.weeklyDay) : null,
        model: form.model,
        notifyTelegram: form.notifyTelegram
      })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setSaving(false);
    if (!response?.ok) {
      setStatus(result?.error === "scheduler_sync_failed" ? "Programarea tehnică nu a putut fi sincronizată. Setările nu au fost schimbate." : result?.error === "invalid_payload" ? "Verifică ziua selectată pentru programarea săptămânală." : "Setările nu au putut fi salvate. Încearcă din nou.");
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
      {weeklySchedule ? <label>
        <span>Ziua săptămânii</span>
        <select value={form.weeklyDay} disabled={!form.enabled} onChange={(event) => setForm((current) => ({ ...current, weeklyDay: event.target.value }))}>
          <option value="">Alege ziua</option>
          {WEEKDAY_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
      </label> : null}
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
        {saving ? <LoadingSpinner size={16} /> : status ? <Check size={16} /> : <Save size={16} />}
        {saving ? "Se salvează…" : "Salvează"}
      </button>
      {status ? <span className="admin-automation-compact-message" role="status">{status}</span> : null}
      {nextPublication ? <span className="admin-automation-next-publication" role="status">{nextPublication}</span> : null}
      <AdminGenerationPromptPreview preview={generationPreview ? { ...generationPreview, model: form.model } : null} />
    </div>
  );
}
