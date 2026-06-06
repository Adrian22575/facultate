export const BILLING_PLANS = {
  premium_24h: {
    code: "premium_24h",
    family: "premium",
    name: "Acces 24 ore",
    description: "Acces premium timp de 24 de ore.",
    amount: 1000,
    currency: "ron",
    durationHours: 24
  },
  premium_7d: {
    code: "premium_7d",
    family: "premium",
    name: "Acces 7 zile",
    description: "Acces premium timp de 7 zile.",
    amount: 2500,
    currency: "ron",
    durationHours: 24 * 7
  },
  premium_30d: {
    code: "premium_30d",
    family: "premium",
    name: "Acces 30 zile",
    description: "Acces premium timp de 30 de zile.",
    amount: 4900,
    currency: "ron",
    durationHours: 24 * 30
  },
  ai_upload_1: {
    code: "ai_upload_1",
    family: "ai_credits",
    name: "1 material incarcat",
    description: "O incarcare de material (PDF, DOCX sau TXT).",
    amount: 1000,
    currency: "ron",
    aiCredits: 1
  },
  ai_upload_5: {
    code: "ai_upload_5",
    family: "ai_credits",
    name: "5 materiale incarcate",
    description: "Cinci incarcari de materiale pentru recapitulare.",
    amount: 2500,
    currency: "ron",
    aiCredits: 5
  }
};

export const BILLING_PLAN_LIST = Object.values(BILLING_PLANS);

export function getBillingPlan(planCode) {
  return BILLING_PLANS[planCode] ?? null;
}
