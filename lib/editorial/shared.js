import { createHash } from "node:crypto";

import { z } from "zod";

export const EDITORIAL_MODEL = process.env.OPENAI_EDITORIAL_MODEL?.trim() || "gpt-5.4";
export const EDITORIAL_QUALITY_THRESHOLD = 85;
export const EDITORIAL_CATEGORIES = ["Politici educaționale", "Învățare și cercetare", "Tehnologie educațională", "Evaluare și examene", "Acces și bunăstare", "Competențe și carieră"];

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

export const editorialSourceSchema = z.object({
  id: z.string().trim().min(2).max(80),
  url: z.string().trim().regex(/^https?:\/\//).max(1200),
  title: z.string().trim().min(8).max(300),
  publisher: z.string().trim().min(2).max(160),
  author: z.string().trim().max(160).nullable(),
  publishedAt: isoDate.nullable(),
  eventDate: isoDate.nullable(),
  sourceType: z.enum(["primary", "research", "official", "journalism", "context"]),
  region: z.enum(["Romania", "Europa", "Internațional"]),
  supports: z.array(z.string().trim().min(12).max(360)).min(1).max(8),
  relevance: z.number().int().min(0).max(10),
  importance: z.number().int().min(0).max(10),
  recency: z.number().int().min(0).max(10),
  credibility: z.number().int().min(0).max(10),
  usefulness: z.number().int().min(0).max(10),
  primarySourceUrl: z.string().trim().regex(/^https?:\/\//).max(1200).nullable(),
  risks: z.array(z.string().trim().min(4).max(240)).max(5)
});

export const researchSchema = z.object({
  sources: z.array(editorialSourceSchema).min(8).max(28),
  candidateTopics: z.array(z.object({
    title: z.string().trim().min(12).max(190),
    summary: z.string().trim().min(40).max(700),
    sourceIds: z.array(z.string().trim().min(2).max(80)).min(1).max(6),
    category: z.enum(EDITORIAL_CATEGORIES),
    relevance: z.number().int().min(0).max(10),
    importance: z.number().int().min(0).max(10),
    recency: z.number().int().min(0).max(10),
    credibility: z.number().int().min(0).max(10),
    usefulness: z.number().int().min(0).max(10),
    riskNote: z.string().trim().max(300).nullable()
  })).min(5).max(12)
});

export const articlePlanSchema = z.object({
  title: z.string().trim().min(20).max(180),
  subtitle: z.string().trim().min(30).max(320),
  primaryTopic: z.string().trim().min(4).max(120),
  categories: z.array(z.enum(EDITORIAL_CATEGORIES)).min(1).max(3),
  keyTakeaways: z.array(z.string().trim().min(18).max(250)).min(3).max(5),
  selectedTopicTitles: z.array(z.string().trim().min(12).max(190)).min(3).max(5),
  studentImplications: z.array(z.string().trim().min(18).max(300)).min(2).max(6),
  weeklyTerm: z.object({ term: z.string().trim().min(3).max(100), explanation: z.string().trim().min(30).max(420), dictionarySlug: z.string().trim().regex(/^[a-z0-9-]+$/).nullable() })
});

const sectionSchema = z.object({
  title: z.string().trim().min(10).max(180),
  content: z.string().trim().min(180).max(5000),
  keyClaims: z.array(z.string().trim().min(20).max(500)).min(1).max(6),
  sourceIds: z.array(z.string().trim().min(2).max(80)).min(1).max(6),
  implication: z.string().trim().min(25).max(550),
  limitations: z.string().trim().min(15).max(450)
});

export const articleDraftSchema = z.object({
  title: z.string().trim().min(20).max(180),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/).min(12).max(160),
  subtitle: z.string().trim().min(30).max(320),
  summary: z.string().trim().min(120).max(1400),
  primaryTopic: z.string().trim().min(4).max(120),
  categories: z.array(z.enum(EDITORIAL_CATEGORIES)).min(1).max(3),
  keyTakeaways: z.array(z.string().trim().min(18).max(250)).min(3).max(5),
  sections: z.array(sectionSchema).min(3).max(5),
  studentImplications: z.array(z.string().trim().min(18).max(300)).min(2).max(6),
  weeklyTerm: z.object({ term: z.string().trim().min(3).max(100), explanation: z.string().trim().min(30).max(420), dictionarySlug: z.string().trim().regex(/^[a-z0-9-]+$/).nullable() }),
  conclusion: z.string().trim().min(60).max(1800),
  internalLinks: z.array(z.object({ label: z.string().trim().min(3).max(90), href: z.string().trim().regex(/^\//).max(240), context: z.string().trim().max(240) })).max(4),
  seoTitle: z.string().trim().min(20).max(70),
  metaDescription: z.string().trim().min(70).max(180),
  socialDescription: z.string().trim().min(70).max(220),
  imagePrompt: z.string().trim().min(20).max(400)
});

export const factCheckSchema = z.object({
  passed: z.boolean(),
  sourceCoverage: z.number().int().min(0).max(100),
  factualAccuracy: z.number().int().min(0).max(100),
  clarity: z.number().int().min(0).max(100),
  duplicationRisk: z.number().int().min(0).max(100),
  issues: z.array(z.object({ severity: z.enum(["critical", "major", "minor"]), description: z.string().trim().min(8).max(400), sectionTitle: z.string().trim().max(180).nullable() })).max(16),
  verifiedClaimCount: z.number().int().min(0).max(80),
  unsupportedClaimCount: z.number().int().min(0).max(80),
  summary: z.string().trim().min(20).max(800)
});

export function hashText(value) { return createHash("sha256").update(String(value || "")).digest("hex"); }

export function normalizeUrl(value) {
  try {
    const url = new URL(value);
    if (!/^https?:$/.test(url.protocol)) return null;
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid|gclid)/i.test(key)) url.searchParams.delete(key);
    return url.toString().replace(/\/$/, "");
  } catch { return null; }
}

export async function verifyEditorialSourceUrl(value) {
  const url = normalizeUrl(value);
  if (!url) return false;

  try {
    const response = await fetch(url, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(8000),
      headers: { "user-agent": "Nota5Plus editorial verifier/1.0" }
    });
    if (response.status >= 200 && response.status < 400) return true;
    if ([404, 410].includes(response.status)) return false;
  } catch {
    // Some public sources reject HEAD even though the page is reachable with GET.
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      redirect: "follow",
      signal: AbortSignal.timeout(10000),
      headers: {
        "user-agent": "Nota5Plus editorial verifier/1.0",
        range: "bytes=0-2048"
      }
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

export function scoreCandidate(topic) {
  return [topic.relevance, topic.importance, topic.recency, topic.credibility, topic.usefulness].reduce((sum, value) => sum + Number(value || 0), 0);
}

export function getEditorialWeek(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short" }).formatToParts(date);
  const part = (type) => parts.find((entry) => entry.type === type)?.value;
  const local = new Date(`${part("year")}-${part("month")}-${part("day")}T12:00:00Z`);
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(part("weekday"));
  const offset = weekday === 0 ? 6 : Math.max(0, weekday - 1);
  const start = new Date(local); start.setUTCDate(local.getUTCDate() - offset);
  const end = new Date(start); end.setUTCDate(start.getUTCDate() + 6);
  const format = (value) => value.toISOString().slice(0, 10);
  return { start: format(start), end: format(end), key: `${format(start)}:${format(end)}` };
}

export function isSundayInBucharest(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", { timeZone: "Europe/Bucharest", weekday: "short" }).format(date) === "Sun";
}

export function validateResearch(research, week) {
  const deduped = new Map();
  for (const source of research.sources || []) {
    const url = normalizeUrl(source.url);
    if (!url) continue;
    if (!deduped.has(url)) deduped.set(url, { ...source, url, score: scoreCandidate(source) });
  }
  const sources = [...deduped.values()].filter((source) => source.credibility >= 8 && source.relevance >= 7);
  const sourceIds = new Set(sources.map((source) => source.id));
  const topics = (research.candidateTopics || [])
    .map((topic) => ({ ...topic, sourceIds: topic.sourceIds.filter((id) => sourceIds.has(id)), score: scoreCandidate(topic) }))
    .filter((topic) => topic.sourceIds.length && topic.score >= 40)
    .sort((a, b) => b.score - a.score);
  const selected = [];
  const categoryCounts = new Map();
  for (const topic of topics) {
    if ((categoryCounts.get(topic.category) || 0) >= 2) continue;
    selected.push(topic); categoryCounts.set(topic.category, (categoryCounts.get(topic.category) || 0) + 1);
    if (selected.length === 5) break;
  }
  const currentSources = sources.filter((source) => !source.publishedAt || source.publishedAt >= week.start || Boolean(source.eventDate && source.eventDate >= week.start));
  const hasPrimary = selected.some((topic) => topic.sourceIds.some((id) => {
    const source = sources.find((entry) => entry.id === id);
    return ["primary", "official"].includes(source?.sourceType) || Boolean(source?.primarySourceUrl);
  }));
  const reasons = [];
  if (sources.length < 5) reasons.push("Nu sunt suficiente surse credibile și distincte.");
  if (selected.length < 3) reasons.push("Nu sunt suficiente subiecte distincte pentru o ediție.");
  if (currentSources.length < 5) reasons.push("Cercetarea nu conține suficiente informații actuale din săptămâna selectată.");
  if (!hasPrimary) reasons.push("Lipsește o sursă primară sau oficială pentru subiectele selectate.");
  return { valid: reasons.length === 0, reasons, sources: sources.slice(0, 12), topics: selected, sourceIds };
}

export function scoreEditorialQuality({ draft, factCheck, existingArticles = [] }) {
  const sourceScore = Math.min(35, Math.round((factCheck.sourceCoverage || 0) * 0.35));
  const factualScore = Math.min(35, Math.round((factCheck.factualAccuracy || 0) * 0.35));
  const clarityScore = Math.min(20, Math.round((factCheck.clarity || 0) * 0.2));
  const noveltyScore = Math.min(10, Math.round((100 - (factCheck.duplicationRisk || 0)) * 0.1));
  const titleKey = String(draft.title || "").toLocaleLowerCase("ro");
  const duplicateTitle = existingArticles.some((article) => String(article.title || "").toLocaleLowerCase("ro") === titleKey);
  const criticalIssues = (factCheck.issues || []).filter((issue) => issue.severity === "critical").length;
  const majorIssues = (factCheck.issues || []).filter((issue) => issue.severity === "major").length;
  const score = Math.max(0, sourceScore + factualScore + clarityScore + noveltyScore - (duplicateTitle ? 25 : 0) - criticalIssues * 20 - majorIssues * 6);
  const reasons = [];
  if (!factCheck.passed) reasons.push("Verificarea factuală nu a trecut.");
  if ((factCheck.unsupportedClaimCount || 0) > 0) reasons.push("Există afirmații fără sursă confirmată.");
  if (criticalIssues) reasons.push("Există probleme factuale critice.");
  if (duplicateTitle) reasons.push("Titlul duplică o ediție existentă.");
  if (score < EDITORIAL_QUALITY_THRESHOLD) reasons.push(`Scorul ${score}/100 este sub pragul ${EDITORIAL_QUALITY_THRESHOLD}.`);
  return { score, valid: reasons.length === 0, reasons };
}

export function countWords(draft) {
  return [draft.summary, ...(draft.sections || []).map((section) => section.content), draft.conclusion].join(" ").trim().split(/\s+/).filter(Boolean).length;
}
