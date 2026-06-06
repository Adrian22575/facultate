"use client";

import { useState } from "react";

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
    return <div className="empty-state">Testul activ nu conține încă întrebări.</div>;
  }

  if (phase === "result") {
    const score = questions.reduce(
      (total, question, index) => total + (answers[index] === question.correct_index ? 1 : 0),
      0
    );
    const percentage = Math.round((score / questions.length) * 100);

    return (
      <section className="surface">
        <h2>{test.title}</h2>
        <div className="score">{`Scor: ${score} / ${questions.length} (${percentage}%)`}</div>

        <div className="draft-list">
          {questions.map((question, index) => {
            const isCorrect = answers[index] === question.correct_index;
            const userText =
              answers[index] === null
                ? "(fără răspuns)"
                : question.answers[answers[index]] || "(răspuns lipsă)";
            const correctText = question.answers[question.correct_index] || "(răspuns lipsă)";

            return (
              <article key={question.id} className="draft-card">
                <strong>{`${index + 1}. ${question.question_text}`}</strong>
                <p className={isCorrect ? "correct" : "wrong"}>{`Răspunsul tău: ${userText}`}</p>
                {!isCorrect ? (
                  <p className="show-correct">
                    Corect: <b>{correctText}</b>
                  </p>
                ) : null}
                {question.explanation ? (
                  <p className="choice-row-meta">{question.explanation}</p>
                ) : null}
              </article>
            );
          })}
        </div>

        <div className="inline-actions">
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
        </div>
      </section>
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
        <div>{`Răspunse: ${answeredCount}/${questions.length}`}</div>
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
          Anterioară
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
          {currentIndex === questions.length - 1 ? "Finalizează" : "Următoare"}
        </button>
      </div>
    </section>
  );
}
