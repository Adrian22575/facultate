"use client";

import Link from "next/link";
import { useState } from "react";

import { QuestionCorrectionButton } from "@/components/question-correction-button";
import { TestResultPanel } from "@/components/test-result-panel";

export function PrivateTestPlayer({ test, questions }) {
  const [safeQuestions, setSafeQuestions] = useState(questions);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(() => new Array(questions.length).fill(null));
  const [phase, setPhase] = useState("quiz");
  const [answerNotice, setAnswerNotice] = useState("");

  const currentQuestion = safeQuestions[currentIndex];
  const answeredCount = answers.filter((answer) => answer !== null).length;

  function mergeCorrectedQuestion(question, correction) {
    if (question?.correction?.sourceQuestionId !== correction.sourceQuestionId) {
      return question;
    }

    return {
      ...question,
      question_text: correction.text,
      text: correction.text,
      answers: correction.answers,
      correct_index: correction.correctIndex,
      correctIndex: correction.correctIndex,
      explanation: correction.explanation,
      correction: {
        ...(question.correction || {}),
        ...correction,
        hasPersonalCorrection: true
      }
    };
  }

  function applySavedCorrection(correction) {
    setSafeQuestions((current) => current.map((question) => mergeCorrectedQuestion(question, correction)));
  }

  function chooseAnswer(answerIndex) {
    const next = [...answers];
    next[currentIndex] = answerIndex;
    setAnswers(next);
    setAnswerNotice("");
  }

  function advanceCurrentQuestion() {
    if (answers[currentIndex] === null) {
      setAnswerNotice("Alege un raspuns inainte sa mergi mai departe.");
      return;
    }

    setAnswerNotice("");

    if (currentIndex < safeQuestions.length - 1) {
      setCurrentIndex((value) => value + 1);
    } else {
      setPhase("result");
    }
  }

  if (!safeQuestions.length) {
    return <div className="empty-state">Testul activ nu contine inca intrebari.</div>;
  }

  if (phase === "result") {
    const score = safeQuestions.reduce(
      (total, question, index) => total + (answers[index] === question.correct_index ? 1 : 0),
      0
    );
    const percentage = Math.round((score / safeQuestions.length) * 100);
    const wrongRows = safeQuestions
      .map((question, index) => {
        const selectedIndex = answers[index];

        if (selectedIndex === question.correct_index) {
          return null;
        }

        return {
          id: question.id,
          questionText: question.question_text,
          selectedIndex,
          selectedText:
            selectedIndex === null
              ? "Fara raspuns"
              : question.answers[selectedIndex] || "Raspuns lipsa",
          correctIndex: question.correct_index,
          correctText: question.answers[question.correct_index] || "Raspuns lipsa",
          explanation: question.explanation,
          correctionControl: (
            <QuestionCorrectionButton
              question={question}
              label="Corecteaza intrebarea"
              onSaved={applySavedCorrection}
            />
          )
        };
      })
      .filter(Boolean);

    return (
      <TestResultPanel
        title={test.title || "Rezultat final"}
        score={score}
        total={safeQuestions.length}
        percentage={percentage}
        wrongRows={wrongRows}
        stats={[{ label: "Greseli", value: wrongRows.length }]}
        emptyMessage="Nu ai gresit nicio intrebare in aceasta runda."
        actions={
          <>
            <Link className="btn-link secondary" href="/statistici">
              Vezi statistici
            </Link>
            <button
              type="button"
              onClick={() => {
                setAnswers(new Array(safeQuestions.length).fill(null));
                setCurrentIndex(0);
                setAnswerNotice("");
                setPhase("quiz");
              }}
            >
              Reia testul
            </button>
          </>
        }
      />
    );
  }

  return (
    <section className="surface">
      <div className="progress-bar-container" aria-label="Progres test privat">
        <div
          className="progress-fill"
          style={{ width: `${((currentIndex + 1) / safeQuestions.length) * 100}%` }}
        />
      </div>

      <div className="quiz-meta">
        <div>{`${currentIndex + 1} / ${safeQuestions.length}`}</div>
        <div>{`Raspunse: ${answeredCount}/${safeQuestions.length}`}</div>
      </div>

      <div className="question">
        <div className="question-inline-head">
          <strong>
            <span>{`${currentIndex + 1}. `}</span>
            <span className="question-rich-text">{currentQuestion.question_text}</span>
          </strong>
          <QuestionCorrectionButton question={currentQuestion} onSaved={applySavedCorrection} />
        </div>
        <div className="answers">
          {currentQuestion.answers.map((answer, answerIndex) => (
            <label key={`${currentQuestion.id}-${answerIndex}`}>
              <input
                checked={answers[currentIndex] === answerIndex}
                name={`private-q-${currentIndex}`}
                type="radio"
                value={answerIndex}
                onChange={() => chooseAnswer(answerIndex)}
              />
              <span className="question-rich-text">{answer}</span>
            </label>
          ))}
        </div>
        {answerNotice ? <p className="quiz-answer-required" role="alert">{answerNotice}</p> : null}
      </div>

      <div className="quiz-actions">
        <button
          type="button"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((value) => value - 1)}
        >
          Anterioara
        </button>
        <button
          type="button"
          className={answers[currentIndex] === null ? "is-disabled-soft" : ""}
          onClick={advanceCurrentQuestion}
        >
          {currentIndex === safeQuestions.length - 1 ? "Finalizeaza" : "Urmatoarea"}
        </button>
      </div>
    </section>
  );
}
