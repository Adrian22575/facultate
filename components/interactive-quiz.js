"use client";

import { useEffect, useState } from "react";

import { QuestionCorrectionButton } from "@/components/question-correction-button";
import { Button } from "@/components/ui/action";
import { SurfaceCard } from "@/components/ui/surface-card";
import { InlineFeedback } from "@/components/ui/status";
import { syncSubjectProgress } from "@/lib/progress-client";
import { saveLastSession } from "@/lib/session-storage";
import { shuffleArray } from "@/lib/quiz";

import styles from "./interactive-quiz.module.css";
import quizStyles from "./test-quiz.module.css";

export function InteractiveQuiz({ subject, initialQuestions }) {
  const [questionSource, setQuestionSource] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [userAnswers, setUserAnswers] = useState([]);

  useEffect(() => {
    const source = normalizeQuestionList(initialQuestions);
    const shuffled = shuffleArray(source);

    setQuestionSource(source);
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
    setQuestions(normalizeQuestionList(nextQuestions));
    setUserAnswers(new Array(nextQuestions.length).fill(null));
    setCurrentIndex(0);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function mergeCorrectedQuestion(question, correction) {
    if (question?.correction?.sourceQuestionId !== correction.sourceQuestionId) {
      return question;
    }

    return {
      ...question,
      text: correction.text,
      answers: correction.answers,
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
    const correctedSourceQuestionId = correction.sourceQuestionId;
    const correctedAnswerCount = correction.answers.length;

    setQuestionSource((current) => current.map((question) => mergeCorrectedQuestion(question, correction)));
    setQuestions((current) => current.map((question) => mergeCorrectedQuestion(question, correction)));
    setUserAnswers((current) =>
      current.map((answer, index) => {
        if (answer === null || answer === undefined) {
          return answer;
        }

        const question = questions[index];
        if (question?.correction?.sourceQuestionId !== correctedSourceQuestionId) {
          return answer;
        }

        return answer >= correctedAnswerCount ? null : answer;
      })
    );
  }

  if (!currentQuestion) {
    return <InlineFeedback tone="error" role="alert">Fisierul de intrebari este gol sau format gresit.</InlineFeedback>;
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
      <SurfaceCard>
        <div className="progress-bar-container">
          <div className="progress-bar-interactive" style={{ width: `${progressPercent}%` }} />
        </div>

        <div className={styles.statusBar}>
          <div className="stats">
            {`Raspunse: ${stats.answered}/${totalQuestions} - Corecte: ${stats.correct} - Gresite: ${stats.wrong}`}
          </div>
          <span className={styles.questionCounter}>{`${currentIndex + 1} / ${totalQuestions}`}</span>
        </div>

        <div className={quizStyles.question}>
          <div className={quizStyles.inlineHead}>
            <strong className={quizStyles.questionTitle}>
              <span>{`${currentIndex + 1}. `}</span>
              <span className="question-rich-text">{currentQuestion.text}</span>
            </strong>
            <QuestionCorrectionButton question={currentQuestion} onSaved={applySavedCorrection} />
          </div>
          <div className={`${quizStyles.answers}${selectedAnswer !== null ? ` ${quizStyles.answered}` : ""}`}>
            {currentQuestion.answers.map((answer, answerIndex) => {
              const letter = String.fromCharCode(97 + answerIndex);
              const isSelected = selectedAnswer === answerIndex;
              const isCorrect = currentQuestion.correctIndex === answerIndex;
              const optionClassName = [
                quizStyles.answerOption,
                isSelected ? quizStyles.selected : "",
                selectedAnswer !== null && isCorrect ? quizStyles.correct : "",
                selectedAnswer !== null && isSelected && !isCorrect ? quizStyles.wrong : ""
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

          {selectedAnswer !== null && currentQuestion.explanation ? (
            <div className="study-explanation">
              <strong>Explicatie</strong>
              <p>{currentQuestion.explanation}</p>
            </div>
          ) : null}

          {selectedAnswer !== null ? (
            <Button className={styles.resetAction} variant="secondary" onClick={resetAnswer}>
              Reseteaza raspunsul
            </Button>
          ) : null}
        </div>

        <div className={styles.navigation}>
          {selectedAnswer === null ? (
            <InlineFeedback className={quizStyles.answerRequired} tone="error" id="interactive-answer-required" role="status">
              Alege un raspuns pentru a continua.
            </InlineFeedback>
          ) : null}
          <div className={styles.navigationActions}>
            <Button
              variant="secondary"
              disabled={currentIndex <= 0}
              onClick={() => setCurrentIndex((value) => value - 1)}
            >
              Anterioara
            </Button>
            <Button
              aria-describedby={selectedAnswer === null ? "interactive-answer-required" : undefined}
              disabled={selectedAnswer === null || currentIndex >= totalQuestions - 1}
              onClick={() => setCurrentIndex((value) => value + 1)}
            >
              Urmatoarea
            </Button>
          </div>
        </div>

        {showFinishActions ? (
          <div className={styles.finishActions}>
            {wrongQuestions.length ? (
              <Button
                onClick={() => restartWithQuestions(wrongQuestions)}
              >
                {`Revizuieste greselile (${wrongQuestions.length})`}
              </Button>
            ) : null}
            <Button
              onClick={() => restartWithQuestions(questions)}
            >
              Repeta testul
            </Button>
            <Button
              variant="secondary"
              onClick={() => restartWithQuestions(shuffleArray(questionSource))}
            >
              Mai fa un test
            </Button>
          </div>
        ) : null}
      </SurfaceCard>
    </>
  );
}

function normalizeQuestionList(questionList) {
  return (questionList || []).map((question) => ({
    ...question,
    answers: [...(question.answers || [])]
  }));
}
