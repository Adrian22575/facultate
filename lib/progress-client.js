export async function syncSubjectProgress(payload) {
  if (typeof window === "undefined") {
    return;
  }

  try {
    await fetch("/api/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      keepalive: true
    });
  } catch {
    // Pastram experienta fluida chiar daca salvarea progresului pica temporar.
  }
}
