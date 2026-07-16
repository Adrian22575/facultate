import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function requireApiAdmin() {
  const supabase = await createClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  return user && (await isAdminUser(user)) ? user : null;
}

export async function GET(_request, { params }) {
  const adminUser = await requireApiAdmin();
  if (!adminUser) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const resolvedParams = await params;
  const feedbackId = typeof resolvedParams?.feedbackId === "string" ? resolvedParams.feedbackId : "";
  if (!feedbackId) {
    return NextResponse.json({ error: "invalid_feedback_id" }, { status: 400 });
  }

  const admin = createAdminClient();
  const { data: feedback, error } = await admin
    .from("feedback_submissions")
    .select("screenshot_bucket, screenshot_path, screenshot_mime_type")
    .eq("id", feedbackId)
    .maybeSingle();

  if (error) {
    return NextResponse.json({ error: "feedback_lookup_failed" }, { status: 500 });
  }

  if (!feedback?.screenshot_bucket || !feedback.screenshot_path) {
    return NextResponse.json({ error: "screenshot_not_found" }, { status: 404 });
  }

  const { data: screenshot, error: downloadError } = await admin.storage
    .from(feedback.screenshot_bucket)
    .download(feedback.screenshot_path);

  if (downloadError || !screenshot) {
    return NextResponse.json({ error: "screenshot_download_failed" }, { status: 404 });
  }

  return new NextResponse(screenshot, {
    headers: {
      "Content-Type": feedback.screenshot_mime_type || "application/octet-stream",
      "Content-Disposition": "inline",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; sandbox"
    }
  });
}
