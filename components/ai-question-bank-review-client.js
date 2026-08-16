"use client";

import { moduleClassNames } from "@/lib/ui/module-class-names";
import { SectionLabel } from "@/components/ui/section-label";
import styles from "./ai-question-bank-review-client.module.css";
import reviewStyles from "./workspace-question-review.module.css";
import editorStyles from "./workspace-question-editor.module.css";
import { CircleAlert, CheckCircle2, Edit3, ListFilter, Plus, Save, Trash2, X } from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import {
  addQuestionBankItemAction,
  deleteQuestionBankAction,
  deleteQuestionBankItemAction,
  updateQuestionBankItemAction
} from "@/app/ai/actions";
import { FilterSearch, FilterSelect } from "@/components/ui/collection-controls";
import { DialogShell } from "@/components/ui/dialog-shell";
import { LoadingIconText } from "@/components/loading-spinner";
import { normalizeSearchText, truncateText } from "@/lib/quiz";
import { useDialogFocus } from "@/lib/ui/dialog";

const REVIEW_PAGE_SIZE_OPTIONS = [5, 10, 25, 50, "all"];
const REVIEW_FILTER_TABS = [
  { id: "all", label: "Toate" },
  { id: "needs_review", label: "De verificat" }
];

function answerLabel(index) {
  return String.fromCharCode(65 + index);
}

function IconText({ icon: Icon, children }) {
  return (
    <span className={moduleClassNames([styles, reviewStyles, editorStyles], "ui-icon-text")}>
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

function AnswerView({ answer, index, correctIndex }) {
  const label = answerLabel(index);
  const isCorrect = index === correctIndex;

  return (
    <li className={moduleClassNames([styles, reviewStyles, editorStyles], `review-answer-item ${isCorrect ? "is-correct" : ""}`)}>
      <span className={moduleClassNames([styles, reviewStyles, editorStyles], "review-answer-badge")}>{label}</span>
      <span className={moduleClassNames([styles, reviewStyles, editorStyles], "review-answer-copy")}>{answer}</span>
    </li>
  );
}

function getReviewNote(item) {
  if (item?.quality_status !== "needs_review") {
    return null;
  }

  const value = item?.metadata?.review_note;
  if (!(typeof value === "string" && value.trim())) {
    return null;
  }

  const note = value.trim();
  const normalized = note
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  if (normalized.includes("raspuns inferat") || normalized.includes("inferenta")) {
    return "Raspuns dedus (verifica rapid).";
  }

  return note;
}

function scoreReviewTextMatch(normalizedQuery, text, exactScore = 100) {
  const normalizedText = normalizeSearchText(text || "");
  if (!normalizedQuery || !normalizedText) return 0;
  if (normalizedText.includes(normalizedQuery)) return exactScore;

  const queryTokens = normalizedQuery.split(" ").filter((token) => token.length >= 3);
  if (!queryTokens.length) return 0;

  const textTokens = new Set(normalizedText.split(" ").filter((token) => token.length >= 3));
  const matchedTokens = queryTokens.filter((token) => textTokens.has(token)).length;
  if (!matchedTokens) return 0;

  const tokenScore = (matchedTokens / queryTokens.length) * Math.min(88, exactScore - 8);
  const lengthBonus = Math.min(8, normalizedQuery.length / 14);
  return Math.round(tokenScore + lengthBonus);
}

function buildReviewSearchMatch(item, normalizedQuery) {
  const numberQuery = Number(normalizedQuery);
  if (Number.isInteger(numberQuery) && numberQuery === item.position) {
    return {
      matchScore: 110,
      matchKind: "Numar intrebare",
      matchText: `Intrebarea ${item.position}`
    };
  }

  const questionScore = scoreReviewTextMatch(normalizedQuery, item.question_text, 100);
  const answerMatches = (item.answers || [])
    .map((answer, answerIndex) => ({
      answer,
      answerIndex,
      score: scoreReviewTextMatch(normalizedQuery, answer, answerIndex === item.correct_index ? 96 : 90)
    }))
    .filter((match) => match.score > 0)
    .sort((left, right) => right.score - left.score);
  const bestAnswerMatch = answerMatches[0] || null;

  if (questionScore >= (bestAnswerMatch?.score || 0)) {
    return {
      matchScore: questionScore,
      matchKind: questionScore > 0 ? "Intrebare" : "",
      matchText: ""
    };
  }

  return {
    matchScore: bestAnswerMatch.score,
    matchKind: bestAnswerMatch.answerIndex === item.correct_index ? "Raspuns corect" : "Raspuns",
    matchText: bestAnswerMatch.answer
  };
}

function ReviewQuestionView({ bankId, item, searchActive, onEdit, onDelete }) {
  const reviewNote = getReviewNote(item);

  return (
    <article
      className={moduleClassNames([styles, reviewStyles, editorStyles], `draft-card review-question-card ${item.quality_status === "needs_review" ? "is-needs-review" : ""}`)}
    >
      <div className={moduleClassNames([styles, reviewStyles, editorStyles], "draft-card-head review-question-head")}>
        <div>
          <SectionLabel variant="eyebrow">{`Intrebarea ${item.position}`}</SectionLabel>
          <strong className={moduleClassNames([styles, reviewStyles, editorStyles], "review-question-text")}>{item.question_text}</strong>
          {item.quality_status === "needs_review" ? (
            <span className={moduleClassNames([styles, reviewStyles, editorStyles], "status-pill is-warning review-quality-pill")}>Verifica atent</span>
          ) : null}
        </div>
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "inline-actions review-item-actions")}>
          <button type="button" className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")} onClick={() => onEdit(item.id)}>
            <IconText icon={Edit3}>Editeaza</IconText>
          </button>
          <button
            type="button"
            className={moduleClassNames([styles, reviewStyles, editorStyles], "secondary review-delete-btn")}
            onClick={() =>
              onDelete({
                kind: "item",
                bankId,
                itemId: item.id,
                title: `Stergi intrebarea ${item.position}?`,
                copy: "Intrebarea se sterge definitiv din banca."
              })
            }
          >
            <IconText icon={Trash2}>Sterge</IconText>
          </button>
        </div>
      </div>

      <ol className={moduleClassNames([styles, reviewStyles, editorStyles], "review-answer-list")}>
        {(item.answers || []).map((answer, index) => (
          <AnswerView key={`${item.id}-${index}`} answer={answer} index={index} correctIndex={item.correct_index} />
        ))}
      </ol>

      {reviewNote ? (
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-note-panel")}>
          <strong>Atentie</strong>
          <p>{reviewNote}</p>
        </div>
      ) : null}

      {item.explanation ? (
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-explanation")}>
          <strong>Explicatie</strong>
          <p>{item.explanation}</p>
        </div>
      ) : null}

      {searchActive && item.matchKind ? (
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-search-match")}>
          <span className={moduleClassNames([styles, reviewStyles, editorStyles], "match-score")}>
            {item.matchScore > 100 ? "Potrivire exacta" : `${Math.round(item.matchScore)}% potrivire`}
          </span>
          <span>
            {item.matchKind}
            {item.matchText ? `: ${truncateText(item.matchText, 90)}` : ""}
          </span>
        </div>
      ) : null}
    </article>
  );
}

function ReviewQuestionEditor({ item, isSaving, onCancel, onSave }) {
  const needsManualResolution = item.quality_status === "needs_review";
  const [selectedCorrectIndex, setSelectedCorrectIndex] = useState(String(item.correct_index));
  const FocusIcon = needsManualResolution ? CircleAlert : CheckCircle2;

  return (
    <article className={moduleClassNames([styles, reviewStyles, editorStyles], "draft-card draft-card-form review-question-card review-edit-card is-editing")}>
      <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-head")}>
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-question-index")}>
          <span>{item.position}</span>
        </div>
        <div>
          <SectionLabel variant="eyebrow">Editare intrebare</SectionLabel>
          <strong>Modifica intrebarea si raspunsurile</strong>
          <p>Schimbarile se aplica direct in banca publicata.</p>
        </div>
      </div>

      <div className={moduleClassNames([styles, reviewStyles, editorStyles], `review-editor-focus ${needsManualResolution ? "is-warning" : "is-ready"}`)}>
        <FocusIcon aria-hidden="true" size={20} strokeWidth={2.2} />
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-focus-copy")}>
          <strong>{needsManualResolution ? "Necesita confirmare" : "Gata de modificat"}</strong>
          <span>
            {needsManualResolution
              ? "Completeaza ce lipseste si confirma raspunsul corect."
              : "Corecteaza doar campurile necesare."}
          </span>
        </div>
      </div>

      <form
        className={moduleClassNames([styles, reviewStyles, editorStyles], "ai-form review-edit-form")}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="bankId" value={item.bank_id} />
        <input type="hidden" name="itemId" value={item.id} />
        <input type="hidden" name="correctIndex" value={selectedCorrectIndex} />

        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-section is-question")}>
          <label>
            <span>Intrebarea</span>
            <textarea
              className={moduleClassNames([styles, reviewStyles, editorStyles], "textarea-input")}
              name="questionText"
              rows="4"
              defaultValue={item.question_text}
            />
          </label>
        </div>

        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-section")}>
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-section-head")}>
            <span>Variante raspuns</span>
          </div>
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-options")}>
            {item.answers.map((answer, index) => (
              <div className={moduleClassNames([styles, reviewStyles, editorStyles], `review-editor-option ${selectedCorrectIndex === String(index) ? "is-selected" : ""}`)} key={`${item.id}-answer-${index}`}>
                <button
                  type="button"
                  className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-option-select")}
                  onClick={() => setSelectedCorrectIndex(String(index))}
                  aria-label={`Alege varianta ${answerLabel(index)} ca raspuns corect`}
                >
                  {answerLabel(index)}
                </button>
                <input
                  className={moduleClassNames([styles, reviewStyles, editorStyles], "input-search review-editor-answer-input")}
                  type="text"
                  name="answers"
                  defaultValue={answer || ""}
                  aria-label={`Text varianta ${answerLabel(index)}`}
                />
                <button
                  type="button"
                  className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-correct-button")}
                  onClick={() => setSelectedCorrectIndex(String(index))}
                  aria-pressed={selectedCorrectIndex === String(index)}
                >
                  <IconText icon={CheckCircle2}>{selectedCorrectIndex === String(index) ? "Corect" : "Alege"}</IconText>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-section")}>
          <label>
            <span>Explicatie</span>
            <textarea
              className={moduleClassNames([styles, reviewStyles, editorStyles], "textarea-input")}
              name="explanation"
              rows="3"
              defaultValue={item.explanation || ""}
            />
          </label>
        </div>

        {needsManualResolution ? (
          <label className={moduleClassNames([styles, reviewStyles, editorStyles], "review-resolve-check")}>
            <input type="checkbox" name="resolvedNeedsReview" value="true" required />
            <span>
              Am completat manual ce lipsea si am verificat raspunsul corect.
            </span>
          </label>
        ) : null}

        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "inline-actions review-edit-actions")}>
          <button type="submit" disabled={isSaving}>
            <LoadingIconText icon={Save} loading={isSaving} loadingLabel="Se salveaza...">
              Salveaza modificarile
            </LoadingIconText>
          </button>
          <button type="button" className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")} onClick={onCancel} disabled={isSaving}>
            <IconText icon={X}>Renunta</IconText>
          </button>
        </div>
      </form>
    </article>
  );
}

function ReviewQuestionManualCreator({ bankId, nextPosition, isSaving, onCancel, onSave }) {
  const [selectedCorrectIndex, setSelectedCorrectIndex] = useState("0");
  const [answerCount, setAnswerCount] = useState(4);
  const answerIndexes = Array.from({ length: answerCount }, (_, index) => index);

  function removeLastAnswer() {
    setAnswerCount((current) => {
      const nextCount = Math.max(4, current - 1);
      if (Number(selectedCorrectIndex) >= nextCount) {
        setSelectedCorrectIndex(String(nextCount - 1));
      }
      return nextCount;
    });
  }

  return (
    <article className={moduleClassNames([styles, reviewStyles, editorStyles], "draft-card draft-card-form review-question-card review-edit-card is-editing")}>
      <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-head")}>
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-question-index")}>
          <span>{nextPosition}</span>
        </div>
        <div>
          <SectionLabel variant="eyebrow">Intrebare noua</SectionLabel>
          <strong>Adauga manual o intrebare</strong>
          <p>O poti folosi daca ai sters ceva din greseala sau vrei sa completezi banca.</p>
        </div>
      </div>

      <form
        className={moduleClassNames([styles, reviewStyles, editorStyles], "ai-form review-edit-form")}
        onSubmit={(event) => {
          event.preventDefault();
          onSave(new FormData(event.currentTarget));
        }}
      >
        <input type="hidden" name="bankId" value={bankId} />
        <input type="hidden" name="correctIndex" value={selectedCorrectIndex} />

        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-section is-question")}>
          <label>
            <span>Intrebarea</span>
            <textarea
              className={moduleClassNames([styles, reviewStyles, editorStyles], "textarea-input")}
              name="questionText"
              rows="4"
              placeholder="Scrie intrebarea aici"
              required
              minLength={10}
            />
          </label>
        </div>

        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-section")}>
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-section-head")}>
            <span>Variante raspuns</span>
            <div className={moduleClassNames([styles, reviewStyles, editorStyles], "inline-actions")}>
              {answerCount < 5 ? (
                <button
                  type="button"
                  className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")}
                  onClick={() => setAnswerCount((current) => Math.min(5, current + 1))}
                  disabled={isSaving}
                >
                  <IconText icon={Plus}>Adauga varianta</IconText>
                </button>
              ) : null}
              {answerCount > 4 ? (
                <button type="button" className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")} onClick={removeLastAnswer} disabled={isSaving}>
                  <IconText icon={X}>Scoate varianta E</IconText>
                </button>
              ) : null}
            </div>
          </div>
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-options")}>
            {answerIndexes.map((index) => (
              <div className={moduleClassNames([styles, reviewStyles, editorStyles], `review-editor-option ${selectedCorrectIndex === String(index) ? "is-selected" : ""}`)} key={`new-answer-${index}`}>
                <button
                  type="button"
                  className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-option-select")}
                  onClick={() => setSelectedCorrectIndex(String(index))}
                  aria-label={`Alege varianta ${answerLabel(index)} ca raspuns corect`}
                  disabled={isSaving}
                >
                  {answerLabel(index)}
                </button>
                <input
                  className={moduleClassNames([styles, reviewStyles, editorStyles], "input-search review-editor-answer-input")}
                  type="text"
                  name="answers"
                  placeholder={`Varianta ${answerLabel(index)}`}
                  aria-label={`Text varianta ${answerLabel(index)}`}
                  required
                />
                <button
                  type="button"
                  className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-correct-button")}
                  onClick={() => setSelectedCorrectIndex(String(index))}
                  aria-pressed={selectedCorrectIndex === String(index)}
                  disabled={isSaving}
                >
                  <IconText icon={CheckCircle2}>{selectedCorrectIndex === String(index) ? "Corect" : "Alege"}</IconText>
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-editor-section")}>
          <label>
            <span>Explicatie</span>
            <textarea
              className={moduleClassNames([styles, reviewStyles, editorStyles], "textarea-input")}
              name="explanation"
              rows="3"
              placeholder="Optional"
            />
          </label>
        </div>

        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "inline-actions review-edit-actions")}>
          <button type="submit" disabled={isSaving}>
            <LoadingIconText icon={Save} loading={isSaving} loadingLabel="Se adauga...">
              Adauga intrebarea
            </LoadingIconText>
          </button>
          <button type="button" className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")} onClick={onCancel} disabled={isSaving}>
            <IconText icon={X}>Renunta</IconText>
          </button>
        </div>
      </form>
    </article>
  );
}

function ConfirmDialog({ confirmState, isPending, onClose, onConfirm }) {
  const dialogRef = useDialogFocus(Boolean(confirmState), () => {
    if (!isPending) onClose();
  });

  if (!confirmState) {
    return null;
  }

  return (
    <DialogShell
      dialogRef={dialogRef}
      titleId="review-confirm-title"
      title={confirmState.title}
      description={confirmState.copy}
      onClose={onClose}
      closeDisabled={isPending}
      closeContent={<IconText icon={X}>Inchide</IconText>}
      panelClassName={moduleClassNames([styles, reviewStyles, editorStyles], "review-confirm-modal")}
      bodyClassName={moduleClassNames([styles, reviewStyles, editorStyles], "workspace-modal-form")}
    >
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "inline-actions")}>
            <button type="button" className={moduleClassNames([styles, reviewStyles, editorStyles], "secondary review-delete-btn")} onClick={onConfirm} disabled={isPending}>
              <LoadingIconText icon={Trash2} loading={isPending} loadingLabel="Se sterge...">
                Da, sterge
              </LoadingIconText>
            </button>
            <button type="button" className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")} onClick={onClose} disabled={isPending}>
              <IconText icon={X}>Renunta</IconText>
            </button>
          </div>
    </DialogShell>
  );
}

export function AIQuestionBankReviewClient({ bank, initialItems }) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [editingItemId, setEditingItemId] = useState(null);
  const [isAddingItem, setIsAddingItem] = useState(false);
  const [reviewFilter, setReviewFilter] = useState("all");
  const [pageSize, setPageSize] = useState(5);
  const [visiblePage, setVisiblePage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [isMutating, startTransition] = useTransition();
  const [savingItemId, setSavingItemId] = useState(null);

  const visibleItems = useMemo(
    () =>
      items.map((item, index) => ({
        ...item,
        position: index + 1
      })),
    [items]
  );
  const needsReviewCount = visibleItems.filter((item) => item.quality_status === "needs_review").length;
  const filteredItems = useMemo(() => {
    if (reviewFilter === "needs_review") {
      return visibleItems.filter((item) => item.quality_status === "needs_review");
    }

    return visibleItems;
  }, [reviewFilter, visibleItems]);
  const normalizedSearchQuery = normalizeSearchText(searchQuery);
  const searchActive = normalizedSearchQuery.length >= 1;
  const searchedItems = useMemo(() => {
    if (!searchActive) {
      return filteredItems;
    }

    return filteredItems
      .map((item) => ({
        ...item,
        ...buildReviewSearchMatch(item, normalizedSearchQuery)
      }))
      .filter((item) => item.matchScore > 0)
      .sort((left, right) => right.matchScore - left.matchScore || left.position - right.position);
  }, [filteredItems, normalizedSearchQuery, searchActive]);
  const normalizedPageSize = pageSize === "all" ? searchedItems.length || 1 : Number(pageSize) || 5;
  const totalPages = Math.max(1, Math.ceil(searchedItems.length / normalizedPageSize));
  const currentPage = Math.min(visiblePage, totalPages);
  const visibleStart = (currentPage - 1) * normalizedPageSize;
  const pagedItems = pageSize === "all" ? searchedItems : searchedItems.slice(visibleStart, visibleStart + normalizedPageSize);
  const visibleEnd = pageSize === "all" ? searchedItems.length : Math.min(visibleStart + normalizedPageSize, searchedItems.length);

  function openDeleteConfirm(nextState) {
    setErrorMessage("");
    setConfirmState(nextState);
  }

  function closeDeleteConfirm() {
    if (isMutating) {
      return;
    }

    setConfirmState(null);
  }

  function handleEdit(itemId) {
    setFeedback("");
    setErrorMessage("");
    setIsAddingItem(false);
    setEditingItemId(itemId);
    const itemIndex = searchedItems.findIndex((item) => item.id === itemId);
    if (itemIndex >= 0 && pageSize !== "all") {
      setVisiblePage(Math.floor(itemIndex / normalizedPageSize) + 1);
    }
  }

  function changeReviewFilter(nextFilter) {
    setReviewFilter(nextFilter);
    setVisiblePage(1);
  }

  function handleCancelEdit() {
    if (savingItemId) {
      return;
    }

    setEditingItemId(null);
  }

  function handleOpenAddItem() {
    setFeedback("");
    setErrorMessage("");
    setEditingItemId(null);
    setIsAddingItem(true);
    setReviewFilter("all");
    setSearchQuery("");
    setVisiblePage(1);
  }

  function handleCancelAddItem() {
    if (savingItemId === "new") {
      return;
    }

    setIsAddingItem(false);
  }

  function handleAddItem(formData) {
    const questionText = String(formData.get("questionText") || "");
    const answers = formData.getAll("answers").map((value) => String(value || ""));
    const explanation = String(formData.get("explanation") || "");
    const correctIndex = Number(formData.get("correctIndex") || 0);

    setFeedback("");
    setErrorMessage("");
    setSavingItemId("new");

    startTransition(async () => {
      try {
        const result = await addQuestionBankItemAction({
          bankId: String(formData.get("bankId") || ""),
          questionText,
          answers,
          correctIndex: String(correctIndex),
          explanation
        });

        if (!result?.ok || !result.item) {
          throw new Error("Nu am putut adauga intrebarea.");
        }

        const nextItem = {
          ...result.item,
          quality_status: result.item.quality_status || "accepted",
          metadata: result.item.metadata || {}
        };
        const nextCount = items.length + 1;
        setItems((current) => [...current, nextItem]);
        setIsAddingItem(false);
        setReviewFilter("all");
        setSearchQuery("");
        setVisiblePage(pageSize === "all" ? 1 : Math.max(1, Math.ceil(nextCount / normalizedPageSize)));
        setFeedback(result.message || "Intrebarea a fost adaugata.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Nu am putut adauga intrebarea.");
      } finally {
        setSavingItemId(null);
      }
    });
  }

  function handleSave(formData) {
    const questionText = String(formData.get("questionText") || "");
    const answers = formData.getAll("answers").map((value) => String(value || ""));
    const explanation = String(formData.get("explanation") || "");
    const itemId = String(formData.get("itemId") || "");
    const correctIndex = Number(formData.get("correctIndex") || 0);
    const resolvedNeedsReview = String(formData.get("resolvedNeedsReview") || "") === "true";

    setFeedback("");
    setErrorMessage("");
    setSavingItemId(itemId);

    startTransition(async () => {
      try {
        const result = await updateQuestionBankItemAction({
          bankId: String(formData.get("bankId") || ""),
          itemId,
          questionText,
          answers,
          correctIndex: String(correctIndex),
          explanation,
          resolvedNeedsReview
        });

        if (!result?.ok) {
          throw new Error("Nu am putut salva intrebarea.");
        }

        setItems((current) =>
          current.map((item) =>
            item.id === itemId
              ? {
                  ...item,
                  question_text: questionText,
                  answers,
                  correct_index: correctIndex,
                  explanation,
                  quality_status: "accepted"
                }
              : item
          )
        );
        setEditingItemId(null);
        setFeedback(result.message || "Intrebarea a fost salvata.");
        router.refresh();
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "Nu am putut salva intrebarea.");
      } finally {
        setSavingItemId(null);
      }
    });
  }

  function handleConfirmDelete() {
    if (!confirmState) {
      return;
    }

    setFeedback("");
    setErrorMessage("");

    startTransition(async () => {
      try {
        if (confirmState.kind === "item") {
          const result = await deleteQuestionBankItemAction({
            bankId: confirmState.bankId,
            itemId: confirmState.itemId
          });

          if (!result?.ok) {
            throw new Error("Nu am putut sterge intrebarea.");
          }

          setItems((current) => current.filter((item) => item.id !== confirmState.itemId));
          const nextCount = Math.max(0, items.length - 1);
          const nextTotalPages = pageSize === "all" ? 1 : Math.max(1, Math.ceil(nextCount / normalizedPageSize));
          setVisiblePage((current) => Math.min(current, nextTotalPages));
          if (editingItemId === confirmState.itemId) {
            setEditingItemId(null);
          }
          setFeedback(result.message || "Intrebarea a fost stearsa.");
          setConfirmState(null);
          router.refresh();
          return;
        }

        const result = await deleteQuestionBankAction({
          bankId: confirmState.bankId
        });

        if (!result?.ok || !result.redirectTo) {
          throw new Error("Nu am putut sterge fisierul.");
        }

        router.push(result.redirectTo);
      } catch (error) {
        setErrorMessage(error instanceof Error ? error.message : "A aparut o problema.");
        setConfirmState(null);
      }
    });
  }

  return (
    <>
      {feedback ? (
        <section className={moduleClassNames([styles, reviewStyles, editorStyles], "surface")}>
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "success-state")} role="status">{feedback}</div>
        </section>
      ) : null}

      {errorMessage ? (
        <section className={moduleClassNames([styles, reviewStyles, editorStyles], "surface")}>
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "error-state")} role="alert">{errorMessage}</div>
        </section>
      ) : null}

      <section className={moduleClassNames([styles, reviewStyles, editorStyles], "surface")}>
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "dashboard-header")}>
          <div>
            <h2>Intrebari extrase</h2>
            <p className={moduleClassNames([styles, reviewStyles, editorStyles], "page-copy")}>
              {needsReviewCount > 0
                ? `${needsReviewCount} intrebari au nevoie de completare manuala inainte de publicare.`
                : "Deschizi doar intrebarea pe care vrei sa o modifici."}
            </p>
          </div>
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-list-controls")}>
            <button
              type="button"
              className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")}
              onClick={handleOpenAddItem}
              disabled={isAddingItem || isMutating}
            >
              <IconText icon={Plus}>Adauga intrebare</IconText>
            </button>
            {visibleItems.length ? (
              <>
                <div className={moduleClassNames([styles, reviewStyles, editorStyles], "ui-segmented-tabs review-filter-tabs")} role="group" aria-label="Filtru intrebari">
                  {REVIEW_FILTER_TABS.map((tab) => {
                    const count = tab.id === "needs_review" ? needsReviewCount : visibleItems.length;

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        aria-pressed={reviewFilter === tab.id}
                        className={moduleClassNames([styles, reviewStyles, editorStyles], `ui-segmented-tab secondary ${reviewFilter === tab.id ? "is-active" : ""}`)}
                        onClick={() => changeReviewFilter(tab.id)}
                      >
                        {`${tab.label} (${count})`}
                      </button>
                    );
                  })}
                </div>
                <FilterSearch
                  value={searchQuery}
                  onChange={(value) => {
                    setSearchQuery(value);
                    setVisiblePage(1);
                  }}
                  placeholder="Numar, intrebare sau raspuns"
                  ariaLabel="Cauta intrebarile"
                  compact
                  className={moduleClassNames([styles, reviewStyles, editorStyles], "review-search-control")}
                  inputProps={{ inputMode: "search" }}
                />
                <FilterSelect
                  label="Afiseaza"
                  value={String(pageSize)}
                  onChange={(value) => {
                    setPageSize(value === "all" ? "all" : Number(value));
                    setVisiblePage(1);
                  }}
                  icon={ListFilter}
                  ariaLabel="Numar de intrebari afisate"
                  compact
                  className={moduleClassNames([styles, reviewStyles, editorStyles], "review-page-size-control")}
                  options={REVIEW_PAGE_SIZE_OPTIONS.map((option) => ({
                    value: String(option),
                    label: option === "all" ? "Toate" : `${option} intrebari`
                  }))}
                />
                <span className={moduleClassNames([styles, reviewStyles, editorStyles], "review-list-range")}>
                  {`${searchedItems.length ? visibleStart + 1 : 0}-${visibleEnd} din ${searchedItems.length}`}
                </span>
              </>
            ) : null}
          </div>
        </div>

        {needsReviewCount > 0 ? (
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-required-panel")}>
            <strong>Publicarea este blocata temporar</strong>
            <p>
              Editeaza fiecare intrebare marcata cu atentie, completeaza ce lipseste si bifeaza confirmarea din formular.
            </p>
          </div>
        ) : null}

        {isAddingItem ? (
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "draft-list review-manual-add-list")}>
            <ReviewQuestionManualCreator
              bankId={bank.id}
              nextPosition={visibleItems.length + 1}
              isSaving={savingItemId === "new"}
              onCancel={handleCancelAddItem}
              onSave={handleAddItem}
            />
          </div>
        ) : null}

        {searchedItems.length ? (
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "draft-list")}>
            {pagedItems.map((item) =>
              editingItemId === item.id ? (
                <ReviewQuestionEditor
                  key={item.id}
                  item={{ ...item, bank_id: bank.id }}
                  isSaving={savingItemId === item.id}
                  onCancel={handleCancelEdit}
                  onSave={handleSave}
                />
              ) : (
                <ReviewQuestionView
                  key={item.id}
                  bankId={bank.id}
                  item={item}
                  searchActive={searchActive}
                  onEdit={handleEdit}
                  onDelete={openDeleteConfirm}
                />
              )
            )}
          </div>
        ) : !isAddingItem ? (
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "draft-card review-empty-card")}>
            <strong>
              {searchActive
                ? "Nu am gasit intrebari pentru cautarea aceasta."
                : reviewFilter === "needs_review"
                  ? "Nu mai sunt intrebari de verificat."
                  : "Nu mai exista intrebari in aceasta banca."}
            </strong>
            <p className={moduleClassNames([styles, reviewStyles, editorStyles], "page-copy")}>
              {searchActive
                ? "Cauta dupa numarul intrebarii, un cuvant din intrebare sau un text din raspuns."
                : reviewFilter === "needs_review"
                  ? "Toate intrebarile marcate au fost rezolvate sau sterse."
                : "Poti sterge fisierul sau poti incarca unul nou."}
            </p>
          </div>
        ) : null}

        {searchedItems.length > normalizedPageSize && pageSize !== "all" ? (
          <div className={moduleClassNames([styles, reviewStyles, editorStyles], "review-pagination")}>
            <button
              type="button"
              className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")}
              onClick={() => setVisiblePage(1)}
              disabled={currentPage <= 1}
            >
              Prima pagina
            </button>
            <button
              type="button"
              className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")}
              onClick={() => setVisiblePage((current) => Math.max(1, current - 1))}
              disabled={currentPage <= 1}
            >
              Inapoi
            </button>
            <span>{`Pagina ${currentPage} din ${totalPages}`}</span>
            <button
              type="button"
              className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")}
              onClick={() => setVisiblePage((current) => Math.min(totalPages, current + 1))}
              disabled={currentPage >= totalPages}
            >
              Mai multe
            </button>
            <button
              type="button"
              className={moduleClassNames([styles, reviewStyles, editorStyles], "btn-link secondary")}
              onClick={() => setVisiblePage(totalPages)}
              disabled={currentPage >= totalPages}
            >
              Ultima pagina
            </button>
          </div>
        ) : null}
      </section>

      <section className={moduleClassNames([styles, reviewStyles, editorStyles], "surface review-danger-panel")}>
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "dashboard-header")}>
          <div>
            <h2>Sterge fisierul</h2>
            <p className={moduleClassNames([styles, reviewStyles, editorStyles], "page-copy")}>
              Aceasta actiune sterge doar intrebarile extrase din acest upload. Materia ramane in catalog.
            </p>
          </div>
        </div>
        <div className={moduleClassNames([styles, reviewStyles, editorStyles], "inline-actions")}>
          <button
            type="button"
            className={moduleClassNames([styles, reviewStyles, editorStyles], "secondary review-delete-btn")}
            onClick={() =>
              openDeleteConfirm({
                kind: "bank",
                bankId: bank.id,
                title: "Stergi fisierul?",
                copy: "Se sterg doar intrebarile extrase din acest fisier. Materia ramane disponibila."
              })
            }
          >
            <IconText icon={Trash2}>Sterge fisierul</IconText>
          </button>
        </div>
      </section>

      <ConfirmDialog
        confirmState={confirmState}
        isPending={isMutating}
        onClose={closeDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
