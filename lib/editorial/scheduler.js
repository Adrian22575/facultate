import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function synchronizeEditorialSchedulerSecret() {
  const secret = String(process.env.CRON_SECRET || "");
  if (secret.length < 24) throw new Error("cron_secret_missing");
  const { error } = await createAdminClient().rpc("configure_editorial_scheduler_token", { scheduler_secret: secret });
  if (error) throw error;
}
