"use client";

import { createBrowserClient } from "@supabase/ssr";

import { getSupabasePublicEnv, hasSupabasePublicEnv } from "@/lib/env/public";

export function createClient() {
  if (!hasSupabasePublicEnv()) {
    throw new Error(
      "Supabase nu este configurat. Completează NEXT_PUBLIC_SUPABASE_URL și NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY."
    );
  }

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getSupabasePublicEnv();

  return createBrowserClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
  );
}
