import { createClient } from "@supabase/supabase-js";

import { dictionaryCategories, dictionaryInitialTerms } from "../data/dictionary-initial-terms.js";
import { dictionarySlug, scoreDictionaryTerm } from "../lib/dictionary/shared.js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceRole) throw new Error("dictionary_seed_requires_supabase_service_env");

const admin = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
const now = new Date().toISOString();
const categoriesPayload = dictionaryCategories.map((category, index) => ({ ...category, sort_order: index + 1 }));
const { error: categoryError } = await admin.from("dictionary_categories").upsert(categoriesPayload, { onConflict: "slug" });
if (categoryError) throw categoryError;
const { data: categories, error: categoriesError } = await admin.from("dictionary_categories").select("id, slug");
if (categoriesError) throw categoriesError;
const categoryIds = new Map(categories.map((category) => [category.slug, category.id]));

const records = dictionaryInitialTerms.map((seed) => {
  const content = { term: seed.term, slug: dictionarySlug(seed.term), shortDefinition: seed.shortDefinition, simpleExplanation: seed.simpleExplanation, analogy: seed.analogy || null, example: seed.example, whyItMatters: seed.whyItMatters, howToApply: seed.steps, category: seed.categorySlug, synonyms: seed.synonyms, relatedTermCandidates: seed.relatedSlugs, frequentlyAskedQuestions: seed.faqs, seoTitle: `Ce înseamnă ${seed.term}? | Dicționar Nota 5+`, metaDescription: seed.shortDefinition.slice(0, 157), searchIntent: `Explicație simplă pentru ${seed.term}.`, ctaType: seed.ctaType, sourcesNeeded: false, qualityNotes: "Termen editorial inițial verificat pentru claritate." };
  const score = scoreDictionaryTerm(content);
  if (!score.valid) throw new Error(`invalid_dictionary_seed:${seed.term}`);
  return { term: content.term, slug: content.slug, category_id: categoryIds.get(seed.categorySlug), short_definition: content.shortDefinition, simple_explanation: content.simpleExplanation, analogy: content.analogy, example: content.example, why_it_matters: content.whyItMatters, how_to_apply: content.howToApply, synonyms: content.synonyms, related_term_candidates: content.relatedTermCandidates, faqs: content.frequentlyAskedQuestions, cta_type: content.ctaType, seo_title: content.seoTitle, meta_description: content.metaDescription, search_intent: content.searchIntent, sources_needed: false, quality_notes: content.qualityNotes, quality_score: score.score, status: "published", generated_model: "editorial-initial", generated_at: now, published_at: now };
});
const { error: termsError } = await admin.from("dictionary_terms").upsert(records, { onConflict: "slug" });
if (termsError) throw termsError;
const { data: rows, error: rowsError } = await admin.from("dictionary_terms").select("id, slug");
if (rowsError) throw rowsError;
const ids = new Map(rows.map((row) => [row.slug, row.id]));
const relations = dictionaryInitialTerms.flatMap((seed) => seed.relatedSlugs.map((slug) => ({ term_id: ids.get(dictionarySlug(seed.term)), related_term_id: ids.get(slug) })).filter((row) => row.term_id && row.related_term_id && row.term_id !== row.related_term_id));
if (relations.length) { const { error } = await admin.from("dictionary_term_relations").upsert(relations, { onConflict: "term_id,related_term_id" }); if (error) throw error; }
console.log(JSON.stringify({ categories: categoriesPayload.length, terms: records.length, relations: relations.length }));
