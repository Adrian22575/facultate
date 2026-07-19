import { NextResponse } from "next/server";
import { z } from "zod";

import { isAdminUser } from "@/lib/admin";
import { AUTOMATION_MODELS, AUTOMATION_WORKFLOWS } from "@/lib/editorial/automation-settings";
import { synchronizeEditorialSchedulerSecret } from "@/lib/editorial/scheduler";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const updateSchema = z.object({
  enabled: z.boolean(),
  frequencyDays: z.number().int().min(1).max(30),
  scheduledHour: z.number().int().min(0).max(23),
  model: z.enum(AUTOMATION_MODELS),
  notifyTelegram: z.boolean()
});

async function requireApiAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return user && await isAdminUser(user) ? user : null;
}

export async function PATCH(request, { params }) {
  const user = await requireApiAdmin();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const { workflow } = await params;
  if (!AUTOMATION_WORKFLOWS.includes(workflow)) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const parsed = updateSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_payload" }, { status: 400 });

  try {
    await synchronizeEditorialSchedulerSecret();
  } catch (error) {
    console.error("admin_editorial_scheduler_sync_failed", { workflow, message: error instanceof Error ? error.message : "unknown_error" });
    return NextResponse.json({ error: "scheduler_sync_failed" }, { status: 503 });
  }

  const value = parsed.data;
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("editorial_automation_settings")
    .upsert({
      workflow,
      enabled: value.enabled,
      frequency_days: value.frequencyDays,
      scheduled_hour: value.scheduledHour,
      model: value.model,
      notify_telegram: value.notifyTelegram,
      updated_by: user.id
    }, { onConflict: "workflow" })
    .select("workflow, enabled, frequency_days, scheduled_hour, model, notify_telegram, last_scheduled_for, updated_at")
    .single();
  if (error) {
    console.error("admin_editorial_automation_update_failed", { workflow, message: error.message });
    return NextResponse.json({ error: "save_failed" }, { status: 500 });
  }
  return NextResponse.json({ ok: true, settings: data });
}
