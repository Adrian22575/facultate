import { NextResponse } from "next/server";

import { isAdminUser } from "@/lib/admin";
import { ADMIN_NOTIFICATION_SCOPE_VALUES } from "@/lib/admin-notification-scopes";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/guards";

export async function POST(request) {
  const user = await getOptionalUser();

  if (!user || !(await isAdminUser(user))) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }

  let payload = {};

  try {
    payload = await request.json();
  } catch {
    payload = {};
  }

  const scope = String(payload.scope || "").trim();

  if (!ADMIN_NOTIFICATION_SCOPE_VALUES.includes(scope)) {
    return NextResponse.json({ error: "invalid_scope" }, { status: 400 });
  }

  const admin = createAdminClient();
  const viewedAt = new Date().toISOString();
  const { error } = await admin
    .from("admin_notification_views")
    .upsert(
      {
        admin_user_id: user.id,
        scope,
        viewed_at: viewedAt,
        updated_at: viewedAt
      },
      { onConflict: "admin_user_id,scope" }
    );

  if (error) {
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true, scope, viewedAt });
}
