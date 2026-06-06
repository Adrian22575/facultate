import "server-only";

import { redirect } from "next/navigation";

import { getDemoUser } from "@/lib/demo-session";
import { hasSupabasePublicEnv } from "@/lib/env/public";
import { ensurePremiumGrantFromAllowlist } from "@/lib/free-access";
import { createClient } from "@/lib/supabase/server";

const AUTH_LOOKUP_TIMEOUT_MS = 2500;

async function getUserWithTimeout(supabase) {
  return Promise.race([
    supabase.auth.getUser(),
    new Promise((resolve) => {
      setTimeout(() => {
        resolve({ data: { user: null }, error: new Error("auth_lookup_timeout") });
      }, AUTH_LOOKUP_TIMEOUT_MS);
    })
  ]);
}

export async function getOptionalUser() {
  const demoUser = await getDemoUser();

  if (!hasSupabasePublicEnv()) {
    return demoUser;
  }

  try {
    const supabase = await createClient();
    const {
      data: { user }
    } = await getUserWithTimeout(supabase);

    if (user?.id && user?.email) {
      try {
        await ensurePremiumGrantFromAllowlist({
          userId: user.id,
          email: user.email
        });
      } catch {
        // Ignore allowlist sync errors during guard checks.
      }
    }

    return user ?? demoUser ?? null;
  } catch {
    return demoUser ?? null;
  }
}

export async function requireUser(nextPath = "/") {
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(nextPath)}`);
  }

  return user;
}
