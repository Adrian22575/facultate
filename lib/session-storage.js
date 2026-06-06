"use client";

const LAST_SESSION_KEY = "lastStudySession";

export function saveLastSession(session) {
  if (!session) return;
  if (typeof window === "undefined" || typeof localStorage === "undefined") return;

  try {
    localStorage.setItem(
      LAST_SESSION_KEY,
      JSON.stringify({
        ...session,
        updatedAt: new Date().toISOString()
      })
    );
  } catch (error) {
    console.warn("Nu pot salva ultima sesiune.", error);
  }
}

export function getLastSession() {
  if (typeof window === "undefined" || typeof localStorage === "undefined") {
    return null;
  }

  try {
    const value = localStorage.getItem(LAST_SESSION_KEY);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    console.warn("Nu pot citi ultima sesiune.", error);
    return null;
  }
}
