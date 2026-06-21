import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import JSZip from "jszip";
import mammoth from "mammoth";
import { extractQuestionBankItemsFromPdfWithOpenAI } from "@/lib/ai/openai-pdf-fallback";
import {
  AI_SOURCE_ACCEPTED_MIME_TYPES,
  AI_SOURCE_UPLOAD_MAX_BYTES,
  AI_SOURCE_UPLOAD_MAX_LABEL
} from "@/lib/ai/upload-limits";

const PDF_PARSE_TIMEOUT_MS = 90_000;
const ACCEPTED_MIME_TYPES = new Set(AI_SOURCE_ACCEPTED_MIME_TYPES);
const WORKER_SCRIPT_PATH = resolve(
  dirname(fileURLToPath(import.meta.url)),
  "../../scripts/pdf-extract-worker.cjs"
);

function normalizeWhitespace(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.replace(/\s+/g, " ").trim())
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function sanitizeFilename(filename = "document") {
  return filename.replace(/[^a-zA-Z0-9._-]/g, "-");
}

export function inferMimeTypeFromName(filename = "") {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".docx")) {
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  }
  if (lower.endsWith(".pptx")) {
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  }
  if (lower.endsWith(".txt")) return "text/plain";
  return "application/octet-stream";
}

export function inferSourceKindFromMimeType(mimeType = "", filename = "") {
  if (mimeType === "application/pdf" || filename.toLowerCase().endsWith(".pdf")) {
    return "pdf";
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    filename.toLowerCase().endsWith(".docx")
  ) {
    return "docx";
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation" ||
    filename.toLowerCase().endsWith(".pptx")
  ) {
    return "pptx";
  }

  if (mimeType === "text/plain" || filename.toLowerCase().endsWith(".txt")) {
    return "txt";
  }

  return "txt";
}

function isLikelyScannedOrEmpty(extractedText) {
  return (
    extractedText.length < 80 || extractedText.split(" ").filter(Boolean).length < 20
  );
}

function buildLocalPdfMetadata(pdfExtraction) {
  return {
    pdfProcessingMode: "local",
    extractionSource: "local_text",
    pdfPageCount: Number(pdfExtraction?.pageCount || 0) || null,
    pdfExtractedCharacterCount:
      Number(pdfExtraction?.extractedCharacterCount || pdfExtraction?.text?.length || 0) || 0
  };
}

function buildPdfFallbackMetadata(reason, fallback) {
  return {
    pdfProcessingMode: "openai_fallback",
    pdfFallbackReason: reason,
    pdfFallbackItemCount: Array.isArray(fallback?.items) ? fallback.items.length : 0,
    pdfFallbackNotes: Array.isArray(fallback?.notes) ? fallback.notes : []
  };
}

function toUserSafePdfError(error) {
  if (!(error instanceof Error)) {
    return new Error(
      "PDF-ul nu a putut fi citit corect. Incarca un PDF valid, cu text selectabil."
    );
  }

  const normalized = error.message.toLowerCase();

  if (
    normalized.includes("pdf-ul pare scanat") ||
    normalized.includes("text selectabil")
  ) {
    return error;
  }

  if (
    normalized.includes("password") ||
    normalized.includes("encrypted") ||
    normalized.includes("invalid pdf") ||
    normalized.includes("bad xref") ||
    normalized.includes("missing pdf") ||
    normalized.includes("unexpected response") ||
    normalized.includes("worker") ||
    normalized.includes("object.defineproperty") ||
    normalized.includes("pdfjs") ||
    normalized.includes("timed out") ||
    normalized.includes("invalid response")
  ) {
    return new Error(
      "PDF-ul nu a putut fi citit corect. Incarca un PDF valid, cu text selectabil."
    );
  }

  return new Error(
    "PDF-ul nu a putut fi citit corect. Incarca un PDF valid, cu text selectabil."
  );
}

function runPdfExtractWorker(pdfPath) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [WORKER_SCRIPT_PATH, pdfPath], {
      stdio: ["ignore", "pipe", "pipe"]
    });

    let stdout = "";
    let stderr = "";
    let isSettled = false;

    const timeoutId = setTimeout(() => {
      isSettled = true;
      child.kill();
      reject(new Error("PDF parsing timed out."));
    }, PDF_PARSE_TIMEOUT_MS);

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      clearTimeout(timeoutId);
      reject(error);
    });

    child.on("close", (code) => {
      if (isSettled) {
        return;
      }

      isSettled = true;
      clearTimeout(timeoutId);

      let payload = null;
      try {
        payload = JSON.parse(stdout || "{}");
      } catch (error) {
        reject(new Error("PDF worker returned invalid response."));
        return;
      }

      if (payload?.ok && typeof payload.text === "string") {
        resolve({
          text: payload.text,
          pageCount: Number(payload.pageCount || 0) || null,
          extractedCharacterCount:
            Number(payload.extractedCharacterCount || payload.text.length || 0) || 0
        });
        return;
      }

      reject(
        new Error(
          payload?.error ||
            stderr.trim() ||
            `PDF worker failed with code ${code ?? "unknown"}.`
        )
      );
    });
  });
}

export function validateUploadMetadata({ filename = "document", mimeType, sizeBytes }) {
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
    throw new Error("Fisierul selectat pare gol sau invalid.");
  }

  if (sizeBytes > AI_SOURCE_UPLOAD_MAX_BYTES) {
    throw new Error(`Fisierul depaseste limita maxima de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`);
  }

  const resolvedMimeType = mimeType || inferMimeTypeFromName(filename);
  if (!ACCEPTED_MIME_TYPES.has(resolvedMimeType)) {
    throw new Error("Sunt acceptate doar fisiere PDF cu text selectabil, DOCX, PPTX si TXT.");
  }
}

export function validateUpload({ file, manualText, uploadedSourceDocumentId = null }) {
  const hasFile = file && typeof file.name === "string" && file.size > 0;
  const hasManualText = typeof manualText === "string" && manualText.trim().length > 0;
  const hasUploadedSourceDocument =
    typeof uploadedSourceDocumentId === "string" &&
    uploadedSourceDocumentId.trim().length > 0;

  if (!hasFile && !hasManualText && !hasUploadedSourceDocument) {
    throw new Error("Incarca un fisier acceptat sau introdu text manual.");
  }

  if (hasFile) {
    validateUploadMetadata({
      filename: file.name,
      mimeType: file.type || inferMimeTypeFromName(file.name),
      sizeBytes: file.size
    });
  }

  if (hasManualText && Buffer.byteLength(manualText.trim(), "utf8") > AI_SOURCE_UPLOAD_MAX_BYTES) {
    throw new Error(`Textul lipit depaseste limita maxima de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`);
  }
}

export async function prepareSourceFile(file) {
  const mimeType = file.type || inferMimeTypeFromName(file.name);
  const buffer = Buffer.from(await file.arrayBuffer());
  const originalFilename = sanitizeFilename(file.name);

  return {
    sourceKind: inferSourceKindFromMimeType(mimeType, originalFilename),
    originalFilename,
    mimeType,
    sizeBytes: file.size,
    buffer
  };
}

async function extractTextFromPdf(buffer) {
  const tempDir = await mkdtemp(join(tmpdir(), "nota5-pdf-"));
  const tempPdfPath = join(tempDir, `${randomUUID()}.pdf`);

  try {
    await writeFile(tempPdfPath, buffer);
    const pdfExtraction = await runPdfExtractWorker(tempPdfPath);
    const extracted = normalizeWhitespace(pdfExtraction.text);

    if (isLikelyScannedOrEmpty(extracted)) {
      throw new Error(
        "PDF-ul pare scanat sau nu contine suficient text selectabil. Incarca un PDF cu text selectabil, nu imagini scanate."
      );
    }

    return {
      extractedText: extracted,
      extractionMetadata: buildLocalPdfMetadata({
        ...pdfExtraction,
        text: extracted,
        extractedCharacterCount: extracted.length
      })
    };
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function extractTextFromPdfWithFallback({
  buffer,
  originalFilename,
  examType,
  subjectName,
  userId = null,
  sourceDocumentId = null,
  jobId = null,
  allowOpenAIFallback = true
}) {
  const tempDir = await mkdtemp(join(tmpdir(), "nota5-pdf-"));
  const tempPdfPath = join(tempDir, `${randomUUID()}.pdf`);

  try {
    await writeFile(tempPdfPath, buffer);
    const pdfExtraction = await runPdfExtractWorker(tempPdfPath);
    const extracted = normalizeWhitespace(pdfExtraction.text);

    if (isLikelyScannedOrEmpty(extracted)) {
      if (!allowOpenAIFallback) {
        throw new Error(
          "PDF-ul pare scanat sau nu contine suficient text selectabil pentru parsing local."
        );
      }

      const fallback = await extractQuestionBankItemsFromPdfWithOpenAI({
        buffer,
        filename: originalFilename,
        examType,
        subjectName,
        reason: "local_text_too_short",
        userId,
        sourceDocumentId,
        jobId
      });

      if (!fallback?.canonicalText) {
        throw new Error(
          "PDF-ul pare scanat sau nu contine suficient text selectabil. Incarca un PDF cu text selectabil, nu imagini scanate."
        );
      }

      return {
        extractedText: normalizeWhitespace(fallback.canonicalText),
        extractionMetadata: buildPdfFallbackMetadata("local_text_too_short", fallback)
      };
    }

    return {
      extractedText: extracted,
      extractionMetadata: buildLocalPdfMetadata({
        ...pdfExtraction,
        text: extracted,
        extractedCharacterCount: extracted.length
      })
    };
  } catch (error) {
    if (!allowOpenAIFallback) {
      throw toUserSafePdfError(error);
    }

    try {
      const fallback = await extractQuestionBankItemsFromPdfWithOpenAI({
        buffer,
        filename: originalFilename,
        examType,
        subjectName,
        reason: "local_parser_failed",
        userId,
        sourceDocumentId,
        jobId
      });

      if (!fallback?.canonicalText) {
        throw error;
      }

      return {
        extractedText: normalizeWhitespace(fallback.canonicalText),
        extractionMetadata: buildPdfFallbackMetadata("local_parser_failed", fallback)
      };
    } catch (fallbackError) {
      throw toUserSafePdfError(fallbackError instanceof Error ? fallbackError : error);
    }
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function extractTextFromDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  const extracted = normalizeWhitespace(result.value || "");

  if (!extracted) {
    throw new Error("Fisierul DOCX nu contine text care poate fi extras.");
  }

  return extracted;
}

function decodeXmlText(value) {
  return String(value || "")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

function getPptxSlideIndex(pathname) {
  const match = pathname.match(/\/slide(\d+)\.xml$/);
  return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

async function extractTextFromPptx(buffer) {
  const zip = await JSZip.loadAsync(buffer);
  const slideFiles = Object.values(zip.files)
    .filter((file) => !file.dir && /^ppt\/slides\/slide\d+\.xml$/i.test(file.name))
    .sort((a, b) => getPptxSlideIndex(a.name) - getPptxSlideIndex(b.name));

  if (!slideFiles.length) {
    throw new Error("Fisierul PPTX nu contine slide-uri care pot fi citite.");
  }

  const slideSections = [];

  for (const [index, slideFile] of slideFiles.entries()) {
    const xml = await slideFile.async("text");
    const textRuns = Array.from(xml.matchAll(/<a:t[^>]*>([\s\S]*?)<\/a:t>/g))
      .map((match) => decodeXmlText(match[1]).replace(/\s+/g, " ").trim())
      .filter(Boolean);

    if (textRuns.length) {
      slideSections.push(`Slide ${index + 1}\n${textRuns.join("\n")}`);
    }
  }

  const extracted = normalizeWhitespace(slideSections.join("\n\n"));

  if (!extracted) {
    throw new Error("Fisierul PPTX nu contine text care poate fi extras.");
  }

  return {
    extractedText: extracted,
    extractionMetadata: {
      pptxSlideCount: slideFiles.length,
      pptxSlidesWithText: slideSections.length,
      pptxExtractedCharacterCount: extracted.length
    }
  };
}

async function extractTextFromTxt(buffer) {
  const extracted = normalizeWhitespace(buffer.toString("utf8"));

  if (!extracted) {
    throw new Error("Fisierul TXT este gol.");
  }

  return extracted;
}

export async function extractSourceText({
  file,
  manualText,
  examType = "normal",
  subjectName = null,
  userId = null,
  sourceDocumentId = null,
  jobId = null,
  preparedFile = null,
  allowPdfOpenAIFallback = true
}) {
  if (typeof manualText === "string" && manualText.trim().length > 0) {
    const extracted = normalizeWhitespace(manualText);

    if (extracted.length < 80) {
      throw new Error(
        "Textul introdus manual este prea scurt. Adauga mai mult context pentru a genera intrebari utile."
      );
    }

    return {
      sourceKind: "manual",
      originalFilename: null,
      mimeType: "text/plain",
      sizeBytes: Buffer.byteLength(extracted, "utf8"),
      extractedText: extracted,
      storageFile: null,
      extractionMetadata: null
    };
  }

  const prepared =
    preparedFile ||
    (file ? await prepareSourceFile(file) : null);

  if (!prepared && !file) {
    throw new Error("Incarca un fisier acceptat sau introdu text manual.");
  }

  const mimeType =
    prepared?.mimeType || file?.type || inferMimeTypeFromName(file?.name || "");
  const buffer = prepared?.buffer || Buffer.from(await file.arrayBuffer());
  const originalFilename =
    prepared?.originalFilename || sanitizeFilename(file?.name || "document");
  const sizeBytes = prepared?.sizeBytes || file?.size || buffer.length;

  if (mimeType === "application/pdf") {
    const pdfExtraction = await extractTextFromPdfWithFallback({
      buffer,
      originalFilename,
      examType,
      subjectName,
      userId,
      sourceDocumentId,
      jobId,
      allowOpenAIFallback: allowPdfOpenAIFallback
    });

    return {
      sourceKind: "pdf",
      originalFilename,
      mimeType,
      sizeBytes,
      extractedText: pdfExtraction.extractedText,
      storageFile: buffer,
      extractionMetadata: pdfExtraction.extractionMetadata
    };
  }

  if (
    mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return {
      sourceKind: "docx",
      originalFilename,
      mimeType,
      sizeBytes,
      extractedText: await extractTextFromDocx(buffer),
      storageFile: buffer,
      extractionMetadata: null
    };
  }

  if (mimeType === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {
    const pptxExtraction = await extractTextFromPptx(buffer);

    return {
      sourceKind: "pptx",
      originalFilename,
      mimeType,
      sizeBytes,
      extractedText: pptxExtraction.extractedText,
      storageFile: buffer,
      extractionMetadata: pptxExtraction.extractionMetadata
    };
  }

  if (mimeType === "text/plain") {
    return {
      sourceKind: "txt",
      originalFilename,
      mimeType,
      sizeBytes,
      extractedText: await extractTextFromTxt(buffer),
      storageFile: buffer,
      extractionMetadata: null
    };
  }

  throw new Error("Tipul fisierului nu este acceptat.");
}
