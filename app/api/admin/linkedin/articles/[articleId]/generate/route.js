import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { prepareLinkedInDraft } from "@/lib/linkedin/server";
import { linkedinGenerationOptionsSchema } from "@/lib/linkedin/requests";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { articleId } = await params;
  const parsed = linkedinGenerationOptionsSchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_generation_options" }, { status: 400 });
  try {
    await assertRateLimit({ action: "linkedin_article_generate", subject: `user:${user.id}`, windowSeconds: 300, maxRequests: 8 });
    const result = await prepareLinkedInDraft(articleId, { force: true, manual: true, createNewEdition: true, ...parsed.data });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const code = error?.code === "RATE_LIMITED" ? "rate_limited" : error?.message || "generation_failed";
    console.error("[linkedin] Nu s-a putut crea o variantă nouă", { articleId, code, databaseCode: error?.code || null });
    return NextResponse.json({ error: code }, { status: error?.code === "RATE_LIMITED" ? 429 : 422 });
  }
}
