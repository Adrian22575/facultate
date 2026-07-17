import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { dictionarySlug, scoreDictionaryTerm } from "@/lib/dictionary/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const UpdateSchema = z.object({
  status: z.enum(["draft", "published", "withdrawn", "rejected"]), categoryId: z.string().uuid(), term: z.string().trim().min(2).max(160), shortDefinition: z.string().trim().min(30).max(700), simpleExplanation: z.string().trim().min(80).max(5000), analogy: z.string().trim().max(2000).nullable().optional(), example: z.string().trim().min(40).max(2500), whyItMatters: z.string().trim().min(40).max(2500), howToApply: z.array(z.string().trim().min(8).max(300)).min(1).max(8), faqs: z.array(z.object({ question: z.string().trim().min(8).max(180), answer: z.string().trim().min(24).max(900) })).length(3), ctaType: z.enum(["practice", "materials", "review", "simulation"]), synonyms: z.array(z.string().trim().min(2).max(100)).max(12)
});

async function requireApiAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user && await isAdminUser(user) ? user : null;
}

export async function PATCH(request, { params }) {
  if (!(await requireApiAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { termId } = await params;
  const parsed = UpdateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const admin = createAdminClient();
  const { data: existing, error: existingError } = await admin.from("dictionary_terms").select("related_term_candidates, seo_title, meta_description, search_intent, sources_needed, quality_notes").eq("id", termId).maybeSingle();
  if (existingError || !existing) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const value = parsed.data;
  const complete = { term: value.term, slug: dictionarySlug(value.term), shortDefinition: value.shortDefinition, simpleExplanation: value.simpleExplanation, analogy: value.analogy || null, example: value.example, whyItMatters: value.whyItMatters, howToApply: value.howToApply, category: "administrare", synonyms: value.synonyms, relatedTermCandidates: existing.related_term_candidates || [], frequentlyAskedQuestions: value.faqs, seoTitle: existing.seo_title, metaDescription: existing.meta_description, searchIntent: existing.search_intent || "Actualizare editorială.", ctaType: value.ctaType, sourcesNeeded: Boolean(existing.sources_needed), qualityNotes: existing.quality_notes || "Actualizare manuală." };
  const score = scoreDictionaryTerm(complete);
  if (!score.valid) return NextResponse.json({ error: "quality_check_failed", reasons: score.reasons }, { status: 422 });
  const { data: updated, error } = await admin.from("dictionary_terms").update({ term: value.term, slug: dictionarySlug(value.term), category_id: value.categoryId, short_definition: value.shortDefinition, simple_explanation: value.simpleExplanation, analogy: value.analogy || null, example: value.example, why_it_matters: value.whyItMatters, how_to_apply: value.howToApply, faqs: value.faqs, synonyms: value.synonyms, cta_type: value.ctaType, quality_score: score.score, status: value.status, published_at: value.status === "published" ? new Date().toISOString() : null }).eq("id", termId).select("id, slug, status, quality_score").maybeSingle();
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, term: updated });
}
