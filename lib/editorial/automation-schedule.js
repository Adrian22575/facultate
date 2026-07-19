export function dateInBucharest(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(date);
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
  if (hourInBucharest(date) < Number(settings.scheduled_hour ?? 10)) return false;
  const today = dateInBucharest(date);
  const previous = String(settings.last_scheduled_for || "");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(previous)) return true;
  const elapsed = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86_400_000);
  return elapsed >= Number(settings.frequency_days || 1);
}
