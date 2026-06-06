"use client";

import Link from "next/link";
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Edit3,
  ExternalLink,
  ListPlus,
  Plus,
  Save,
  Search,
  Trash2,
  X
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { LoadingIconText } from "@/components/loading-spinner";

const TERMINAL_STATUSES = new Set([
  "ready_for_preview",
  "completed",
  "completed_with_warnings",
  "needs_review",
  "failed"
]);

const REVIEWABLE_STATUSES = new Set(["ready_for_preview", "needs_review", "completed_with_warnings"]);

const QUESTION_TABS = [
  { id: "all", label: "Toate", countKey: "totalQuestions" },
  { id: "answer_matched", label: "Cu raspuns", countKey: "questionsWithAnswers" },
  { id: "missing_answer", label: "Fara raspuns", countKey: "questionsMissingAnswers" },
  { id: "needs_review", label: "De verificat", countKey: "needsReviewCount" }
];
const REVIEW_PAGE_SIZE = 10;

function IconText({ icon: Icon, children }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
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

function questionStatusHint(status) {
  if (status === "missing_answer") return "Alege varianta corecta sau corecteaza textul.";
  if (status === "needs_review") return "Verifica intrebarea inainte de salvare.";
  if (status === "answer_matched") return "Poti pastra raspunsul sau poti alege altul.";
  return "Intrebare extrasa din set.";
}

function getFirstActionableFilter(nextStatus) {
  if (Number(nextStatus?.questionsMissingAnswers || 0) > 0) {
    return "missing_answer";
  }
  if (Number(nextStatus?.needsReviewCount || 0) > 0) {
    return "needs_review";
  }
  return "all";
}

function getFollowUpFilter(nextStatus, currentFilter) {
  if (currentFilter === "missing_answer" && Number(nextStatus?.questionsMissingAnswers || 0) === 0) {
    return getFirstActionableFilter(nextStatus);
  }
  if (currentFilter === "needs_review" && Number(nextStatus?.needsReviewCount || 0) === 0) {
    return getFirstActionableFilter(nextStatus);
  }
  return currentFilter;
}

function getReviewLoadKey(importJobId, nextStatus) {
  if (!importJobId || !nextStatus) return "";
  return [
    importJobId,
    nextStatus.status || "",
    Number(nextStatus.questionsMissingAnswers || 0),
    Number(nextStatus.needsReviewCount || 0),
    Number(nextStatus.totalQuestions || 0)
  ].join(":");
}

function answerLabel(index) {
  return String.fromCharCode(65 + index);
}

function optionDisplayLabel(option, index) {
  return String(option?.label || answerLabel(index)).toUpperCase();
}

function normalizeEditorOptions(options) {
  const normalized = (options || []).map((option, index) => ({
    label: option.label || String.fromCharCode(97 + index),
    text: option.text || "",
    isCorrect: Boolean(option.isCorrect)
  }));

  while (normalized.length < 4) {
    normalized.push({
      label: String.fromCharCode(97 + normalized.length),
      text: "",
      isCorrect: false
    });
  }

  return normalized.slice(0, 5);
}

function getDuplicateOptionLabels(options) {
  const seen = new Set();
  const duplicates = new Set();
  for (const option of options || []) {
    const label = String(option.label || "").trim().toLowerCase();
    if (!label) continue;
    if (seen.has(label)) {
      duplicates.add(label);
    }
    seen.add(label);
  }
  return duplicates;
}

function getEditorIssues({ questionText, options, correctIndex }) {
  const issues = [];
  const filledOptions = (options || []).filter((option) => String(option.text || "").trim());
  const duplicates = getDuplicateOptionLabels(options);

  if (String(questionText || "").trim().length < 10) {
    issues.push("Textul intrebarii este prea scurt");
  }
  if (filledOptions.length < 4 || filledOptions.length > 5) {
    issues.push("Sunt necesare 4 sau 5 variante");
  }
  if ((options || []).some((option) => String(option.text || "").trim() && !String(option.label || "").trim())) {
    issues.push("Fiecare varianta are nevoie de litera");
  }
  if (duplicates.size > 0) {
    issues.push("Exista litere duplicate");
  }
  if (correctIndex === "") {
    issues.push("Alege raspunsul corect");
  } else if (!String(options?.[Number(correctIndex)]?.text || "").trim()) {
    issues.push("Raspunsul corect nu are text");
  }

  return issues;
}

function buildBlankQuestion(nextIndex = 1) {
  return {
    id: "__new_question__",
    globalIndex: nextIndex,
    localNumber: String(nextIndex),
    questionText: "",
    status: "needs_review",
    options: normalizeEditorOptions([])
  };
}

function getInitialCorrectIndex(question) {
  const index = (question.options || []).findIndex((option) => option.isCorrect);
  return index >= 0 ? String(index) : "";
}

function buildAnswerSelectionPayload(question, optionIndex) {
  return {
    questionId: question.id,
    questionText: question.questionText,
    options: normalizeEditorOptions(question.options),
    correctOptionIndex: String(optionIndex),
    markReviewed: true
  };
}

function ImportQuestionEditor({ question, isSaving, onCancel, onSave }) {
  const [questionText, setQuestionText] = useState(question.questionText || "");
  const [options, setOptions] = useState(() => normalizeEditorOptions(question.options));
  const [correctIndex, setCorrectIndex] = useState(() => getInitialCorrectIndex(question));
  const isNewQuestion = question.id === "__new_question__";
  const duplicatedLabels = useMemo(() => getDuplicateOptionLabels(options), [options]);
  const editorIssues = useMemo(
    () => getEditorIssues({ questionText, options, correctIndex }),
    [questionText, options, correctIndex]
  );
  const canSubmitEditor = editorIssues.length === 0 && !isSaving;

  function updateOption(index, patch) {
    setOptions((current) =>
      current.map((option, optionIndex) => (optionIndex === index ? { ...option, ...patch } : option))
    );
  }

  function addOption() {
    setOptions((current) =>
      current.length >= 5
        ? current
        : [
            ...current,
            {
              label: String.fromCharCode(97 + current.length),
              text: "",
              isCorrect: false
            }
          ]
    );
  }

  function removeOption(index) {
    setOptions((current) => current.filter((_, optionIndex) => optionIndex !== index));
    setCorrectIndex((current) => {
      const parsed = Number(current);
      if (!Number.isInteger(parsed)) return "";
      if (parsed === index) return "";
      return parsed > index ? String(parsed - 1) : current;
    });
  }

  return (
    <article className="draft-card draft-card-form review-question-card review-edit-card is-editing">
      <div className="review-editor-head">
        <div className="review-question-index">
          <span>{question.globalIndex || question.localNumber || "-"}</span>
        </div>
        <div>
          <span className="step-eyebrow">{isNewQuestion ? "Intrebare noua" : "Reparare intrebare"}</span>
          <strong>{isNewQuestion ? "Adauga intrebarea lipsa" : `Intrebarea ${question.globalIndex || question.localNumber || ""}`}</strong>
        </div>
      </div>

      <div className={`review-editor-focus ${editorIssues.length ? "is-warning" : "is-ready"}`}>
        {editorIssues.length ? (
          <>
            <AlertTriangle aria-hidden="true" size={18} strokeWidth={2.2} />
            <div>
              <strong>De rezolvat</strong>
              <div className="review-editor-issue-list">
                {editorIssues.map((issue) => (
                  <span key={issue}>{issue}</span>
                ))}
              </div>
            </div>
          </>
        ) : (
          <>
            <CheckCircle2 aria-hidden="true" size={18} strokeWidth={2.2} />
            <div>
              <strong>Gata de salvat</strong>
              <span>Intrebarea are variante valide si raspuns corect.</span>
            </div>
          </>
        )}
      </div>

      <form
        className="ai-form review-edit-form"
        onSubmit={(event) => {
          event.preventDefault();
          onSave({
            questionId: question.id,
            questionText,
            options,
            correctOptionIndex: correctIndex,
            markReviewed: true
          });
        }}
      >
        <div className="review-editor-section is-question">
          <label>
            <span>Intrebarea</span>
            <textarea
              className="textarea-input"
              rows="4"
              value={questionText}
              onChange={(event) => setQuestionText(event.target.value)}
            />
          </label>
        </div>

        <div className="review-editor-section">
          <div className="review-editor-section-head">
            <span>Variante</span>
            {options.length < 5 ? (
              <button type="button" className="btn-link secondary" onClick={addOption}>
                <IconText icon={Plus}>Adauga varianta</IconText>
              </button>
            ) : null}
          </div>
          <div className="review-editor-options">
            {options.map((option, index) => (
              <div className={`review-editor-option ${correctIndex === String(index) ? "is-selected" : ""}`} key={`${question.id}-option-${index}`}>
                <button
                  type="button"
                  className="review-editor-option-select"
                  onClick={() => setCorrectIndex(String(index))}
                  aria-label={`Alege varianta ${optionDisplayLabel(option, index)} ca raspuns corect`}
                >
                  {optionDisplayLabel(option, index)}
                </button>
                <input
                  className={duplicatedLabels.has(String(option.label || "").trim().toLowerCase()) ? "input-search review-editor-label-input is-invalid" : "input-search review-editor-label-input"}
                  type="text"
                  value={option.label}
                  maxLength={8}
                  aria-label={`Litera variantei ${index + 1}`}
                  onChange={(event) => updateOption(index, { label: event.target.value })}
                />
                <input
                  className="input-search"
                  type="text"
                  value={option.text}
                  placeholder={`Text varianta ${optionDisplayLabel(option, index)}`}
                  onChange={(event) => updateOption(index, { text: event.target.value })}
                />
                <button
                  type="button"
                  className="review-editor-correct-button"
                  onClick={() => setCorrectIndex(String(index))}
                  aria-pressed={correctIndex === String(index)}
                >
                  <IconText icon={CheckCircle2}>{correctIndex === String(index) ? "Corect" : "Alege"}</IconText>
                </button>
                {options.length > 4 ? (
                  <button type="button" className="btn-link secondary" onClick={() => removeOption(index)}>
                    <IconText icon={Trash2}>Elimina</IconText>
                  </button>
                ) : null}
              </div>
            ))}
          </div>
        </div>

        <div className="inline-actions review-edit-actions">
          <button type="submit" disabled={!canSubmitEditor}>
            <LoadingIconText icon={Save} loading={isSaving} loadingLabel="Se salveaza...">
              {isNewQuestion ? "Adauga intrebarea" : "Salveaza modificarile"}
            </LoadingIconText>
          </button>
          <button type="button" className="btn-link secondary" onClick={onCancel} disabled={isSaving}>
            <IconText icon={X}>Renunta</IconText>
          </button>
        </div>
      </form>
    </article>
  );
}

function ImportQuestionCard({ question, isEditing, isSaving, readOnly, onEdit, onCancel, onSave, onDelete }) {
  const initialCorrectIndex = getInitialCorrectIndex(question);
  const [selectedIndex, setSelectedIndex] = useState(initialCorrectIndex);

  useEffect(() => {
    setSelectedIndex(initialCorrectIndex);
  }, [question.id, initialCorrectIndex]);

  if (isEditing) {
    return (
      <ImportQuestionEditor
        question={question}
        isSaving={isSaving}
        onCancel={onCancel}
        onSave={onSave}
      />
    );
  }

  const canChooseAnswer = !readOnly && (question.options || []).length >= 4;
  const hasSelectedAnswer = selectedIndex !== "";
  const hasAnswerChange = selectedIndex !== initialCorrectIndex;
  const saveAnswerDisabled = isSaving || !hasSelectedAnswer || !hasAnswerChange;
  const duplicateLabels = getDuplicateOptionLabels(question.options);
  const hasDuplicateLabels = duplicateLabels.size > 0;
  const needsFocusedRepair = question.status === "needs_review" || question.status === "missing_answer" || hasDuplicateLabels;

  return (
    <article className={`draft-card import-preview-question review-work-card ${question.status === "needs_review" || hasDuplicateLabels ? "is-needs-review" : ""} ${question.status === "missing_answer" ? "is-missing-answer" : ""}`}>
      <div className="review-work-topline">
        <div className="review-question-index">
          <span>{question.globalIndex || question.localNumber || "-"}</span>
        </div>
        <div className="review-work-main">
          <div className="review-work-meta">
            <span className={`status-pill ${question.status === "answer_matched" ? "is-good" : "is-warning"}`}>
              {questionStatusLabel(question.status)}
            </span>
            {hasDuplicateLabels ? <span className="review-issue-chip">Litere duplicate</span> : null}
            {initialCorrectIndex === "" ? <span className="review-issue-chip">Raspuns neales</span> : null}
            <span>{questionStatusHint(question.status)}</span>
          </div>
          <strong className="review-question-text">{question.questionText}</strong>
        </div>
        <div className="inline-actions review-item-actions">
          {!readOnly ? (
            <>
              <button type="button" className={needsFocusedRepair ? "btn-link" : "btn-link secondary"} onClick={() => onEdit(question.id)}>
                <IconText icon={Edit3}>{needsFocusedRepair ? "Repara" : "Ajusteaza"}</IconText>
              </button>
              <button type="button" className="secondary review-delete-btn" onClick={() => onDelete(question)}>
                <IconText icon={Trash2}>Elimina</IconText>
              </button>
            </>
          ) : null}
        </div>
      </div>

      <ol className="review-answer-list">
        {(question.options || []).map((option, index) => (
          <li
            key={`${question.id}-${index}`}
            className={`review-answer-item ${selectedIndex === String(index) ? "is-selected" : ""} ${option.isCorrect ? "is-correct" : ""} ${canChooseAnswer ? "has-action" : ""}`}
          >
            {canChooseAnswer ? (
              <button
                type="button"
                className="review-answer-select"
                onClick={() => setSelectedIndex(String(index))}
                disabled={isSaving}
                aria-pressed={selectedIndex === String(index)}
              >
                {String(option.label || answerLabel(index)).toUpperCase()}
              </button>
            ) : (
              <span className="review-answer-badge">
                {String(option.label || answerLabel(index)).toUpperCase()}
              </span>
            )}
            <span className="review-answer-copy">{option.text}</span>
            {selectedIndex === String(index) ? <span className="review-answer-state">Selectat</span> : null}
          </li>
        ))}
      </ol>
      {canChooseAnswer ? (
        <div className="review-answer-actions">
          <span>
            {hasAnswerChange
              ? "Ai schimbat raspunsul. Apasa Salveaza ca sa confirmi."
              : hasSelectedAnswer
                ? "Raspunsul afisat este cel salvat."
                : "Alege raspunsul corect."}
          </span>
          <button
            type="button"
            className="btn-link"
            onClick={() => onSave(buildAnswerSelectionPayload(question, Number(selectedIndex)))}
            disabled={saveAnswerDisabled}
          >
            <LoadingIconText icon={Save} loading={isSaving} loadingLabel="Se salveaza...">
              Salveaza raspunsul
            </LoadingIconText>
          </button>
        </div>
      ) : null}
    </article>
  );
}

function ImportQuestionSearchBar({ value, activeValue, total, onChange, onSubmit, onClear }) {
  return (
    <form className="import-question-search" onSubmit={onSubmit}>
      <label className="import-question-search-label">
        <span>Cauta intrebare</span>
        <input
          className="input-search"
          type="search"
          inputMode="search"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder="Numar, ex. 37, sau text din intrebare"
        />
      </label>
      <div className="import-question-search-actions">
        <button type="submit" className="btn-link secondary">
          <IconText icon={Search}>Cauta</IconText>
        </button>
        {activeValue ? (
          <button type="button" className="btn-link secondary" onClick={onClear}>
            <IconText icon={X}>Reset</IconText>
          </button>
        ) : null}
      </div>
      {activeValue ? (
        <span className="micro-copy">{`${total} rezultate pentru "${activeValue}"`}</span>
      ) : null}
    </form>
  );
}

function ReadyToSaveSetPanel({ sessionMode, isBusy, onSave, onSaveAndContinue }) {
  return (
    <div className="import-next-step-panel" aria-live="polite">
      <div className="import-next-step-copy">
        <span className="step-eyebrow">Pasul final</span>
        <h2>{sessionMode ? "Setul este corectat" : "Importul este corectat"}</h2>
        <p>
          {sessionMode
            ? "Modificarile la intrebari sunt salvate. Mai trebuie sa salvezi setul in licenta ca sa dispara complet din zona de verificare."
            : "Modificarile la intrebari sunt salvate. Salveaza importul ca sa pregatim banca finala."}
        </p>
      </div>
      <div className="import-next-step-actions">
        <button type="button" onClick={onSave} disabled={isBusy}>
          <LoadingIconText icon={CheckCircle2} loading={isBusy} loadingLabel="Se salveaza...">
            {sessionMode ? "Salveaza setul in licenta" : "Salveaza importul"}
          </LoadingIconText>
        </button>
        {sessionMode && onSaveAndContinue ? (
          <button
            type="button"
            className="btn-link secondary"
            onClick={onSaveAndContinue}
            disabled={isBusy}
          >
            <LoadingIconText icon={ListPlus} loading={isBusy} loadingLabel="Se salveaza...">
              Salveaza si incarca urmatorul set
            </LoadingIconText>
          </button>
        ) : null}
      </div>
    </div>
  );
}

function ConfirmDialog({ confirmState, isBusy, onClose, onConfirm }) {
  if (!confirmState) return null;

  return (
    <div className="workspace-modal-backdrop" role="presentation">
      <div className="workspace-modal-card review-confirm-modal" role="dialog" aria-modal="true">
        <div className="workspace-modal-head">
          <div>
            <strong>{confirmState.title}</strong>
            <p>{confirmState.copy}</p>
          </div>
          <button className="workspace-modal-close feedback-modal-close" type="button" onClick={onClose} disabled={isBusy}>
            <IconText icon={X}>Inchide</IconText>
          </button>
        </div>
        <div className="workspace-modal-form">
          <div className="inline-actions">
            <button type="button" className="secondary review-delete-btn" onClick={onConfirm} disabled={isBusy}>
              <LoadingIconText icon={Trash2} loading={isBusy} loadingLabel="Se elimina...">
                Da, elimina
              </LoadingIconText>
            </button>
            <button type="button" className="btn-link secondary" onClick={onClose} disabled={isBusy}>
              <IconText icon={X}>Renunta</IconText>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function ImportJobStatusClient({
  initialStatus,
  sessionMode = false,
  guidedMode = false,
  readOnly = false,
  onImportConfirmed,
  onStatusChange,
  onRequestNextSet,
  onRequestFinalize
}) {
  const [status, setStatus] = useState(initialStatus);
  const [warnings, setWarnings] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [questionTotal, setQuestionTotal] = useState(0);
  const [questionPage, setQuestionPage] = useState(1);
  const [hasMoreQuestions, setHasMoreQuestions] = useState(false);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [questionsLoadError, setQuestionsLoadError] = useState("");
  const [activeFilter, setActiveFilter] = useState("all");
  const [questionSearchInput, setQuestionSearchInput] = useState("");
  const [activeQuestionSearch, setActiveQuestionSearch] = useState("");
  const [editingQuestionId, setEditingQuestionId] = useState(null);
  const [isAddingQuestion, setIsAddingQuestion] = useState(false);
  const [savingQuestionId, setSavingQuestionId] = useState(null);
  const [confirmState, setConfirmState] = useState(null);
  const [showAllQuestions, setShowAllQuestions] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [processingNotice, setProcessingNotice] = useState("");
  const [showAnswerKeyForm, setShowAnswerKeyForm] = useState(false);
  const [answerKeyText, setAnswerKeyText] = useState("");
  const [isSubmittingAnswerKey, setIsSubmittingAnswerKey] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const inFlightRef = useRef(false);
  const loadedReviewRef = useRef("");
  const questionRequestRef = useRef(0);
  const processErrorCountRef = useRef(0);
  const reviewSectionRef = useRef(null);

  const importJobId = status?.importJobId || null;
  const failedWithExtractedQuestions = status?.status === "failed" && Number(status?.totalQuestions || 0) > 0;
  const failedWithoutExtractedQuestions = status?.status === "failed" && Number(status?.totalQuestions || 0) < 1;
  const shouldProcess = useMemo(
    () => importJobId && status && !TERMINAL_STATUSES.has(status.status),
    [importJobId, status]
  );
  const canReview = !readOnly && status && (REVIEWABLE_STATUSES.has(status.status) || failedWithExtractedQuestions);
  const canSupplementAnswers = canReview && Number(status?.questionsMissingAnswers || 0) > 0;
  const hasPostSaveActions = Boolean(onRequestNextSet || onRequestFinalize);
  const canSave =
    canReview &&
    status.totalQuestions > 0 &&
    status.questionsMissingAnswers === 0 &&
    status.needsReviewCount === 0;
  const progress =
    Number.isFinite(status?.progressPercent)
      ? status.progressPercent
      : status?.totalChunks > 0
      ? Math.round((status.processedChunks / Math.max(status.totalChunks, 1)) * 100)
      : TERMINAL_STATUSES.has(status?.status)
        ? 100
        : 8;
  const visibleQuestions = guidedMode ? questions.slice(0, 3) : questions;
  const setIndexLabel = status?.setIndex ? `Setul ${status.setIndex}` : "Setul";

  async function readJson(response) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(payload?.error || "Cererea nu a putut fi finalizata.");
    }
    return payload;
  }

  async function loadPreview(jobId) {
    const response = await fetch(`/api/import/${jobId}/preview`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });
    const payload = await readJson(response);
    setWarnings(payload.warnings || []);
    setStatus(payload.status);
    if (payload.status?.status !== "failed") {
      setErrorMessage("");
      setProcessingNotice("");
    }
    onStatusChange?.(payload.status);
  }

  async function loadStatus(jobId) {
    const response = await fetch(`/api/import/${jobId}/status`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });
    const payload = await readJson(response);
    setStatus(payload);
    if (payload.status !== "failed") {
      setErrorMessage("");
      setProcessingNotice("");
    }
    onStatusChange?.(payload);
  }

  async function loadQuestions(filter = activeFilter, page = 1, append = false, search = activeQuestionSearch, jobId = importJobId) {
    if (!jobId) return;
    const requestId = questionRequestRef.current + 1;
    questionRequestRef.current = requestId;
    setIsLoadingQuestions(true);
    setQuestionsLoadError("");

    const params = new URLSearchParams({
      status: filter,
      page: String(page),
      pageSize: String(REVIEW_PAGE_SIZE)
    });
    if (search.trim()) {
      params.set("q", search.trim());
    }

    try {
      const response = await fetch(`/api/import/${jobId}/questions?${params.toString()}`, {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store"
      });
      const payload = await readJson(response);
      if (questionRequestRef.current !== requestId || payload.status?.importJobId !== jobId) {
        return;
      }
      setStatus(payload.status);
      if (payload.status?.status !== "failed") {
        setErrorMessage("");
        setProcessingNotice("");
      }
      setQuestionPage(payload.page);
      setQuestionTotal(payload.total || 0);
      setHasMoreQuestions(Boolean(payload.hasMore));
      setQuestions((current) => (append ? [...current, ...(payload.items || [])] : payload.items || []));
    } catch (error) {
      if (questionRequestRef.current === requestId) {
        const message = error instanceof Error ? error.message : "Nu am putut incarca intrebarile.";
        setQuestionsLoadError(message);
        throw error;
      }
    } finally {
      if (questionRequestRef.current === requestId) {
        setIsLoadingQuestions(false);
      }
    }
  }

  async function loadReviewData(filter = activeFilter) {
    if (!importJobId) return;
    await Promise.all([loadPreview(importJobId), loadQuestions(filter, 1, false, activeQuestionSearch, importJobId)]);
  }

  async function loadActionableReviewData(nextStatus) {
    const targetJobId = nextStatus?.importJobId || importJobId;
    if (!targetJobId) return;
    const nextFilter = getFirstActionableFilter(nextStatus);
    setActiveFilter(nextFilter);
    setQuestionSearchInput("");
    setActiveQuestionSearch("");
    await Promise.all([loadPreview(targetJobId), loadQuestions(nextFilter, 1, false, "", targetJobId)]);
  }

  async function processOnce(jobId) {
    const response = await fetch(`/api/import/${jobId}/process`, {
      method: "POST",
      credentials: "same-origin",
      headers: {
        Accept: "application/json"
      }
    });
    const payload = await readJson(response);
    processErrorCountRef.current = 0;
    setProcessingNotice("");
    setErrorMessage("");
    setStatus(payload);
    onStatusChange?.(payload);

    if (TERMINAL_STATUSES.has(payload.status)) {
      await loadActionableReviewData(payload);
    }
  }

  useEffect(() => {
    if (!shouldProcess || !importJobId) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;

    async function tick() {
      if (cancelled || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      try {
        await processOnce(importJobId);
      } catch (error) {
        processErrorCountRef.current += 1;
        if (processErrorCountRef.current >= 3) {
          setProcessingNotice("Procesarea dureaza mai mult decat de obicei. Verificam in continuare statusul setului.");
        }
        try {
          await loadStatus(importJobId);
        } catch {
          if (processErrorCountRef.current >= 5) {
            setErrorMessage(error instanceof Error ? error.message : "Nu am putut verifica procesarea acum.");
          }
        }
      } finally {
        inFlightRef.current = false;
        if (!cancelled) {
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
  }, [importJobId, shouldProcess]);

  useEffect(() => {
    if (!shouldProcess || !importJobId) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;

    async function pollStatus() {
      try {
        await loadStatus(importJobId);
      } catch {
        // Procesarea ramane responsabila pentru mesajul de eroare vizibil.
      } finally {
        if (!cancelled) {
          timeoutId = window.setTimeout(pollStatus, 1500);
        }
      }
    }

    timeoutId = window.setTimeout(pollStatus, 700);
    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [importJobId, shouldProcess]);

  useEffect(() => {
    if (!importJobId || !TERMINAL_STATUSES.has(status?.status)) {
      return;
    }

    const reviewLoadKey = getReviewLoadKey(importJobId, status);
    if (loadedReviewRef.current === reviewLoadKey) {
      return;
    }

    loadedReviewRef.current = reviewLoadKey;
    loadActionableReviewData(status).catch((error) => {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut incarca intrebarile.");
    });
  }, [importJobId, status?.status, status?.questionsMissingAnswers, status?.needsReviewCount, status?.totalQuestions]);

  async function confirmImport({ continueToNextSet = false } = {}) {
    if (!importJobId || readOnly || !canSave) return;
    setIsBusy(true);
    setErrorMessage("");
    setFeedback("");
    try {
      const response = await fetch(`/api/import/${importJobId}/confirm`, {
        method: "POST",
        credentials: "same-origin"
      });
      const payload = await readJson(response);
      setStatus(payload);
      onStatusChange?.(payload);
      setFeedback(
        payload.licentaSessionId
          ? "Setul a fost salvat in licenta. Poti continua cu urmatorul set sau finaliza licenta."
          : "Importul a fost salvat."
      );
      await loadReviewData();
      await onImportConfirmed?.(payload, { continueToNextSet });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut salva importul.");
    } finally {
      setIsBusy(false);
    }
  }

  async function saveQuestion(payload) {
    if (!importJobId || readOnly || !payload?.questionId) return;
    const questionId = payload.questionId;
    setSavingQuestionId(questionId);
    setErrorMessage("");
    setFeedback("");
    try {
      const response = await fetch(`/api/import/${importJobId}/questions/${questionId}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = await readJson(response);
      setStatus(result.status);
      onStatusChange?.(result.status);
      setEditingQuestionId(null);
      const isSetReady =
        Number(result.status?.questionsMissingAnswers || 0) === 0 &&
        Number(result.status?.needsReviewCount || 0) === 0;
      setFeedback(
        isSetReady
          ? sessionMode
            ? "Modificarile au fost salvate. Setul este corectat; salveaza setul in licenta ca sa finalizezi pasul."
            : "Modificarile au fost salvate. Importul este corectat; salveaza importul ca sa finalizezi pasul."
          : result.message || "Modificarile au fost salvate."
      );
      const nextFilter = getFollowUpFilter(result.status, activeFilter);
      setActiveFilter(nextFilter);
      setQuestionSearchInput("");
      setActiveQuestionSearch("");
      try {
        await loadQuestions(nextFilter, 1, false, "", importJobId);
        await loadPreview(importJobId);
      } catch (reloadError) {
        setErrorMessage(reloadError instanceof Error ? reloadError.message : "Modificarile au fost salvate, dar lista nu s-a reincarcat automat.");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut salva intrebarea.");
    } finally {
      setSavingQuestionId(null);
    }
  }

  async function addQuestion(payload) {
    if (!importJobId || readOnly) return;
    setSavingQuestionId("__new_question__");
    setErrorMessage("");
    setFeedback("");
    try {
      const response = await fetch(`/api/import/${importJobId}/questions`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(payload)
      });
      const result = await readJson(response);
      setStatus(result.status);
      onStatusChange?.(result.status);
      setIsAddingQuestion(false);
      setFeedback(result.message || "Intrebarea a fost adaugata.");
      setActiveFilter("all");
      setQuestionSearchInput("");
      setActiveQuestionSearch("");
      await loadQuestions("all", 1, false, "", importJobId);
      await loadPreview(importJobId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut adauga intrebarea.");
    } finally {
      setSavingQuestionId(null);
    }
  }

  async function submitAnswerKey(event) {
    event.preventDefault();
    if (!importJobId || readOnly || !answerKeyText.trim()) {
      setErrorMessage("Lipeste lista de raspunsuri inainte sa o potrivesti.");
      return;
    }

    setIsSubmittingAnswerKey(true);
    setErrorMessage("");
    setFeedback("");
    try {
      const response = await fetch(`/api/import/${importJobId}/answers`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({ answerKeyText })
      });
      const result = await readJson(response);
      setStatus(result.status);
      onStatusChange?.(result.status);
      setFeedback(result.message || "Raspunsurile au fost verificate.");
      setAnswerKeyText("");
      setShowAnswerKeyForm(false);
      const nextFilter = getFirstActionableFilter(result.status);
      setActiveFilter(nextFilter);
      await loadReviewData(nextFilter);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut potrivi raspunsurile.");
    } finally {
      setIsSubmittingAnswerKey(false);
    }
  }

  async function deleteQuestion() {
    if (!importJobId || readOnly || !confirmState?.questionId) return;
    setIsBusy(true);
    setErrorMessage("");
    setFeedback("");
    try {
      const response = await fetch(`/api/import/${importJobId}/questions/${confirmState.questionId}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const result = await readJson(response);
      setStatus(result.status);
      onStatusChange?.(result.status);
      setFeedback(result.message || "Intrebarea a fost eliminata.");
      setConfirmState(null);
      const nextFilter = getFollowUpFilter(result.status, activeFilter);
      setActiveFilter(nextFilter);
      setQuestionSearchInput("");
      setActiveQuestionSearch("");
      await loadQuestions(nextFilter, 1, false, "", importJobId);
      await loadPreview(importJobId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut elimina intrebarea.");
      setConfirmState(null);
    } finally {
      setIsBusy(false);
    }
  }

  async function changeFilter(nextFilter) {
    setActiveFilter(nextFilter);
    setEditingQuestionId(null);
    setIsAddingQuestion(false);
    setErrorMessage("");
    await loadQuestions(nextFilter, 1, false, activeQuestionSearch, importJobId);
  }

  async function submitQuestionSearch(event) {
    event.preventDefault();
    const nextSearch = questionSearchInput.trim();
    setActiveQuestionSearch(nextSearch);
    setEditingQuestionId(null);
    setIsAddingQuestion(false);
    setErrorMessage("");
    await loadQuestions(activeFilter, 1, false, nextSearch, importJobId);
  }

  async function clearQuestionSearch() {
    setQuestionSearchInput("");
    setActiveQuestionSearch("");
    setEditingQuestionId(null);
    setIsAddingQuestion(false);
    setErrorMessage("");
    await loadQuestions(activeFilter, 1, false, "", importJobId);
  }

  async function openAllQuestionsModal() {
    setShowAllQuestions(true);
    setQuestionSearchInput("");
    setActiveQuestionSearch("");
    setEditingQuestionId(null);
    setIsAddingQuestion(false);
    setErrorMessage("");
    try {
      await loadQuestions(activeFilter, 1, false, "", importJobId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut incarca intrebarile.");
    }
  }

  async function reloadCurrentQuestions() {
    try {
      await loadQuestions(activeFilter, 1, false, "", importJobId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut incarca intrebarile.");
    }
  }

  function startAddingQuestion() {
    setEditingQuestionId(null);
    setIsAddingQuestion(true);
    setErrorMessage("");
  }

  async function jumpToProblemFilter(nextFilter) {
    setQuestionSearchInput("");
    setActiveQuestionSearch("");
    setActiveFilter(nextFilter);
    setEditingQuestionId(null);
    setIsAddingQuestion(false);
    setErrorMessage("");
    if (guidedMode) {
      setShowAllQuestions(true);
      try {
        await loadQuestions(nextFilter, 1, false, "", importJobId);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Nu am putut incarca intrebarile.");
      }
    } else {
      try {
        await loadQuestions(nextFilter, 1, false, "", importJobId);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Nu am putut incarca intrebarile.");
      }
      reviewSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  if (!status) {
    return <div className="error-state">Importul nu a putut fi incarcat.</div>;
  }

  return (
    <div className={`job-status-stack${guidedMode ? " licenta-guided-job" : ""}`}>
      {feedback ? <div className="success-state">{feedback}</div> : null}
      {processingNotice ? (
        <div className="workspace-credit-alert import-warning-panel">
          <div>
            <strong>Procesarea continua</strong>
            <p>{processingNotice}</p>
          </div>
        </div>
      ) : null}
      {errorMessage ? <div className="error-state">{errorMessage}</div> : null}

      <section className={guidedMode ? "licenta-guided-status" : "surface workspace-job-hero"}>
        <div className="workspace-job-badge">
          <span className={`status-pill ${statusTone(status.status)}`}>{statusLabel(status.status)}</span>
        </div>
        <div className="progress-bar-container job-progress-bar" aria-label="Progres import">
          <div className="progress-fill" style={{ width: `${Math.min(progress, 100)}%` }} />
        </div>
        <div className="job-status-copy workspace-job-copy">
          <strong>{TERMINAL_STATUSES.has(status.status) ? statusLabel(status.status) : `${progress}%`}</strong>
          <p>{status.message}</p>
        </div>
      </section>

      <section className={guidedMode ? "licenta-guided-summary" : "surface"}>
        <div className="dashboard-header">
          <h2>Pe scurt</h2>
          <span className="status-pill is-muted">Licenta</span>
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
        {failedWithoutExtractedQuestions ? (
          <div className="workspace-credit-alert import-warning-panel">
            <div>
              <strong>Setul nu poate fi verificat in forma actuala</strong>
              <p>Elimina setul din zona de gestionare si incarca din nou un fisier sau text mai clar.</p>
            </div>
          </div>
        ) : null}
      </section>

      {TERMINAL_STATUSES.has(status.status) ? (
        <section className={guidedMode ? "licenta-guided-review-section" : "surface"} ref={reviewSectionRef}>
          <div className="dashboard-header">
            <div>
              <h2>
                {guidedMode
                  ? readOnly
                    ? `${setIndexLabel} este salvat in licenta`
                    : `${setIndexLabel} a fost procesat`
                  : readOnly
                    ? "Set pentru audit"
                    : "Verifica intrebarile"}
              </h2>
              <p className="page-copy">
                {guidedMode
                  ? readOnly
                    ? "Setul ramane disponibil pentru audit in zona de gestionare."
                    : "Verifica sumarul, uita-te peste cateva intrebari si salveaza setul doar daca este pregatit."
                  : readOnly
                    ? "Setul este deja salvat in licenta. Intrebarile raman vizibile, fara editare aici."
                    : "Completeaza raspunsurile lipsa sau elimina intrebarile care nu trebuie salvate."}
              </p>
            </div>
          </div>

          {warnings.length ? (
            <div className="workspace-credit-alert import-warning-panel">
              <div>
                <strong>Atentionari</strong>
                {warnings.map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          ) : null}

          {canSupplementAnswers ? (
            <div className="import-answer-key-panel">
              <div className="import-answer-key-copy">
                <span className="step-eyebrow">Raspunsuri separate</span>
                <strong>Ai uitat sa pui baremul?</strong>
                <p>
                  Lipeste aici lista de raspunsuri. O potrivim cu intrebarile deja extrase, apoi verifici doar ce ramane neclar.
                </p>
              </div>
              {showAnswerKeyForm ? (
                <form className="import-answer-key-form" onSubmit={submitAnswerKey}>
                  <textarea
                    className="textarea-input"
                    rows="5"
                    value={answerKeyText}
                    onChange={(event) => setAnswerKeyText(event.target.value)}
                    placeholder="Exemplu: 1-a, 2-c, 3-b..."
                    disabled={isSubmittingAnswerKey}
                  />
                  <div className="inline-actions import-actions-row">
                    <button type="submit" disabled={isSubmittingAnswerKey || !answerKeyText.trim()}>
                      <LoadingIconText icon={CheckCircle2} loading={isSubmittingAnswerKey} loadingLabel="Potrivim...">
                        Potriveste raspunsurile
                      </LoadingIconText>
                    </button>
                    <button
                      type="button"
                      className="btn-link secondary"
                      onClick={() => {
                        setShowAnswerKeyForm(false);
                        setAnswerKeyText("");
                      }}
                      disabled={isSubmittingAnswerKey}
                    >
                      <IconText icon={X}>Renunta</IconText>
                    </button>
                  </div>
                </form>
              ) : (
                <button type="button" className="btn-link secondary" onClick={() => setShowAnswerKeyForm(true)}>
                  <IconText icon={ListPlus}>Adauga raspunsuri</IconText>
                </button>
              )}
            </div>
          ) : null}

          {canSave ? (
            <ReadyToSaveSetPanel
              sessionMode={sessionMode}
              isBusy={isBusy}
              onSave={() => confirmImport()}
              onSaveAndContinue={sessionMode ? () => confirmImport({ continueToNextSet: true }) : null}
            />
          ) : null}

          {guidedMode ? (
            <div className="licenta-guided-preview">
              <div className="dashboard-header ai-workspace-subsection-head">
                <div>
                  <h2>Preview intrebari</h2>
                  <p className="page-copy">Afisam doar cateva intrebari aici, ca pagina sa ramana usor de urmarit.</p>
                </div>
                <button type="button" className="btn-link secondary" onClick={openAllQuestionsModal}>
                  Vezi toate intrebarile
                </button>
              </div>
              {isLoadingQuestions && !visibleQuestions.length ? (
                <div className="draft-card review-empty-card">
                  <strong>Se incarca intrebarile...</strong>
                  <p className="page-copy">Aducem lista pentru setul curent.</p>
                </div>
              ) : questionsLoadError ? (
                <div className="error-state">{questionsLoadError}</div>
              ) : visibleQuestions.length ? (
                <div className="draft-list import-preview-list">
                  {visibleQuestions.map((question) => (
                    <ImportQuestionCard
                      key={question.id}
                      question={question}
                      isEditing={!readOnly && editingQuestionId === question.id}
                      isSaving={savingQuestionId === question.id}
                      readOnly={readOnly}
                      onEdit={(questionId) => {
                        setIsAddingQuestion(false);
                        setEditingQuestionId(questionId);
                      }}
                      onCancel={() => setEditingQuestionId(null)}
                      onSave={saveQuestion}
                      onDelete={(item) =>
                        setConfirmState({
                          questionId: item.id,
                          title: "Elimini intrebarea din import?",
                          copy: "Intrebarea nu va fi salvata in banca finala."
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="draft-card review-empty-card">
                  <strong>Nu exista inca preview.</strong>
                  <p className="page-copy">Deschide lista completa daca vrei sa verifici toate intrebarile.</p>
                  {questionTotal > 0 ? (
                    <button type="button" className="btn-link secondary" onClick={openAllQuestionsModal}>
                      Reincarca intrebarile
                    </button>
                  ) : null}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="ui-segmented-tabs import-main-tabs" role="tablist" aria-label="Filtru intrebari">
                {QUESTION_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeFilter === tab.id}
                    className={`ui-segmented-tab secondary ${activeFilter === tab.id ? "is-active" : ""}`}
                    onClick={() => changeFilter(tab.id)}
                  >
                    {`${tab.label} (${status?.[tab.countKey] || 0})`}
                  </button>
                ))}
              </div>

              <ImportQuestionSearchBar
                value={questionSearchInput}
                activeValue={activeQuestionSearch}
                total={questionTotal}
                onChange={setQuestionSearchInput}
                onSubmit={submitQuestionSearch}
                onClear={clearQuestionSearch}
              />

              <div className="dashboard-header ai-workspace-subsection-head">
                <h2>{`${questionTotal} intrebari`}</h2>
                {canReview ? (
                  <button type="button" className="btn-link secondary" onClick={startAddingQuestion}>
                    <IconText icon={Plus}>Adauga intrebare</IconText>
                  </button>
                ) : null}
              </div>

              {isAddingQuestion ? (
                <ImportQuestionEditor
                  question={buildBlankQuestion(Number(status?.totalQuestions || 0) + 1)}
                  isSaving={savingQuestionId === "__new_question__"}
                  onCancel={() => setIsAddingQuestion(false)}
                  onSave={addQuestion}
                />
              ) : null}

              {isLoadingQuestions && !questions.length ? (
                <div className="draft-card review-empty-card">
                  <strong>Se incarca intrebarile...</strong>
                  <p className="page-copy">Aducem lista pentru filtrul selectat.</p>
                </div>
              ) : questionsLoadError ? (
                <div className="error-state">{questionsLoadError}</div>
              ) : questions.length ? (
                <div className="draft-list import-preview-list">
                  {questions.map((question) => (
                    <ImportQuestionCard
                      key={question.id}
                      question={question}
                      isEditing={!readOnly && editingQuestionId === question.id}
                      isSaving={savingQuestionId === question.id}
                      readOnly={readOnly}
                      onEdit={(questionId) => {
                        setIsAddingQuestion(false);
                        setEditingQuestionId(questionId);
                      }}
                      onCancel={() => setEditingQuestionId(null)}
                      onSave={saveQuestion}
                      onDelete={(item) =>
                        setConfirmState({
                          questionId: item.id,
                          title: "Elimini intrebarea din import?",
                          copy: "Intrebarea nu va fi salvata in banca finala."
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="draft-card review-empty-card">
                  <strong>Nu exista intrebari in acest filtru.</strong>
                  <p className="page-copy">Schimba filtrul sau revino dupa ce procesarea este gata.</p>
                  {questionTotal > 0 ? (
                    <button
                      type="button"
                      className="btn-link secondary"
                      onClick={reloadCurrentQuestions}
                    >
                      Reincarca intrebarile
                    </button>
                  ) : null}
                </div>
              )}

              {hasMoreQuestions ? (
                <div className="inline-actions import-actions-row">
                  <button
                    type="button"
                    className="btn-link secondary"
                    onClick={() => loadQuestions(activeFilter, questionPage + 1, true, activeQuestionSearch)}
                  >
                    <IconText icon={ListPlus}>Incarca mai multe</IconText>
                  </button>
                </div>
              ) : null}
            </>
          )}
        </section>
      ) : null}

      <section className={guidedMode ? "licenta-guided-bottom" : "surface"}>
        {!canSave && canReview ? (
          <div className="workspace-credit-alert import-warning-panel">
            <div>
              <strong>Salvarea este blocata temporar</strong>
              <p>Corecteaza sau elimina toate intrebarile fara raspuns si cele de verificat.</p>
            </div>
            <div className="import-warning-actions">
              {status.questionsMissingAnswers > 0 ? (
                <button type="button" className="btn-link secondary" onClick={() => jumpToProblemFilter("missing_answer")}>
                  Fara raspuns ({status.questionsMissingAnswers})
                </button>
              ) : null}
              {status.needsReviewCount > 0 ? (
                <button type="button" className="btn-link secondary" onClick={() => jumpToProblemFilter("needs_review")}>
                  De verificat ({status.needsReviewCount})
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        {sessionMode && status.status === "completed" ? (
          <div className="import-next-step-panel is-saved" aria-live="polite">
            <div className="import-next-step-copy">
              <span className="step-eyebrow">Set salvat</span>
              <h2>Setul este salvat in licenta</h2>
              <p>
                {hasPostSaveActions
                  ? "Alege urmatorul pas: mai incarci un set sau finalizezi licenta."
                  : "Setul ramane disponibil aici pentru audit si revizitare."}
              </p>
            </div>
            <div className="import-next-step-actions">
              {onRequestNextSet ? (
                <button type="button" className="btn-back" onClick={onRequestNextSet}>
                  <IconText icon={ListPlus}>Incarca urmatorul set</IconText>
                </button>
              ) : null}
              {onRequestFinalize ? (
                <button type="button" className="btn-link secondary" onClick={onRequestFinalize}>
                  <IconText icon={CheckCircle2}>Finalizeaza licenta</IconText>
                </button>
              ) : null}
            </div>
          </div>
        ) : null}

        <div className="inline-actions import-actions-row">
          {status.resultHref ? (
            <Link className="btn-back" href={status.resultHref}>
              <IconText icon={ExternalLink}>Deschide verificarea</IconText>
            </Link>
          ) : null}
          {!sessionMode ? (
            <Link className="btn-link secondary" href="/materiale">
              <IconText icon={ArrowLeft}>Inapoi</IconText>
            </Link>
          ) : null}
        </div>
      </section>

      {guidedMode && showAllQuestions ? (
        <div className="workspace-modal-backdrop" role="presentation">
          <div className="workspace-modal-card licenta-questions-modal" role="dialog" aria-modal="true">
            <div className="workspace-modal-head">
              <div>
                <strong>{`Intrebarile din ${setIndexLabel.toLowerCase()}`}</strong>
                <p>Editeaza sau elimina intrebarile problematice, apoi revino la pasul principal.</p>
              </div>
              <button
                className="workspace-modal-close feedback-modal-close"
                type="button"
                onClick={() => setShowAllQuestions(false)}
                disabled={isBusy}
              >
                <IconText icon={X}>Inchide</IconText>
              </button>
            </div>
            <div className="workspace-modal-form licenta-questions-modal-body">
              {canSave ? (
                <ReadyToSaveSetPanel
                  sessionMode={sessionMode}
                  isBusy={isBusy}
                  onSave={() => confirmImport()}
                  onSaveAndContinue={sessionMode ? () => confirmImport({ continueToNextSet: true }) : null}
                />
              ) : null}

              <div className="ui-segmented-tabs import-main-tabs" role="tablist" aria-label="Filtru intrebari">
                {QUESTION_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeFilter === tab.id}
                    className={`ui-segmented-tab secondary ${activeFilter === tab.id ? "is-active" : ""}`}
                    onClick={() => changeFilter(tab.id)}
                  >
                    {`${tab.label} (${status?.[tab.countKey] || 0})`}
                  </button>
                ))}
              </div>

              <ImportQuestionSearchBar
                value={questionSearchInput}
                activeValue={activeQuestionSearch}
                total={questionTotal}
                onChange={setQuestionSearchInput}
                onSubmit={submitQuestionSearch}
                onClear={clearQuestionSearch}
              />

              <div className="dashboard-header ai-workspace-subsection-head">
                <h2>{`${questionTotal} intrebari`}</h2>
                {canReview ? (
                  <button type="button" className="btn-link secondary" onClick={startAddingQuestion}>
                    <IconText icon={Plus}>Adauga intrebare</IconText>
                  </button>
                ) : null}
              </div>

              {isAddingQuestion ? (
                <ImportQuestionEditor
                  question={buildBlankQuestion(Number(status?.totalQuestions || 0) + 1)}
                  isSaving={savingQuestionId === "__new_question__"}
                  onCancel={() => setIsAddingQuestion(false)}
                  onSave={addQuestion}
                />
              ) : null}

              {isLoadingQuestions && !questions.length ? (
                <div className="draft-card review-empty-card">
                  <strong>Se incarca intrebarile...</strong>
                  <p className="page-copy">Aducem lista pentru filtrul selectat.</p>
                </div>
              ) : questionsLoadError ? (
                <div className="error-state">{questionsLoadError}</div>
              ) : questions.length ? (
                <div className="draft-list import-preview-list">
                  {questions.map((question) => (
                    <ImportQuestionCard
                      key={question.id}
                      question={question}
                      isEditing={!readOnly && editingQuestionId === question.id}
                      isSaving={savingQuestionId === question.id}
                      readOnly={readOnly}
                      onEdit={(questionId) => {
                        setIsAddingQuestion(false);
                        setEditingQuestionId(questionId);
                      }}
                      onCancel={() => setEditingQuestionId(null)}
                      onSave={saveQuestion}
                      onDelete={(item) =>
                        setConfirmState({
                          questionId: item.id,
                          title: "Elimini intrebarea din import?",
                          copy: "Intrebarea nu va fi salvata in banca finala."
                        })
                      }
                    />
                  ))}
                </div>
              ) : (
                <div className="draft-card review-empty-card">
                  <strong>Nu exista intrebari in acest filtru.</strong>
                  <p className="page-copy">Schimba filtrul sau revino dupa ce procesarea este gata.</p>
                  {questionTotal > 0 ? (
                    <button
                      type="button"
                      className="btn-link secondary"
                      onClick={reloadCurrentQuestions}
                    >
                      Reincarca intrebarile
                    </button>
                  ) : null}
                </div>
              )}

              {hasMoreQuestions ? (
                <div className="inline-actions import-actions-row">
                  <button
                    type="button"
                    className="btn-link secondary"
                    onClick={() => loadQuestions(activeFilter, questionPage + 1, true, activeQuestionSearch)}
                  >
                    <IconText icon={ListPlus}>Incarca mai multe</IconText>
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      {!readOnly ? (
        <ConfirmDialog
          confirmState={confirmState}
          isBusy={isBusy}
          onClose={() => setConfirmState(null)}
          onConfirm={deleteQuestion}
        />
      ) : null}
    </div>
  );
}
