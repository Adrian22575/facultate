import "server-only";

import { toFile } from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import {
  DocumentProfileSchema,
  QuestionBankChunkResultSchema
} from "@/lib/ai/question-bank-schema";
import {
  createLoggedOpenAIFile,
  deleteLoggedOpenAIFile,
  normalizeOpenAIError,
  runLoggedResponseCreate,
  runLoggedResponseParse,
  runLoggedResponseRetrieve
} from "@/lib/openai/logging";

const DEFAULT_OPENAI_PDF_FALLBACK_MODEL = process.env.OPENAI_PDF_FALLBACK_MODEL || "gpt-5.4";
const DEFAULT_PDF_MAX_OUTPUT_TOKENS = 12000;

function cleanupText(value) {
  return String(value || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function answerLabel(index) {
  return String.fromCharCode(65 + index);
}

function buildCanonicalText(items) {
  return items
    .map((item, index) => {
      const answersBlock = (item.answers || [])
        .map((answer, answerIndex) => `${answerLabel(answerIndex)}) ${cleanupText(answer)}`)
        .join("\n");
      const correctAnswerLine = `Raspuns corect: ${answerLabel(item.correct_index)}`;
      const explanationLine = item.explanation
        ? `Explicatie: ${cleanupText(item.explanation)}`
        : null;

      return [
        `${index + 1}. ${cleanupText(item.question_text)}`,
        answersBlock,
        correctAnswerLine,
        explanationLine
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function buildPdfExtractionInstructions({
  examType,
  subjectName,
  reason,
  batchRange = null
}) {
  return [
    "Extrage exclusiv intrebarile si raspunsurile existente in PDF.",
    "Nu rezuma si nu inventa nimic.",
    batchRange
      ? `Extrage doar intrebarile din intervalul ${batchRange.start}-${batchRange.end}, folosind numerotarea din document. Daca numerotarea are mici diferente de formatare, foloseste ordinea aparitiei intrebarilor si pastreaza doar acest interval.`
      : "Extrage toate intrebarile care par complete, chiar daca textul are mici urme de OCR sau zgomot de formatare.",
    "Pastraza intrebarile complete, inclusiv cele cu 5 variante daca exista.",
    "Pastreaza un singur raspuns corect.",
    "Daca raspunsul corect este evidentiat vizual in PDF, foloseste acel indiciu.",
    "Daca o intrebare este partial incompleta, cu raspuns corect neclar sau cu o varianta lipsa, pastreaz-o pentru review daca textul intrebarii poate fi identificat.",
    "Pentru aceste intrebari, completeaza review_note cu prefixul `ATENTIE:` si spune concret ce trebuie completat manual.",
    "Daca lipseste o varianta necesara, foloseste placeholderul `[Varianta lipsa - completeaza manual]` doar ca marcaj de review.",
    "Daca nu exista deloc variante, dar intrebarea este clara, pastreaza intrebarea si foloseste patru placeholderuri `[Varianta lipsa - completeaza manual]`, apoi marcheaza obligatoriu review_note.",
    "Daca raspunsul corect lipseste sau nu este clar, seteaza temporar correct_index la 0 si marcheaza obligatoriu review_note cu `ATENTIE: raspuns corect de completat manual`.",
    "Daca raspunsul corect nu este marcat explicit, poti deduce logic varianta corecta doar cand intrebarea si variantele sunt suficient de clare; in acest caz completeaza review_note cu mentiunea `raspuns inferat`.",
    "Daca o intrebare este in mare parte clara, dar are mici ambiguitati de formatare, extrage-o si completeaza review_note cu un avertisment scurt.",
    "Sari peste o intrebare doar daca textul intrebarii nu poate fi identificat suficient pentru a fi reparat manual in review.",
    "Explicatia este optionala si trebuie pastrata doar daca apare clar in document.",
    examType === "licenta"
      ? "Contextul este de licenta, deci pastreaza formularea riguroasa."
      : "Contextul este de materie obisnuita, pastreaza formularea clara.",
    subjectName ? `Materia este: ${subjectName}.` : "",
    `Motivul pentru aceasta analiza mai atenta este: ${reason}.`
  ]
    .filter(Boolean)
    .join(" ");
}

function buildPdfExtractionRequest({
  openaiFileId,
  examType,
  subjectName,
  reason,
  model,
  reasoningEffort,
  maxOutputTokens,
  batchRange = null
}) {
  const instructions = buildPdfExtractionInstructions({
    examType,
    subjectName,
    reason,
    batchRange
  });

  const rangeText = batchRange
    ? ` Returneaza doar intervalul ${batchRange.start}-${batchRange.end}.`
    : "";

  return {
    model,
    ...(reasoningEffort
      ? {
          reasoning: {
            effort: reasoningEffort
          }
        }
      : {}),
    input: [
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: `${instructions}\n\nReturneaza doar intrebarile care apar deja in PDF, cu variantele disponibile si raspunsul corect cand poate fi identificat.${rangeText} Daca pastrezi o intrebare care merita verificata atent sau nu are raspuns corect sigur, completeaza review_note cu motivul scurt.`
          },
          {
            type: "input_file",
            file_id: openaiFileId
          }
        ]
      }
    ],
    max_output_tokens: maxOutputTokens,
    text: {
      format: zodTextFormat(QuestionBankChunkResultSchema, "question_bank_pdf_fallback")
    }
  };
}

function extractJsonFromText(text) {
  const trimmed = String(text || "").trim();
  if (!trimmed) {
    return null;
  }

  const normalized = trimmed
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();

  try {
    return JSON.parse(normalized);
  } catch {
    const firstBrace = normalized.indexOf("{");
    const lastBrace = normalized.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      const candidate = normalized.slice(firstBrace, lastBrace + 1);
      try {
        return JSON.parse(candidate);
      } catch {
        return null;
      }
    }
  }

  return null;
}

function parseQuestionBankChunkFromResponse(response) {
  if (!response) {
    throw new Error("Procesarea PDF nu a returnat un raspuns.");
  }

  const rawCandidates = [];

  if (response.output_parsed) {
    rawCandidates.push(response.output_parsed);
  }

  if (typeof response.output_text === "string" && response.output_text.trim()) {
    rawCandidates.push(extractJsonFromText(response.output_text));
  }

  for (const raw of rawCandidates) {
    if (!raw) {
      continue;
    }

    const parsed = QuestionBankChunkResultSchema.safeParse(raw);
    if (parsed.success) {
      const items = parsed.data.items || [];
      const notes = parsed.data.notes || [];
      return {
        items,
        notes,
        canonicalText: buildCanonicalText(items)
      };
    }
  }

  throw new Error("Procesarea PDF nu a returnat o extragere valida.");
}

export async function uploadPdfForOpenAIExtraction({
  buffer,
  filename,
  examType = "normal",
  subjectName = null,
  reason = "pdf_fallback",
  model = DEFAULT_OPENAI_PDF_FALLBACK_MODEL,
  reasoningEffort = null,
  timeoutMs = null,
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  const requestOptions = timeoutMs ? { timeout: timeoutMs } : undefined;
  return createLoggedOpenAIFile({
    userId,
    sourceDocumentId,
    jobId,
    requestScope: "pdf_file_upload",
    requestOptions,
      metadata: {
        filename: filename || "document.pdf",
        examType,
        subjectName,
        reason,
        model,
        reasoningEffort
      },
    file: await toFile(buffer, filename || "document.pdf", {
      type: "application/pdf"
    }),
    purpose: "user_data"
  });
}

export async function deleteOpenAIPdfExtractionFile({
  fileId,
  filename,
  examType = "normal",
  subjectName = null,
  reason = "pdf_fallback_cleanup",
  model = null,
  reasoningEffort = null,
  timeoutMs = null,
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  if (!fileId) {
    return null;
  }

  return deleteLoggedOpenAIFile({
    fileId,
    requestScope: "pdf_file_delete",
    requestOptions: timeoutMs ? { timeout: Math.min(timeoutMs, 30 * 1000) } : undefined,
    userId,
    sourceDocumentId,
    jobId,
    metadata: {
      filename: filename || "document.pdf",
      examType,
      subjectName,
      reason,
      model,
      reasoningEffort
    }
  });
}

export async function extractQuestionBankItemsFromOpenAIFile({
  openaiFileId,
  filename,
  examType = "normal",
  subjectName = null,
  reason = "pdf_fallback",
  model = DEFAULT_OPENAI_PDF_FALLBACK_MODEL,
  reasoningEffort = null,
  timeoutMs = null,
  maxOutputTokens = DEFAULT_PDF_MAX_OUTPUT_TOKENS,
  batchRange = null,
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  if (!openaiFileId) {
    throw new Error("ID-ul fisierului PDF lipseste pentru extragere.");
  }

  const requestOptions = timeoutMs ? { timeout: timeoutMs } : undefined;
  const request = buildPdfExtractionRequest({
    openaiFileId,
    examType,
    subjectName,
    reason,
    model,
    reasoningEffort,
    maxOutputTokens,
    batchRange
  });

  const response = await runLoggedResponseParse({
    requestScope: batchRange ? "pdf_batch_extract" : "pdf_fallback_extract",
    requestOptions,
    userId,
    sourceDocumentId,
    jobId,
    metadata: {
      filename: filename || "document.pdf",
      examType,
      subjectName,
      reason,
      openaiFileId,
      model,
      reasoningEffort,
      batchRange
    },
    request
  });

  return parseQuestionBankChunkFromResponse(response);
}

export async function createQuestionBankItemsOpenAIResponse({
  openaiFileId,
  filename,
  examType = "normal",
  subjectName = null,
  reason = "pdf_fallback",
  model = DEFAULT_OPENAI_PDF_FALLBACK_MODEL,
  reasoningEffort = null,
  timeoutMs = null,
  maxOutputTokens = DEFAULT_PDF_MAX_OUTPUT_TOKENS,
  batchRange = null,
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  if (!openaiFileId) {
    throw new Error("ID-ul fisierului PDF lipseste pentru extragere.");
  }

  const requestOptions = timeoutMs ? { timeout: timeoutMs } : undefined;
  const request = {
    ...buildPdfExtractionRequest({
      openaiFileId,
      examType,
      subjectName,
      reason,
      model,
      reasoningEffort,
      maxOutputTokens,
      batchRange
    }),
    background: true
  };

  const response = await runLoggedResponseCreate({
    requestScope: batchRange ? "pdf_batch_extract_async_create" : "pdf_fallback_extract_async_create",
    requestOptions,
    userId,
    sourceDocumentId,
    jobId,
    metadata: {
      filename: filename || "document.pdf",
      examType,
      subjectName,
      reason,
      openaiFileId,
      model,
      reasoningEffort,
      batchRange,
      background: true
    },
    request
  });

  return response;
}

export async function retrieveQuestionBankItemsOpenAIResponse({
  responseId,
  filename,
  examType = "normal",
  subjectName = null,
  reason = "pdf_fallback",
  model = DEFAULT_OPENAI_PDF_FALLBACK_MODEL,
  timeoutMs = null,
  batchRange = null,
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  if (!responseId) {
    throw new Error("ID-ul raspunsului de procesare lipseste pentru extragere.");
  }

  const requestOptions = timeoutMs ? { timeout: timeoutMs } : undefined;
  return runLoggedResponseRetrieve({
    requestScope: "pdf_fallback_extract_async_retrieve",
    responseId,
    requestOptions,
    userId,
    sourceDocumentId,
    jobId,
    metadata: {
      filename: filename || "document.pdf",
      examType,
      subjectName,
      reason,
      model,
      batchRange
    }
  });
}

export async function parseQuestionBankItemsFromOpenAIResponse({
  response,
  responseId,
  filename,
  examType = "normal",
  subjectName = null,
  reason = "pdf_fallback",
  model = DEFAULT_OPENAI_PDF_FALLBACK_MODEL,
  timeoutMs = null,
  batchRange = null,
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  let resolvedResponse = response || null;

  if (!resolvedResponse && responseId) {
    resolvedResponse = await retrieveQuestionBankItemsOpenAIResponse({
      responseId,
      filename,
      examType,
      subjectName,
      reason,
      model,
      timeoutMs,
      batchRange,
      userId,
      sourceDocumentId,
      jobId
    });
  }

  return parseQuestionBankChunkFromResponse(resolvedResponse);
}

export async function profileQuestionBankPdfFromOpenAIFile({
  openaiFileId,
  filename,
  examType = "licenta",
  subjectName = null,
  reason = "pdf_profile",
  model = DEFAULT_OPENAI_PDF_FALLBACK_MODEL,
  reasoningEffort = null,
  timeoutMs = null,
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  if (!openaiFileId) {
    throw new Error("ID-ul fisierului PDF lipseste pentru profilare.");
  }

  const requestOptions = timeoutMs ? { timeout: timeoutMs } : undefined;
  const response = await runLoggedResponseParse({
    requestScope: "pdf_profile",
    requestOptions,
    userId,
    sourceDocumentId,
    jobId,
    metadata: {
      filename: filename || "document.pdf",
      examType,
      subjectName,
      reason,
      openaiFileId,
      model,
      reasoningEffort
    },
    request: {
      model,
      ...(reasoningEffort
        ? {
            reasoning: {
              effort: reasoningEffort
            }
          }
        : {}),
      input: [
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text:
                "Analizeaza PDF-ul ca banca de intrebari grila. Nu extrage intrebarile acum. Estimeaza cate intrebari grila exista, daca documentul contine variante de raspuns si raspunsuri corecte, si returneaza doar profilul cerut. Pentru licenta, accepta documente mari cu intrebari numerotate si raspunsuri marcate separat. detectedFormat trebuie sa fie qa_extract daca documentul pare reparabil in review."
            },
            {
              type: "input_file",
              file_id: openaiFileId
            }
          ]
        }
      ],
      max_output_tokens: 2000,
      text: {
        format: zodTextFormat(DocumentProfileSchema, "question_bank_pdf_profile")
      }
    }
  });

  if (!response.output_parsed) {
    throw new Error("Profilarea PDF nu a returnat un profil valid.");
  }

  return response.output_parsed;
}

export async function extractQuestionBankItemsFromPdfWithOpenAI({
  buffer,
  filename,
  examType = "normal",
  subjectName = null,
  reason = "pdf_fallback",
  model = DEFAULT_OPENAI_PDF_FALLBACK_MODEL,
  reasoningEffort = null,
  timeoutMs = null,
  maxOutputTokens = DEFAULT_PDF_MAX_OUTPUT_TOKENS,
  userId = null,
  sourceDocumentId = null,
  jobId = null
}) {
  const uploadedFile = await uploadPdfForOpenAIExtraction({
    buffer,
    filename,
    examType,
    subjectName,
    reason,
    model,
    reasoningEffort,
    timeoutMs,
    userId,
    sourceDocumentId,
    jobId
  });

  try {
    return await extractQuestionBankItemsFromOpenAIFile({
      openaiFileId: uploadedFile.id,
      filename,
      examType,
      subjectName,
      reason,
      model,
      reasoningEffort,
      timeoutMs,
      maxOutputTokens,
      userId,
      sourceDocumentId,
      jobId
    });
  } finally {
    try {
      await deleteOpenAIPdfExtractionFile({
        fileId: uploadedFile.id,
        filename,
        examType,
        subjectName,
        reason,
        model,
        reasoningEffort,
        timeoutMs,
        userId,
        sourceDocumentId,
        jobId
      });
    } catch (error) {
      const normalizedError = normalizeOpenAIError(error);
      console.error("Failed to delete PDF provider fallback file", {
        fileId: uploadedFile.id,
        error: normalizedError.message,
        status: normalizedError.status,
        code: normalizedError.code
      });
    }
  }
}
