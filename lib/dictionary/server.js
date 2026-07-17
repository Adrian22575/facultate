import "server-only";

import { dictionaryCategories, dictionaryInitialTerms } from "@/data/dictionary-initial-terms";
import {
  dictionaryInitialLetter,
  dictionarySlug,
  dictionaryTermSchema,
  getDictionaryCta,
  normalizeDictionaryText,
  scoreDictionaryTerm
} from "@/lib/dictionary/shared";
import { hasSupabaseServiceEnv } from "@/lib/env/server";
import { createAdminClient } from "@/lib/supabase/admin";

const PUBLIC_TERM_COLUMNS = "id, term, slug, category_id, short_definition, synonyms, quality_score, published_at, updated_at, dictionary_categories(slug, name)";
const FULL_TERM_COLUMNS = "id, term, slug, category_id, short_definition, simple_explanation, analogy, example, why_it_matters, how_to_apply, synonyms, related_term_candidates, faqs, cta_type, seo_title, meta_description, search_intent, sources_needed, quality_notes, quality_score, status, generated_model, generated_at, published_at, created_at, updated_at, dictionary_categories(slug, name)";

function getAdmin() {
  if (!hasSupabaseServiceEnv()) return null;
  return createAdminClient();
}

function mapTerm(row) {
  if (!row) return null;
  const category = Array.isArray(row.dictionary_categories) ? row.dictionary_categories[0] : row.dictionary_categories;
  return {
    ...row,
    category: category ? { slug: category.slug, name: category.name } : null,
    initial: dictionaryInitialLetter(row.term),
    cta: getDictionaryCta(row.cta_type)
  };
}

export async function getDictionaryOverview() {
  const admin = getAdmin();
  if (!admin) return { categories: [], terms: [], total: 0, recent: [], popular: [] };

  const [{ data: categories, error: categoriesError }, { data: terms, error: termsError }] = await Promise.all([
    admin.from("dictionary_categories").select("id, slug, name, description, sort_order").order("sort_order").order("name"),
    admin.from("dictionary_terms").select(PUBLIC_TERM_COLUMNS).eq("status", "published").order("term").limit(500)
  ]);

  if (categoriesError) throw categoriesError;
  if (termsError) throw termsError;
  const mappedTerms = (terms || []).map(mapTerm);
  const byPublished = [...mappedTerms].sort((left, right) => new Date(right.published_at || 0) - new Date(left.published_at || 0));

  return {
    categories: categories || [],
    terms: mappedTerms,
    total: mappedTerms.length,
    recent: byPublished.slice(0, 4),
    popular: []
  };
}

export async function getDictionaryTerm(slug, { includeUnpublished = false } = {}) {
  const admin = getAdmin();
  if (!admin) return null;
  let query = admin.from("dictionary_terms").select(FULL_TERM_COLUMNS).eq("slug", slug);
  if (!includeUnpublished) query = query.eq("status", "published");
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  if (!data) return null;

  const { data: relations, error: relationsError } = await admin
    .from("dictionary_term_relations")
    .select("related_term_id")
    .eq("term_id", data.id);
  if (relationsError) throw relationsError;

  const relatedIds = (relations || []).map((row) => row.related_term_id);
  let relatedTerms = [];
  if (relatedIds.length) {
    const { data: rows, error: relatedError } = await admin
      .from("dictionary_terms")
      .select(PUBLIC_TERM_COLUMNS)
      .in("id", relatedIds)
      .eq("status", "published");
    if (relatedError) throw relatedError;
    relatedTerms = (rows || []).map(mapTerm);
  }

  return { ...mapTerm(data), relatedTerms };
}

export async function getDictionarySitemapEntries() {
  const admin = getAdmin();
  if (!admin) return [];
  const { data, error } = await admin
    .from("dictionary_terms")
    .select("slug, updated_at")
    .eq("status", "published")
    .order("updated_at", { ascending: false })
    .limit(10000);
  if (error) throw error;
  return data || [];
}

export async function getDictionaryAdminOverview() {
  const admin = getAdmin();
  if (!admin) return { categories: [], terms: [], runs: [], warning: "Conexiunea de administrare nu este disponibilă." };

  const [{ data: categories, error: categoriesError }, { data: terms, error: termsError }, { data: runs, error: runsError }] = await Promise.all([
    admin.from("dictionary_categories").select("id, slug, name, description, sort_order").order("sort_order").order("name"),
    admin.from("dictionary_terms").select(FULL_TERM_COLUMNS).order("updated_at", { ascending: false }).limit(120),
    admin.from("dictionary_generation_runs").select("id, run_key, run_date, trigger_source, status, candidate_term, quality_score, rejection_reason, error_message, notification_sent, started_at, finished_at").order("started_at", { ascending: false }).limit(16)
  ]);
  if (categoriesError) throw categoriesError;
  if (termsError) throw termsError;
  if (runsError) throw runsError;
  return { categories: categories || [], terms: (terms || []).map(mapTerm), runs: runs || [], warning: null };
}

function buildSeedTerm(seed, categoryId) {
  const model = "editorial-initial";
  const generatedAt = new Date().toISOString();
  const term = {
    term: seed.term,
    slug: dictionarySlug(seed.term),
    shortDefinition: seed.shortDefinition,
    simpleExplanation: seed.simpleExplanation,
    analogy: seed.analogy || null,
    example: seed.example,
    whyItMatters: seed.whyItMatters,
    howToApply: seed.steps,
    category: seed.categorySlug,
    synonyms: seed.synonyms,
    relatedTermCandidates: seed.relatedSlugs,
    frequentlyAskedQuestions: seed.faqs,
    seoTitle: `Ce înseamnă ${seed.term}? | Dicționar Nota 5+`,
    metaDescription: seed.shortDefinition.slice(0, 157),
    searchIntent: `Explicație simplă pentru ${seed.term}.`,
    ctaType: seed.ctaType,
    sourcesNeeded: false,
    qualityNotes: "Termen editorial inițial verificat pentru claritate."
  };
  const assessment = scoreDictionaryTerm(term);
  if (!assessment.valid) throw new Error(`dictionary_seed_invalid:${seed.term}`);

  return {
    term: term.term,
    slug: term.slug,
    category_id: categoryId,
    short_definition: term.shortDefinition,
    simple_explanation: term.simpleExplanation,
    analogy: term.analogy,
    example: term.example,
    why_it_matters: term.whyItMatters,
    how_to_apply: term.howToApply,
    synonyms: term.synonyms,
    related_term_candidates: term.relatedTermCandidates,
    faqs: term.frequentlyAskedQuestions,
    cta_type: term.ctaType,
    seo_title: term.seoTitle,
    meta_description: term.metaDescription,
    search_intent: term.searchIntent,
    sources_needed: term.sourcesNeeded,
    quality_notes: term.qualityNotes,
    quality_score: assessment.score,
    status: "published",
    generated_model: model,
    generated_at: generatedAt,
    published_at: generatedAt
  };
}

export async function seedInitialDictionaryTerms() {
  const admin = getAdmin();
  if (!admin) throw new Error("dictionary_seed_requires_service_role");

  const categoriesPayload = dictionaryCategories.map((category, index) => ({ ...category, sort_order: index + 1 }));
  const { error: categoryError } = await admin
    .from("dictionary_categories")
    .upsert(categoriesPayload, { onConflict: "slug" });
  if (categoryError) throw categoryError;

  const { data: categoryRows, error: categoryReadError } = await admin
    .from("dictionary_categories")
    .select("id, slug");
  if (categoryReadError) throw categoryReadError;
  const categoryIds = new Map((categoryRows || []).map((category) => [category.slug, category.id]));
  const payload = dictionaryInitialTerms.map((seed) => buildSeedTerm(seed, categoryIds.get(seed.categorySlug)));
  const { error: termsError } = await admin.from("dictionary_terms").upsert(payload, { onConflict: "slug" });
  if (termsError) throw termsError;

  const { data: terms, error: termsReadError } = await admin.from("dictionary_terms").select("id, slug");
  if (termsReadError) throw termsReadError;
  const ids = new Map((terms || []).map((term) => [term.slug, term.id]));
  const relations = dictionaryInitialTerms.flatMap((seed) => {
    const termId = ids.get(dictionarySlug(seed.term));
    return seed.relatedSlugs
      .map((relatedSlug) => ({ term_id: termId, related_term_id: ids.get(relatedSlug) }))
      .filter((relation) => relation.term_id && relation.related_term_id && relation.term_id !== relation.related_term_id);
  });
  if (relations.length) {
    const { error: relationsError } = await admin
      .from("dictionary_term_relations")
      .upsert(relations, { onConflict: "term_id,related_term_id" });
    if (relationsError) throw relationsError;
  }

  return { categories: categoriesPayload.length, terms: payload.length, relations: relations.length };
}

export function matchesDictionarySearch(term, query) {
  const normalizedQuery = normalizeDictionaryText(query);
  if (!normalizedQuery) return true;
  const haystack = normalizeDictionaryText([
    term.term,
    term.short_definition,
    term.category?.name,
    ...(term.synonyms || [])
  ].join(" "));
  return haystack.includes(normalizedQuery);
}

export { buildSeedTerm, dictionaryTermSchema };
