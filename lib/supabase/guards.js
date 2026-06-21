import "server-only";

import { redirect } from "next/navigation";

import { getDemoUser } from "@/lib/demo-session";
import { hasSupabasePublicEnv } from "@/lib/env/public";
import { createClient } from "@/lib/supabase/server";

const AUTH_LOOKUP_TIMEOUT_MS = 2500;

async function getUserWithTimeout(supabase) {
  let timeoutId;

  try {
    return await Promise.race([
      supabase.auth.getUser(),
      new Promise((resolve) => {
        timeoutId = setTimeout(() => {
          resolve({ data: { user: null }, error: new Error("auth_lookup_timeout") });
        }, AUTH_LOOKUP_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function getOptionalUser() {
  const demoUser = await getDemoUser();

  if (demoUser) {
    return demoUser;
  }

  if (!hasSupabasePublicEnv()) {
    return null;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await getUserWithTimeout(supabase);

    return user ?? null;
  } catch {
    return null;
  }
}

export async function requireUser(nextPath = "/") {
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}
