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

export function weekdayInBucharest(date = new Date()) {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Bucharest",
    weekday: "short"
  }).format(date);
  return { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[weekday] || null;
}

export function isAutomationDue(settings, date = new Date()) {
  if (!settings?.enabled) return false;
  if (hourInBucharest(date) < Number(settings.scheduled_hour ?? 10)) return false;
  const today = dateInBucharest(date);
  const previous = String(settings.last_scheduled_for || "");
  const frequencyDays = Number(settings.frequency_days || 1);

  if (frequencyDays === 7) {
    const weeklyDay = Number(settings.weekly_day);
    if (!Number.isInteger(weeklyDay) || weeklyDay < 1 || weeklyDay > 7) return false;
    return weekdayInBucharest(date) === weeklyDay && previous !== today;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(previous)) return true;
  const elapsed = Math.floor((Date.parse(`${today}T00:00:00Z`) - Date.parse(`${previous}T00:00:00Z`)) / 86_400_000);
  return elapsed >= frequencyDays;
}
