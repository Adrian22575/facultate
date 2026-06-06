import { z } from "zod";

function optionalStringField(schema) {
  return z.preprocess((value) => {
    if (value === null || value === undefined) {
      return undefined;
    }

    const normalized = String(value).trim();
    return normalized ? normalized : undefined;
  }, schema.optional());
}

function optionalIntegerField(schema) {
  return z.preprocess((value) => {
    if (value === null || value === undefined || value === "") {
      return undefined;
    }

    return value;
  }, schema.optional());
}

export const GeneratedQuestionSchema = z.object({
  question_text: z.string().min(10),
  answers: z.array(z.string().min(1)).length(4),
  correct_index: z.number().int().min(0).max(3),
  explanation: z.string()
});

export const GeneratedQuizSchema = z.object({
  title: z.string().min(3),
  questions: z.array(GeneratedQuestionSchema).min(5).max(20)
});

export const DraftQuestionFormSchema = z.object({
  questionId: z.string().uuid(),
  testId: z.string().uuid(),
  questionText: z.string().min(10),
  answerA: z.string().min(1),
  answerB: z.string().min(1),
  answerC: z.string().min(1),
  answerD: z.string().min(1),
  correctIndex: z.coerce.number().int().min(0).max(3),
  explanation: z.string()
});

export const DraftMetaFormSchema = z.object({
  testId: z.string().uuid(),
  title: z.string().min(3)
});

export const PublishDraftSchema = z.object({
  testId: z.string().uuid()
});

export const QuestionBankReviewItemSchema = z.object({
  bankId: z.string().uuid(),
  itemId: z.string().uuid(),
  questionText: z.string().min(10),
  answers: z.array(z.string().min(1)).min(4).max(5),
  correctIndex: z.coerce.number().int().min(0),
  explanation: z.string(),
  resolvedNeedsReview: z.coerce.boolean().optional().default(false)
}).superRefine((value, context) => {
  if (value.correctIndex >= value.answers.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Alege un raspuns corect valid.",
      path: ["correctIndex"]
    });
  }
});

export const PublishQuestionBankSchema = z.object({
  bankId: z.string().uuid()
});

export const DeleteQuestionBankItemSchema = z.object({
  bankId: z.string().uuid(),
  itemId: z.string().uuid()
});

export const DeleteQuestionBankSchema = z.object({
  bankId: z.string().uuid()
});

export const DeleteQuestionBanksSchema = z.object({
  bankIds: z.array(z.string().uuid()).min(1).max(50)
});

export const DeleteQuestionBankJobActivitySchema = z.object({
  jobId: z.string().uuid()
});

export const DeleteQuestionBankUploadSchema = z.object({
  jobId: z.string().uuid()
});

export const GenerateTestInputSchema = z
  .object({
    userType: z.enum(["student", "elev"]),
    examType: z.enum(["normal", "licenta"]),
    subjectId: optionalStringField(z.string().min(1)),
    subjectCustomName: optionalStringField(z.string().max(160)),
    semester: optionalIntegerField(z.coerce.number().int().min(1).max(2)),
    studentYear: optionalIntegerField(z.coerce.number().int().min(1).max(10)),
    schoolClass: optionalStringField(z.string().max(120))
  })
  .superRefine((value, context) => {
    if (value.examType === "licenta") {
      return;
    }

    if (!value.subjectId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Alege materia.",
        path: ["subjectId"]
      });
    }

    if (value.subjectId === "custom" && !value.subjectCustomName) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Scrie materia noua daca nu exista in lista.",
        path: ["subjectCustomName"]
      });
    }

    if (!value.semester) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Alege semestrul.",
        path: ["semester"]
      });
    }

    if (value.userType === "student" && !value.studentYear) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Alege anul.",
        path: ["studentYear"]
      });
    }

    if (value.userType === "elev" && !value.schoolClass) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Completeaza clasa.",
        path: ["schoolClass"]
      });
    }
  });
