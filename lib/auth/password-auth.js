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
  return typeof nextPath === "string" && nextPath.startsWith("/") && !nextPath.startsWith("//")
    ? nextPath
    : "/";
}
