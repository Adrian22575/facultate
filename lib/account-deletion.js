import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

async function deleteRows(query, label) {
  const { error } = await query;
  if (error) throw new Error(`account_cleanup_failed:${label}:${error.code || "unknown"}`);
}

async function removeStoredFiles(admin, documents) {
  const pathsByBucket = new Map();

  for (const document of documents || []) {
    if (!document.storage_bucket || !document.storage_path) continue;
    const paths = pathsByBucket.get(document.storage_bucket) || [];
    paths.push(document.storage_path);
    pathsByBucket.set(document.storage_bucket, paths);
  }

  for (const [bucket, paths] of pathsByBucket.entries()) {
    for (let index = 0; index < paths.length; index += 100) {
      const batch = paths.slice(index, index + 100);
      const { error } = await admin.storage.from(bucket).remove(batch);
      if (error) {
        throw new Error(`account_storage_cleanup_failed:${bucket}:${error.code || "unknown"}`);
      }
    }
  }
}

export async function deleteAccountData(userId) {
  if (!userId) throw new Error("account_delete_missing_user");

  const admin = createAdminClient();
  const { data: authUserData, error: authUserError } = await admin.auth.admin.getUserById(userId);
  if (authUserError) throw authUserError;

  const accountEmail = String(authUserData?.user?.email || "").trim().toLowerCase();
  const [documentsResult, feedbackResult] = await Promise.all([
    admin
      .from("ai_source_documents")
      .select("storage_bucket, storage_path")
      .eq("user_id", userId),
    admin
      .from("feedback_submissions")
      .select("screenshot_bucket, screenshot_path")
      .eq("user_id", userId)
  ]);

  const { data: documents, error: documentsError } = documentsResult;
  const { data: feedbackEntries, error: feedbackError } = feedbackResult;

  if (documentsError) throw documentsError;
  if (feedbackError) throw feedbackError;

  await deleteRows(admin.from("openai_request_logs").delete().eq("user_id", userId), "request_logs");
  await deleteRows(admin.from("user_usage_events").delete().eq("user_id", userId), "usage_events");
  await deleteRows(
    admin.from("learning_study_set_reports").delete().eq("reporter_user_id", userId),
    "study_set_reports"
  );
  await deleteRows(
    admin.from("admin_notification_events").delete().eq("metadata->>userId", userId),
    "notification_events"
  );
  await deleteRows(
    admin.from("api_rate_limit_events").delete().in("subject", [userId, `user:${userId}`]),
    "rate_limit_events"
  );
  if (accountEmail) {
    await deleteRows(
      admin.from("free_access_allowlist").delete().eq("email", accountEmail),
      "free_access_allowlist"
    );
  }

  const feedbackScreenshots = (feedbackEntries || []).map((entry) => ({
    storage_bucket: entry.screenshot_bucket,
    storage_path: entry.screenshot_path
  }));

  await removeStoredFiles(admin, [...(documents || []), ...feedbackScreenshots]);

  const { error: deleteError } = await admin.auth.admin.deleteUser(userId);
  if (deleteError) throw deleteError;

  return {
    deletedUserId: userId,
    removedStorageObjectCount: (documents || []).length + feedbackScreenshots.length
  };
}
