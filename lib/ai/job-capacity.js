import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function requeueCreditBackedGenerationJob({ jobId, userId }) {
  const admin = createAdminClient();
  const { data, error } = await admin.rpc("requeue_credit_backed_generation_job", {
    p_job_id: jobId,
    p_user_id: userId
  });

  if (error) throw error;
  return data;
}
