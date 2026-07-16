"use client";

import Link from "next/link";
import { useId, useRef, useState } from "react";
import { Check, ClipboardPaste, FileUp, LoaderCircle, Upload } from "lucide-react";

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

function ProcessingPanel({ status }) {
  return (
    <section className="learning-processing-panel" aria-live="polite">
      <span className="learning-processing-icon" aria-hidden="true">
        <LoaderCircle size={20} strokeWidth={2.3} />
      </span>
      <div className="learning-processing-copy">
        <strong>{status || "Pregatim materialul..."}</strong>
        <p>Poti inchide pagina. Materialul ramane disponibil in Materialele mele.</p>
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
  const [manualText, setManualText] = useState("");
  const [clientError, setClientError] = useState("");
  const [errorActionHref, setErrorActionHref] = useState("");
  const [status, setStatus] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
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
  const subjectReady = Boolean(selectedSubjectId);
  const disabled = Boolean(setupWarning) || noCredits || isSubmitting;
  const submitDisabled = disabled || !sourceReady || !subjectReady;
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
  }

  function updateSelectedFile(file) {
    if (isSubmitting) return;
    setSelectedFile(file || null);
    uploadedSourceDocumentIdRef.current = "";
    setClientError("");
    setErrorActionHref("");
    setStatus("");
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
      {visibleError ? (
        <div className="error-state" role="alert">
          <span>{visibleError}</span>
          {errorActionHref ? <Link href={errorActionHref}>Vezi pachetele</Link> : null}
        </div>
      ) : null}
      {noCredits ? (
        <div className="learning-upload-credit-warning" role="status">
          <div>
            <strong>Ai nevoie de o incarcare disponibila.</strong>
            <span>Alege un pachet, apoi revii automat aici pentru upload.</span>
          </div>
          <Link className="btn-link secondary" href={creditPurchaseHref}>
            Vezi pachetele
          </Link>
        </div>
      ) : null}
      {isSubmitting ? <ProcessingPanel status={status} /> : null}
      <form className="surface learning-upload-form" onSubmit={handleSubmit} aria-busy={isSubmitting}>
        <div className="learning-upload-section-head">
          <div>
            <h2>Adauga materialul</h2>
          </div>
          <span className="learning-upload-cost-meta">Consuma 1 incarcare</span>
        </div>

        <section className="learning-upload-subject-section" aria-labelledby="learning-upload-subject-title">
          <div className="learning-upload-subject-head">
            <div>
              <h3 id="learning-upload-subject-title">Materia</h3>
              <p>Alege materia căreia îi aparține conținutul.</p>
            </div>
          </div>

          <label className="learning-upload-field">
            <span className="sr-only">Materia</span>
            <select
              className="input-search"
              name="subjectId"
              value={selectedSubjectId}
              required
              disabled={isSubmitting}
              onChange={(event) => {
                setSelectedSubjectId(event.target.value);
                setClientError("");
                setErrorActionHref("");
              }}
            >
              <option value="" disabled>
                Alege materia
              </option>
              {subjects.map((subject) => (
                <option key={subject.id} value={subject.id}>
                  {subject.title}
                </option>
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
                disabled={isSubmitting}
                autoFocus
              />
              <span className="learning-upload-field-note">
                O adăugăm pentru acest material; îl poți publica ulterior pentru comunitatea ta.
              </span>
            </label>
          ) : null}

          <p className="learning-upload-subject-helper">
            Nu găsești materia? Alege „Adaugă o materie nouă”.
          </p>
        </section>

        <div className="learning-upload-source-grid" aria-label="Tipuri sursa">
          <SourceOption
            icon={FileUp}
            title="Incarca fisier"
            copy="PDF, DOCX, PPTX sau TXT"
            active={sourceMode === "file"}
            disabled={isSubmitting}
            onClick={() => switchSourceMode("file")}
          />
          <SourceOption
            icon={ClipboardPaste}
            title="Lipeste text"
            copy="Lipeste continutul direct"
            active={sourceMode === "text"}
            disabled={isSubmitting}
            onClick={() => switchSourceMode("text")}
          />
        </div>

        {sourceMode === "file" ? (
          <div className="learning-upload-file-box">
            <label className="learning-upload-file-drop" htmlFor={fileInputId}>
              <Upload aria-hidden="true" size={22} strokeWidth={2.2} />
              <strong>{selectedFile ? selectedFile.name : "Alege PDF, DOCX, PPTX sau TXT"}</strong>
              <span>
                {selectedFile
                  ? `${formatFileSize(selectedFile.size)} din ${AI_SOURCE_UPLOAD_MAX_LABEL}`
                  : `Un singur fisier, maxim ${AI_SOURCE_UPLOAD_MAX_LABEL}.`}
              </span>
              <input
                id={fileInputId}
                ref={fileInputRef}
                type="file"
                name="sourceFile"
                accept=".pdf,.docx,.pptx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.openxmlformats-officedocument.presentationml.presentation,text/plain"
                disabled={isSubmitting}
                onChange={(event) => updateSelectedFile(event.target.files?.[0] || null)}
              />
            </label>
            {selectedFile ? (
          <button
            type="button"
            className="btn-link secondary"
            data-usage-event="learning_file_removed"
            data-usage-label="Sterge fisierul invatare"
            disabled={isSubmitting}
            onClick={() => {
                  updateSelectedFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
              >
                Sterge fisierul
              </button>
            ) : null}
          </div>
        ) : (
          <label className="learning-upload-field">
            Textul materiei
            <textarea
              className="input-search learning-upload-textarea"
              name="manualText"
              placeholder="Lipeste aici cursul, notitele sau continutul capitolului..."
              value={manualText}
              readOnly={isSubmitting}
              minLength={MIN_TEXT_LENGTH}
              onChange={(event) => {
                setManualText(event.target.value);
                setClientError("");
                setErrorActionHref("");
                setStatus("");
              }}
            />
            <span className="learning-upload-field-note">
              {textLength ? `${textLength}/${MIN_TEXT_LENGTH} caractere minime` : "Textul lipit ramane alternativa rapida."}
            </span>
          </label>
        )}

        <input type="hidden" name="uploadedSourceDocumentId" value="" />
        <input type="hidden" name="idempotencyKey" value={idempotencyKeyRef.current} />

        <div className="learning-upload-submit-row">
          <p>
            {status || (!subjectReady
              ? "Alege materia înainte să pornești procesarea."
              : "Materialul rămâne privat. Îl poți publica pentru comunitatea ta mai târziu.")}
          </p>
          <button
            type="submit"
            data-usage-event="learning_upload_started"
            data-usage-label={sourceMode === "file" ? "Upload fisier invatare" : "Upload text invatare"}
            disabled={submitDisabled}
          >
            {isSubmitting
                ? "Se proceseaza..."
                : noCredits
                  ? "Ai nevoie de o incarcare"
                  : !subjectReady
                    ? "Alege materia"
                : "Proceseaza materia"}
          </button>
        </div>
      </form>
    </>
  );
}
