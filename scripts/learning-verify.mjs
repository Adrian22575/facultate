import assert from "node:assert/strict";

import JSZip from "jszip";

import { extractSourceText } from "@/lib/ai/extract-text.js";
import { buildLearningArtifactsFromText } from "@/lib/learning/study-set-generator.js";

const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX_MIME = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

function sampleLearningText() {
  return `
Capitolul 1 Introducere in management strategic
Managementul strategic este procesul prin care o organizatie stabileste directia pe termen lung,
analizeaza mediul intern si extern, formuleaza obiective si alege strategii potrivite. Strategia
ajuta organizatia sa foloseasca resursele eficient si sa obtina avantaj competitiv. Un avantaj
competitiv apare atunci cand o firma este aleasa in locul alteia datorita costului, calitatii,
vitezei de livrare sau diferentierii produselor.

Capitolul 2 Analiza mediului
Analiza mediului extern urmareste oportunitatile si amenintarile din piata. Analiza interna
urmareste resursele, competentele, procesele si cultura organizationala. Instrumentele folosite
pot include analiza SWOT, analiza concurentei si evaluarea resurselor cheie. Oportunitatile pot
fi piete noi, tehnologii utile sau schimbari favorabile de legislatie.

Capitolul 3 Implementarea strategiei
Implementarea transforma planul strategic in actiuni concrete. Sunt necesare responsabilitati,
termene, bugete, indicatori si comunicare clara. Controlul strategic compara rezultatele obtinute
cu obiectivele si permite ajustari. Daca indicatorii arata abateri, managerii pot modifica
resursele, prioritizarea sau ritmul activitatilor.
`.repeat(4);
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

async function createDocxBuffer(text) {
  const zip = new JSZip();
  const paragraphs = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<w:p><w:r><w:t>${escapeXml(line)}</w:t></w:r></w:p>`)
    .join("");

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);
  zip.folder("word").file("document.xml", `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
  <w:body>${paragraphs}</w:body>
</w:document>`);

  return zip.generateAsync({ type: "nodebuffer" });
}

async function createPptxBuffer(text) {
  const zip = new JSZip();
  const lines = text.split(/\n+/).map((line) => line.trim()).filter(Boolean).slice(0, 12);
  const slides = [lines.slice(0, 4), lines.slice(4, 8), lines.slice(8, 12)];

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  ${slides.map((_, index) => `<Override PartName="/ppt/slides/slide${index + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`).join("")}
</Types>`);
  zip.folder("_rels").file(".rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/>
</Relationships>`);
  zip.folder("ppt").file("presentation.xml", "<p:presentation xmlns:p=\"http://schemas.openxmlformats.org/presentationml/2006/main\"/>");

  const slideFolder = zip.folder("ppt").folder("slides");
  slides.forEach((slideLines, index) => {
    const textRuns = slideLines
      .map((line) => `<a:t>${escapeXml(line)}</a:t>`)
      .join("");
    slideFolder.file(`slide${index + 1}.xml`, `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
  <p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r>${textRuns}</a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>
</p:sld>`);
  });

  return zip.generateAsync({ type: "nodebuffer" });
}

function createPdfBuffer(text) {
  const lines = text
    .replace(/[()\\]/g, " ")
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 18);
  const content = [
    "BT",
    "/F1 11 Tf",
    "50 760 Td",
    ...lines.flatMap((line, index) => [
      index === 0 ? "" : "0 -22 Td",
      `(${line.slice(0, 92)}) Tj`
    ]).filter(Boolean),
    "ET"
  ].join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
    `<< /Length ${Buffer.byteLength(content, "utf8")} >>\nstream\n${content}\nendstream`
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((object, index) => {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${object}\nendobj\n`;
  });
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  offsets.slice(1).forEach((offset) => {
    pdf += `${String(offset).padStart(10, "0")} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

async function verifyExtraction(label, preparedFile) {
  const result = await extractSourceText({
    file: null,
    manualText: "",
    examType: "normal",
    subjectName: "Management strategic",
    preparedFile,
    allowPdfOpenAIFallback: false
  });

  assert.equal(result.sourceKind, preparedFile.sourceKind, `${label}: source kind`);
  assert.ok(result.extractedText.length >= 600, `${label}: extracted text length`);
  assert.match(result.extractedText, /management|strategic|Capitolul/i, `${label}: expected content`);
  return result;
}

function verifyArtifacts(text) {
  const artifacts = buildLearningArtifactsFromText({
    title: "Management strategic",
    text,
    examDate: "2026-07-01",
    minutesPerDay: 30,
    objective: "recapitulare pentru examen"
  });

  assert.ok(["ready", "ready_with_warnings"].includes(artifacts.status), "artifacts status");
  assert.ok(artifacts.chapters.length >= 2, "chapter count");
  assert.ok(artifacts.stats.flashcardCount > 0, "flashcards generated");
  assert.ok(artifacts.stats.questionCount > 0, "questions generated");
  assert.ok(artifacts.plan.length > 0, "plan generated");
  return artifacts;
}

async function main() {
  const text = sampleLearningText();
  const manual = await extractSourceText({
    file: null,
    manualText: text,
    examType: "normal",
    subjectName: "Management strategic"
  });
  assert.equal(manual.sourceKind, "manual", "manual source kind");
  assert.ok(manual.extractedText.length >= 600, "manual text length");

  const txt = await verifyExtraction("TXT", {
    sourceKind: "txt",
    originalFilename: "management.txt",
    mimeType: "text/plain",
    sizeBytes: Buffer.byteLength(text, "utf8"),
    buffer: Buffer.from(text, "utf8")
  });

  await verifyExtraction("DOCX", {
    sourceKind: "docx",
    originalFilename: "management.docx",
    mimeType: DOCX_MIME,
    sizeBytes: 1,
    buffer: await createDocxBuffer(text)
  });

  await verifyExtraction("PPTX", {
    sourceKind: "pptx",
    originalFilename: "management.pptx",
    mimeType: PPTX_MIME,
    sizeBytes: 1,
    buffer: await createPptxBuffer(text)
  });

  await verifyExtraction("PDF", {
    sourceKind: "pdf",
    originalFilename: "management.pdf",
    mimeType: "application/pdf",
    sizeBytes: 1,
    buffer: createPdfBuffer(text)
  });

  const artifacts = verifyArtifacts(txt.extractedText);

  console.log("learning:verify ok");
  console.log(
    JSON.stringify(
      {
        chapters: artifacts.stats.chapterCount,
        concepts: artifacts.stats.conceptCount,
        flashcards: artifacts.stats.flashcardCount,
        questions: artifacts.stats.questionCount,
        planDays: artifacts.plan.length
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  process.exitCode = 1;
  console.error(error);
});
