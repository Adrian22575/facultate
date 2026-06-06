import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

const PREMIUM_ALLOWLIST_PRODUCT_CODE = "premium_30d";
const PREMIUM_ALLOWLIST_ENDS_AT = "2099-12-31T23:59:59.000Z";

export function normalizeEmail(email) {
  return String(email || "").trim().toLowerCase();
}

export function parseEmailList(input) {
  const lines = String(input || "")
    .split(/\r?\n/g)
    .map((line) => normalizeEmail(line))
    .filter(Boolean);

  const unique = Array.from(new Set(lines));
  const valid = [];
  const invalid = [];

  for (const email of unique) {
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      valid.push(email);
    } else {
      invalid.push(email);
    }
  }

  return {
    valid,
    invalid
  };
}

export async function ensurePremiumGrantFromAllowlist({ userId, email }) {
  const normalizedEmail = normalizeEmail(email);
  if (!userId || !normalizedEmail) {
    return { eligible: false, applied: false };
  }

  const admin = createAdminClient();
  const { data: allowlistEntry, error: allowlistError } = await admin
    .from("free_access_allowlist")
    .select("id")
    .eq("email", normalizedEmail)
    .eq("is_active", true)
    .maybeSingle();

  if (allowlistError) {
    throw allowlistError;
  }

  if (!allowlistEntry?.id) {
    return { eligible: false, applied: false };
  }

  const { data: existingGrant, error: existingGrantError } = await admin
    .from("premium_access_grants")
    .select("id")
    .eq("user_id", userId)
    .eq("source", "admin")
    .eq("product_code", PREMIUM_ALLOWLIST_PRODUCT_CODE)
    .contains("metadata", { free_access_allowlist: true })
    .gt("ends_at", new Date().toISOString())
    .maybeSingle();

  if (existingGrantError) {
    throw existingGrantError;
  }

  if (existingGrant?.id) {
    return { eligible: true, applied: false, alreadyApplied: true };
  }

  const nowIso = new Date().toISOString();
  const { error: insertError } = await admin.from("premium_access_grants").insert({
    user_id: userId,
    source: "admin",
    product_code: PREMIUM_ALLOWLIST_PRODUCT_CODE,
    starts_at: nowIso,
    ends_at: PREMIUM_ALLOWLIST_ENDS_AT,
    metadata: {
      free_access_allowlist: true,
      allowlist_entry_id: allowlistEntry.id,
      allowlist_email: normalizedEmail
    }
  });

  if (insertError && insertError.code !== "23505") {
    throw insertError;
  }

  return { eligible: true, applied: true, alreadyApplied: false };
}

export async function getAdminFreeAccessOverview() {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("free_access_allowlist")
    .select("id, email, grant_kind, is_active, notes, added_by, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(500);

  if (error) {
    throw error;
  }

  const rows = data || [];
  const userIds = Array.from(new Set(rows.map((row) => row.added_by).filter(Boolean)));
  const [profilesResult, grantsResult] = await Promise.all([
    userIds.length
      ? admin.from("profiles").select("id, email").in("id", userIds)
      : Promise.resolve({ data: [], error: null }),
    rows.length
      ? admin
          .from("premium_access_grants")
          .select("user_id, ends_at, metadata")
          .eq("source", "admin")
          .eq("product_code", PREMIUM_ALLOWLIST_PRODUCT_CODE)
          .contains("metadata", { free_access_allowlist: true })
      : Promise.resolve({ data: [], error: null })
  ]);

  if (profilesResult.error) {
    throw profilesResult.error;
  }
  if (grantsResult.error) {
    throw grantsResult.error;
  }

  const addedByEmailMap = new Map((profilesResult.data || []).map((row) => [row.id, row.email || null]));
  const grantsByEmail = new Set();

  for (const grant of grantsResult.data || []) {
    const grantEmail = normalizeEmail(grant?.metadata?.allowlist_email);
    if (grantEmail) {
      grantsByEmail.add(grantEmail);
    }
  }

  const enrichedRows = rows.map((row) => ({
    ...row,
    added_by_email: row.added_by ? addedByEmailMap.get(row.added_by) || null : null,
    grant_applied: grantsByEmail.has(normalizeEmail(row.email))
  }));

  return {
    rows: enrichedRows,
    total: enrichedRows.length,
    active: enrichedRows.filter((row) => row.is_active).length
  };
}
