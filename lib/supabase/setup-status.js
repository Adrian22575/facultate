export function isSupabaseSetupIncompleteError(error) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";

  return (
    code === "PGRST205" ||
    code === "PGRST202" ||
    code === "42P01" ||
    code === "42703" ||
    code === "42704" ||
    code === "42883" ||
    message.includes("schema cache") ||
    message.includes("Could not find the table") ||
    message.includes("Could not find the function") ||
    message.includes("does not exist")
  );
}

export function getSupabaseSetupErrorMessage(error) {
  if (isSupabaseSetupIncompleteError(error)) {
    return "Setup-ul Supabase pentru zona SaaS nu este complet inca. Ruleaza migrarile `0001`-`0010`, apoi revino aici.";
  }

  return null;
}

export function getAIQuestionBankSetupErrorMessage(error) {
  if (isSupabaseSetupIncompleteError(error)) {
    return "Setup-ul Supabase pentru Workspace nu este complet. Ruleaza migrarile `0001`-`0016`, apoi revino aici. Migrarea `0017` este recomandata pentru logging, dar nu blocheaza procesarea materialelor.";
  }

  return null;
}

export function getLearningSetupErrorMessage(error) {
  if (isSupabaseSetupIncompleteError(error)) {
    return "Zona de invatare nu este configurata complet. Ruleaza migrarile pentru learning_study_sets, idempotency, PPTX, raportari si joburi async, apoi revino aici.";
  }

  return null;
}
