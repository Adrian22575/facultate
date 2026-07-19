import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { LINKEDIN_REFINEMENT_ACTIONS, summarizeLinkedInValidationIssues } from "@/lib/linkedin/requests";
import { approveLinkedInPost, prepareLinkedInDraft, publishLinkedInPost, refineLinkedInPost, rejectLinkedInPost, retryLinkedInFirstComment, saveLinkedInPostFeedback } from "@/lib/linkedin/server";
import { assertRateLimit } from "@/lib/rate-limit";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({
  action: z.enum(["generate", "approve", "reject", "publish", "retry", "retry_comment", "feedback", ...LINKEDIN_REFINEMENT_ACTIONS]),
  feedback: z.enum(["up", "down"]).optional()
}).superRefine((value, context) => {
  if (value.action === "feedback" && !value.feedback) context.addIssue({ code: z.ZodIssueCode.custom, path: ["feedback"], message: "feedback_required" });
});

export async function POST(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  const { postId } = await params;
  if (!parsed.success) {
    console.warn("linkedin_post_action_invalid", { postId, issues: summarizeLinkedInValidationIssues(parsed.error) });
    return NextResponse.json({ error: "invalid_action" }, { status: 400 });
  }
  try {
    await assertRateLimit({ action: `linkedin_post_${parsed.data.action}`, subject: `user:${user.id}`, windowSeconds: 60, maxRequests: 10 });
    if (parsed.data.action === "approve") return NextResponse.json({ ok: true, post: await approveLinkedInPost(postId, user.id) });
    if (parsed.data.action === "reject") return NextResponse.json({ ok: true, post: await rejectLinkedInPost(postId) });
    if (parsed.data.action === "feedback") return NextResponse.json({ ok: true, post: await saveLinkedInPostFeedback(postId, parsed.data.feedback) });
    if (parsed.data.action === "retry_comment") return NextResponse.json({ ok: true, post: await retryLinkedInFirstComment(postId) });
    if (LINKEDIN_REFINEMENT_ACTIONS.includes(parsed.data.action)) return NextResponse.json({ ok: true, post: await refineLinkedInPost(postId, parsed.data.action) });
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
    const result = await prepareLinkedInDraft(post.article_id, { force: true, manual: true, targetPostId: postId });
    return NextResponse.json(result, { status: result.ok ? 200 : 422 });
  } catch (error) {
    const code = error?.code === "RATE_LIMITED" ? "rate_limited" : error?.message || "action_failed";
    return NextResponse.json({ error: code }, { status: error?.code === "RATE_LIMITED" ? 429 : 422 });
  }
}
