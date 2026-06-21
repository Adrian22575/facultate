"use client";

import Link from "next/link";
import { useEffect, useId, useMemo, useRef, useState } from "react";

import { LoadingIconText } from "@/components/loading-spinner";
import { WorkspaceSubjectPicker } from "@/components/workspace-subject-picker";
import {
  AI_SOURCE_ACCEPTED_MIME_TYPES,
  AI_SOURCE_UPLOAD_MAX_BYTES,
  AI_SOURCE_UPLOAD_MAX_LABEL
} from "@/lib/ai/upload-limits";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { handleTablistKeyDown } from "@/lib/ui/tablist";

const MANUAL_TEXT_MIN_CHARS = 80;
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

function getManualTextQualityChecks(text) {
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

function UploadFileIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="10" y="8" width="28" height="32" rx="10" fill="#edf4ff" stroke="#cfe0f5" />
      <path d="M24 31V17" stroke="#1250b1" strokeWidth="3.5" strokeLinecap="round" />
      <path d="m18 22 6-6 6 6" stroke="#1250b1" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M17 35h14" stroke="#7aa3e8" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function ChecklistIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <rect x="9" y="10" width="30" height="28" rx="10" fill="#fff7e6" stroke="#f0d899" />
      <path d="m17 20 3 3 5-6" stroke="#ffb020" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m17 29 3 3 5-6" stroke="#ffb020" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M26 19h6" stroke="#d7b15a" strokeWidth="3" strokeLinecap="round" />
      <path d="M26 28h6" stroke="#d7b15a" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="24" cy="24" r="15" fill="#eefaf4" stroke="#cdebd9" />
      <path d="M24 14v7" stroke="#1f9d63" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M24 27v7" stroke="#1f9d63" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M34 24h-7" stroke="#1f9d63" strokeWidth="3.5" strokeLinecap="round" />
      <path d="M21 24h-7" stroke="#1f9d63" strokeWidth="3.5" strokeLinecap="round" />
      <circle cx="24" cy="24" r="4.5" fill="#1f9d63" />
    </svg>
  );
}

export function WorkspaceGenerateForm({
  userType,
  subjects,
  subjectAllocations = [],
  initialExamType = "normal",
  fixedExamType = null,
  demoMode,
  setupWarning,
  billingSnapshot,
  message,
  error
}) {
  const [sourceMode, setSourceMode] = useState("file");
  const resolvedFixedExamType =
    fixedExamType === "licenta" || fixedExamType === "normal" ? fixedExamType : null;
  const [examType, setExamType] = useState(
    resolvedFixedExamType || (initialExamType === "licenta" ? "licenta" : "normal")
  );
  const [studentYear, setStudentYear] = useState("");
  const [semester, setSemester] = useState("");
  const [schoolClass, setSchoolClass] = useState("");
  const [answerKeyPlacement, setAnswerKeyPlacement] = useState("");
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [manualText, setManualText] = useState("");
  const [hasSelectedFile, setHasSelectedFile] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [selectedFileName, setSelectedFileName] = useState("");
  const [selectedFileSize, setSelectedFileSize] = useState(0);
  const [clientError, setClientError] = useState("");
  const [uploadStatus, setUploadStatus] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [isDraggingSourceFile, setIsDraggingSourceFile] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const submittingRef = useRef(false);
  const fileInputRef = useRef(null);
  const fileInputId = useId();
  const fileDropNoteId = `${fileInputId}-note`;
  const fileDropStatusId = `${fileInputId}-status`;
  const manualTextSignalId = `${fileInputId}-text-signals`;
  const submitHintId = `${fileInputId}-submit-hint`;

  const isStudent = userType === "student";
  const isLicentaFlow = examType === "licenta";
  const isContextReady = useMemo(() => {
    if (isLicentaFlow) {
      return false;
    }

    if (!semester) {
      return false;
    }

    if (isStudent) {
      return Boolean(studentYear);
    }

    return Boolean(schoolClass.trim());
  }, [isLicentaFlow, isStudent, schoolClass, semester, studentYear]);

  const pickerContext = isStudent
    ? {
        userType: "student",
        studyYear: studentYear ? Number(studentYear) : null,
        semester: semester ? Number(semester) : null,
        schoolClass: null
      }
    : {
        userType: "elev",
        studyYear: null,
        semester: semester ? Number(semester) : null,
        schoolClass: schoolClass.trim() || null
      };

  const hasActiveSourceInput =
    sourceMode === "file" ? hasSelectedFile : Boolean(manualText.trim());
  const manualTextLength = manualText.trim().length;
  const manualTextTooShort =
    sourceMode === "text" &&
    manualTextLength > 0 &&
    manualTextLength < MANUAL_TEXT_MIN_CHARS;
  const manualTextQualityChecks = getManualTextQualityChecks(manualText);
  const manualTextNeedsReview =
    sourceMode === "text" &&
    manualTextLength >= MANUAL_TEXT_MIN_CHARS &&
    manualTextQualityChecks.some((check) => !check.passed);
  const fileSizeLabel = selectedFileSize ? formatFileSize(selectedFileSize) : "";
  const selectedFileUnsupported =
    sourceMode === "file" && selectedFile ? !isSupportedSourceFile(selectedFile) : false;
  const selectedFileTooLarge =
    sourceMode === "file" && selectedFileSize > AI_SOURCE_UPLOAD_MAX_BYTES;
  const selectedFileHasIssue = selectedFileUnsupported || selectedFileTooLarge;
  const sourceReady =
    hasActiveSourceInput && !selectedFileHasIssue && !manualTextTooShort;
  const answerKeyPlacementReady = Boolean(answerKeyPlacement);
  const formLocked = isSubmitting;
  const fieldControlsLocked = formLocked && sourceMode === "file";
  const submitDisabled =
    demoMode ||
    Boolean(setupWarning) ||
    billingSnapshot.aiCredits < 1 ||
    !sourceReady ||
    !answerKeyPlacementReady ||
    (!isLicentaFlow && !selectedSubjectId) ||
    isSubmitting;
  const noCredits = billingSnapshot.aiCredits < 1;
  const creditPurchaseHref = `/cont?section=credits&returnTo=${encodeURIComponent(
    isLicentaFlow ? "/materiale/licenta" : "/materiale/importa"
  )}`;
  const creditCountLabel =
    billingSnapshot.aiCredits === 1
      ? "1 incarcare disponibila"
      : `${billingSnapshot.aiCredits} incarcari disponibile`;
  const creditPolicyText = noCredits
    ? "Ai nevoie de o incarcare ca sa pornesti verificarea."
    : "Se foloseste 1 incarcare cand continutul ajunge la verificare.";
  const destinationReady = isLicentaFlow || (isContextReady && Boolean(selectedSubjectId));
  const destinationHint = isLicentaFlow
    ? "Simularea de licenta este selectata."
    : !isContextReady
      ? isStudent
        ? "Alege anul si semestrul, apoi materia."
        : "Completeaza clasa si semestrul, apoi materia."
      : "Alege materia in care intra intrebarile.";
  const activeSubmitLabel =
    sourceMode === "file" ? "Trimite fisierul spre verificare" : "Trimite textul spre verificare";
  const visibleError =
    clientError ||
    (selectedFileUnsupported
      ? "Tip de fisier neacceptat. Alege PDF, DOCX sau TXT."
      : "") ||
    (selectedFileTooLarge
      ? `Fisierul depaseste limita maxima de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`
      : "") ||
    (manualTextTooShort
      ? `Textul este prea scurt. Adauga cel putin ${MANUAL_TEXT_MIN_CHARS} de caractere.`
      : "");
  const uploadReadinessChecks = [
    {
      label: "Sursa",
      passed: sourceReady,
      hint: selectedFileUnsupported
        ? "Alege un fisier PDF, DOCX sau TXT."
        : selectedFileTooLarge
        ? `Alege un fisier sub ${AI_SOURCE_UPLOAD_MAX_LABEL}.`
        : manualTextTooShort
          ? `Mai adauga ${MANUAL_TEXT_MIN_CHARS - manualTextLength} caractere.`
        : sourceMode === "file"
          ? "Alege fisierul cu intrebari si raspunsuri."
          : "Lipeste textul cu intrebari si raspunsuri."
    },
    {
      label: "Raspunsuri",
      passed: answerKeyPlacementReady,
      hint: "Alege unde sunt raspunsurile corecte in material."
    },
    {
      label: "Destinatie",
      passed: destinationReady,
      hint: destinationHint
    },
    {
      label: "Incarcare",
      passed: !noCredits,
      hint: "Adauga o incarcare ca sa poti procesa materialul."
    }
  ];
  const uploadReady = uploadReadinessChecks.every((check) => check.passed);
  const firstMissingUploadCheck = uploadReadinessChecks.find((check) => !check.passed) || null;
  const submitTitle = isSubmitting
    ? "Trimitem continutul..."
    : uploadReady
      ? "Gata de trimis"
      : "Completeaza pasii lipsa";
  const submitDescription = isSubmitting
    ? uploadStatus || "Nu inchide pagina. Pregatim continutul si il trimitem spre verificare."
    : uploadReady
      ? "Dupa trimitere, verifici intrebarile si publici doar continutul corect."
      : "Rezolva elementele marcate cu Lipseste, apoi poti porni verificarea.";
  const fileDropStatusText = selectedFileName
    ? selectedFileUnsupported
      ? "Fisierul selectat nu este acceptat. Alege PDF, DOCX sau TXT."
      : selectedFileTooLarge
        ? `Fisierul selectat depaseste limita de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`
        : `${selectedFileName} este pregatit pentru verificare.`
    : `Alege un fisier PDF, DOCX sau TXT, maxim ${AI_SOURCE_UPLOAD_MAX_LABEL}.`;
  const submitHint = isSubmitting
    ? uploadStatus || "Trimiterea este in curs."
    : firstMissingUploadCheck
      ? `Mai lipseste: ${firstMissingUploadCheck.label}. ${firstMissingUploadCheck.hint}`
      : "Totul este pregatit pentru verificare.";

  useEffect(() => {
    setSelectedSubjectId("");
  }, [examType, schoolClass, semester, studentYear]);

  function switchSourceMode(nextMode) {
    if (formLocked) {
      return;
    }

    if (nextMode === sourceMode) {
      return;
    }

    setSourceMode(nextMode);

    if (nextMode === "text") {
      setHasSelectedFile(false);
      setSelectedFile(null);
      setSelectedFileName("");
      setSelectedFileSize(0);
      setClientError("");
      setUploadStatus("");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    setManualText("");
    setClientError("");
    setUploadStatus("");
  }

  function applySelectedSourceFile(nextFile) {
    if (formLocked) {
      return;
    }

    setSelectedFile(nextFile);
    setHasSelectedFile(Boolean(nextFile));
    setSelectedFileName(nextFile?.name || "");
    setSelectedFileSize(nextFile?.size || 0);
    setClientError("");
    setUploadStatus("");
  }

  function applyDroppedSourceFiles(fileList) {
    if (formLocked) {
      return;
    }

    const droppedFiles = Array.from(fileList || []);

    if (droppedFiles.length > 1) {
      setClientError("Urca un singur fisier pe rand. Pentru licenta foloseste seturile din sesiunea activa.");
      setUploadStatus("");
      return;
    }

    applySelectedSourceFile(droppedFiles[0] || null);
  }

  function clearSelectedFile() {
    if (formLocked) {
      return;
    }

    applySelectedSourceFile(null);
    setClientError("");
    setUploadStatus("");

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }

  function clearManualText() {
    if (formLocked) {
      return;
    }

    setManualText("");
    setClientError("");
    setUploadStatus("");
  }

  async function startDirectFileUpload(formSnapshot) {
    if (!selectedFile) {
      throw new Error("Alege fisierul pe care vrei sa il urci.");
    }

    if (!isSupportedSourceFile(selectedFile)) {
      throw new Error("Tip de fisier neacceptat. Alege PDF, DOCX sau TXT.");
    }

    if (selectedFile.size > AI_SOURCE_UPLOAD_MAX_BYTES) {
      throw new Error(`Fisierul depaseste limita maxima de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`);
    }

    setUploadStatus("Pregatim spatiul privat pentru fisier...");
    const intentResponse = await fetch("/api/materiale/source-documents/upload-intent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        originalFilename: selectedFile.name,
        mimeType: selectedFile.type,
        sizeBytes: selectedFile.size
      })
    });
    const intentPayload = await intentResponse.json().catch(() => null);

    if (!intentResponse.ok) {
      throw new Error(
        intentPayload?.error || "Nu am putut pregati uploadul fisierului."
      );
    }

    setUploadStatus("Urcam fisierul in siguranta...");
    const supabase = createSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from(intentPayload.storageBucket)
      .upload(intentPayload.storagePath, selectedFile, {
        contentType: intentPayload.mimeType || selectedFile.type,
        upsert: false
      });

    if (uploadError) {
      throw new Error(uploadError.message || "Uploadul fisierului a esuat.");
    }

    setUploadStatus("Pornim procesarea fisierului...");
    const payload = formSnapshot;
    payload.delete("sourceFile");
    payload.set("uploadedSourceDocumentId", intentPayload.sourceDocumentId);

    const generateResponse = await fetch("/api/materiale/generate", {
      method: "POST",
      body: payload
    });

    if (generateResponse.redirected || generateResponse.ok) {
      window.location.assign(generateResponse.url || "/materiale");
      return;
    }

    const responseText = await generateResponse.text().catch(() => "");
    throw new Error(responseText || "Nu am putut porni procesarea fisierului.");
  }

  async function submitManualText(formSnapshot) {
    setUploadStatus("Pornim procesarea textului...");

    const generateResponse = await fetch("/api/materiale/generate", {
      method: "POST",
      body: formSnapshot
    });

    if (generateResponse.redirected || generateResponse.ok) {
      window.location.assign(generateResponse.url || "/materiale");
      return;
    }

    const responseText = await generateResponse.text().catch(() => "");
    throw new Error(responseText || "Nu am putut porni procesarea textului.");
  }

  return (
    <>
      {demoMode ? (
        <div className="error-state" role="status">
          In modul demo poti vedea doar interfata. Pentru procesare reala intra cu Google.
        </div>
      ) : null}

      {setupWarning ? <div className="error-state" role="alert">{setupWarning}</div> : null}
      {message ? <div className="success-state" role="status">{message}</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}
      {visibleError ? <div className="error-state" role="alert">{visibleError}</div> : null}

      <form
        action="/api/materiale/generate"
        method="post"
        encType="multipart/form-data"
        className="ai-form ai-workspace-form"
        aria-busy={isSubmitting}
        onSubmit={async (event) => {
          if (submitDisabled || selectedFileTooLarge || submittingRef.current) {
            event.preventDefault();
            return;
          }

          event.preventDefault();
          const formSnapshot = new FormData(event.currentTarget);
          submittingRef.current = true;
          setIsSubmitting(true);
          setClientError("");
          setUploadStatus("");

          try {
            if (sourceMode === "file") {
              await startDirectFileUpload(formSnapshot);
              return;
            }

            await submitManualText(formSnapshot);
          } catch (submitError) {
            submittingRef.current = false;
            setIsSubmitting(false);
            setUploadStatus("");
            setClientError(
              submitError instanceof Error
                ? submitError.message
                : "Trimiterea continutului a esuat."
            );
          }
        }}
      >
        <section className="workspace-help-toggle ai-workspace-guide-toggle">
          <button
            type="button"
            className="btn-link secondary workspace-help-toggle-btn ai-workspace-guide-trigger"
            onClick={() => setShowGuide((current) => !current)}
            aria-expanded={showGuide}
            aria-controls="workspace-guide-panel"
          >
            {showGuide ? "Ascunde ghidul rapid" : "Vezi ghidul rapid"}
          </button>

          {showGuide ? (
            <div id="workspace-guide-panel" className="workspace-help-panel ai-workspace-guide-panel">
              <div className="workspace-guide-grid">
                <article className="workspace-guide-card ui-panel-card ai-workspace-guide-card">
                  <div className="workspace-guide-icon">
                    <UploadFileIcon />
                  </div>
                  <strong>Ce urci</strong>
                  <p>PDF, DOCX, TXT sau text lipit direct aici.</p>
                </article>

                <article className="workspace-guide-card ui-panel-card ai-workspace-guide-card">
                  <div className="workspace-guide-icon">
                    <ChecklistIcon />
                  </div>
                  <strong>Cum trebuie sa fie</strong>
                  <p>Fisierul trebuie sa aiba deja intrebari si raspunsuri.</p>
                </article>

                <article className="workspace-guide-card ui-panel-card ai-workspace-guide-card">
                  <div className="workspace-guide-icon">
                    <SparkIcon />
                  </div>
                  <strong>Ce primesti</strong>
                  <p>Intrebarile apar in materia ta sau in simularea de licenta.</p>
                </article>
              </div>

              <section className="workspace-rule-banner">
                <strong>Important</strong>
                <p>Daca fisierul nu are deja intrebari si raspunsuri, nu il putem folosi.</p>
              </section>

              <section className="workspace-example-panel ui-panel-card ai-workspace-example-panel">
                <div className="workspace-example-copy">
                  <strong>Exemplu simplu de fisier bun</strong>
                  <p>
                    Nu trebuie sa arate perfect. Important este sa aiba intrebarea, variantele si raspunsul corect.
                  </p>
                </div>
                <pre className="workspace-example-box">{`1. Care este raspunsul corect?
A) Varianta 1
B) Varianta 2
C) Varianta 3
D) Varianta 4
Raspuns corect: B`}</pre>
              </section>
            </div>
          ) : null}
        </section>

        <section className="workspace-form-panel ui-panel-card ai-workspace-step-panel">
          <div className="workspace-form-head">
            <div>
              <span className="ui-section-label ai-workspace-step-label">Pasul 1</span>
              <h2>Alege cum trimiti continutul</h2>
            </div>
          </div>

          <div
            className="ui-segmented-tabs ai-workspace-source-tabs"
            role="tablist"
            aria-label="Sursa continutului"
            onKeyDown={handleTablistKeyDown}
          >
            <button
              id="workspace-source-tab-file"
              type="button"
              role="tab"
              aria-selected={sourceMode === "file"}
              aria-controls="workspace-source-panel"
              tabIndex={sourceMode === "file" ? 0 : -1}
              aria-disabled={formLocked}
              className={`ui-segmented-tab secondary ai-workspace-source-tab ${
                sourceMode === "file" ? "is-active" : ""
              }`}
              onClick={() => switchSourceMode("file")}
            >
              Urc fisier
            </button>
            <button
              id="workspace-source-tab-text"
              type="button"
              role="tab"
              aria-selected={sourceMode === "text"}
              aria-controls="workspace-source-panel"
              tabIndex={sourceMode === "text" ? 0 : -1}
              aria-disabled={formLocked}
              className={`ui-segmented-tab secondary ai-workspace-source-tab ${
                sourceMode === "text" ? "is-active" : ""
              }`}
              onClick={() => switchSourceMode("text")}
            >
              Lipesc text
            </button>
          </div>

          {sourceMode === "file" ? (
            <div
              id="workspace-source-panel"
              className="selector-container ai-workspace-source-panel"
              role="tabpanel"
              aria-labelledby="workspace-source-tab-file"
            >
              <label
                className={`ai-workspace-file-dropzone${
                  isDraggingSourceFile ? " is-dragging" : ""
                }${selectedFileHasIssue ? " is-warning" : ""}${sourceReady ? " is-ready" : ""}`}
                htmlFor={fileInputId}
                role="button"
                tabIndex={formLocked ? -1 : 0}
                aria-disabled={formLocked}
                aria-describedby={`${fileDropNoteId} ${fileDropStatusId}`}
                onKeyDown={(event) => {
                  if (formLocked) {
                    return;
                  }

                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  if (formLocked) {
                    return;
                  }
                  setIsDraggingSourceFile(true);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  if (formLocked) {
                    return;
                  }
                  event.dataTransfer.dropEffect = "copy";
                  setIsDraggingSourceFile(true);
                }}
                onDragLeave={(event) => {
                  if (!event.currentTarget.contains(event.relatedTarget)) {
                    setIsDraggingSourceFile(false);
                  }
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  setIsDraggingSourceFile(false);
                  applyDroppedSourceFiles(event.dataTransfer.files);
                }}
              >
                <span className="ai-workspace-file-drop-title">
                  {isDraggingSourceFile ? "Elibereaza fisierul aici" : "Alege sau trage fisierul aici"}
                </span>
                <span id={fileDropNoteId} className="ai-workspace-file-drop-note">
                  Un singur PDF, DOCX sau TXT cu intrebari si raspunsuri. Maxim {AI_SOURCE_UPLOAD_MAX_LABEL}.
                </span>
                <input
                  id={fileInputId}
                  ref={fileInputRef}
                  className="ai-workspace-file-input"
                  type="file"
                  name="sourceFile"
                  disabled={fieldControlsLocked}
                  tabIndex={-1}
                  accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                  onChange={(event) => {
                    applySelectedSourceFile(event.target.files?.[0] || null);
                  }}
                />
              </label>
              <p className="micro-copy ai-workspace-source-hint">
                Verificam structura intrebare + raspuns, apoi pregatim continutul pentru verificare. Limita: {AI_SOURCE_UPLOAD_MAX_LABEL}.
              </p>
              <p id={fileDropStatusId} className="sr-only" aria-live="polite">
                {fileDropStatusText}
              </p>
              {selectedFileName ? (
                <div className={`ai-workspace-source-meta${selectedFileHasIssue ? " is-warning" : ""}`}>
                  <span className={`ui-chip ${selectedFileHasIssue ? "is-warning" : "is-good"}`}>
                    {selectedFileUnsupported
                      ? "Tip neacceptat"
                      : selectedFileTooLarge
                        ? "Prea mare"
                        : "Fisier selectat"}
                  </span>
                  <span>{selectedFileName}</span>
                  {fileSizeLabel ? (
                    <span>
                      {fileSizeLabel} din {AI_SOURCE_UPLOAD_MAX_LABEL}
                    </span>
                  ) : null}
                  <button
                    type="button"
                    className="btn-link secondary ai-workspace-source-action"
                    aria-disabled={formLocked}
                    onClick={clearSelectedFile}
                  >
                    Sterge fisierul
                  </button>
                </div>
              ) : null}
            </div>
          ) : (
            <div
              id="workspace-source-panel"
              className="selector-container ai-workspace-source-panel"
              role="tabpanel"
              aria-labelledby="workspace-source-tab-text"
            >
              <label>
                Lipeste direct banca de intrebari si raspunsuri daca nu ai fisier
                <textarea
                  className="textarea-input ai-workspace-textarea math-friendly-input"
                  name="manualText"
                  rows="12"
                  value={manualText}
                  readOnly={formLocked}
                  aria-readonly={formLocked}
                  aria-describedby={manualTextLength >= MANUAL_TEXT_MIN_CHARS ? manualTextSignalId : undefined}
                  onChange={(event) => {
                    if (formLocked) {
                      return;
                    }

                    setManualText(event.target.value);
                    setClientError("");
                    setUploadStatus("");
                  }}
                  placeholder="Lipeste aici intrebarile si raspunsurile. Le verificam si le pregatim pentru verificare."
                />
              </label>
              <p className="micro-copy ai-workspace-source-hint">
                Daca textul este clar si are deja intrebari + raspunsuri, il trimitem prin acelasi flow ca la fisier.
              </p>
              {manualTextLength > 0 ? (
                <div className={`ai-workspace-source-meta${manualTextTooShort || manualTextNeedsReview ? " is-warning" : ""}`}>
                  <span className={`ui-chip ${manualTextTooShort || manualTextNeedsReview ? "is-warning" : "is-good"}`}>
                    {manualTextTooShort
                      ? "Text scurt"
                      : manualTextNeedsReview
                        ? "Verifica structura"
                        : "Text pregatit"}
                  </span>
                  <span>
                    {manualTextLength}/{MANUAL_TEXT_MIN_CHARS} caractere minime
                  </span>
                  <button
                    type="button"
                    className="btn-link secondary ai-workspace-source-action"
                    aria-disabled={formLocked}
                    onClick={clearManualText}
                  >
                    Sterge textul
                  </button>
                </div>
              ) : null}
              {manualTextLength >= MANUAL_TEXT_MIN_CHARS ? (
                <div id={manualTextSignalId} className="ai-workspace-text-signals" aria-label="Semnale text lipit">
                  {manualTextQualityChecks.map((check) => (
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
          )}

          <div className="selector-container ai-workspace-answer-key-control">
            <label>
              Unde sunt raspunsurile corecte?
              <select
                name="answerKeyPlacement"
                value={answerKeyPlacement}
                disabled={formLocked}
                required
                onChange={(event) => setAnswerKeyPlacement(event.target.value)}
              >
                <option value="" disabled>
                  Alege varianta
                </option>
                <option value="unknown">Nu sunt sigur</option>
                <option value="after_each_question">Dupa fiecare intrebare</option>
                <option value="at_end">La final, ca barem</option>
                <option value="mixed">Amestecat in document</option>
              </select>
            </label>
            <p className="micro-copy">
              Daca raspunsurile sunt la final, folosim baremul ca reper pentru toate bucatile de procesare.
            </p>
          </div>

          <div className="workspace-checklist">
            <div className="workspace-check-row">
              <span>1</span>
              <p>Verificam rapid daca sursa are deja intrebari si raspunsuri clare.</p>
            </div>
            <div className="workspace-check-row">
              <span>2</span>
              <p>Daca este buna, scoatem intrebarile si pregatim rezultatul pentru verificare.</p>
            </div>
            <div className="workspace-check-row">
              <span>3</span>
              <p>Dupa trimitere, vezi progresul si deschizi rezultatul din activitatea ta.</p>
            </div>
          </div>
        </section>

        <section
          className={`workspace-form-panel ui-panel-card ai-workspace-step-panel${
            sourceReady ? "" : " is-locked"
          }`}
        >
          <div className="workspace-form-head">
            <div>
              <span className="ui-section-label ai-workspace-step-label">Pasul 2</span>
              <h2>{isLicentaFlow ? "Alege tipul de test" : "Alege materia si detaliile"}</h2>
            </div>
          </div>

          {!sourceReady ? (
            <div className="workspace-step-locked">
              <strong>
                {hasActiveSourceInput ? "Sursa nu este inca pregatita." : "Mai intai alege sursa pe care vrei sa o verificam."}
              </strong>
              <p>
                {hasActiveSourceInput
                  ? "Corecteaza sursa, apoi iti aratam imediat selectia de materie si restul setarilor."
                  : "Dupa asta iti aratam imediat selectia de materie si restul setarilor."}
              </p>
            </div>
          ) : (
            <>
              {resolvedFixedExamType ? (
                <input type="hidden" name="examType" value={resolvedFixedExamType} />
              ) : (
                <div className="ai-workspace-exam-choice" role="radiogroup" aria-label="Tip test">
                  <input type="hidden" name="examType" value={examType} />
                  <button
                    type="button"
                    role="radio"
                    aria-checked={examType === "normal"}
                    aria-disabled={fieldControlsLocked}
                    disabled={fieldControlsLocked}
                    className={`secondary ai-workspace-exam-card ${
                      examType === "normal" ? "is-selected" : ""
                    }`}
                    onClick={() => {
                      if (!fieldControlsLocked) {
                        setExamType("normal");
                      }
                    }}
                  >
                    <span className="ai-workspace-exam-icon is-normal" aria-hidden="true">T</span>
                    <span className="ai-workspace-exam-copy">
                      <strong>Test grila pe materie</strong>
                      <span>Alegi anul, semestrul si materia unde intra intrebarile.</span>
                    </span>
                    <span className="ai-workspace-exam-mark" aria-hidden="true">
                      {examType === "normal" ? "Selectat" : "Alege"}
                    </span>
                  </button>
                  <button
                    type="button"
                    role="radio"
                    aria-checked={examType === "licenta"}
                    aria-disabled={fieldControlsLocked}
                    disabled={fieldControlsLocked}
                    className={`secondary ai-workspace-exam-card ${
                      examType === "licenta" ? "is-selected" : ""
                    }`}
                    onClick={() => {
                      if (!fieldControlsLocked) {
                        setExamType("licenta");
                      }
                    }}
                  >
                    <span className="ai-workspace-exam-icon is-licenta" aria-hidden="true">L</span>
                    <span className="ai-workspace-exam-copy">
                      <strong>Licenta</strong>
                      <span>Pregatesti intrebari pentru simularea generala de licenta.</span>
                    </span>
                    <span className="ai-workspace-exam-mark" aria-hidden="true">
                      {examType === "licenta" ? "Selectat" : "Alege"}
                    </span>
                  </button>
                </div>
              )}

              {isLicentaFlow ? (
                <div className="workspace-licenta-callout">
                  <strong>Incarci grile pentru simularea generala de licenta.</strong>
                  <p>
                    Pentru licenta nu mai alegi materie, an, clasa sau semestru. Dupa verificare,
                    intrebarile publicate intra direct in simularea generala.
                  </p>
                </div>
              ) : (
                <>
                  {isStudent ? (
                    <div className="selector-grid">
                      <div className="selector-container">
                        <label>
                          An
                          <select
                            name="studentYear"
                            required
                            value={studentYear}
                            disabled={fieldControlsLocked}
                            onChange={(event) => setStudentYear(event.target.value)}
                          >
                            <option value="" disabled>
                              Alege anul
                            </option>
                            {Array.from({ length: 10 }, (_, index) => (
                              <option key={index + 1} value={index + 1}>
                                {`Anul ${index + 1}`}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>
                      <div className="selector-container">
                        <label>
                          Semestru
                          <select
                            name="semester"
                            required
                            value={semester}
                            disabled={fieldControlsLocked}
                            onChange={(event) => setSemester(event.target.value)}
                          >
                            <option value="" disabled>
                              Alege semestrul
                            </option>
                            <option value="1">Semestrul 1</option>
                            <option value="2">Semestrul 2</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  ) : (
                    <div className="selector-grid">
                      <div className="selector-container">
                        <label>
                          Clasa
                          <input
                            className="input-search math-friendly-input"
                            type="text"
                            name="schoolClass"
                            placeholder="Ex: Clasa a 11-a"
                            value={schoolClass}
                            readOnly={formLocked}
                            aria-readonly={formLocked}
                            onChange={(event) => setSchoolClass(event.target.value)}
                            required
                          />
                        </label>
                      </div>
                      <div className="selector-container">
                        <label>
                          Semestru
                          <select
                            name="semester"
                            required
                            value={semester}
                            disabled={fieldControlsLocked}
                            onChange={(event) => setSemester(event.target.value)}
                          >
                            <option value="" disabled>
                              Alege semestrul
                            </option>
                            <option value="1">Semestrul 1</option>
                            <option value="2">Semestrul 2</option>
                          </select>
                        </label>
                      </div>
                    </div>
                  )}

                  <WorkspaceSubjectPicker
                    subjects={subjects}
                    subjectAllocations={subjectAllocations}
                    userType={userType}
                    context={pickerContext}
                    isContextReady={isContextReady}
                    selectedSubjectId={selectedSubjectId}
                    onSubjectChange={setSelectedSubjectId}
                    disabled={formLocked}
                  />
                </>
              )}
            </>
          )}
        </section>

        {noCredits ? (
          <div className="workspace-credit-alert">
            <div>
              <strong>Nu mai ai incarcari disponibile</strong>
              <p>Alege un pachet, apoi revii automat aici ca sa continui uploadul.</p>
            </div>
            <Link className="btn-link secondary ai-workspace-alert-link" href={creditPurchaseHref}>
              Adauga incarcari
            </Link>
          </div>
        ) : null}

        <div className="workspace-submit-card ui-panel-card ai-workspace-submit-card">
          <div className="ai-workspace-submit-copy">
            <strong>{submitTitle}</strong>
            <p>{submitDescription}</p>
            <div className={`ai-workspace-credit-summary${noCredits ? " is-warning" : ""}`}>
              <span className={`ui-chip ${noCredits ? "is-warning" : "is-good"}`}>
                {creditCountLabel}
              </span>
              <span>{creditPolicyText}</span>
            </div>
            <div className="ai-workspace-submit-readiness" aria-label="Checklist trimitere continut">
              {uploadReadinessChecks.map((check) => (
                <div key={check.label} className={`ai-workspace-submit-check ${check.passed ? "is-done" : "is-open"}`}>
                  <span>{check.passed ? "Gata" : "Lipseste"}</span>
                  <div>
                    <strong>{check.label}</strong>
                    <p>{check.passed ? "Pregatit." : check.hint}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="inline-actions workspace-submit-row ai-workspace-submit-row">
            <button type="submit" disabled={submitDisabled} aria-describedby={submitHintId}>
              <LoadingIconText loading={isSubmitting} loadingLabel="Se trimite...">
                {activeSubmitLabel}
              </LoadingIconText>
            </button>
            <p id={submitHintId} className="ai-workspace-submit-action-hint" aria-live="polite">
              {submitHint}
            </p>
          </div>
        </div>

        {isSubmitting ? (
          <div className="micro-copy workspace-submit-hint" aria-live="polite">
            {uploadStatus || "Nu inchide pagina. Pregatim continutul si il trimitem spre verificare."}
          </div>
        ) : null}
      </form>
    </>
  );
}
