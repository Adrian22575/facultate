import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { updateLinkedInPostText } from "@/lib/linkedin/server";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ text: z.string().trim().min(120).max(3000) });

export async function PATCH(request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_text" }, { status: 400 });
  const { postId } = await params;
  try {
    await assertRateLimit({ action: "linkedin_post_edit", subject: `user:${user.id}`, windowSeconds: 60, maxRequests: 20 });
    const post = await updateLinkedInPostText(postId, parsed.data.text);
    return NextResponse.json({ ok: true, post });
  } catch (error) {
    const code = error?.message || "update_failed";
    return NextResponse.json({ error: code }, { status: error?.code === "RATE_LIMITED" ? 429 : 422 });
  }
}
