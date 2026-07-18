import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export const AUTOMATION_WORKFLOWS = ["dictionary", "editorial"];
export const AUTOMATION_MODELS = ["gpt-5.6-sol", "gpt-5.6-terra", "gpt-5.6-luna", "gpt-5.4", "gpt-5.4-mini"];

const DEFAULTS = {
  dictionary: { workflow: "dictionary", enabled: true, frequency_days: 1, scheduled_hour: 10, model: "gpt-5.4", notify_telegram: true, last_scheduled_for: null },
  editorial: { workflow: "editorial", enabled: true, frequency_days: 7, scheduled_hour: 10, model: "gpt-5.4", notify_telegram: true, last_scheduled_for: null }
};

export function dateInBucharest(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
}

export function defaultAutomationSettings(workflow) {
  return { ...DEFAULTS[workflow] };
}

export function hourInBucharest(date = new Date()) {
  return Number(new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/Bucharest",
    hour: "2-digit",
    hourCycle: "h23"
  }).format(date));
}

export function isAutomationDue(settings, date = new Date()) {
  if (!settings?.enabled) return false;
  if (hourInBucharest(date) !== Number(settings.scheduled_hour ?? 10)) return false;
  const today = dateInBucharest(date);
  const previous = String(settings.last_scheduled_for || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(previous)) return true;
  const elapsed = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86_400_000);
  return elapsed >= Number(settings.frequency_days || 1);
}

export async function getAutomationSettings(workflow, admin = createAdminClient()) {
  if (!AUTOMATION_WORKFLOWS.includes(workflow)) throw new Error("invalid_automation_workflow");
  const { data, error } = await admin
    .from("editorial_automation_settings")
    .select("workflow, enabled, frequency_days, scheduled_hour, model, notify_telegram, last_scheduled_for, updated_at")
    .eq("workflow", workflow)
    .maybeSingle();
  if (error) throw error;
  return data || defaultAutomationSettings(workflow);
}

export async function markAutomationScheduled(workflow, date, admin = createAdminClient()) {
  const { error } = await admin
    .from("editorial_automation_settings")
    .update({ last_scheduled_for: date })
    .eq("workflow", workflow);
  if (error) throw error;
}
