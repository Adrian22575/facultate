import "server-only";

import { getPostLoginNextPath } from "@/lib/auth/password-auth";
import { getBillingSnapshot } from "@/lib/billing";

export const LEARNING_MODES_LOCK_HREF = "/cont?section=plans&lock=learning_modes";

export function getLearningModesLockHref(returnTo = "") {
  const normalizedReturnTo = getPostLoginNextPath(returnTo);
  const safeReturnTo = normalizedReturnTo === "/" && returnTo !== "/" ? "" : normalizedReturnTo;

  return safeReturnTo
    ? `${LEARNING_MODES_LOCK_HREF}&returnTo=${encodeURIComponent(safeReturnTo)}`
    : LEARNING_MODES_LOCK_HREF;
}

export async function hasLearningModesAccess({ user, demoMode = false, billingSnapshot }) {
  if (!user) {
    return false;
  }

  if (demoMode) {
    return true;
  }

  const snapshot = billingSnapshot ?? (await getBillingSnapshot(user.id));
  return Boolean(snapshot?.activePremium);
}
