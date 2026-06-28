"use client";

import { ExternalLink, Pencil, Plus, Trash2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { useDialogFocus } from "@/lib/ui/dialog";

function answerLabel(index) {
  return String.fromCharCode(65 + index);
}

function normalizeAnswers(answers) {
  const list = Array.isArray(answers) ? answers : [];
  return list.length ? list.map((answer) => String(answer || "")) : ["", ""];
}

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
    setAnswers((current) => [...current, ""]);
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

  return (
    <>
      <button
        type="button"
        className="question-correction-trigger"
        onClick={() => setOpen(true)}
      >
        <Pencil aria-hidden="true" size={15} strokeWidth={2.2} />
        <span>{label}</span>
      </button>

      {open ? (
        <div className="question-correction-layer" role="presentation">
          <button
            className="question-correction-scrim"
            type="button"
            aria-label="Inchide editorul"
            onClick={() => setOpen(false)}
          />
          <section
            ref={dialogRef}
            className="question-correction-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="question-correction-title"
          >
            <div className="question-correction-head">
              <div>
                <h2 id="question-correction-title">Corecteaza intrebarea</h2>
                <p>Modificarile se aplica pentru contul tau. Poti scrie formule ca text: x^2, sqrt(x), a/b sau LaTeX.</p>
              </div>
              <button
                ref={closeRef}
                className="question-correction-close"
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Inchide"
              >
                <X aria-hidden="true" size={20} strokeWidth={2.2} />
              </button>
            </div>

            <form className="question-correction-form" onSubmit={saveCorrection}>
              {correction.sourceDocumentHref ? (
                <a
                  className="question-source-link"
                  href={correction.sourceDocumentHref}
                  target="_blank"
                  rel="noreferrer"
                >
                  <ExternalLink aria-hidden="true" size={16} strokeWidth={2.2} />
                  Deschide fisierul original
                </a>
              ) : (
                <p className="question-source-muted">Fisierul original nu este disponibil pentru aceasta intrebare.</p>
              )}

              <label className="question-correction-field">
                <span>Text intrebare</span>
                <textarea
                  value={questionText}
                  onChange={(event) => setQuestionText(event.target.value)}
                  rows={5}
                  required
                />
              </label>

              <div className="question-correction-answers">
                <div className="question-correction-subhead">
                  <strong>Raspunsuri</strong>
                  <button type="button" className="secondary" onClick={addAnswer} disabled={answers.length >= 12}>
                    <Plus aria-hidden="true" size={15} strokeWidth={2.2} />
                    Adauga
                  </button>
                </div>

                {answers.map((answer, index) => (
                  <div className="question-correction-answer-row" key={`correction-answer-${index}`}>
                    <label className="question-correction-radio">
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
                      className="question-correction-remove"
                      onClick={() => removeAnswer(index)}
                      disabled={answers.length <= 2}
                      aria-label={`Sterge raspunsul ${answerLabel(index)}`}
                    >
                      <Trash2 aria-hidden="true" size={16} strokeWidth={2.2} />
                    </button>
                  </div>
                ))}
              </div>

              <label className="question-correction-field">
                <span>Explicatie optionala</span>
                <textarea
                  value={explanation}
                  onChange={(event) => setExplanation(event.target.value)}
                  rows={3}
                />
              </label>

              {message ? (
                <p className={`question-correction-message is-${status}`} role={status === "error" ? "alert" : "status"}>
                  {message}
                </p>
              ) : null}

              <div className="question-correction-actions">
                <button type="button" className="secondary" onClick={() => setOpen(false)}>
                  Renunta
                </button>
                <button type="submit" disabled={status === "saving"}>
                  {status === "saving" ? "Se salveaza..." : "Salveaza corectia"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
