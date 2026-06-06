import { z } from "zod";

export const QuestionBankItemSchema = z
  .object({
    question_text: z.string().min(10),
    answers: z.array(z.string().min(1)).min(4).max(5),
    correct_index: z.number().int().min(0),
    explanation: z.string().default(""),
    source_reference: z.string().optional().default(""),
    review_note: z.string().optional().default("")
  })
  .superRefine((value, context) => {
    if (value.correct_index >= value.answers.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Raspunsul corect trebuie sa existe in lista de variante.",
        path: ["correct_index"]
      });
    }
  });

export const QuestionBankChunkResultSchema = z.object({
  items: z.array(QuestionBankItemSchema).max(120),
  notes: z.array(z.string()).max(10).default([])
});

export const DocumentProfileSchema = z.object({
  profile: z.enum(["small", "medium", "large"]),
  estimatedItems: z.number().int().min(0),
  chunkCount: z.number().int().min(1),
  detectedFormat: z.enum(["qa_extract", "invalid_source"]),
  qualitySignals: z.array(z.string()).default([])
});

export const ProcessingStageSchema = z.enum([
  "queued",
  "profiling",
  "extracting",
  "consolidating",
  "publishing",
  "completed",
  "failed"
]);
