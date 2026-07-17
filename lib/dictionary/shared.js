import { z } from "zod";

export const DICTIONARY_STATUS = ["draft", "published", "withdrawn", "rejected"];
export const DICTIONARY_CTA_TYPES = ["practice", "materials", "review", "simulation"];

export const dictionaryFaqSchema = z.object({
  question: z.string().trim().min(8).max(180),
  answer: z.string().trim().min(24).max(900)
});

export const dictionaryTermSchema = z.object({
  term: z.string().trim().min(2).max(160),
  slug: z.string().trim().regex(/^[a-z0-9-]+$/),
  shortDefinition: z.string().trim().min(30).max(700),
  simpleExplanation: z.string().trim().min(80).max(5000),
  analogy: z.string().trim().min(20).max(2000).nullable().optional(),
  example: z.string().trim().min(40).max(2500),
  whyItMatters: z.string().trim().min(40).max(2500),
  howToApply: z.array(z.string().trim().min(8).max(300)).max(8),
  category: z.string().trim().min(3).max(100),
  synonyms: z.array(z.string().trim().min(2).max(100)).max(12),
  relatedTermCandidates: z.array(z.string().trim().min(2).max(160)).max(8),
  frequentlyAskedQuestions: z.array(dictionaryFaqSchema).length(3),
  seoTitle: z.string().trim().min(20).max(70),
  metaDescription: z.string().trim().min(70).max(180),
  searchIntent: z.string().trim().min(10).max(300),
  ctaType: z.enum(DICTIONARY_CTA_TYPES),
  sourcesNeeded: z.boolean(),
  qualityNotes: z.string().trim().max(1000)
});

export function normalizeDictionaryText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function dictionarySlug(value) {
  return normalizeDictionaryText(value).replace(/\s+/g, "-").replace(/^-+|-+$/g, "");
}

export function dictionaryInitialLetter(term) {
  const normalized = normalizeDictionaryText(term);
  return normalized ? normalized.slice(0, 1).toUpperCase() : "#";
}

export function scoreDictionaryTerm(term) {
  const parsed = dictionaryTermSchema.safeParse(term);
  if (!parsed.success) {
    return { valid: false, score: 0, reasons: parsed.error.issues.map((issue) => issue.message) };
  }

  const content = parsed.data;
  const reasons = [];
  let score = 100;

  if (!content.analogy) {
    score -= 8;
    reasons.push("Lipsește analogia.");
  }

  if (new Set(content.frequentlyAskedQuestions.map((item) => normalizeDictionaryText(item.question))).size !== 3) {
    score -= 30;
    reasons.push("Întrebările frecvente nu sunt distincte.");
  }

  if (content.frequentlyAskedQuestions.some((item) => normalizeDictionaryText(item.answer).includes("placeholder"))) {
    score -= 40;
    reasons.push("Conținutul conține text de lucru.");
  }

  return { valid: score >= 82, score, reasons };
}

export function getDictionaryCta(type) {
  const ctas = {
    practice: { label: "Exersează prin grile", href: "/materii", copy: "Verifică imediat ce ai reținut prin întrebări clare." },
    materials: { label: "Încarcă materia", href: "/materiale", copy: "Transformă cursul tău într-un mod de studiu mai ușor de parcurs." },
    review: { label: "Repetă ce ai greșit", href: "/materii", copy: "Păstrează întrebările dificile și revino la ele la momentul potrivit." },
    simulation: { label: "Începe o simulare", href: "/licenta-exam", copy: "Testează-ți ritmul și vezi ce capitole mai au nevoie de lucru." }
  };

  return ctas[type] || ctas.practice;
}
