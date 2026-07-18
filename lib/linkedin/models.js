export const LINKEDIN_MODEL_OPTIONS = [
  { value: "gpt-5.6-sol", label: "GPT-5.6 Sol", description: "Calitate maximă" },
  { value: "gpt-5.6-terra", label: "GPT-5.6 Terra", description: "Echilibru calitate și cost" },
  { value: "gpt-5.6-luna", label: "GPT-5.6 Luna", description: "Cost redus" }
];

export const LINKEDIN_MODELS = LINKEDIN_MODEL_OPTIONS.map((option) => option.value);

export function isLinkedInModel(value) {
  return LINKEDIN_MODELS.includes(String(value || "").trim());
}

export function normalizeLinkedInModel(value) {
  const model = String(value || "").trim();
  // The generic GPT-5.6 alias resolves to Sol. Normalize it so the saved
  // setting and the visible choice always name the concrete model.
  if (model === "gpt-5.6") return "gpt-5.6-sol";
  return isLinkedInModel(model) ? model : "gpt-5.6-sol";
}
