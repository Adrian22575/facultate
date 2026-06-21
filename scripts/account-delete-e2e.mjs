import assert from "node:assert/strict";
import fs from "node:fs";

function loadEnvFile(path) {
  if (!fs.existsSync(path)) return {};

  const env = {};
  for (const line of fs.readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index < 0) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

Object.assign(process.env, loadEnvFile(".env.local"), process.env);

const nativeFetch = globalThis.fetch;
globalThis.fetch = (input, init = {}) =>
  nativeFetch(input, {
    ...init,
    signal: init.signal
      ? AbortSignal.any([init.signal, AbortSignal.timeout(20_000)])
      : AbortSignal.timeout(20_000)
  });

const { deleteAccountData } = await import("@/lib/account-deletion.js");
const { SOURCE_BUCKET } = await import("@/lib/ai/storage.js");
const { createAdminClient } = await import("@/lib/supabase/admin.js");

async function countRows(admin, table, column, value) {
  const { count, error } = await admin
    .from(table)
    .select("id", { count: "exact", head: true })
    .eq(column, value);
  if (error) throw error;
  return count || 0;
}

async function main() {
  const admin = createAdminClient();
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  const storagePath = `account-delete-e2e/${suffix}.txt`;
  let userId = null;
  let userEmail = null;

  try {
    userEmail = `account-delete-e2e-${suffix}@example.test`;
    const { data: created, error: createError } = await admin.auth.admin.createUser({
      email: userEmail,
      password: `Account-delete-e2e-${suffix}!`,
      email_confirm: true,
      user_metadata: { full_name: "Account Delete E2E" }
    });
    if (createError) throw createError;
    userId = created?.user?.id;
    assert.ok(userId, "temporary auth user created");

    const { error: uploadError } = await admin.storage
      .from(SOURCE_BUCKET)
      .upload(storagePath, Buffer.from("temporary account deletion fixture", "utf8"), {
        contentType: "text/plain",
        upsert: false
      });
    if (uploadError) throw uploadError;

    const { data: sourceDocument, error: sourceError } = await admin
      .from("ai_source_documents")
      .insert({
        user_id: userId,
        source_kind: "txt",
        storage_bucket: SOURCE_BUCKET,
        storage_path: storagePath,
        original_filename: "account-delete-e2e.txt",
        mime_type: "text/plain",
        size_bytes: 34,
        extraction_status: "pending"
      })
      .select("id")
      .single();
    if (sourceError) throw sourceError;

    const { error: usageError } = await admin.from("user_usage_events").insert({
      user_id: userId,
      session_id: `account-delete-e2e-${suffix}`,
      event_name: "account_delete_e2e",
      feature: "account",
      route_path: "/cont"
    });
    if (usageError) throw usageError;

    const { error: allowlistError } = await admin.from("free_access_allowlist").insert({
      email: userEmail,
      grant_kind: "premium",
      is_active: true,
      notes: "account deletion e2e fixture"
    });
    if (allowlistError) throw allowlistError;

    const { error: logError } = await admin.from("openai_request_logs").insert({
      user_id: userId,
      source_document_id: sourceDocument.id,
      operation: "account_delete_e2e",
      request_scope: "verification",
      status: "succeeded",
      input_preview: "temporary personal fixture"
    });
    if (logError) throw logError;

    const result = await deleteAccountData(userId);
    assert.equal(result.removedStorageObjectCount, 1, "storage cleanup succeeded");

    const { data: deletedUser } = await admin.auth.admin.getUserById(userId);
    assert.equal(deletedUser?.user, null, "auth user deleted");
    assert.equal(await countRows(admin, "ai_source_documents", "user_id", userId), 0, "source rows deleted");
    assert.equal(await countRows(admin, "user_usage_events", "user_id", userId), 0, "usage rows deleted");
    assert.equal(await countRows(admin, "openai_request_logs", "user_id", userId), 0, "request logs deleted");
    assert.equal(
      await countRows(admin, "free_access_allowlist", "email", userEmail),
      0,
      "free access allowlist entry deleted"
    );

    const { data: storedObjects, error: listError } = await admin.storage
      .from(SOURCE_BUCKET)
      .list("account-delete-e2e", { search: `${suffix}.txt` });
    if (listError) throw listError;
    assert.equal(storedObjects?.length || 0, 0, "stored object deleted");

    userId = null;
    console.log("account:delete:e2e ok");
  } finally {
    await admin.storage.from(SOURCE_BUCKET).remove([storagePath]);
    if (userEmail) {
      await admin.from("free_access_allowlist").delete().eq("email", userEmail);
    }
    if (userId) await admin.auth.admin.deleteUser(userId);
  }
}

try {
  await main();
  process.exit(0);
} catch (error) {
  console.error(error?.stack || error?.message || error);
  process.exit(1);
}
