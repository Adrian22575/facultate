import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { LINKEDIN_MODES } from "@/lib/linkedin/shared";
import { saveLinkedInSettings } from "@/lib/linkedin/server";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

const schema = z.object({ mode: z.enum(LINKEDIN_MODES), notifyTelegram: z.boolean(), model: z.string().trim().min(2).max(80) });

export async function PATCH(request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });
  try {
    await assertRateLimit({ action: "linkedin_settings", subject: `user:${user.id}`, windowSeconds: 60, maxRequests: 12 });
    const settings = await saveLinkedInSettings(parsed.data, user.id);
    return NextResponse.json({ ok: true, settings });
  } catch (error) {
    return NextResponse.json({ error: error?.code === "RATE_LIMITED" ? "rate_limited" : "save_failed" }, { status: error?.code === "RATE_LIMITED" ? 429 : 500 });
  }
}
