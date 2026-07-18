import "server-only";

import { revalidatePath } from "next/cache";
import { zodTextFormat } from "openai/helpers/zod";

import { notifyEditorialDraftReady, notifyEditorialGenerationFailed, notifyEditorialPublished } from "@/lib/notifications/telegram";
import { runLoggedResponseParse } from "@/lib/openai/logging";
import { createAdminClient } from "@/lib/supabase/admin";
import { dateInBucharest, getAutomationSettings, isAutomationDue, markAutomationScheduled } from "@/lib/editorial/automation-settings";
import {
  articleDraftSchema,
  articlePlanSchema,
  countWords,
  getEditorialWeek,
  hashText,
  normalizeUrl,
  researchSchema,
  scoreEditorialQuality,
  validateResearch,
  factCheckSchema
} from "@/lib/editorial/shared";

function errorMessage(error) { return error instanceof Error ? error.message.slice(0, 1200) : "Eroare necunoscută."; }
function cleanPromptData(value) { return JSON.stringify(value).slice(0, 60000); }

async function updateRun(admin, id, values) {
  const { error } = await admin.from("editorial_generation_runs").update(values).eq("id", id);
  if (error) throw error;
}

async function verifyUrl(url) {
  const canonical = normalizeUrl(url);
  if (!canonical) return false;
  try {
    const response = await fetch(canonical, { method: "HEAD", redirect: "follow", signal: AbortSignal.timeout(8000), headers: { "user-agent": "Nota5Plus editorial verifier/1.0" } });
    return response.status >= 200 && response.status < 400;
  } catch { return false; }
}

function researchPrompt(week) {
  return [
    "Ești cercetător editorial pentru Nota5Plus, o aplicație românească pentru elevi și studenți.",
    "Cercetează pe web schimbările, studiile, tehnologiile, politicile și tendințele educaționale cu impact real în perioada indicată.",
    "Folosește doar informații găsite prin web search. Nu completa din memorie și nu inventa URL-uri, instituții, date sau statistici.",
    "Caută România, Uniunea Europeană și internațional numai când este util publicului român. Preferă ministere, Comisia Europeană, Eurostat, OECD, UNESCO, universități, reviste științifice, rapoarte și pagini oficiale.",
    "Pentru fiecare sursă indică data publicării și data evenimentului separat când diferă. Nu prezenta o republicare ca noutate.",
    "Returnează cel puțin 8 surse și 5 subiecte candidate distincte. Nu include forumuri, postări sociale sau agregatoare ca suport factual.",
    `Interval editorial: ${week.start}–${week.end}.`
  ].join("\n");
}

function planPrompt() {
  return "Construiește un plan editorial românesc precis, calm și fără clickbait. Folosește numai pachetul de cercetare validat furnizat. Alege 3-5 subiecte, explică de ce contează pentru elevi și studenți și nu introduce fapte noi.";
}

function draftPrompt() {
  return "Redactează un articol editorial în română, 1200-2500 de cuvinte când materialul o permite, destinat elevilor, studenților și profesorilor. Folosește exclusiv datele din pachetul validat. Fiecare secțiune are nevoie de sourceIds existente; nu crea surse sau linkuri noi. Separă faptele de interpretare, spune limitele și evită promisiunile sau dramatizarea. Titlul trebuie să indice perioada ori tema concretă.";
}

function factCheckPrompt() {
  return "Ești verificator editorial independent. Compară proiectul exclusiv cu cercetarea validată. Marchează orice afirmație factuală care nu este susținută de sourceIds, orice dată incorectă, exagerare, cauzalitate nejustificată, sursă lipsă sau posibilă invenție. Treci verificarea numai dacă nu există afirmații fără suport și conținutul este suficient de clar pentru public.";
}

async function researchWeek(week, model) {
  const response = await runLoggedResponseParse({
    requestScope: "editorial_weekly_research",
    metadata: { weekStart: week.start, weekEnd: week.end, tool: "web_search" },
    request: {
      model,
      reasoning: { effort: "high" },
      tools: [{ type: "web_search" }],
      input: [{ role: "developer", content: researchPrompt(week) }, { role: "user", content: "Începe cercetarea și returnează numai date structurate." }],
      text: { format: zodTextFormat(researchSchema, "editorial_research") }
    }
  });
  if (!response.output_parsed) throw new Error("editorial_research_missing_structured_output");
  return response.output_parsed;
}

async function makePlan({ research, week, model }) {
  const response = await runLoggedResponseParse({
    requestScope: "editorial_weekly_plan",
    metadata: { weekStart: week.start, topics: research.topics.length, sources: research.sources.length },
    request: {
      model,
      reasoning: { effort: "high" },
      input: [{ role: "developer", content: planPrompt() }, { role: "user", content: cleanPromptData({ week, research }) }],
      text: { format: zodTextFormat(articlePlanSchema, "editorial_plan") }
    }
  });
  if (!response.output_parsed) throw new Error("editorial_plan_missing_structured_output");
  return response.output_parsed;
}

async function draftArticle({ plan, research, week, model }) {
  const response = await runLoggedResponseParse({
    requestScope: "editorial_weekly_draft",
    metadata: { weekStart: week.start, selectedTopics: research.topics.length, sources: research.sources.length },
    request: {
      model,
      reasoning: { effort: "high" },
      input: [{ role: "developer", content: draftPrompt() }, { role: "user", content: cleanPromptData({ week, plan, research }) }],
      text: { format: zodTextFormat(articleDraftSchema, "editorial_article") }
    }
  });
  if (!response.output_parsed) throw new Error("editorial_draft_missing_structured_output");
  return response.output_parsed;
}

async function checkFacts({ draft, research, model }) {
  const response = await runLoggedResponseParse({
    requestScope: "editorial_weekly_fact_check",
    metadata: { sourceCount: research.sources.length, sectionCount: draft.sections.length },
    request: {
      model,
      reasoning: { effort: "high" },
      input: [{ role: "developer", content: factCheckPrompt() }, { role: "user", content: cleanPromptData({ draft, research }) }],
      text: { format: zodTextFormat(factCheckSchema, "editorial_fact_check") }
    }
  });
  if (!response.output_parsed) throw new Error("editorial_fact_check_missing_structured_output");
  return response.output_parsed;
}

function validateDraftSourceReferences(draft, sources) {
  const known = new Set(sources.map((source) => source.id));
  const unknown = draft.sections.flatMap((section) => section.sourceIds).filter((id) => !known.has(id));
  return [...new Set(unknown)];
}

function dbRecord({ draft, research, factCheck, assessment, week, publish, model }) {
  const wordCount = countWords(draft);
  const sourceSet = research.sources.filter((source) => new Set(draft.sections.flatMap((section) => section.sourceIds)).has(source.id));
  const now = new Date().toISOString();
  return {
    slug: draft.slug,
    title: draft.title,
    subtitle: draft.subtitle,
    summary: draft.summary,
    period_start: week.start,
    period_end: week.end,
    primary_topic: draft.primaryTopic,
    categories: draft.categories,
    key_takeaways: draft.keyTakeaways,
    sections: draft.sections,
    student_implications: draft.studentImplications,
    weekly_term: draft.weeklyTerm,
    conclusion: draft.conclusion,
    sources: sourceSet,
    internal_links: draft.internalLinks,
    seo_title: draft.seoTitle,
    meta_description: draft.metaDescription,
    social_description: draft.socialDescription,
    image_prompt: draft.imagePrompt,
    reading_minutes: Math.max(1, Math.ceil(wordCount / 210)),
    word_count: wordCount,
    content_hash: hashText(JSON.stringify({ title: draft.title, summary: draft.summary, sections: draft.sections })),
    source_url_hashes: sourceSet.map((source) => hashText(source.url)),
    quality_score: assessment.score,
    fact_check_status: factCheck.passed ? "passed" : "failed",
    fact_check_report: factCheck,
    status: publish ? "published" : "draft",
    generation_model: model,
    published_at: publish ? now : null,
    last_reviewed_at: now
  };
}

export function getEditorialGenerationPreview({ date = new Date(), model = "gpt-5.4" } = {}) {
  const week = getEditorialWeek(date);
  return {
    workflow: "editorial",
    model,
    timezone: "Europe/Bucharest",
    requests: [
      {
        id: "research",
        title: "Cercetare",
        reasoning: "high",
        output: "editorial_research (structură validată)",
        tools: ["web_search"],
        developerPrompt: researchPrompt(week),
        userPrompt: "Începe cercetarea și returnează numai date structurate.",
        dynamicContext: `Intervalul este deja inclus în instrucțiuni: ${week.start}–${week.end}.`
      },
      {
        id: "plan",
        title: "Plan editorial",
        reasoning: "high",
        output: "editorial_plan (structură validată)",
        tools: [],
        developerPrompt: planPrompt(),
        dynamicContext: "Mesajul utilizator este un obiect JSON cu intervalul și cercetarea validată din etapa anterioară. Valoarea exactă nu există înainte de rulare."
      },
      {
        id: "draft",
        title: "Ciornă articol",
        reasoning: "high",
        output: "editorial_article (structură validată)",
        tools: [],
        developerPrompt: draftPrompt(),
        dynamicContext: "Mesajul utilizator este un obiect JSON cu planul și cercetarea validată din etapele anterioare. Valoarea exactă nu există înainte de rulare."
      },
      {
        id: "fact-check",
        title: "Verificare factuală",
        reasoning: "high",
        output: "editorial_fact_check (structură validată)",
        tools: [],
        developerPrompt: factCheckPrompt(),
        dynamicContext: "Mesajul utilizator este un obiect JSON cu ciorna și cercetarea validată. Valoarea exactă nu există înainte de rulare."
      }
    ],
    publication: "După validare, articolul rămâne ciornă. Dacă notificările sunt active, primești mesaj pe Telegram; publicarea cere confirmarea ta explicită din Admin."
  };
}

export async function runEditorialGeneration({ triggerSource = "cron", runKey, date = new Date(), publish = false, force = false } = {}) {
  const week = getEditorialWeek(date);
  const admin = createAdminClient();
  const settings = await getAutomationSettings("editorial", admin);
  if (triggerSource === "cron" && !force && !isAutomationDue(settings, date)) return { ok: true, skipped: true, reason: settings.enabled ? "not_due" : "automation_disabled" };
  const runDate = dateInBucharest(date);
  const model = settings.model;
  const resolvedRunKey = runKey || `${triggerSource}:${runDate}`;
  const { data: run, error: insertError } = await admin.from("editorial_generation_runs").insert({ run_key: resolvedRunKey, run_date: runDate, week_start: week.start, week_end: week.end, trigger_source: triggerSource, status: "started", model }).select("id").maybeSingle();
  if (insertError?.code === "23505") return { ok: true, skipped: true, reason: "already_ran_today" };
  if (insertError || !run?.id) throw insertError || new Error("editorial_run_not_created");
  if (triggerSource === "cron") await markAutomationScheduled("editorial", runDate, admin);

  try {
    await updateRun(admin, run.id, { status: "researching" });
    const rawResearch = await researchWeek(week, model);
    const research = validateResearch(rawResearch, week);
    const urlChecks = await Promise.all(research.sources.map(async (source) => [source.url, await verifyUrl(source.url)]));
    const validUrls = new Set(urlChecks.filter(([, valid]) => valid).map(([url]) => url));
    research.sources = research.sources.filter((source) => validUrls.has(source.url));
    research.topics = research.topics.filter((topic) => topic.sourceIds.some((id) => research.sources.some((source) => source.id === id)));
    const finalResearch = validateResearch({ sources: research.sources, candidateTopics: research.topics }, week);
    await updateRun(admin, run.id, { status: finalResearch.valid ? "validated_research" : "rejected", candidate_count: rawResearch.candidateTopics.length, source_count: finalResearch.sources.length, topic_count: finalResearch.topics.length, research_snapshot: { sources: finalResearch.sources, topics: finalResearch.topics }, validation_report: { reasons: finalResearch.reasons }, rejection_reason: finalResearch.reasons.join(" ") || null });
    if (!finalResearch.valid) {
      await updateRun(admin, run.id, { finished_at: new Date().toISOString() });
      if (settings.notify_telegram) await notifyEditorialGenerationFailed({ runKey: resolvedRunKey, reason: finalResearch.reasons.join(" ") || "cercetare insuficientă" });
      return { ok: false, skipped: false, reason: "research_validation_failed" };
    }

    const plan = await makePlan({ research: finalResearch, week, model });
    const draft = await draftArticle({ plan, research: finalResearch, week, model });
    const unknownSourceIds = validateDraftSourceReferences(draft, finalResearch.sources);
    if (unknownSourceIds.length) throw new Error(`editorial_unknown_source_ids:${unknownSourceIds.join(",")}`);
    await updateRun(admin, run.id, { status: "drafted" });
    const factCheck = await checkFacts({ draft, research: finalResearch, model });
    const { data: existing } = await admin.from("editorial_articles").select("title").limit(120);
    const assessment = scoreEditorialQuality({ draft, factCheck, existingArticles: existing || [] });
    await updateRun(admin, run.id, { status: assessment.valid ? "fact_checked" : "rejected", quality_score: assessment.score, validation_report: { assessment, factCheck }, rejection_reason: assessment.reasons.join(" ") || null });
    if (!assessment.valid) {
      await updateRun(admin, run.id, { finished_at: new Date().toISOString() });
      if (settings.notify_telegram) await notifyEditorialGenerationFailed({ runKey: resolvedRunKey, reason: assessment.reasons.join(" ") || "verificarea editorială nu a trecut" });
      return { ok: false, skipped: false, reason: "quality_threshold_failed", score: assessment.score };
    }

    const record = dbRecord({ draft, research: finalResearch, factCheck, assessment, week, publish, model });
    const { data: article, error: articleError } = await admin.from("editorial_articles").insert(record).select("id, slug, title, status, quality_score").single();
    if (articleError) throw articleError;
    revalidatePath("/articole"); revalidatePath(`/articole/${article.slug}`); revalidatePath("/sitemap.xml");
    let notification = { sent: false };
    if (settings.notify_telegram) {
      notification = publish
        ? await notifyEditorialPublished({ article, week, runKey: resolvedRunKey })
        : await notifyEditorialDraftReady({ article, week, runKey: resolvedRunKey });
    }
    await updateRun(admin, run.id, { status: publish ? (notification.sent || notification.skipped ? "published" : "failed") : "draft", article_id: article.id, notification_sent: Boolean(notification.sent), finished_at: new Date().toISOString() });
    return { ok: true, skipped: false, article, published: publish, notificationSent: Boolean(notification.sent) };
  } catch (error) {
    const message = errorMessage(error);
    await updateRun(admin, run.id, { status: "failed", error_message: message, finished_at: new Date().toISOString() }).catch(() => null);
    if (settings.notify_telegram) await notifyEditorialGenerationFailed({ runKey: resolvedRunKey, reason: message }).catch(() => null);
    throw error;
  }
}

export async function runEditorialFactCheck(article) {
  const sources = Array.isArray(article.sources) ? article.sources : [];
  const draft = { title: article.title, summary: article.summary, sections: article.sections || [], conclusion: article.conclusion };
  const settings = await getAutomationSettings("editorial");
  return checkFacts({ draft, research: { sources }, model: settings.model });
}
