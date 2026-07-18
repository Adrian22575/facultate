import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { disconnectLinkedInConnection } from "@/lib/linkedin/server";
import { assertRateLimit } from "@/lib/rate-limit";
import { createClient } from "@/lib/supabase/server";

export async function POST(_request, { params }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user || !(await isAdminUser(user))) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { connectionId } = await params;
  try {
    await assertRateLimit({ action: "linkedin_disconnect", subject: `user:${user.id}`, windowSeconds: 300, maxRequests: 8 });
    const connection = await disconnectLinkedInConnection(connectionId);
    return NextResponse.json({ ok: true, connection });
  } catch (error) {
    return NextResponse.json({ error: error?.code === "RATE_LIMITED" ? "rate_limited" : "disconnect_failed" }, { status: error?.code === "RATE_LIMITED" ? 429 : 500 });
  }
}
