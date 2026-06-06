import "server-only";

import { cookies } from "next/headers";

import { DEMO_USER } from "@/lib/demo-user";

export const DEMO_SESSION_COOKIE = "demo_session";

export async function getDemoUser() {
  const cookieStore = await cookies();
  const hasDemoSession = cookieStore.get(DEMO_SESSION_COOKIE)?.value === "1";

  return hasDemoSession ? DEMO_USER : null;
}

export async function startDemoSession() {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, "1", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7
  });
}

export async function clearDemoSession() {
  const cookieStore = await cookies();
  cookieStore.set(DEMO_SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}
