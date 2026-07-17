import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { runEditorialFactCheck } from "@/lib/editorial/automation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ action: z.enum(["publish", "withdraw", "fact_check"]) });
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
    await admin.from("editorial_articles").update({ status: "withdrawn" }).eq("id", articleId);
    return NextResponse.json({ ok: true, status: "withdrawn" });
  }
  if (parsed.data.action === "fact_check") {
    const report = await runEditorialFactCheck(article);
    const status = report.passed && report.unsupportedClaimCount === 0 ? "passed" : "failed";
    await admin.from("editorial_articles").update({ fact_check_status: status, fact_check_report: report, last_reviewed_at: new Date().toISOString() }).eq("id", articleId);
    return NextResponse.json({ ok: true, factCheckStatus: status, report });
  }
  if (article.fact_check_status !== "passed" || Number(article.quality_score) < 85) return NextResponse.json({ error: "publication_quality_not_met" }, { status: 422 });
  await admin.from("editorial_articles").update({ status: "published", published_at: article.published_at || new Date().toISOString() }).eq("id", articleId);
  return NextResponse.json({ ok: true, status: "published" });
}
