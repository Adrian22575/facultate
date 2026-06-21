import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { getSupabasePublicEnv, hasSupabasePublicEnv } from "@/lib/env/public";

const AUTH_LOOKUP_TIMEOUT_MS = 2500;

async function refreshClaimsWithTimeout(supabase) {
  let timeoutId;

  try {
    return await Promise.race([
      supabase.auth.getClaims(),
      new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error("middleware_auth_timeout"));
        }, AUTH_LOOKUP_TIMEOUT_MS);
      })
    ]);
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function updateSession(request) {
  if (!hasSupabasePublicEnv()) {
    return NextResponse.next({
      request
    });
  }

  const { NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY } =
    getSupabasePublicEnv();

  let response = NextResponse.next({
    request
  });

  const supabase = createServerClient(
    NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => {
            request.cookies.set(name, value);
          });

          response = NextResponse.next({
            request
          });

          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        }
      }
    }
  );

  try {
    await refreshClaimsWithTimeout(supabase);
  } catch {
    return response;
  }

  return response;
}
