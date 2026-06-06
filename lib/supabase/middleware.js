import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

import { getSupabasePublicEnv, hasSupabasePublicEnv } from "@/lib/env/public";

const AUTH_LOOKUP_TIMEOUT_MS = 2500;

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
    await Promise.race([
      supabase.auth.getUser(),
      new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error("middleware_auth_timeout"));
        }, AUTH_LOOKUP_TIMEOUT_MS);
      })
    ]);
  } catch {
    return response;
  }

  return response;
}
