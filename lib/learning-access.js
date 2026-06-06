import "server-only";

import { getBillingSnapshot } from "@/lib/billing";

export const LEARNING_MODES_LOCK_HREF = "/cont?section=plans&lock=learning_modes";

export async function hasLearningModesAccess({ user, demoMode = false }) {
  if (!user) {
    return false;
  }

  if (demoMode) {
    return true;
  }

  try {
    const snapshot = await getBillingSnapshot(user.id);
    return Boolean(snapshot?.activePremium);
  } catch {
    return false;
  }
}
