const DEFAULT_SITE_URL = "https://nota5plus.ro";

export function normalizeSiteUrl(value, fallback = DEFAULT_SITE_URL) {
  const raw = String(value || fallback).trim();
  const absolute = raw.startsWith("http://") || raw.startsWith("https://")
    ? raw
    : `https://${raw}`;

  try {
    return new URL(absolute).origin;
  } catch {
    return new URL(fallback).origin;
  }
}

export function getPublicSiteUrl() {
  return normalizeSiteUrl(process.env.NEXT_PUBLIC_SITE_URL);
}

export function getBaseUrl(request = null) {
  if (request?.url) {
    return new URL("/", request.url).origin;
  }

  const raw =
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.VERCEL_URL ||
    process.env.VERCEL_BRANCH_URL ||
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    "http://localhost:3000";

  return normalizeSiteUrl(raw, "http://localhost:3000");
}
