import "server-only";

import { createClient as createSupabaseClient } from "@supabase/supabase-js";

import { getSupabaseServerEnv, hasSupabaseServiceEnv } from "@/lib/env/server";

export function createAdminClient() {
  if (!hasSupabaseServiceEnv()) {
    throw new Error(
      "Supabase service role key lipsește. Completează SUPABASE_SERVICE_ROLE_KEY doar pe server."
    );
  }

  const {
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY
  } = getSupabaseServerEnv();

  return createSupabaseClient(
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  );
}
