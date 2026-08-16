"use client";

import { useState } from "react";

import { QuestionCorrectionButton } from "@/components/question-correction-button";
import { TestResultPanel } from "@/components/test-result-panel";
import { EmptyState } from "@/components/ui/state";
import { SurfaceCard } from "@/components/ui/surface-card";
import { ProgressBar } from "@/components/ui/progress-bar";
import { ActionLink, Button } from "@/components/ui/action";
import { InlineFeedback } from "@/components/ui/status";

import quizStyles from "./test-quiz.module.css";

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
    return <EmptyState description="Testul activ nu contine inca intrebari." />;
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
          explanation: question.explanation
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
            <ActionLink variant="secondary" href="/statistici">
              Vezi statistici
            </ActionLink>
            <Button
              onClick={() => {
                setAnswers(new Array(safeQuestions.length).fill(null));
                setCurrentIndex(0);
                setAnswerNotice("");
                setPhase("quiz");
              }}
            >
              Reia testul
            </Button>
          </>
        }
      />
    );
  }

  return (
    <SurfaceCard>
      <ProgressBar
        value={((currentIndex + 1) / safeQuestions.length) * 100}
        aria-label="Progres test privat"
      />

      <div className={quizStyles.meta}>
        <div>{`${currentIndex + 1} / ${safeQuestions.length}`}</div>
        <div>{`Raspunse: ${answeredCount}/${safeQuestions.length}`}</div>
      </div>

      <div className={quizStyles.question}>
        <div className={quizStyles.inlineHead}>
          <strong className={quizStyles.questionTitle}>
            <span>{`${currentIndex + 1}. `}</span>
            <span className="question-rich-text">{currentQuestion.question_text}</span>
          </strong>
          <QuestionCorrectionButton question={currentQuestion} onSaved={applySavedCorrection} />
        </div>
        <div className={quizStyles.answers}>
          {currentQuestion.answers.map((answer, answerIndex) => (
            <label className={quizStyles.answerLabel} key={`${currentQuestion.id}-${answerIndex}`}>
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
        {answerNotice ? (
          <InlineFeedback className={quizStyles.answerRequired} tone="error" role="alert">
            {answerNotice}
          </InlineFeedback>
        ) : null}
      </div>

      <div className={quizStyles.actions}>
        <Button
          variant="secondary"
          disabled={currentIndex === 0}
          onClick={() => setCurrentIndex((value) => value - 1)}
        >
          Anterioara
        </Button>
        <Button
          className={answers[currentIndex] === null ? quizStyles.softDisabled : undefined}
          onClick={advanceCurrentQuestion}
        >
          {currentIndex === safeQuestions.length - 1 ? "Finalizeaza" : "Urmatoarea"}
        </Button>
      </div>
    </SurfaceCard>
  );
}
