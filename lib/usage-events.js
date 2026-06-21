const SAFE_QUERY_KEYS = new Set([
  "examType",
  "mode",
  "ref",
  "section",
  "source",
  "sync",
  "tab",
  "view",
  "welcome"
]);
const SAFE_QUERY_VALUE = /^[a-z0-9_-]{1,40}$/i;
const UUID_SEGMENT = /\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}(?=\/|$)/gi;

export function sanitizeUsagePath(value) {
  const raw = String(value || "").trim();
  if (!raw.startsWith("/")) return null;

  const pathname = raw.split(/[?#]/, 1)[0].slice(0, 300);
  if (pathname.startsWith("/r/")) return "/r/[code]";

  return pathname.replace(UUID_SEGMENT, "/[id]");
}

export function sanitizeUsageQuery(value) {
  const raw = String(value || "").trim().replace(/^\?/, "");
  if (!raw) return null;

  const safe = new URLSearchParams();
  const source = new URLSearchParams(raw);

  for (const [key, queryValue] of source.entries()) {
    if (!SAFE_QUERY_KEYS.has(key) || !SAFE_QUERY_VALUE.test(queryValue)) continue;
    safe.set(key, queryValue);
  }

  const serialized = safe.toString();
  return serialized ? `?${serialized}` : null;
}
