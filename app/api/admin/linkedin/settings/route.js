import { NextResponse } from "next/server";
import { isAdminUser } from "@/lib/admin";
import { linkedinSettingsSchema } from "@/lib/linkedin/requests";
import { saveLinkedInSettings } from "@/lib/linkedin/server";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = linkedinSettingsSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  try {
    await assertRateLimit({ action: "linkedin_settings", subject: `user:${user.id}`, windowSeconds: 60, maxRequests: 12 });
    const settings = await saveLinkedInSettings(parsed.data, user.id);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({ error: error?.code === "RATE_LIMITED" ? "rate_limited" : "save_failed" }, { status: error?.code === "RATE_LIMITED" ? 429 : 500 });
  }
}
