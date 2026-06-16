export async function syncSubjectProgress(payload) {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const response = await fetch("/api/progress", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      keepalive: true
    });

    return await response.json().catch(() => null);
  } catch {
    // Pastram experienta fluida chiar daca salvarea progresului pica temporar.
    return null;
  }
}
