import { revalidatePath } from "next/cache";
import { after, NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { runEditorialFactCheck } from "@/lib/editorial/automation";
import { prepareLinkedInDraft } from "@/lib/linkedin/server";
import { LINKEDIN_POST_OBJECTIVE_KEYS, LINKEDIN_POST_TEMPLATE_KEYS, LINKEDIN_POST_VOICE_KEYS } from "@/lib/linkedin/templates";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const linkedinPostSchema = z.object({
  templateKey: z.enum(LINKEDIN_POST_TEMPLATE_KEYS).optional(),
  objectiveKey: z.enum(LINKEDIN_POST_OBJECTIVE_KEYS).optional(),
  voiceKey: z.enum(LINKEDIN_POST_VOICE_KEYS).optional()
});
const schema = z.object({ action: z.enum(["publish", "withdraw", "fact_check"]), linkedin: linkedinPostSchema.optional() });
async function requireApiAdmin() { const supabase = await createClient(); const { data: { user } } = await supabase.auth.getUser(); return user && await isAdminUser(user) ? user : null; }

export async function POST(request, { params }) {
  if (!(await requireApiAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const { articleId } = await params;
  const admin = createAdminClient();
  const { data: article, error } = await admin.from("editorial_articles").select("*").eq("id", articleId).maybeSingle();
  if (error || !article) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (parsed.data.action === "withdraw") {
    const { error: withdrawError } = await admin.from("editorial_articles").update({ status: "withdrawn" }).eq("id", articleId);
    if (withdrawError) return NextResponse.json({ error: "withdraw_failed" }, { status: 500 });
    revalidatePath("/articole");
    revalidatePath(`/articole/${article.slug}`);
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ ok: true, status: "withdrawn" });
  }
  if (parsed.data.action === "fact_check") {
    try {
      const report = await runEditorialFactCheck(article);
      const status = report.passed && report.unsupportedClaimCount === 0 ? "passed" : "failed";
      const { error: factCheckError } = await admin.from("editorial_articles").update({ fact_check_status: status, fact_check_report: report, last_reviewed_at: new Date().toISOString() }).eq("id", articleId);
      if (factCheckError) return NextResponse.json({ error: "fact_check_save_failed" }, { status: 500 });
      return NextResponse.json({ ok: true, factCheckStatus: status, report });
    } catch (factCheckError) {
      console.error("admin_editorial_fact_check_failed", { articleId, message: factCheckError instanceof Error ? factCheckError.message : "unknown_error" });
      return NextResponse.json({ error: "fact_check_failed" }, { status: 500 });
    }
  }
  if (article.fact_check_status !== "passed" || Number(article.quality_score) < 85) return NextResponse.json({ error: "publication_quality_not_met" }, { status: 422 });
  const { error: publishError } = await admin.from("editorial_articles").update({ status: "published", published_at: article.published_at || new Date().toISOString() }).eq("id", articleId);
  if (publishError) return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  revalidatePath("/articole");
  revalidatePath(`/articole/${article.slug}`);
  revalidatePath("/sitemap.xml");
  after(async () => {
    const result = await prepareLinkedInDraft(article.id, parsed.data.linkedin || {}).catch((linkedinError) => ({
      ok: false,
      reason: linkedinError instanceof Error ? linkedinError.message : "linkedin_distribution_failed"
    }));
    if (!result.ok && !result.skipped) {
      console.error("linkedin_distribution_after_publication_failed", { articleId: article.id, reason: result.reason });
    }
  });
  return NextResponse.json({ ok: true, status: "published", linkedinQueued: true });
}
