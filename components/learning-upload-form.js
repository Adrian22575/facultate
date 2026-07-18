"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Check, ClipboardPaste, FileText, FileUp, LoaderCircle, Upload, X } from "lucide-react";

import {
  AI_SOURCE_ACCEPTED_MIME_TYPES,
  AI_SOURCE_UPLOAD_MAX_BYTES,
  AI_SOURCE_UPLOAD_MAX_LABEL
} from "@/lib/ai/upload-limits";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";

const ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"];
const MIN_TEXT_LENGTH = 600;

function createIdempotencyKey() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  return `learning-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 KB";
  if (bytes >= 1024 * 1024) {
    const decimals = bytes >= 10 * 1024 * 1024 ? 0 : 1;
    return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
  }
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isSupportedFile(file) {
  if (!file) return false;
  const normalizedName = file.name.toLowerCase();
  const hasAcceptedExtension = ACCEPTED_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension)
  );
  const hasAcceptedMimeType = file.type ? AI_SOURCE_ACCEPTED_MIME_TYPES.includes(file.type) : false;
  return hasAcceptedExtension || hasAcceptedMimeType;
}

function SourceOption({ icon: Icon, title, copy, active = false, disabled = false, onClick }) {
  return (
    <button
      type="button"
      className={`learning-upload-source-option${active ? " is-active" : ""}`}
      data-usage-event="learning_source_selected"
      data-usage-label={title}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
    >
      <span aria-hidden="true">
        <Icon size={18} strokeWidth={2.3} />
      </span>
      <div>
        <strong>{title}</strong>
        <small>{copy}</small>
      </div>
      {active ? <Check className="learning-upload-source-check" aria-hidden="true" size={18} strokeWidth={2.5} /> : null}
    </button>
  );
}

function getResponseError(payload, fallback) {
  return payload?.error || fallback;
}

function ProcessingPanel({ status, sourceMode, sourceSaved }) {
  const waitingMessage = sourceSaved
    ? sourceMode === "file"
      ? "Fisierul este salvat. Pregatim pagina unde urmaresti procesarea."
      : "Continutul este preluat. Pregatim pagina unde urmaresti procesarea."
    : sourceMode === "file"
      ? "Pastreaza aceasta pagina deschisa cat timp fisierul se incarca."
      : "Pregatim continutul pentru procesare.";

  return (
    <section className="learning-processing-panel" role="status" aria-live="polite" aria-atomic="true">
      <span className="learning-processing-icon" aria-hidden="true">
        <LoaderCircle size={20} strokeWidth={2.3} />
      </span>
      <div className="learning-processing-copy">
        <strong>{status || "Pregatim materialul..."}</strong>
        <p>{waitingMessage}</p>
      </div>
    </section>
  );
}

export function LearningUploadForm({ billingSnapshot, setupWarning, subjects = [], initialSubjectId = "" }) {
  const [sourceMode, setSourceMode] = useState("file");
  const [selectedSubjectId, setSelectedSubjectId] = useState(() =>
    subjects.some((subject) => subject.id === initialSubjectId) ? initialSubjectId : ""
  );
  const [selectedFile, setSelectedFile] = useState(null);
  const [customSubjectName, setCustomSubjectName] = useState("");
  const [manualText, setManualText] = useState("");
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [clientError, setClientError] = useState("");
  const [errorActionHref, setErrorActionHref] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sourceSaved, setSourceSaved] = useState(false);
  const fileInputRef = useRef(null);
  const uploadedSourceDocumentIdRef = useRef("");
  const idempotencyKeyRef = useRef(createIdempotencyKey());
  const fileInputId = useId();

  const noCredits = billingSnapshot.aiCredits < 1;
  const creditPurchaseHref = `/cont?section=credits&returnTo=${encodeURIComponent("/materiale/invata")}`;
  const selectedFileUnsupported = selectedFile ? !isSupportedFile(selectedFile) : false;
  const selectedFileTooLarge = selectedFile ? selectedFile.size > AI_SOURCE_UPLOAD_MAX_BYTES : false;
  const fileReady = sourceMode === "file" && selectedFile && !selectedFileUnsupported && !selectedFileTooLarge;
  const textLength = manualText.trim().length;
  const textTooShort = sourceMode === "text" && textLength > 0 && textLength < MIN_TEXT_LENGTH;
  const textReady = sourceMode === "text" && textLength >= MIN_TEXT_LENGTH;
  const sourceReady = fileReady || textReady;
  const selectedSubject = subjects.find((subject) => subject.id === selectedSubjectId);
  const subjectReady = Boolean(
    selectedSubjectId && (selectedSubjectId !== "custom" || customSubjectName.trim().length >= 2)
  );
  const disabled = Boolean(setupWarning) || noCredits || isSubmitting;
  const submitDisabled = disabled || !sourceReady || !subjectReady;
  const subjectLabel = selectedSubject?.title || (customSubjectName.trim() || "Materie nouă");
  const sourceLabel = sourceMode === "file"
    ? selectedFile?.name || "Niciun fișier ales"
    : textReady
      ? `${textLength.toLocaleString("ro-RO")} caractere`
      : "Text incomplet";
  const readinessMessage = !subjectReady
    ? "Alege materia materialului."
    : !sourceReady
      ? sourceMode === "file"
        ? "Alege fișierul pe care vrei să îl transformi."
        : `Mai adaugă ${Math.max(0, MIN_TEXT_LENGTH - textLength)} caractere.`
      : "Totul este pregătit. Materialul rămâne privat până alegi să îl distribui.";
  const visibleError =
    clientError ||
    (selectedFileUnsupported ? "Tip de fisier neacceptat. Alege PDF, DOCX, PPTX sau TXT." : "") ||
    (selectedFileTooLarge ? `Fisierul depaseste limita maxima de ${AI_SOURCE_UPLOAD_MAX_LABEL}.` : "") ||
    (textTooShort ? `Textul este prea scurt. Mai adauga ${MIN_TEXT_LENGTH - textLength} caractere.` : "");

  function switchSourceMode(nextMode) {
    if (isSubmitting) return;
    setSourceMode(nextMode);
    setClientError("");
    setErrorActionHref("");
    setStatus("");
    setSourceSaved(false);
  }

  function updateSelectedFile(file) {
    if (isSubmitting) return;
    setSelectedFile(file || null);
    uploadedSourceDocumentIdRef.current = "";
    setClientError("");
    setErrorActionHref("");
    setStatus("");
    setSourceSaved(false);
  }

  function handleFileDrop(event) {
    event.preventDefault();
    setIsDraggingFile(false);
    if (isSubmitting) return;
    updateSelectedFile(event.dataTransfer.files?.[0] || null);
  }

  async function uploadSelectedFile() {
    if (!selectedFile) {
      throw new Error("Alege fisierul pe care vrei sa il procesezi.");
    }

    if (!isSupportedFile(selectedFile)) {
      throw new Error("Tip de fisier neacceptat. Alege PDF, DOCX, PPTX sau TXT.");
    }

    if (selectedFile.size > AI_SOURCE_UPLOAD_MAX_BYTES) {
      throw new Error(`Fisierul depaseste limita maxima de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`);
    }

    if (uploadedSourceDocumentIdRef.current) {
      return uploadedSourceDocumentIdRef.current;
    }

    setStatus("Pregatim spatiul privat pentru fisier...");
    const intentResponse = await fetch("/api/materiale/source-documents/upload-intent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        originalFilename: selectedFile.name,
        mimeType: selectedFile.type,
        sizeBytes: selectedFile.size
      })
    });
    const intentPayload = await intentResponse.json().catch(() => null);

    if (!intentResponse.ok) {
      setErrorActionHref(
        typeof intentPayload?.actionHref === "string" ? intentPayload.actionHref : ""
      );
      throw new Error(getResponseError(intentPayload, "Nu am putut pregati uploadul fisierului."));
    }

    setStatus("Urcam fisierul in siguranta...");
    const supabase = createSupabaseBrowserClient();
    const { error: uploadError } = await supabase.storage
      .from(intentPayload.storageBucket)
      .upload(intentPayload.storagePath, selectedFile, {
        contentType: intentPayload.mimeType || selectedFile.type,
        upsert: false
      });

    if (uploadError) {
      throw new Error("Fisierul nu a putut fi urcat. Verifica legatura la internet si incearca din nou.");
    }

    uploadedSourceDocumentIdRef.current = intentPayload.sourceDocumentId;
    setSourceSaved(true);
    return intentPayload.sourceDocumentId;
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (submitDisabled) return;

    const formData = new FormData(event.currentTarget);
    setIsSubmitting(true);
    setClientError("");
    setErrorActionHref("");
    setStatus(sourceMode === "file" ? "Pregatim fisierul..." : "Pregatim textul...");

    try {
      if (sourceMode === "file") {
        const sourceDocumentId = await uploadSelectedFile();
        formData.delete("sourceFile");
        formData.delete("manualText");
        formData.set("uploadedSourceDocumentId", sourceDocumentId);
      } else {
        formData.delete("sourceFile");
        formData.delete("uploadedSourceDocumentId");
      }

      setStatus("Pregatim procesarea materialului...");
      const response = await fetch("/api/materiale/invata", {
        method: "POST",
        body: formData
      });
      const payload = await response.json().catch(() => null);

      if (!response.ok) {
        setErrorActionHref(typeof payload?.actionHref === "string" ? payload.actionHref : "");
        throw new Error(getResponseError(payload, "Nu am putut porni procesarea materialului."));
      }

      setStatus("Materia a fost incarcata. Deschidem pagina de progres...");
      window.location.assign(payload.redirectUrl || "/materiale/invata");
    } catch (error) {
      setIsSubmitting(false);
      setStatus("");
      setClientError(error instanceof Error ? error.message : "Procesarea materialului a esuat.");
    }
  }

  return (
    <>
      {isSubmitting ? (
        <ProcessingPanel status={status} sourceMode={sourceMode} sourceSaved={sourceSaved} />
      ) : null}
      {visibleError ? (
        <div className="error-state" role="alert">
          <span>{visibleError}</span>
          {errorActionHref ? <Link href={errorActionHref}>Vezi pachetele</Link> : null}
        </div>
      ) : null}
      {noCredits ? (
        <div className="learning-upload-credit-warning" role="status">
          <div>
            <strong>Ai nevoie de o încărcare disponibilă.</strong>
            <span>Alege un pachet, apoi revii automat aici.</span>
          </div>
          <Link className="btn-link secondary" href={creditPurchaseHref}>
            Vezi pachetele
          </Link>
        </div>
      ) : null}
      {!isSubmitting ? (
        <form className="surface learning-upload-form" onSubmit={handleSubmit}>
          <div className="learning-upload-section-head">
            <div>
              <h2>Încarcă materialul</h2>
              <p>Trei pași simpli. Tu alegi, noi pregătim modurile de învățare.</p>
            </div>
            <span className="learning-upload-cost-meta">
              {`${billingSnapshot.aiCredits || 0} disponibile · consumă 1`}
            </span>
          </div>

          <ol className="learning-upload-flow" aria-label="Pașii încărcării">
            <li className={subjectReady ? "is-done" : "is-active"}>
              <span>{subjectReady ? <Check aria-hidden="true" size={14} /> : "1"}</span>
              Materie
            </li>
            <li className={sourceReady ? "is-done" : subjectReady ? "is-active" : ""}>
              <span>{sourceReady ? <Check aria-hidden="true" size={14} /> : "2"}</span>
              Conținut
            </li>
            <li className={sourceReady && subjectReady ? "is-active" : ""}>
              <span>3</span>
              Confirmare
            </li>
          </ol>

          <section className="learning-upload-subject-section" aria-labelledby="learning-upload-subject-title">
            <div className="learning-upload-subject-head">
              <div>
                <span className="learning-upload-step-number" aria-hidden="true">1</span>
                <div>
                  <h3 id="learning-upload-subject-title">Alege materia</h3>
                  <p>Așa găsești ușor materialul mai târziu.</p>
                </div>
              </div>
            </div>

            <label className="learning-upload-field">
              <span className="sr-only">Materia</span>
              <select
                className="input-search"
                name="subjectId"
                value={selectedSubjectId}
                required
                onChange={(event) => {
                  setSelectedSubjectId(event.target.value);
                  if (event.target.value !== "custom") setCustomSubjectName("");
                  setClientError("");
                  setErrorActionHref("");
                }}
              >
                <option value="" disabled>Alege materia</option>
                {subjects.map((subject) => (
                  <option key={subject.id} value={subject.id}>{subject.title}</option>
                ))}
                <option value="custom">+ Adaugă o materie nouă</option>
              </select>
            </label>

            {selectedSubjectId === "custom" ? (
              <label className="learning-upload-field learning-upload-new-subject">
                Numele materiei noi
                <input
                  className="input-search"
                  name="subjectCustomName"
                  placeholder="Ex: Economie internațională"
                  type="text"
                  minLength={2}
                  maxLength={160}
                  required
                  value={customSubjectName}
                  autoFocus
                  onChange={(event) => setCustomSubjectName(event.target.value)}
                />
                <span className="learning-upload-field-note">O adăugăm acum, iar materialul rămâne privat.</span>
              </label>
            ) : null}
          </section>

          <section className="learning-upload-content-section" aria-labelledby="learning-upload-content-title">
            <div className="learning-upload-subject-head">
              <div>
                <span className="learning-upload-step-number" aria-hidden="true">2</span>
                <div>
                  <h3 id="learning-upload-content-title">Adaugă conținutul</h3>
                  <p>Încarcă un fișier sau lipește textul.</p>
                </div>
              </div>
            </div>

            <div className="learning-upload-source-grid" aria-label="Tipul conținutului">
              <SourceOption
                icon={FileUp}
                title="Încarcă fișier"
                copy="PDF, DOCX, PPTX sau TXT"
                active={sourceMode === "file"}
                onClick={() => switchSourceMode("file")}
              />
              <SourceOption
                icon={ClipboardPaste}
                title="Lipește text"
                copy="Curs sau notițe copiate"
                active={sourceMode === "text"}
                onClick={() => switchSourceMode("text")}
              />
            </div>

            {sourceMode === "file" ? (
              <div className="learning-upload-file-box">
                <label
                  className={`learning-upload-file-drop${isDraggingFile ? " is-dragging" : ""}${selectedFile ? " is-selected" : ""}`}
                  htmlFor={fileInputId}
                  onDragEnter={(event) => {
                    event.preventDefault();
                    setIsDraggingFile(true);
                  }}
                  onDragOver={(event) => event.preventDefault()}
                  onDragLeave={() => setIsDraggingFile(false)}
                  onDrop={handleFileDrop}
                >
                  <span className="learning-upload-file-icon" aria-hidden="true">
                    {selectedFile ? <FileText size={24} strokeWidth={2.1} /> : <Upload size={24} strokeWidth={2.1} />}
                  </span>
                  <strong>{selectedFile ? selectedFile.name : "Trage fișierul aici"}</strong>
                  <span>
                    {selectedFile
                      ? `${formatFileSize(selectedFile.size)} · apasă pentru a-l schimba`
                      : `sau apasă pentru a-l alege · maxim ${AI_SOURCE_UPLOAD_MAX_LABEL}`}
                  </span>
                  <input
                    id={fileInputId}
                    ref={fileInputRef}
                    type="file"
                    name="sourceFile"
                    accept=".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                    onChange={(event) => updateSelectedFile(event.target.files?.[0] || null)}
                  />
                </label>
                {selectedFile ? (
                  <button
                    type="button"
                    className="learning-upload-file-remove"
                    data-usage-event="learning_file_removed"
                    data-usage-label="Elimină fișierul"
                    onClick={() => {
                      updateSelectedFile(null);
                      if (fileInputRef.current) fileInputRef.current.value = "";
                    }}
                  >
                    <X aria-hidden="true" size={16} />
                    Elimină fișierul
                  </button>
                ) : null}
              </div>
            ) : (
              <label className="learning-upload-field">
                Textul materialului
                <textarea
                  className="input-search learning-upload-textarea"
                  name="manualText"
                  placeholder="Lipește aici cursul, notițele sau conținutul capitolului..."
                  value={manualText}
                  minLength={MIN_TEXT_LENGTH}
                  onChange={(event) => {
                    setManualText(event.target.value);
                    setClientError("");
                    setErrorActionHref("");
                    setStatus("");
                  }}
                />
                <span className="learning-upload-field-note">
                  {textLength
                    ? `${textLength.toLocaleString("ro-RO")} caractere · minimum ${MIN_TEXT_LENGTH}`
                    : `Minimum ${MIN_TEXT_LENGTH} de caractere.`}
                </span>
              </label>
            )}
          </section>

          <input type="hidden" name="uploadedSourceDocumentId" value="" />
          <input type="hidden" name="idempotencyKey" value={idempotencyKeyRef.current} />

          <section className="learning-upload-review" aria-labelledby="learning-upload-review-title">
            <div className="learning-upload-review-head">
              <span className="learning-upload-step-number" aria-hidden="true">3</span>
              <div>
                <h3 id="learning-upload-review-title">Verifică și pornește</h3>
                <p>{readinessMessage}</p>
              </div>
            </div>
            <dl className="learning-upload-summary">
              <div><dt>Materie</dt><dd>{subjectReady ? subjectLabel : "Nealeasă"}</dd></div>
              <div><dt>Conținut</dt><dd>{sourceLabel}</dd></div>
            </dl>
            <button
              type="submit"
              data-usage-event="learning_upload_started"
              data-usage-label={sourceMode === "file" ? "Upload fisier invatare" : "Upload text invatare"}
              disabled={submitDisabled}
            >
              {noCredits ? "Ai nevoie de o încărcare" : "Pregătește materialul"}
            </button>
          </section>
        </form>
      ) : null}
    </>
  );
}
