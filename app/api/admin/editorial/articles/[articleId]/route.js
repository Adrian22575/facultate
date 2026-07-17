import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const sourceSchema = z.object({ id: z.string().trim().min(2).max(80), url: z.string().url().max(1200), title: z.string().trim().min(8).max(300), publisher: z.string().trim().min(2).max(160), author: z.string().trim().max(160).nullable().optional(), publishedAt: z.string().nullable().optional(), eventDate: z.string().nullable().optional(), sourceType: z.string().trim().min(3).max(30), region: z.string().trim().min(3).max(40), supports: z.array(z.string().trim().min(12).max(360)).min(1).max(8) });
const updateSchema = z.object({
  title: z.string().trim().min(20).max(180), subtitle: z.string().trim().max(320), summary: z.string().trim().min(120).max(1400), primaryTopic: z.string().trim().min(4).max(120), categories: z.array(z.string().trim().min(3).max(80)).min(1).max(3), keyTakeaways: z.array(z.string().trim().min(18).max(250)).min(1).max(5), sections: z.array(z.object({ title: z.string().trim().min(10).max(180), content: z.string().trim().min(80).max(5000), keyClaims: z.array(z.string().trim().min(20).max(500)).min(1).max(6), sourceIds: z.array(z.string().trim().min(2).max(80)).min(1).max(6), implication: z.string().trim().min(25).max(550), limitations: z.string().trim().min(15).max(450) })).min(3).max(5), studentImplications: z.array(z.string().trim().min(18).max(300)).min(1).max(6), weeklyTerm: z.object({ term: z.string().trim().min(3).max(100), explanation: z.string().trim().min(30).max(420), dictionarySlug: z.string().nullable().optional() }), conclusion: z.string().trim().min(60).max(1800), sources: z.array(sourceSchema).min(5).max(12), internalLinks: z.array(z.object({ label: z.string().trim().min(3).max(90), href: z.string().trim().regex(/^\//).max(240), context: z.string().trim().max(240) })).max(4), seoTitle: z.string().trim().min(20).max(70), metaDescription: z.string().trim().min(70).max(180), socialDescription: z.string().trim().min(70).max(220), correctionNote: z.string().trim().max(2000).nullable().optional()
});

async function requireApiAdmin() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return user && await isAdminUser(user) ? user : null; }

export async function PATCH(request, { params }) {
  if (!(await requireApiAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  const { articleId } = await params;
  const value = parsed.data;
  const knownSources = new Set(value.sources.map((source) => source.id));
  if (value.sections.some((section) => section.sourceIds.some((id) => !knownSources.has(id)))) return NextResponse.json({ error: "unknown_source_reference" }, { status: 422 });
  const admin = createAdminClient();
  const { data: updated, error } = await admin.from("editorial_articles").update({ title: value.title, subtitle: value.subtitle, summary: value.summary, primary_topic: value.primaryTopic, categories: value.categories, key_takeaways: value.keyTakeaways, sections: value.sections, student_implications: value.studentImplications, weekly_term: value.weeklyTerm, conclusion: value.conclusion, sources: value.sources, internal_links: value.internalLinks, seo_title: value.seoTitle, meta_description: value.metaDescription, social_description: value.socialDescription, correction_note: value.correctionNote || null }).eq("id", articleId).select("id, slug").maybeSingle();
  if (error) return NextResponse.json({ error: "save_failed" }, { status: 500 });
  if (!updated) return NextResponse.json({ error: "not_found" }, { status: 404 });
  return NextResponse.json({ ok: true, article: updated });
}
