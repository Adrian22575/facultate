import { z } from "zod";

import { LINKEDIN_PROMPT_VERSION } from "./banned-phrases.js";

const shortText = z.string().trim().min(2).max(500);
const score = z.number().int().min(1).max(10);

export const linkedinStrategySchema = z.object({
  analysis: z.object({
    topic: shortText,
    mainIdea: shortText,
    keyIdeas: z.array(shortText).length(3),
    surprisingElements: z.array(shortText).max(5),
    counterintuitiveClaims: z.array(shortText).max(5),
    readerProblems: z.array(shortText).max(5),
    tensions: z.array(shortText).max(5),
    examples: z.array(shortText).max(5),
    dataPoints: z.array(shortText).max(8),
    quotes: z.array(shortText).max(5),
    conclusions: z.array(shortText).max(5),
    relevantAudiences: z.array(shortText).max(6),
    prohibitedInferences: z.array(shortText).min(1).max(10)
  }),
  angleCandidates: z.array(z.object({
    type: z.enum(["problem", "counterintuitive", "mistake", "lesson", "industry_implication", "hard_question", "framework", "example", "perspective_shift"]),
    centralIdea: shortText,
    promise: shortText,
    evidence: z.array(shortText).min(1).max(4),
    fitScore: score
  })).length(3),
  selectedAngle: z.object({ type: shortText, centralIdea: shortText, reason: shortText }),
  hookCandidates: z.array(z.object({
    type: z.enum(["counterintuitive", "recognizable_problem", "contradiction", "specific_question", "personal_observation", "consequence", "mistake", "information_gap"]),
    text: z.string().trim().min(15).max(240),
    relevance: score,
    clarity: score,
    curiosity: score,
    credibility: score,
    specificity: score,
    audienceFit: score,
    clickbaitRisk: score
  })).length(5),
  selectedHook: z.object({ text: z.string().trim().min(15).max(240), reason: shortText }),
  promptVersion: z.literal(LINKEDIN_PROMPT_VERSION)
});

export const linkedinGeneratedDraftSchema = z.object({
  hook: z.string().trim().min(15).max(240),
  body: z.string().trim().min(80).max(2400),
  cta: z.string().trim().min(8).max(320).nullable(),
  linkSentence: z.string().trim().min(8).max(500).nullable(),
  hashtags: z.array(z.string().trim().min(2).max(60)).max(4),
  angle: z.string().trim().min(10).max(500),
  claims: z.array(z.string().trim().min(12).max(500)).min(2).max(8),
  warnings: z.array(z.string().trim().min(2).max(300)).max(10),
  promptVersion: z.literal(LINKEDIN_PROMPT_VERSION)
});

export const linkedinCritiqueSchema = z.object({
  scores: z.object({
    hookStrength: score,
    clarity: score,
    curiosity: score,
    relevance: score,
    specificity: score,
    authenticity: score,
    fluency: score,
    commentPotential: score,
    savePotential: score,
    objectiveFit: score,
    clicheFree: score,
    factualFidelity: score
  }),
  qualityScore: z.number().min(0).max(10),
  issues: z.array(z.string().trim().min(2).max(300)).max(12),
  warnings: z.array(z.string().trim().min(2).max(300)).max(12),
  revisedDraft: linkedinGeneratedDraftSchema,
  rewriteApplied: z.boolean(),
  promptVersion: z.literal(LINKEDIN_PROMPT_VERSION)
});

export const linkedinHookRefinementSchema = z.object({
  hook: z.string().trim().min(15).max(240),
  reason: z.string().trim().min(8).max(300),
  promptVersion: z.literal(LINKEDIN_PROMPT_VERSION)
});

export const linkedinDraftRefinementSchema = z.object({
  draft: linkedinGeneratedDraftSchema,
  summary: z.string().trim().min(8).max(300),
  promptVersion: z.literal(LINKEDIN_PROMPT_VERSION)
});
