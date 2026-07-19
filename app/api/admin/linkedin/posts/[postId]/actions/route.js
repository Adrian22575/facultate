import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { approveLinkedInPost, prepareLinkedInDraft, publishLinkedInPost, rejectLinkedInPost } from "@/lib/linkedin/server";
import { LINKEDIN_POST_OBJECTIVE_KEYS, LINKEDIN_POST_TEMPLATE_KEYS, LINKEDIN_POST_VOICE_KEYS } from "@/lib/linkedin/templates";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ action: z.enum(["generate", "approve", "reject", "publish", "retry"]), templateKey: z.enum(LINKEDIN_POST_TEMPLATE_KEYS).optional(), objectiveKey: z.enum(LINKEDIN_POST_OBJECTIVE_KEYS).optional(), voiceKey: z.enum(LINKEDIN_POST_VOICE_KEYS).optional() });

export async function POST(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  const { postId } = await params;
  try {
    await assertRateLimit({ action: `linkedin_post_${parsed.data.action}`, subject: `user:${user.id}`, windowSeconds: 60, maxRequests: 10 });
    if (parsed.data.action === "approve") return NextResponse.json({ ok: true, post: await approveLinkedInPost(postId, user.id) });
    if (parsed.data.action === "reject") return NextResponse.json({ ok: true, post: await rejectLinkedInPost(postId) });
    if (parsed.data.action === "publish") {
      const result = await publishLinkedInPost(postId);
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }

    const admin = createAdminClient();
    const { data: post, error } = await admin.from("linkedin_editorial_posts").select("article_id, generated_text, edited_text, status, approved_at, last_error").eq("id", postId).maybeSingle();
    if (error || !post) return NextResponse.json({ error: "not_found" }, { status: 404 });
    if (parsed.data.action === "retry" && post.generated_text && post.approved_at && !["linkedin_publish_result_unknown", "linkedin_publish_confirmation_missing", "linkedin_publish_confirmation_persistence_failed"].includes(post.last_error)) {
      const result = await publishLinkedInPost(postId, { admin });
      return NextResponse.json(result, { status: result.ok ? 200 : 422 });
    }
    const result = await prepareLinkedInDraft(post.article_id, { force: true, manual: true, templateKey: parsed.data.templateKey, objectiveKey: parsed.data.objectiveKey, voiceKey: parsed.data.voiceKey });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const code = error?.code === "RATE_LIMITED" ? "rate_limited" : error?.message || "action_failed";
    return NextResponse.json({ error: code }, { status: error?.code === "RATE_LIMITED" ? 429 : 422 });
  }
}
