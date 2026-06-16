"use client";

import { useState } from "react";

import { TestResultPanel } from "@/components/test-result-panel";

export function PrivateTestPlayer({ test, questions }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState(() => new Array(questions.length).fill(null));
  const [phase, setPhase] = useState("quiz");

  const currentQuestion = questions[currentIndex];
  const answeredCount = answers.filter((answer) => answer !== null).length;

  function chooseAnswer(answerIndex) {
    const next = [...answers];
    next[currentIndex] = answerIndex;
    setAnswers(next);
  }

  if (!questions.length) {
    return <div className="empty-state">Testul activ nu contine inca intrebari.</div>;
  }

  if (phase === "result") {
    const score = questions.reduce(
      (total, question, index) => total + (answers[index] === question.correct_index ? 1 : 0),
      0
    );
    const percentage = Math.round((score / questions.length) * 100);
    const wrongRows = questions
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
          explanation: question.explanation
        };
      })
      .filter(Boolean);

    return (
      <TestResultPanel
        title={test.title || "Rezultat final"}
        score={score}
        total={questions.length}
        percentage={percentage}
        wrongRows={wrongRows}
        stats={[{ label: "Greseli", value: wrongRows.length }]}
        emptyMessage="Nu ai gresit nicio intrebare in aceasta runda."
        actions={
          <button
            type="button"
            onClick={() => {
              setAnswers(new Array(questions.length).fill(null));
              setCurrentIndex(0);
              setPhase("quiz");
            }}
          >
            Reia testul
          </button>
        }
      />
    );
  }

  return (
    <section className="surface">
      <div className="progress-bar-container" aria-label="Progres test privat">
        <div
          className="progress-fill"
          style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
        />
      </div>

      <div className="quiz-meta">
        <div>{`${currentIndex + 1} / ${questions.length}`}</div>
        <div>{`Raspunse: ${answeredCount}/${questions.length}`}</div>
      </div>

      <div className="question">
        <strong>{`${currentIndex + 1}. ${currentQuestion.question_text}`}</strong>
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
              {answer}
            </label>
          ))}
        </div>
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
          onClick={() => {
            if (currentIndex < questions.length - 1) {
              setCurrentIndex((value) => value + 1);
            } else {
              setPhase("result");
            }
          }}
        >
          {currentIndex === questions.length - 1 ? "Finalizeaza" : "Urmatoarea"}
        </button>
      </div>
    </section>
  );
}
