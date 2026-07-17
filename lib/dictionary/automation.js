import "server-only";

import { revalidatePath } from "next/cache";
import { zodTextFormat } from "openai/helpers/zod";

import { notifyDictionaryGenerationFailed, notifyDictionaryPublished } from "@/lib/notifications/telegram";
import { runLoggedResponseParse } from "@/lib/openai/logging";
import { createAdminClient } from "@/lib/supabase/admin";
import { dictionarySlug, dictionaryTermSchema, normalizeDictionaryText, scoreDictionaryTerm } from "@/lib/dictionary/shared";

const DICTIONARY_MODEL = process.env.OPENAI_CONTENT_MODEL?.trim() || "gpt-5.6";
const CANDIDATE_TERMS = ["învățare prin elaborare", "efectul de poziție serială", "test diagnostic", "barem de corectare", "obiective SMART de studiu", "strategie de eliminare la grilă", "fișa disciplinei", "plan de învățare", "revizuire activă", "gestionarea timpului la examen"];

function messageOf(error) { return error instanceof Error ? error.message.slice(0, 1000) : "Eroare necunoscută."; }

function todayInBucharest() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function canonicalCandidates(rows) {
  return new Set((rows || []).flatMap((row) => [row.term, ...(row.synonyms || [])]).map(normalizeDictionaryText).filter(Boolean));
}

export function isDuplicateDictionaryTerm(term, existingTerms) {
  const known = canonicalCandidates(existingTerms);
  return [term.term, ...(term.synonyms || [])].some((value) => known.has(normalizeDictionaryText(value)));
}

function buildPrompt({ categories, existingTerms, retryReasons = [] }) {
  return [
    "Generezi un singur termen nou pentru un dicționar public românesc destinat elevilor și studenților.",
    "Răspunde exclusiv prin structura cerută. Fără afirmații medicale, juridice sau financiare și fără statistici neverificabile.",
    "Explică natural, concret și corect. Publicul este mixt: liceu și facultate.",
    `Alege un subiect diferit de termenii existenți. Opțiuni preferate: ${CANDIDATE_TERMS.join("; ")}.`,
    `Categorii permise (folosește exact unul dintre aceste nume): ${categories.map((category) => category.name).join(", ")}.`,
    `Termeni deja publicați sau pregătiți: ${existingTerms.slice(0, 240).map((term) => term.term).join(", ") || "niciunul"}.`,
    "Slug-ul trebuie să fie fără diacritice, doar litere mici, cifre și cratime, derivat fidel din termen.",
    "Creează exact trei întrebări frecvente, toate diferite. Lista howToApply are 3–6 pași acționabili.",
    "Folosește o analogie scurtă când este utilă; dacă nu se potrivește, trimite null.",
    "Meta description: 70–180 caractere. SEO title: 20–70 caractere. Nu promite rezultate garantate.",
    retryReasons.length ? `Versiunea anterioară a fost respinsă pentru: ${retryReasons.join("; ")}. Corectează explicit aceste probleme.` : ""
  ].filter(Boolean).join("\n");
}

async function generateTerm({ categories, existingTerms, retryReasons }) {
  const response = await runLoggedResponseParse({
    requestScope: "dictionary_daily_generation",
    metadata: { candidateCount: CANDIDATE_TERMS.length, existingCount: existingTerms.length, retry: retryReasons.length > 0 },
    request: {
      model: DICTIONARY_MODEL,
      reasoning: { effort: "high" },
      input: [{ role: "developer", content: buildPrompt({ categories, existingTerms, retryReasons }) }, { role: "user", content: "Generează acum termenul nou pentru dicționar." }],
      text: { format: zodTextFormat(dictionaryTermSchema, "dictionary_term") }
    }
  });
  if (!response.output_parsed) throw new Error("dictionary_response_missing_structured_output");
  return response.output_parsed;
}

function categoryIdFor(term, categories) {
  const target = normalizeDictionaryText(term.category);
  return categories.find((category) => normalizeDictionaryText(category.name) === target)?.id || null;
}

function toDbRecord(term, categoryId, assessment) {
  const now = new Date().toISOString();
  return { term: term.term, slug: dictionarySlug(term.slug || term.term), category_id: categoryId, short_definition: term.shortDefinition, simple_explanation: term.simpleExplanation, analogy: term.analogy || null, example: term.example, why_it_matters: term.whyItMatters, how_to_apply: term.howToApply, synonyms: term.synonyms, related_term_candidates: term.relatedTermCandidates, faqs: term.frequentlyAskedQuestions, cta_type: term.ctaType, seo_title: term.seoTitle, meta_description: term.metaDescription, search_intent: term.searchIntent, sources_needed: term.sourcesNeeded, quality_notes: term.qualityNotes, quality_score: assessment.score, status: "published", generated_model: DICTIONARY_MODEL, generated_at: now, published_at: now };
}

async function saveRelations(admin, termId, candidateNames, existingTerms) {
  const known = new Map();
  for (const term of existingTerms) for (const name of [term.term, ...(term.synonyms || [])]) known.set(normalizeDictionaryText(name), term.id);
  const relatedIds = [...new Set((candidateNames || []).map((name) => known.get(normalizeDictionaryText(name))).filter(Boolean))].filter((id) => id !== termId).slice(0, 6);
  if (!relatedIds.length) return 0;
  const relations = relatedIds.flatMap((relatedId) => [{ term_id: termId, related_term_id: relatedId }, { term_id: relatedId, related_term_id: termId }]);
  const { error } = await admin.from("dictionary_term_relations").upsert(relations, { onConflict: "term_id,related_term_id" });
  if (error) throw error;
  return relations.length;
}

async function updateRun(admin, runId, values) {
  const { error } = await admin.from("dictionary_generation_runs").update(values).eq("id", runId);
  if (error) throw error;
}

export async function runDictionaryGeneration({ triggerSource = "cron", runKey, date = todayInBucharest() } = {}) {
  const admin = createAdminClient();
  const resolvedRunKey = runKey || `${triggerSource}:${date}`;
  const { data: run, error: insertError } = await admin.from("dictionary_generation_runs").insert({ run_key: resolvedRunKey, run_date: date, trigger_source: triggerSource, status: "started", model: DICTIONARY_MODEL }).select("id").maybeSingle();
  if (insertError?.code === "23505") return { ok: true, skipped: true, reason: "already_ran_today" };
  if (insertError || !run?.id) throw insertError || new Error("dictionary_run_not_created");

  try {
    const [{ data: categories, error: categoriesError }, { data: existingTerms, error: termsError }] = await Promise.all([
      admin.from("dictionary_categories").select("id, slug, name").order("sort_order"),
      admin.from("dictionary_terms").select("id, term, synonyms, slug, status").order("created_at", { ascending: false }).limit(500)
    ]);
    if (categoriesError) throw categoriesError;
    if (termsError) throw termsError;
    if (!(categories || []).length) throw new Error("dictionary_categories_missing");
    let generated = null;
    let assessment = null;
    let rejectionReasons = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      generated = await generateTerm({ categories: categories || [], existingTerms: existingTerms || [], retryReasons: rejectionReasons });
      assessment = scoreDictionaryTerm(generated);
      const categoryId = categoryIdFor(generated, categories || []);
      rejectionReasons = [];
      if (!categoryId) rejectionReasons.push("Categoria aleasă nu există în dicționar.");
      if (isDuplicateDictionaryTerm(generated, existingTerms || [])) rejectionReasons.push("Termenul sau un sinonim dublează un conținut existent.");
      if (dictionarySlug(generated.term) !== generated.slug) rejectionReasons.push("Slug-ul nu corespunde termenului.");
      if (!assessment.valid) rejectionReasons.push(...assessment.reasons);
      await updateRun(admin, run.id, { attempts: attempt, candidate_term: generated.term, quality_score: assessment.score, status: "generated", rejection_reason: rejectionReasons.join(" ") || null });
      if (!rejectionReasons.length) break;
    }
    if (!generated || !assessment || rejectionReasons.length) {
      await updateRun(admin, run.id, { status: "failed", error_message: rejectionReasons.join(" ") || "Termenul nu a trecut validarea.", finished_at: new Date().toISOString() });
      await notifyDictionaryGenerationFailed({ runKey: resolvedRunKey, reason: rejectionReasons.join(" ") || "validare nereușită" });
      return { ok: false, skipped: false, reason: "validation_failed" };
    }
    const categoryId = categoryIdFor(generated, categories || []);
    await updateRun(admin, run.id, { status: "validated" });
    const { data: created, error: createdError } = await admin.from("dictionary_terms").insert(toDbRecord(generated, categoryId, assessment)).select("id, slug, term").single();
    if (createdError) throw createdError;
    await saveRelations(admin, created.id, generated.relatedTermCandidates, existingTerms || []);
    revalidatePath("/dictionar");
    revalidatePath(`/dictionar/${created.slug}`);
    const notification = await notifyDictionaryPublished({ term: created.term, slug: created.slug, category: generated.category, qualityScore: assessment.score, runKey: resolvedRunKey });
    await updateRun(admin, run.id, { status: notification.sent || notification.skipped ? "published" : "notification_failed", published_term_id: created.id, notification_sent: Boolean(notification.sent), finished_at: new Date().toISOString() });
    return { ok: true, skipped: false, term: created, notificationSent: Boolean(notification.sent) };
  } catch (error) {
    const message = messageOf(error);
    await updateRun(admin, run.id, { status: "failed", error_message: message, finished_at: new Date().toISOString() }).catch(() => null);
    await notifyDictionaryGenerationFailed({ runKey: resolvedRunKey, reason: message }).catch(() => null);
    throw error;
  }
}
