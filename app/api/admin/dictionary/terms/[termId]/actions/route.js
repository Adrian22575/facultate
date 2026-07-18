import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ action: z.enum(["publish", "withdraw"]) });

async function requireApiAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user && await isAdminUser(user) ? user : null;
}

export async function POST(request, { params }) {
  if (!(await requireApiAdmin())) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const { termId } = await params;
  const admin = createAdminClient();
  const { data: term, error } = await admin.from("dictionary_terms").select("id, slug, status, quality_score, published_at").eq("id", termId).maybeSingle();
  if (error || !term) return NextResponse.json({ error: "not_found" }, { status: 404 });

  if (parsed.data.action === "withdraw") {
    const { error: withdrawError } = await admin.from("dictionary_terms").update({ status: "withdrawn" }).eq("id", termId);
    if (withdrawError) return NextResponse.json({ error: "withdraw_failed" }, { status: 500 });
    revalidatePath("/dictionar");
    revalidatePath(`/dictionar/${term.slug}`);
    revalidatePath("/sitemap.xml");
    return NextResponse.json({ ok: true, status: "withdrawn" });
  }

  if (Number(term.quality_score) < 82) return NextResponse.json({ error: "publication_quality_not_met" }, { status: 422 });
  const { error: publishError } = await admin.from("dictionary_terms").update({ status: "published", published_at: term.published_at || new Date().toISOString() }).eq("id", termId);
  if (publishError) return NextResponse.json({ error: "publish_failed" }, { status: 500 });
  revalidatePath("/dictionar");
  revalidatePath(`/dictionar/${term.slug}`);
  revalidatePath("/sitemap.xml");
  return NextResponse.json({ ok: true, status: "published" });
}
