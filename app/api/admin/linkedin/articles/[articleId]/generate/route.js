import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { prepareLinkedInDraft } from "@/lib/linkedin/server";
import { LINKEDIN_POST_TEMPLATE_KEYS } from "@/lib/linkedin/templates";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ templateKey: z.enum(LINKEDIN_POST_TEMPLATE_KEYS).optional() });

export async function POST(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { articleId } = await params;
  const parsed = schema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "invalid_template" }, { status: 400 });
  try {
    await assertRateLimit({ action: "linkedin_article_generate", subject: `user:${user.id}`, windowSeconds: 300, maxRequests: 8 });
    const result = await prepareLinkedInDraft(articleId, { force: true, templateKey: parsed.data.templateKey });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const code = error?.code === "RATE_LIMITED" ? "rate_limited" : error?.message || "generation_failed";
    return NextResponse.json({ error: code }, { status: error?.code === "RATE_LIMITED" ? 429 : 422 });
  }
}
