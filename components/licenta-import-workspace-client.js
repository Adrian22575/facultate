"use client";

import Link from "next/link";
import {
  BookOpenCheck,
  ClipboardList,
  FileText,
  FolderOpen,
  GraduationCap,
  HelpCircle,
  Keyboard,
  Upload
} from "lucide-react";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { LoadingIconText } from "@/components/loading-spinner";
import { WorkspaceGenerateForm } from "@/components/workspace-generate-form";
import {
  AI_SOURCE_ACCEPTED_MIME_TYPES,
  AI_SOURCE_UPLOAD_MAX_BYTES,
  AI_SOURCE_UPLOAD_MAX_LABEL
} from "@/lib/ai/upload-limits";

const TERMINAL_STATUSES = new Set([
  "ready_for_preview",
  "completed",
  "completed_with_warnings",
  "needs_review",
  "failed"
]);

const EXAMPLES = [
  {
    title: "Raspuns langa intrebare",
    body: `1. Care este documentul principal al unei firme?
A. Contractul
B. Statutul
C. Factura
D. Bonul fiscal
Raspuns corect: B`
  },
  {
    title: "Barem la final",
    body: `1. Intrebarea unu...
A. Varianta A
B. Varianta B
C. Varianta C
D. Varianta D

2. Intrebarea doi...
A. Varianta A
B. Varianta B
C. Varianta C
D. Varianta D

Barem: 1-b, 2-d`
  },
  {
    title: "Set care cere verificare",
    tone: "warning",
    body: `1. Intrebare cu variante clare, dar fara raspuns marcat.
A. Varianta A
B. Varianta B
C. Varianta C
D. Varianta D

2. Intrebare unde raspunsul apare neclar in material.
A. Varianta A
B. Varianta B
C. Varianta C
D. Varianta D`
  }
];
const LICENTA_SET_MIN_CHARS = 80;
const AI_SOURCE_ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes >= 1024 * 1024) {
    const decimals = bytes >= 10 * 1024 * 1024 ? 0 : 1;
    return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isSupportedSourceFile(file) {
  if (!file) {
    return false;
  }

  const normalizedName = file.name.toLowerCase();
  const hasAcceptedExtension = AI_SOURCE_ACCEPTED_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension)
  );
  const hasAcceptedMimeType = file.type
    ? AI_SOURCE_ACCEPTED_MIME_TYPES.includes(file.type)
    : false;

  return hasAcceptedExtension || hasAcceptedMimeType;
}

function getTextQualityChecks(text) {
  const normalizedText = text.trim();
  const optionMatches = normalizedText.match(/(?:^|\n)\s*[A-F][).:-]\s+\S/gim) || [];

  return [
    {
      key: "questions",
      label: "Intrebari",
      passed: /(?:^|\n)\s*\d+[).:-]\s+\S/m.test(normalizedText) || normalizedText.includes("?")
    },
    {
      key: "options",
      label: "Variante",
      passed: optionMatches.length >= 2
    },
    {
      key: "answers",
      label: "Raspuns corect",
      passed: /raspuns\s*(corect)?\s*[:\-]/i.test(normalizedText) || /corect\s*[:\-]/i.test(normalizedText)
    }
  ];
}

function statusLabel(status) {
  if (status === "uploaded" || status === "extracting") return "Pregatim fisierul";
  if (status === "chunking") return "Pregatim continutul";
  if (status === "processing") return "Cautam intrebarile";
  if (status === "matching_answers") return "Cautam raspunsurile";
  if (status === "ready_for_preview") return "Gata de verificat";
  if (status === "completed") return "Salvat";
  if (status === "completed_with_warnings") return "Salvat cu atentionari";
  if (status === "needs_review") return "Necesita verificare";
  if (status === "failed") return "Oprit";
  return "In asteptare";
}

function statusTone(status) {
  if (status === "completed" || status === "ready_for_preview") return "is-good";
  if (status === "failed" || status === "needs_review" || status === "completed_with_warnings") return "is-warning";
  return "is-muted";
}

function questionStatusLabel(status) {
  if (status === "answer_matched") return "Cu raspuns";
  if (status === "missing_answer") return "Fara raspuns";
  if (status === "needs_review") return "De verificat";
  return "Extras";
}

function ExamplesModal({ onClose }) {
  return (
    <div className="workspace-modal-backdrop" role="presentation">
      <div
        className="workspace-modal-card import-examples-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="import-examples-title"
      >
        <div className="workspace-modal-head">
          <div>
            <strong id="import-examples-title">Exemple de continut acceptat</strong>
            <p>Poti pune intrebarile si raspunsurile in mai multe forme. Pastreaza textul cat mai clar.</p>
          </div>
          <button className="workspace-modal-close feedback-modal-close" type="button" onClick={onClose}>
            Inchide
          </button>
        </div>
        <div className="import-examples-grid">
          {EXAMPLES.map((example) => (
            <article
              key={example.title}
              className={`ui-panel-card import-example-card ${example.tone === "warning" ? "is-warning" : ""}`}
            >
              <strong>{example.title}</strong>
              <pre>{example.body}</pre>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}

function IconText({ icon: Icon, children }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

function QuestionPreviewList({ title, items }) {
  if (!items?.length) {
    return null;
  }

  return (
    <section className="import-preview-block">
      <h3>{title}</h3>
      <div className="draft-list import-preview-list">
        {items.map((item) => (
          <article key={item.id} className="draft-card import-preview-question">
            <div className="draft-card-head">
              <div>
                <span className="step-eyebrow">{`Intrebarea ${item.globalIndex || item.localNumber || ""}`}</span>
                <strong>{item.questionText}</strong>
              </div>
              <span className={`status-pill ${item.status === "answer_matched" ? "is-good" : "is-warning"}`}>
                {questionStatusLabel(item.status)}
              </span>
            </div>
            <ol className="review-answer-list">
              {(item.options || []).map((option, index) => (
                <li key={`${item.id}-${index}`} className={`review-answer-item ${option.isCorrect ? "is-correct" : ""}`}>
                  <span className="review-answer-badge">
                    {String(option.label || String.fromCharCode(65 + index)).toUpperCase()}
                  </span>
                  <span className="review-answer-copy">{option.text}</span>
                </li>
              ))}
            </ol>
          </article>
        ))}
      </div>
    </section>
  );
}

function getActiveLicentaStep(session) {
  const setCount = Number(session?.setCount || 0);
  const completedSetCount = Number(session?.completedSetCount || 0);
  const missingAnswers = Number(session?.questionsMissingAnswers || 0);
  const needsReview = Number(session?.needsReviewCount || 0);

  if (missingAnswers > 0 || needsReview > 0) {
    return {
      eyebrow: "Verificare necesara",
      title: "Rezolva intrebarile ramase",
      copy: `${missingAnswers} fara raspuns si ${needsReview} de verificat in licenta activa.`,
      cta: "Continua verificarea"
    };
  }

  if (setCount > completedSetCount) {
    return {
      eyebrow: "Set in lucru",
      title: "Termina setul curent",
      copy: "Dupa ce il adaugi in licenta, poti incarca urmatorul set sau poti finaliza.",
      cta: "Deschide setul"
    };
  }

  if (completedSetCount > 0) {
    return {
      eyebrow: "Licenta pregatita",
      title: "Alegi urmatorul pas",
      copy: "Seturile incarcate sunt curate. Continua cu alt set sau finalizeaza licenta.",
      cta: "Continua licenta"
    };
  }

  return {
    eyebrow: "Licenta activa",
    title: "Incarca primul set",
    copy: "Ai o sesiune deschisa. Primul set trebuie incarcat din pagina licentei active.",
    cta: "Deschide licenta"
  };
}

function ImportProgress({ status, preview, onConfirm, onRetry, isBusy }) {
  if (!status) {
    return null;
  }

  const progress =
    Number.isFinite(status.progressPercent)
      ? status.progressPercent
      : status.totalChunks > 0
      ? Math.round((status.processedChunks / Math.max(status.totalChunks, 1)) * 100)
      : TERMINAL_STATUSES.has(status.status)
        ? 100
        : 8;

  return (
    <section className="workspace-form-panel ui-panel-card import-progress-panel">
      <div className="dashboard-header">
        <div>
          <span className={`status-pill ${statusTone(status.status)}`}>{statusLabel(status.status)}</span>
          <h2>{status.fileName || status.title || "Import grile"}</h2>
          <p className="page-copy">{status.message}</p>
        </div>
      </div>

      <div className="progress-bar-container job-progress-bar" aria-label="Progres import">
        <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
      </div>

      <div className="import-count-grid">
        <article>
          <span>Etape finalizate</span>
          <strong>{`${status.processedChunks}/${status.totalChunks || 0}`}</strong>
        </article>
        <article>
          <span>Intrebari</span>
          <strong>{status.totalQuestions}</strong>
        </article>
        <article>
          <span>Cu raspuns</span>
          <strong>{status.questionsWithAnswers}</strong>
        </article>
        <article>
          <span>Fara raspuns</span>
          <strong>{status.questionsMissingAnswers}</strong>
        </article>
        <article>
          <span>De verificat</span>
          <strong>{status.needsReviewCount}</strong>
        </article>
      </div>

      {status.errorMessage ? <div className="error-state">{status.errorMessage}</div> : null}

      {preview ? (
        <div className="import-preview-shell">
          {preview.warnings?.length ? (
            <div className="workspace-credit-alert import-warning-panel">
              <div>
                <strong>Atentionari</strong>
                {preview.warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          ) : null}

          <QuestionPreviewList title="Primele intrebari" items={preview.first} />
          <QuestionPreviewList title="Ultimele intrebari" items={preview.last} />
        </div>
      ) : null}

      <div className="inline-actions import-actions-row">
        {status.status === "failed" ? (
          <button type="button" className="btn-back" onClick={onRetry} disabled={isBusy}>
            <LoadingIconText loading={isBusy} loadingLabel="Reluam...">
              Reproceseaza
            </LoadingIconText>
          </button>
        ) : null}
        {(status.status === "ready_for_preview" || status.status === "needs_review") && status.questionsWithAnswers > 0 ? (
          <button type="button" onClick={onConfirm} disabled={isBusy}>
            <LoadingIconText loading={isBusy} loadingLabel="Se salveaza...">
              Salveaza importul
            </LoadingIconText>
          </button>
        ) : null}
        {status.resultHref ? (
          <Link className="btn-back" href={status.resultHref}>
            Deschide verificarea
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function LicentaImportWorkspaceClient({
  userType,
  subjects,
  demoMode,
  setupWarning,
  billingSnapshot,
  activeLicentaSession,
  message,
  error
}) {
  const [mainMode, setMainMode] = useState("licenta");
  const [licentaImportMode, setLicentaImportMode] = useState("set");
  const [setSourceMode, setSetSourceMode] = useState("text");
  const [contentText, setContentText] = useState("");
  const [selectedAutoFile, setSelectedAutoFile] = useState(null);
  const [selectedSetFile, setSelectedSetFile] = useState(null);
  const [isDraggingAutoFile, setIsDraggingAutoFile] = useState(false);
  const [isDraggingSetFile, setIsDraggingSetFile] = useState(false);
  const [showExamples, setShowExamples] = useState(false);
  const [activeStatus, setActiveStatus] = useState(null);
  const [preview, setPreview] = useState(null);
  const [activeError, setActiveError] = useState("");
  const [isBusy, setIsBusy] = useState(false);
  const processingRef = useRef(false);
  const autoFileRef = useRef(null);
  const setContentFileRef = useRef(null);
  const autoFileInputId = useId();
  const setFileInputId = useId();
  const autoFileDropNoteId = `${autoFileInputId}-note`;
  const autoFileDropStatusId = `${autoFileInputId}-status`;
  const setFileDropNoteId = `${setFileInputId}-note`;
  const setFileDropStatusId = `${setFileInputId}-status`;

  const noCredits = billingSnapshot.aiCredits < 1;
  const disabled = demoMode || Boolean(setupWarning) || noCredits || isBusy;
  const activeJobId = activeStatus?.importJobId || null;
  const activeLicentaStep = activeLicentaSession ? getActiveLicentaStep(activeLicentaSession) : null;
  const creditCountLabel =
    billingSnapshot.aiCredits === 1
      ? "1 incarcare disponibila"
      : `${billingSnapshot.aiCredits} incarcari disponibile`;
  const licentaCreditPolicyText = noCredits
    ? "Ai nevoie de o incarcare disponibila ca sa pornesti importul."
    : licentaImportMode === "set"
      ? "Pe seturi, nu consumi la fiecare set. Se foloseste 1 incarcare doar la finalizare."
      : "Fisierul complet foloseste 1 incarcare cand confirmi rezultatul final.";
  const autoFileUnsupported = selectedAutoFile ? !isSupportedSourceFile(selectedAutoFile) : false;
  const autoFileTooLarge = selectedAutoFile ? selectedAutoFile.size > AI_SOURCE_UPLOAD_MAX_BYTES : false;
  const autoFileHasIssue = autoFileUnsupported || autoFileTooLarge;
  const autoFileSizeLabel = selectedAutoFile ? formatFileSize(selectedAutoFile.size) : "";
  const autoSubmitDisabled = disabled || !selectedAutoFile || autoFileHasIssue;
  const autoFileReady = Boolean(selectedAutoFile && !autoFileHasIssue);
  const autoFileDropStatusText = selectedAutoFile
    ? `${selectedAutoFile.name} selectat, ${autoFileSizeLabel}.`
    : "Niciun fisier complet selectat.";
  const autoInputHint = noCredits
    ? "Adauga o incarcare ca sa poti porni importul."
    : isBusy
      ? "Pornim importul complet."
      : !selectedAutoFile
        ? "Alege fisierul complet pentru import."
        : autoFileUnsupported
          ? "Alege un fisier PDF, DOCX sau TXT."
          : autoFileTooLarge
            ? `Alege un fisier sub ${AI_SOURCE_UPLOAD_MAX_LABEL}.`
            : "Fisierul complet este pregatit pentru import.";
  const setTextLength = contentText.trim().length;
  const setTextTooShort =
    setSourceMode === "text" &&
    setTextLength > 0 &&
    setTextLength < LICENTA_SET_MIN_CHARS;
  const setTextQualityChecks = getTextQualityChecks(contentText);
  const setTextNeedsReview =
    setSourceMode === "text" &&
    setTextLength >= LICENTA_SET_MIN_CHARS &&
    setTextQualityChecks.some((check) => !check.passed);
  const setFileUnsupported = selectedSetFile ? !isSupportedSourceFile(selectedSetFile) : false;
  const setFileTooLarge = selectedSetFile ? selectedSetFile.size > AI_SOURCE_UPLOAD_MAX_BYTES : false;
  const setFileHasIssue = setFileUnsupported || setFileTooLarge;
  const setFileSizeLabel = selectedSetFile ? formatFileSize(selectedSetFile.size) : "";
  const setFileReady = Boolean(selectedSetFile && !setFileHasIssue);
  const setFileDropStatusText = selectedSetFile
    ? `${selectedSetFile.name} selectat, ${setFileSizeLabel}.`
    : "Niciun fisier de set selectat.";
  const setInputMissing =
    setSourceMode === "text" ? setTextLength === 0 : !selectedSetFile;
  const setInputReady = !setInputMissing && !setTextTooShort && !setFileHasIssue;
  const setSubmitDisabled = disabled || !setInputReady;
  const setInputHint = noCredits
    ? "Adauga o incarcare ca sa poti porni importul."
    : isBusy
      ? "Procesarea setului este in curs."
      : setInputMissing
        ? setSourceMode === "text"
          ? "Lipeste continutul setului ca sa poti porni procesarea."
          : "Alege fisierul setului ca sa poti porni procesarea."
        : setFileUnsupported
          ? "Alege un fisier PDF, DOCX sau TXT."
        : setFileTooLarge
          ? `Alege un fisier sub ${AI_SOURCE_UPLOAD_MAX_LABEL}.`
        : setTextTooShort
          ? `Mai adauga ${LICENTA_SET_MIN_CHARS - setTextLength} caractere.`
          : "Setul este pregatit pentru procesare.";
  const shouldProcess = useMemo(
    () => activeJobId && activeStatus && !TERMINAL_STATUSES.has(activeStatus.status),
    [activeJobId, activeStatus]
  );

  async function readJson(response) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Cererea nu a putut fi finalizata.");
    }
    return payload;
  }

  async function loadPreview(importJobId) {
    const response = await fetch(`/api/import/${importJobId}/preview`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });
    const payload = await readJson(response);
    setPreview(payload);
    setActiveStatus(payload.status);
  }

  function applyAutoFile(nextFile) {
    if (disabled) {
      return;
    }
    setSelectedAutoFile(nextFile);
    setActiveError("");
  }

  function applySetFile(nextFile) {
    if (disabled) {
      return;
    }
    setSelectedSetFile(nextFile);
    setActiveError("");
  }

  function applyDroppedAutoFiles(fileList) {
    if (disabled) {
      return;
    }

    const droppedFiles = Array.from(fileList || []);
    if (droppedFiles.length > 1) {
      setActiveError("Incarca un singur fisier complet pe rand.");
      return;
    }

    applyAutoFile(droppedFiles[0] || null);
  }

  function applyDroppedSetFiles(fileList) {
    if (disabled) {
      return;
    }

    const droppedFiles = Array.from(fileList || []);
    if (droppedFiles.length > 1) {
      setActiveError("Incarca un singur fisier pentru setul curent.");
      return;
    }

    applySetFile(droppedFiles[0] || null);
  }

  function clearAutoFile() {
    if (isBusy) {
      return;
    }
    setSelectedAutoFile(null);
    setActiveError("");
    if (autoFileRef.current) {
      autoFileRef.current.value = "";
    }
  }

  function clearSetFile() {
    if (isBusy) {
      return;
    }
    setSelectedSetFile(null);
    setActiveError("");
    if (setContentFileRef.current) {
      setContentFileRef.current.value = "";
    }
  }

  function clearSetText() {
    if (isBusy) {
      return;
    }
    setContentText("");
    setActiveError("");
  }

  async function processOnce(importJobId) {
    const response = await fetch(`/api/import/${importJobId}/process`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readJson(response);
    setActiveStatus(payload);

    if (TERMINAL_STATUSES.has(payload.status)) {
      await loadPreview(importJobId);
    }
  }

  useEffect(() => {
    if (!shouldProcess || processingRef.current) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;

    async function tick() {
      if (cancelled || processingRef.current || !activeJobId) {
        return;
      }

      processingRef.current = true;
      try {
        await processOnce(activeJobId);
      } catch (err) {
        setActiveError(err instanceof Error ? err.message : "Procesarea s-a oprit.");
      } finally {
        processingRef.current = false;
        if (!cancelled && activeJobId) {
          timeoutId = window.setTimeout(tick, 900);
        }
      }
    }

    timeoutId = window.setTimeout(tick, 250);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [activeJobId, shouldProcess]);

  async function submitAuto(event) {
    event.preventDefault();
    if (autoSubmitDisabled) {
      return;
    }

    const file = selectedAutoFile;
    if (!file) {
      setActiveError("Alege fisierul complet pentru import.");
      return;
    }
    if (!isSupportedSourceFile(file)) {
      setActiveError("Tip de fisier neacceptat. Alege PDF, DOCX sau TXT.");
      return;
    }
    if (file.size > AI_SOURCE_UPLOAD_MAX_BYTES) {
      setActiveError(`Fisierul depaseste limita maxima de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`);
      return;
    }

    setIsBusy(true);
    setActiveError("");
    setPreview(null);
    try {
      const formData = new FormData();
      formData.set("sourceFile", file);
      const response = await fetch("/api/import/auto", {
        method: "POST",
        credentials: "same-origin",
        body: formData
      });
      const payload = await readJson(response);
      window.location.assign(`/materiale/imports/${payload.importJobId}`);
    } catch (err) {
      setActiveError(err instanceof Error ? err.message : "Nu am putut porni importul.");
    } finally {
      setIsBusy(false);
    }
  }

  async function submitSet(event) {
    event.preventDefault();
    if (setSubmitDisabled) {
      return;
    }

    const contentFile = selectedSetFile;
    if (setSourceMode === "text" && !contentText.trim()) {
      setActiveError("Lipeste continutul complet al setului.");
      return;
    }
    if (setSourceMode === "text" && contentText.trim().length < LICENTA_SET_MIN_CHARS) {
      setActiveError(`Setul este prea scurt. Adauga cel putin ${LICENTA_SET_MIN_CHARS} de caractere.`);
      return;
    }
    if (setSourceMode === "file" && !contentFile) {
      setActiveError("Alege fisierul mic pentru import pe seturi.");
      return;
    }
    if (setSourceMode === "file" && !isSupportedSourceFile(contentFile)) {
      setActiveError("Tip de fisier neacceptat. Alege PDF, DOCX sau TXT.");
      return;
    }
    if (setSourceMode === "file" && contentFile.size > AI_SOURCE_UPLOAD_MAX_BYTES) {
      setActiveError(`Fisierul depaseste limita maxima de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`);
      return;
    }

    setIsBusy(true);
    setActiveError("");
    setPreview(null);
    try {
      const formData = new FormData();
      if (setSourceMode === "text") {
        formData.set("contentText", contentText);
      } else if (contentFile) {
        formData.set("contentFile", contentFile);
      }

      const response = await fetch("/api/import/set", {
        method: "POST",
        credentials: "same-origin",
        body: formData
      });
      const payload = await readJson(response);
      window.location.assign(`/materiale/licenta/${payload.licentaSessionId}?set=${payload.importJobId}`);
    } catch (err) {
      setActiveError(err instanceof Error ? err.message : "Nu am putut porni importul pe seturi.");
    } finally {
      setIsBusy(false);
    }
  }

  async function retryImport() {
    if (!activeJobId) return;
    setIsBusy(true);
    setActiveError("");
    try {
      const response = await fetch(`/api/import/${activeJobId}/retry`, {
        method: "POST",
        credentials: "same-origin"
      });
      setActiveStatus(await readJson(response));
      setPreview(null);
    } catch (err) {
      setActiveError(err instanceof Error ? err.message : "Nu am putut relua importul.");
    } finally {
      setIsBusy(false);
    }
  }

  async function confirmImport() {
    if (!activeJobId) return;
    setIsBusy(true);
    setActiveError("");
    try {
      const response = await fetch(`/api/import/${activeJobId}/confirm`, {
        method: "POST",
        credentials: "same-origin"
      });
      const payload = await readJson(response);
      setActiveStatus(payload);
      await loadPreview(activeJobId);
    } catch (err) {
      setActiveError(err instanceof Error ? err.message : "Nu am putut salva importul.");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <div className="licenta-import-workspace">
      {demoMode ? (
        <div className="error-state">In modul demo poti vedea doar interfata. Pentru procesare reala intra cu Google.</div>
      ) : null}
      {setupWarning ? <div className="error-state">{setupWarning}</div> : null}
      {message ? <div className="success-state">{message}</div> : null}
      {error ? <div className="error-state">{error}</div> : null}
      {activeError ? <div className="error-state">{activeError}</div> : null}

      <section className="workspace-form-panel ui-panel-card import-choice-panel">
        <div className="workspace-form-head">
          <div>
            <span className="ui-section-label ai-workspace-step-label">Alege ce vrei sa importi</span>
            <h2>Licenta sau test grila</h2>
          </div>
        </div>
        <div className="ui-segmented-tabs import-main-tabs" role="tablist" aria-label="Tip import">
          <button
            type="button"
            role="tab"
            aria-selected={mainMode === "licenta"}
            className={`ui-segmented-tab secondary ${mainMode === "licenta" ? "is-active" : ""}`}
            onClick={() => setMainMode("licenta")}
          >
            <IconText icon={GraduationCap}>Licenta</IconText>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mainMode === "test"}
            className={`ui-segmented-tab secondary ${mainMode === "test" ? "is-active" : ""}`}
            onClick={() => setMainMode("test")}
          >
            <IconText icon={BookOpenCheck}>Test grila</IconText>
          </button>
        </div>
      </section>

      {mainMode === "test" ? (
        <WorkspaceGenerateForm
          userType={userType}
          subjects={subjects}
          initialExamType="normal"
          fixedExamType="normal"
          demoMode={demoMode}
          setupWarning={setupWarning}
          billingSnapshot={billingSnapshot}
          message={null}
          error={null}
        />
      ) : (
        <>
          {activeLicentaSession ? (
            <section className="workspace-form-panel ui-panel-card licenta-active-session-focus">
              <div className="workspace-form-head">
                <div>
                  <span className="ui-section-label ai-workspace-step-label">{activeLicentaStep.eyebrow}</span>
                  <h2>{activeLicentaStep.title}</h2>
                  <p>
                    {activeLicentaStep.copy}
                  </p>
                </div>
              </div>
              <div className="licenta-active-session-stats">
                <article>
                  <span>Seturi adaugate</span>
                  <strong>{`${activeLicentaSession.completedSetCount}/${activeLicentaSession.setCount}`}</strong>
                </article>
                <article>
                  <span>Intrebari</span>
                  <strong>{activeLicentaSession.totalQuestions}</strong>
                </article>
                <article>
                  <span>Cu raspuns</span>
                  <strong>{activeLicentaSession.questionsWithAnswers}</strong>
                </article>
                <article>
                  <span>De rezolvat</span>
                  <strong>
                    {Number(activeLicentaSession.questionsMissingAnswers || 0) +
                      Number(activeLicentaSession.needsReviewCount || 0)}
                  </strong>
                </article>
              </div>
              <div className="workspace-credit-alert licenta-active-session-note">
                <div>
                  <strong>Nu porni alta licenta pentru setul urmator</strong>
                  <p>Tot ce urci pentru aceasta licenta trebuie sa ramana in aceeasi sesiune. Creditul se consuma doar la finalizare.</p>
                </div>
              </div>
              <div className="inline-actions import-actions-row">
                <Link className="btn-back" href={activeLicentaSession.href}>
                  <IconText icon={FolderOpen}>{activeLicentaStep.cta}</IconText>
                </Link>
              </div>
            </section>
          ) : (
            <>
          <section className="workspace-form-panel ui-panel-card import-method-panel">
            <div className="workspace-form-head">
              <div>
                <span className="ui-section-label ai-workspace-step-label">Metoda de import</span>
                <h2>Alege cum adaugi materialul</h2>
              </div>
            </div>
            <div className="ui-segmented-tabs import-method-tabs" role="tablist" aria-label="Metoda import licenta">
              <button
                type="button"
                role="tab"
                aria-selected={licentaImportMode === "set"}
                className={`ui-segmented-tab secondary import-method-tab ${licentaImportMode === "set" ? "is-active" : ""}`}
                onClick={() => setLicentaImportMode("set")}
              >
                <IconText icon={FolderOpen}>Import pe seturi</IconText>
                <span className="ui-chip is-good import-method-badge">Recomandat</span>
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={licentaImportMode === "auto"}
                className={`ui-segmented-tab secondary import-method-tab ${licentaImportMode === "auto" ? "is-active" : ""}`}
                onClick={() => {
                  setLicentaImportMode("auto");
                  setActiveError("");
                }}
              >
                <IconText icon={FileText}>Fisier complet</IconText>
              </button>
            </div>
            <div className={`ai-workspace-credit-summary licenta-import-credit-summary${noCredits ? " is-warning" : ""}`}>
              <span className={`ui-chip ${noCredits ? "is-warning" : "is-good"}`}>
                {creditCountLabel}
              </span>
              <span>{licentaCreditPolicyText}</span>
            </div>
          </section>

          {licentaImportMode === "auto" ? (
            <form className="workspace-form-panel ui-panel-card import-mode-card import-mode-card-single" onSubmit={submitAuto}>
              <div className="workspace-form-head">
                <div>
                  <span className="ui-section-label ai-workspace-step-label">Fisier complet</span>
                  <h2>Incarca fisierul complet</h2>
                  <p>
                    Potrivit cand fisierul este ordonat si raspunsurile sunt usor de identificat.
                  </p>
                </div>
              </div>
              <div className="selector-container ai-workspace-source-panel">
                <label
                  className={`ai-workspace-file-dropzone${
                    isDraggingAutoFile ? " is-dragging" : ""
                  }${autoFileHasIssue ? " is-warning" : ""}${autoFileReady ? " is-ready" : ""}`}
                  htmlFor={autoFileInputId}
                  role="button"
                  tabIndex={disabled ? -1 : 0}
                  aria-disabled={disabled}
                  aria-describedby={`${autoFileDropNoteId} ${autoFileDropStatusId}`}
                  onKeyDown={(event) => {
                    if (disabled) {
                      return;
                    }

                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      autoFileRef.current?.click();
                    }
                  }}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    if (disabled) {
                      return;
                    }
                    setIsDraggingAutoFile(true);
                  }}
                  onDragOver={(event) => {
                    event.preventDefault();
                    if (disabled) {
                      return;
                    }
                    event.dataTransfer.dropEffect = "copy";
                    setIsDraggingAutoFile(true);
                  }}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget)) {
                      setIsDraggingAutoFile(false);
                    }
                  }}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDraggingAutoFile(false);
                    applyDroppedAutoFiles(event.dataTransfer.files);
                  }}
                >
                  <span className="ai-workspace-file-drop-title">
                    {isDraggingAutoFile ? "Elibereaza fisierul aici" : "Alege sau trage fisierul complet aici"}
                  </span>
                  <span id={autoFileDropNoteId} className="ai-workspace-file-drop-note">
                    Un singur PDF, DOCX sau TXT cu toata licenta. Maxim {AI_SOURCE_UPLOAD_MAX_LABEL}.
                  </span>
                  <input
                    id={autoFileInputId}
                    ref={autoFileRef}
                    className="ai-workspace-file-input"
                    type="file"
                    disabled={disabled}
                    tabIndex={-1}
                    accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                    onChange={(event) => {
                      applyAutoFile(event.target.files?.[0] || null);
                    }}
                  />
                </label>
                <p id={autoFileDropStatusId} className="sr-only" aria-live="polite">
                  {autoFileDropStatusText}
                </p>
              </div>
              {selectedAutoFile ? (
                <div className={`ai-workspace-source-meta${autoFileHasIssue ? " is-warning" : ""}`}>
                  <span className={`ui-chip ${autoFileHasIssue ? "is-warning" : "is-good"}`}>
                    {autoFileUnsupported
                      ? "Tip neacceptat"
                      : autoFileTooLarge
                        ? "Prea mare"
                        : "Fisier selectat"}
                  </span>
                  <span>{selectedAutoFile.name}</span>
                  <span>
                    {autoFileSizeLabel} din {AI_SOURCE_UPLOAD_MAX_LABEL}
                  </span>
                  <button
                    type="button"
                    className="btn-link secondary ai-workspace-source-action"
                    onClick={clearAutoFile}
                    disabled={isBusy}
                  >
                    Sterge fisierul
                  </button>
                </div>
              ) : null}
              <div className="inline-actions import-actions-row">
                <button type="submit" disabled={autoSubmitDisabled}>
                  <LoadingIconText icon={Upload} loading={isBusy} loadingLabel="Pornim...">
                    Incarca fisier
                  </LoadingIconText>
                </button>
                <p className="ai-workspace-submit-action-hint" aria-live="polite">
                  {autoInputHint}
                </p>
              </div>
            </form>
          ) : (
            <form className="workspace-form-panel ui-panel-card import-mode-card import-mode-card-single" onSubmit={submitSet}>
              <div className="workspace-form-head">
                <div>
                  <span className="ui-section-label ai-workspace-step-label">Import pe seturi</span>
                  <h2>Proceseaza licenta pe seturi</h2>
                  <p>
                    Recomandat pentru materiale mari sau neclare. Seturile raman in aceeasi licenta,
                    iar incarcarea se consuma doar la final.
                  </p>
                </div>
                <button type="button" className="btn-link secondary import-examples-trigger" onClick={() => setShowExamples(true)}>
                  <IconText icon={HelpCircle}>Vezi exemple</IconText>
                </button>
              </div>

              <div className="ui-segmented-tabs ai-workspace-source-tabs" role="tablist" aria-label="Sursa setului">
                <button
                  type="button"
                  role="tab"
                  aria-selected={setSourceMode === "text"}
                  className={`ui-segmented-tab secondary ai-workspace-source-tab ${setSourceMode === "text" ? "is-active" : ""}`}
                  onClick={() => {
                    setSetSourceMode("text");
                    setActiveError("");
                  }}
                >
                  <IconText icon={Keyboard}>Input text</IconText>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={setSourceMode === "file"}
                  className={`ui-segmented-tab secondary ai-workspace-source-tab ${setSourceMode === "file" ? "is-active" : ""}`}
                  onClick={() => {
                    setSetSourceMode("file");
                    setActiveError("");
                  }}
                >
                  <IconText icon={Upload}>Fisier</IconText>
                </button>
              </div>

              {setSourceMode === "text" ? (
                <div className="selector-container ai-workspace-source-panel">
                  <label>
                    Lipeste continutul complet al setului
                    <textarea
                      className="textarea-input ai-workspace-textarea"
                      rows="12"
                      value={contentText}
                      onChange={(event) => {
                        setContentText(event.target.value);
                        setActiveError("");
                      }}
                      placeholder="Pune aici intrebarile, variantele si raspunsurile, daca exista."
                    />
                  </label>
                  {setTextLength > 0 ? (
                    <div className={`ai-workspace-source-meta${setTextTooShort || setTextNeedsReview ? " is-warning" : ""}`}>
                      <span className={`ui-chip ${setTextTooShort || setTextNeedsReview ? "is-warning" : "is-good"}`}>
                        {setTextTooShort
                          ? "Set scurt"
                          : setTextNeedsReview
                            ? "Verifica structura"
                            : "Set pregatit"}
                      </span>
                      <span>
                        {setTextLength}/{LICENTA_SET_MIN_CHARS} caractere minime
                      </span>
                      <button
                        type="button"
                        className="btn-link secondary ai-workspace-source-action"
                        onClick={clearSetText}
                        disabled={isBusy}
                      >
                        Sterge textul
                      </button>
                    </div>
                  ) : null}
                  {setTextLength >= LICENTA_SET_MIN_CHARS ? (
                    <div className="ai-workspace-text-signals" aria-label="Semnale set licenta">
                      {setTextQualityChecks.map((check) => (
                        <span
                          key={check.key}
                          className={`ai-workspace-text-signal${check.passed ? " is-done" : " is-open"}`}
                        >
                          <span aria-hidden="true">{check.passed ? "OK" : "?"}</span>
                          {check.label}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              ) : (
                <div className="selector-container ai-workspace-source-panel">
                  <label
                    className={`ai-workspace-file-dropzone${
                      isDraggingSetFile ? " is-dragging" : ""
                    }${setFileHasIssue ? " is-warning" : ""}${setFileReady ? " is-ready" : ""}`}
                    htmlFor={setFileInputId}
                    role="button"
                    tabIndex={disabled ? -1 : 0}
                    aria-disabled={disabled}
                    aria-describedby={`${setFileDropNoteId} ${setFileDropStatusId}`}
                    onKeyDown={(event) => {
                      if (disabled) {
                        return;
                      }

                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        setContentFileRef.current?.click();
                      }
                    }}
                    onDragEnter={(event) => {
                      event.preventDefault();
                      if (disabled) {
                        return;
                      }
                      setIsDraggingSetFile(true);
                    }}
                    onDragOver={(event) => {
                      event.preventDefault();
                      if (disabled) {
                        return;
                      }
                      event.dataTransfer.dropEffect = "copy";
                      setIsDraggingSetFile(true);
                    }}
                    onDragLeave={(event) => {
                      if (!event.currentTarget.contains(event.relatedTarget)) {
                        setIsDraggingSetFile(false);
                      }
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      setIsDraggingSetFile(false);
                      applyDroppedSetFiles(event.dataTransfer.files);
                    }}
                  >
                    <span className="ai-workspace-file-drop-title">
                      {isDraggingSetFile ? "Elibereaza fisierul aici" : "Alege sau trage fisierul setului aici"}
                    </span>
                    <span id={setFileDropNoteId} className="ai-workspace-file-drop-note">
                      Un singur fisier mic pentru setul curent. PDF, DOCX sau TXT, maxim {AI_SOURCE_UPLOAD_MAX_LABEL}.
                    </span>
                    <input
                      id={setFileInputId}
                      ref={setContentFileRef}
                      className="ai-workspace-file-input"
                      type="file"
                      disabled={disabled}
                      tabIndex={-1}
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      onChange={(event) => {
                        applySetFile(event.target.files?.[0] || null);
                      }}
                    />
                  </label>
                  <p id={setFileDropStatusId} className="sr-only" aria-live="polite">
                    {setFileDropStatusText}
                  </p>
                  <p className="micro-copy ai-workspace-source-hint">
                    Pentru materiale mari, incarca pe rand seturi mai mici. Le vei vedea grupate in aceeasi licenta.
                  </p>
                  {selectedSetFile ? (
                    <div className={`ai-workspace-source-meta${setFileHasIssue ? " is-warning" : ""}`}>
                      <span className={`ui-chip ${setFileHasIssue ? "is-warning" : "is-good"}`}>
                        {setFileUnsupported
                          ? "Tip neacceptat"
                          : setFileTooLarge
                            ? "Prea mare"
                            : "Fisier selectat"}
                      </span>
                      <span>{selectedSetFile.name}</span>
                      <span>
                        {setFileSizeLabel} din {AI_SOURCE_UPLOAD_MAX_LABEL}
                      </span>
                      <button
                        type="button"
                        className="btn-link secondary ai-workspace-source-action"
                        onClick={clearSetFile}
                        disabled={isBusy}
                      >
                        Sterge fisierul
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="inline-actions import-actions-row">
                <button type="submit" disabled={setSubmitDisabled}>
                  <LoadingIconText icon={ClipboardList} loading={isBusy} loadingLabel="Procesam...">
                    Proceseaza setul
                  </LoadingIconText>
                </button>
                <p className="ai-workspace-submit-action-hint" aria-live="polite">
                  {setInputHint}
                </p>
              </div>
            </form>
          )}

          {noCredits ? (
            <div className="workspace-credit-alert">
              <div>
                <strong>Nu mai ai incarcari disponibile</strong>
                <p>Adauga o incarcare noua din cont ca sa poti importa grilele.</p>
              </div>
              <Link className="btn-link secondary ai-workspace-alert-link" href="/cont?section=credits">
                Adauga incarcari
              </Link>
            </div>
          ) : null}
            </>
          )}

        </>
      )}

      {showExamples ? <ExamplesModal onClose={() => setShowExamples(false)} /> : null}
    </div>
  );
}
