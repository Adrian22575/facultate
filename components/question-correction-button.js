"use client";

import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/action";
import { InlineFeedback } from "@/components/ui/status";
import { useDialogFocus } from "@/lib/ui/dialog";

import styles from "./question-correction-button.module.css";

function answerLabel(index) {
  return String.fromCharCode(65 + index);
}

function normalizeAnswers(answers) {
  const list = Array.isArray(answers) ? answers : [];
  return list.length ? list.map((answer) => String(answer || "")) : ["", ""];
}

const MAX_ANSWERS = 12;

export function QuestionCorrectionButton({ question, label = "Corecteaza", onSaved }) {
  const correction = question?.correction || null;
  const [open, setOpen] = useState(false);
  const [questionText, setQuestionText] = useState(question?.text || question?.question_text || "");
  const [answers, setAnswers] = useState(() => normalizeAnswers(question?.answers));
  const [correctIndex, setCorrectIndex] = useState(
    Number.isInteger(question?.correctIndex)
      ? question.correctIndex
      : Number.isInteger(question?.correct_index)
        ? question.correct_index
        : 0
  );
  const [explanation, setExplanation] = useState(question?.explanation || "");
  const [status, setStatus] = useState("idle");
  const [message, setMessage] = useState("");
  const closeRef = useRef(null);
  const dialogRef = useDialogFocus(open, () => setOpen(false), closeRef);

  useEffect(() => {
    if (!open) {
      return;
    }

    setQuestionText(question?.text || question?.question_text || "");
    setAnswers(normalizeAnswers(question?.answers));
    setCorrectIndex(
      Number.isInteger(question?.correctIndex)
        ? question.correctIndex
        : Number.isInteger(question?.correct_index)
          ? question.correct_index
          : 0
    );
    setExplanation(question?.explanation || "");
    setStatus("idle");
    setMessage("");
  }, [open, question]);

  if (!correction?.sourceType || !correction?.sourceQuestionId) {
    return null;
  }

  function updateAnswer(index, value) {
    setAnswers((current) => current.map((answer, answerIndex) => (answerIndex === index ? value : answer)));
  }

  function addAnswer() {
    setAnswers((current) => (current.length >= MAX_ANSWERS ? current : [...current, ""]));
  }

  function removeAnswer(index) {
    setAnswers((current) => {
      const next = current.filter((_, answerIndex) => answerIndex !== index);
      setCorrectIndex((currentCorrect) => {
        if (currentCorrect === index) return 0;
        if (currentCorrect > index) return currentCorrect - 1;
        return Math.min(currentCorrect, Math.max(next.length - 1, 0));
      });
      return next;
    });
  }

  async function saveCorrection(event) {
    event.preventDefault();
    setStatus("saving");
    setMessage("");

    const trimmedAnswers = answers.map((answer) => answer.trim());
    if (trimmedAnswers.some((answer) => !answer)) {
      setStatus("error");
      setMessage("Completeaza toate raspunsurile sau sterge variantele goale.");
      return;
    }

    const nextCorrectIndex = Math.min(correctIndex, trimmedAnswers.length - 1);

    try {
      const response = await fetch("/api/question-corrections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          sourceType: correction.sourceType,
          sourceQuestionId: correction.sourceQuestionId,
          questionText,
          answers: trimmedAnswers,
          correctIndex: nextCorrectIndex,
          explanation
        })
      });

      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload?.ok) {
        throw new Error(payload?.message || "Nu am putut salva corectia.");
      }

      setStatus("saved");
      setMessage("Corectia a fost salvata pentru contul tau.");
      onSaved?.(payload.correction);
      window.setTimeout(() => setOpen(false), 450);
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Nu am putut salva corectia.");
    }
  }

  const canAddAnswer = answers.length < MAX_ANSWERS;
  const nextAnswerLabel = answerLabel(answers.length);
  const addAnswerLabel = canAddAnswer
    ? `Adauga varianta ${nextAnswerLabel}`
    : `Limita de ${MAX_ANSWERS} variante`;

  return (
    <>
      <button
        type="button"
        className={styles.trigger}
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden="true" size={15} strokeWidth={2.2} />
        <span>{label}</span>
      </button>

      {open ? (
        <div className={styles.layer} role="presentation">
          <button
            className={styles.scrim}
            type="button"
            aria-label="Inchide editorul"
            onClick={() => setOpen(false)}
          />
          <section
            ref={dialogRef}
            className={styles.dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-correction-title"
          >
            <div className={styles.head}>
              <div>
                <h2 id="question-correction-title">Corecteaza intrebarea</h2>
                <p>Modificarile se aplica pentru contul tau. Poti scrie formule ca text: x^2, sqrt(x), a/b sau LaTeX.</p>
              </div>
              <button
                ref={closeRef}
                className={styles.close}
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Inchide"
              >
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>

            <form className={styles.form} onSubmit={saveCorrection}>
              {correction.sourceDocumentHref ? (
                <a
                  className={styles.sourceLink}
                  href={correction.sourceDocumentHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink aria-hidden="true" size={16} strokeWidth={2.2} />
                  Deschide fisierul original
                </a>
              ) : (
                <p className={styles.sourceMuted}>Fisierul original nu este disponibil pentru aceasta intrebare.</p>
              )}

              <label className={styles.field}>
                <span>Text intrebare</span>
                <textarea
                  value={questionText}
                  onChange={(event) => setQuestionText(event.target.value)}
                  rows={5}
                  required
                />
              </label>

              <div className={styles.answers}>
                <div className={styles.subhead}>
                  <strong>Raspunsuri</strong>
                  <Button variant="secondary" onClick={addAnswer} disabled={!canAddAnswer}>
                    <Plus aria-hidden="true" size={15} strokeWidth={2.2} />
                    {addAnswerLabel}
                  </Button>
                </div>

                {answers.map((answer, index) => (
                  <div className={styles.answerRow} key={`correction-answer-${index}`}>
                    <label className={styles.radio}>
                      <input
                        type="radio"
                        name="correct-answer"
                        checked={correctIndex === index}
                        onChange={() => setCorrectIndex(index)}
                      />
                      {answerLabel(index)}
                    </label>
                    <textarea
                      value={answer}
                      onChange={(event) => updateAnswer(index, event.target.value)}
                      aria-label={`Raspuns ${answerLabel(index)}`}
                      rows={2}
                      required
                    />
                    <button
                      type="button"
                      className={styles.remove}
                      onClick={() => removeAnswer(index)}
                      disabled={answers.length <= 2}
                      aria-label={`Sterge raspunsul ${answerLabel(index)}`}
                    >
                      <Trash2 aria-hidden="true" size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                ))}

                <Button
                  variant="secondary"
                  className={styles.addInline}
                  onClick={addAnswer}
                  disabled={!canAddAnswer}
                >
                  <Plus aria-hidden="true" size={15} strokeWidth={2.2} />
                  {addAnswerLabel}
                </Button>
              </div>

              <label className={styles.field}>
                <span>Explicatie optionala</span>
                <textarea
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                  rows={3}
                />
              </label>

              {message ? (
                <InlineFeedback className={styles.message} tone={status === "error" ? "error" : "success"} role={status === "error" ? "alert" : "status"}>
                  {message}
                </InlineFeedback>
              ) : null}

              <div className={styles.actions}>
                <Button variant="secondary" onClick={() => setOpen(false)}>
                  Renunta
                </Button>
                <Button type="submit" disabled={status === "saving"}>
                  {status === "saving" ? "Se salveaza..." : "Salveaza corectia"}
                </Button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
