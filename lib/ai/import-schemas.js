import { z } from "zod";

const ImportExtractedQuestionSchema = z.object({
  localNumber: z.string().nullable().default(null),
  questionText: z.string().min(5),
  options: z
    .array(
      z.object({
        label: z.string().nullable().default(null),
        text: z.string().min(1)
      })
    )
    .min(2)
    .max(8),
  inlineCorrectAnswerLabels: z.array(z.string()).max(3).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
  needsReview: z.boolean().default(false)
});

const ImportAnswerKeyItemSchema = z.object({
  questionNumber: z.string().nullable().default(null),
  positionIndex: z.number().int().min(1).nullable().default(null),
  correctLabels: z.array(z.string()).min(1).max(5),
  rawValue: z.string().default(""),
  confidence: z.number().min(0).max(1).default(0.5)
});

const ImportCarryOverFragmentSchema = z.object({
  placement: z.enum(["start", "end", "unknown"]).default("unknown"),
  text: z.string().min(1).max(4000),
  reason: z.string().max(500).default("")
});

export const ImportChunkClassificationSchema = z.object({
  classification: z.enum(["questions", "answer_key", "mixed", "irrelevant", "unknown"]),
  confidence: z.number().min(0).max(1),
  reason: z.string().default(""),
  detectedQuestionCount: z.number().int().min(0).default(0),
  detectedAnswerKeyCount: z.number().int().min(0).default(0),
  hasQuestionNumbers: z.boolean().default(false),
  hasAnswerOptions: z.boolean().default(false),
  notes: z.array(z.string()).max(10).default([])
});

export const ImportQuestionExtractionSchema = z.object({
  questionSetTitle: z.string().nullable().default(null),
  questions: z
    .array(ImportExtractedQuestionSchema)
    .max(80),
  warnings: z.array(z.string()).max(12).default([]),
  carryOverFragments: z.array(ImportCarryOverFragmentSchema).max(4).default([])
});

export const ImportAnswerKeyExtractionSchema = z.object({
  answerKeys: z
    .array(ImportAnswerKeyItemSchema)
    .max(300),
  answerKeyFormat: z.string().nullable().default(null),
  warnings: z.array(z.string()).max(12).default([]),
  carryOverFragments: z.array(ImportCarryOverFragmentSchema).max(4).default([])
});

export const ImportSetExtractionSchema = z.object({
  questionSetTitle: z.string().nullable().default(null),
  questions: z.array(ImportExtractedQuestionSchema).max(160),
  answerKeys: z.array(ImportAnswerKeyItemSchema).max(300).default([]),
  answerKeyFormat: z.string().nullable().default(null),
  warnings: z.array(z.string()).max(16).default([]),
  carryOverFragments: z.array(ImportCarryOverFragmentSchema).max(4).default([])
});

export const ImportAnswerMatchingSchema = z.object({
  matches: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        correctLabels: z.array(z.string()).min(1).max(5),
        confidence: z.number().min(0).max(1),
        reason: z.string().default("")
      })
    )
    .max(160),
  unmatchedAnswers: z
    .array(
      z.object({
        questionNumber: z.string().nullable().default(null),
        positionIndex: z.number().int().min(1).nullable().default(null),
        rawValue: z.string().default(""),
        reason: z.string().default("")
      })
    )
    .max(160)
    .default([]),
  unmatchedQuestions: z
    .array(
      z.object({
        questionId: z.string().uuid(),
        reason: z.string().default("")
      })
    )
    .max(160)
    .default([]),
  overallConfidence: z.number().min(0).max(1),
  needsReview: z.boolean().default(false)
});
