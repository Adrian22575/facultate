"use client";

import { useEffect, useState } from "react";

import { syncSubjectProgress } from "@/lib/progress-client";
import { saveLastSession } from "@/lib/session-storage";
import { shuffleArray } from "@/lib/quiz";

export function InteractiveQuiz({ subject, initialQuestions }) {
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);

  useEffect(() => {
    const shuffled = shuffleArray(
      initialQuestions.map((question) => ({
        ...question,
        answers: [...question.answers]
      }))
    );

    setQuestions(shuffled);
    setUserAnswers(new Array(shuffled.length).fill(null));

    saveLastSession({
      subjectId: subject.id,
      subjectTitle: subject.title,
      mode: "Interactiv",
      url: `/materii/${subject.id}/interactiv`
    });
  }, [initialQuestions, subject.id, subject.title]);

  const totalQuestions = questions.length;
  const currentQuestion = questions[currentIndex];

  const stats = userAnswers.reduce(
    (accumulator, answer, index) => {
      if (answer === null || answer === undefined) return accumulator;
      accumulator.answered += 1;
      if (answer === questions[index]?.correctIndex) accumulator.correct += 1;
      else accumulator.wrong += 1;
      return accumulator;
    },
    { answered: 0, correct: 0, wrong: 0 }
  );

  useEffect(() => {
    if (!totalQuestions || stats.answered === 0) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      void syncSubjectProgress({
        subjectId: subject.id,
        mode: "interactiv",
        interactiveTotalQuestions: totalQuestions,
        interactiveAnswered: stats.answered,
        interactiveCorrect: stats.correct,
        interactiveWrong: stats.wrong
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [stats.answered, stats.correct, stats.wrong, subject.id, totalQuestions]);

  function chooseAnswer(answerIndex) {
    if (userAnswers[currentIndex] !== null) return;

    const nextAnswers = [...userAnswers];
    nextAnswers[currentIndex] = answerIndex;
    setUserAnswers(nextAnswers);
  }

  function resetAnswer() {
    const nextAnswers = [...userAnswers];
    nextAnswers[currentIndex] = null;
    setUserAnswers(nextAnswers);
  }

  function restartWithQuestions(nextQuestions) {
    setQuestions(
      nextQuestions.map((question) => ({
        ...question,
        answers: [...question.answers]
      }))
    );
    setUserAnswers(new Array(nextQuestions.length).fill(null));
    setCurrentIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (!currentQuestion) {
    return <div className="error-state">Fișierul de întrebări este gol sau format greșit.</div>;
  }

  const selectedAnswer = userAnswers[currentIndex];
  const progressPercent = totalQuestions
    ? Math.round(((currentIndex + 1) / totalQuestions) * 100)
    : 0;
  const wrongQuestions = questions.filter(
    (question, index) => userAnswers[index] !== question.correctIndex
  );
  const showFinishActions =
    currentIndex === totalQuestions - 1 && selectedAnswer !== null;

  return (
    <>
      <section className="surface">
        <div className="progress-bar-container">
          <div className="progress-bar-interactive" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className="status-bar">
          <div className="stats">
            {`Răspunse: ${stats.answered}/${totalQuestions} · Corecte: ${stats.correct} · Greșite: ${stats.wrong}`}
          </div>
          <span className="question-counter">{`${currentIndex + 1} / ${totalQuestions}`}</span>
        </div>

        <div className="question-container">
          <div className="question-header">{`${currentIndex + 1}. ${currentQuestion.text}`}</div>
          <div className={`answers${selectedAnswer !== null ? " answered" : ""}`}>
            {currentQuestion.answers.map((answer, answerIndex) => {
              const letter = String.fromCharCode(97 + answerIndex);
              const isSelected = selectedAnswer === answerIndex;
              const isCorrect = currentQuestion.correctIndex === answerIndex;
              const optionClassName = [
                "option",
                isSelected ? "selected" : "",
                selectedAnswer !== null && isCorrect ? "correct" : "",
                selectedAnswer !== null && isSelected && !isCorrect ? "wrong" : ""
              ]
                .filter(Boolean)
                .join(" ");

              return (
                <button
                  key={`${currentQuestion.id}-${answerIndex}`}
                  className={optionClassName}
                  type="button"
                  onClick={() => chooseAnswer(answerIndex)}
                >
                  {`${letter}) ${answer}`}
                </button>
              );
            })}
          </div>

          {selectedAnswer !== null ? (
            <button className="reset-btn" type="button" onClick={resetAnswer}>
              Resetează răspunsul
            </button>
          ) : null}
        </div>

        <div className="navigation">
          <div className="nav-buttons-row">
            <button
              className="nav-btn"
              type="button"
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((value) => value - 1)}
            >
              Anterioară
            </button>
            <button
              className="nav-btn"
              type="button"
              disabled={currentIndex >= totalQuestions - 1}
              onClick={() => setCurrentIndex((value) => value + 1)}
            >
              Următoare
            </button>
          </div>
        </div>

        {showFinishActions ? (
          <>
            <div className="center-actions">
              {wrongQuestions.length ? (
                <button
                  className="restart-btn"
                  type="button"
                  onClick={() => restartWithQuestions(wrongQuestions)}
                >
                  {`Revizuiește greșelile (${wrongQuestions.length})`}
                </button>
              ) : null}
              <button
                className="restart-btn"
                type="button"
                onClick={() => restartWithQuestions(shuffleArray(initialQuestions))}
              >
                Ia-o de la capăt
              </button>
            </div>
          </>
        ) : null}
      </section>
    </>
  );
}
