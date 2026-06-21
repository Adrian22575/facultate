export function normalizeEmailInput(email) {
  return String(email || "").trim().toLowerCase();
}

export function normalizePhoneInput(phone) {
  const digits = String(phone || "").replace(/\D/g, "");

  if (!digits) return "";
  if (digits.length === 13 && digits.startsWith("0040")) {
    return `0${digits.slice(4)}`;
  }
  if (digits.length === 11 && digits.startsWith("40")) {
    return `0${digits.slice(2)}`;
  }

  return digits;
}

export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getSafeNextPath(nextPath) {
  if (typeof nextPath !== "string") {
    return "/";
  }

  const candidate = nextPath.trim();
  if (!candidate.startsWith("/") || candidate.startsWith("//")) {
    return "/";
  }

  try {
    const baseUrl = new URL("https://nota5.internal");
    const parsed = new URL(candidate, baseUrl);
    if (parsed.origin !== baseUrl.origin) {
      return "/";
    }

    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return "/";
  }
}

export function getPostLoginNextPath(nextPath) {
  const safePath = getSafeNextPath(nextPath);
  const pathname = safePath.split(/[?#]/, 1)[0].toLowerCase();

  if (
    pathname === "/auth" ||
    pathname.startsWith("/auth/") ||
    pathname === "/api" ||
    pathname.startsWith("/api/") ||
    pathname === "/_next" ||
    pathname.startsWith("/_next/")
  ) {
    return "/";
  }

  return safePath;
}
