import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

export async function getActiveLicentaMistakeIds(userId) {
  if (!userId) return [];

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("licenta_exam_mistakes")
    .select("question_id")
    .eq("user_id", userId)
    .order("updated_at", { ascending: false })
    .limit(1000);

  if (error) throw error;
  return (data || []).map((row) => row.question_id).filter(Boolean);
}
