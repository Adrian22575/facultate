"use client";

import { X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

import { QuestionCorrectionButton } from "@/components/question-correction-button";
import { syncSubjectProgress } from "@/lib/progress-client";
import { saveLastSession } from "@/lib/session-storage";
import { useDialogFocus } from "@/lib/ui/dialog";
import {
  normalizeSearchText,
  truncateText
} from "@/lib/quiz";

function sanitizeQuestions(questions) {
  if (!Array.isArray(questions)) {
    return [];
  }

  return questions.map((question, index) => ({
    ...question,
    id: question?.id ?? index + 1,
    text: typeof question?.text === "string" ? question.text : String(question?.text || ""),
    answers: Array.isArray(question?.answers)
      ? question.answers.map((answer) =>
          typeof answer === "string" ? answer : String(answer ?? "")
        )
      : [],
    correctIndex: Number.isInteger(question?.correctIndex) ? question.correctIndex : 0,
    explanation:
      typeof question?.explanation === "string" ? question.explanation.trim() : ""
  }));
}

function scoreTextMatch(normalizedQuery, text, exactScore = 100) {
  const normalizedText = normalizeSearchText(text);
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

function buildSearchResult(question, index, normalizedQuery) {
  const numberQuery = Number(normalizedQuery);
  if (Number.isInteger(numberQuery) && numberQuery === index + 1) {
    return {
      matchScore: 110,
      matchKind: "Numar intrebare",
      matchText: `Intrebarea ${index + 1}`
    };
  }

  const questionScore = scoreTextMatch(normalizedQuery, question.text, 100);
  const answerMatches = question.answers
    .map((answer, answerIndex) => ({
      answer,
      answerIndex,
      score: scoreTextMatch(normalizedQuery, answer, answerIndex === question.correctIndex ? 96 : 90)
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
    matchKind: bestAnswerMatch.answerIndex === question.correctIndex ? "Raspuns corect" : "Raspuns",
    matchText: bestAnswerMatch.answer
  };
}

export function StudyPageClient({ subject, questions, initialViewedIndexes = [] }) {
  const [safeQuestions, setSafeQuestions] = useState(() => sanitizeQuestions(questions));
  const [seen, setSeen] = useState(
    () =>
      new Set(
        (Array.isArray(initialViewedIndexes) ? initialViewedIndexes : []).filter(
          (value) => Number.isInteger(value) && value >= 0 && value < questions.length
        )
      )
  );
  const [isNavOpen, setIsNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const questionRefs = useRef([]);
  const lastSyncedKeyRef = useRef("");
  const navToggleRef = useRef(null);
  const navCloseRef = useRef(null);
  const navDialogRef = useDialogFocus(isNavOpen, () => setIsNavOpen(false), navCloseRef);

  useEffect(() => {
    setSafeQuestions(sanitizeQuestions(questions));
  }, [questions]);

  useEffect(() => {
    saveLastSession({
      subjectId: subject.id,
      subjectTitle: subject.title,
      mode: "Studiu",
      url: `/materii/${subject.id}/studiu`
    });
  }, [subject.id, subject.title]);

  useEffect(() => {
    if (typeof window === "undefined" || typeof IntersectionObserver === "undefined") {
      return undefined;
    }

    try {
      const observer = new IntersectionObserver(
        (entries) => {
          setSeen((current) => {
            const next = new Set(current);
            let changed = false;

            entries.forEach((entry) => {
              const questionIndex = String(entry.target.dataset.index);
              if (entry.isIntersecting && !next.has(questionIndex)) {
                next.add(questionIndex);
                changed = true;
              }
            });

            return changed ? next : current;
          });
        },
        { threshold: 0.2 }
      );

      questionRefs.current.forEach((element) => {
        if (element) {
          observer.observe(element);
        }
      });

      return () => observer.disconnect();
    } catch {
      return undefined;
    }
  }, [safeQuestions]);

  useEffect(() => {
    if (!safeQuestions.length || !seen.size) {
      return undefined;
    }

    const viewedIndexes = Array.from(seen)
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value >= 0)
      .sort((left, right) => left - right);
    const syncKey = `${subject.id}:${viewedIndexes.join(",")}`;

    if (syncKey === lastSyncedKeyRef.current) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      lastSyncedKeyRef.current = syncKey;
      void syncSubjectProgress({
        subjectId: subject.id,
        mode: "studiu",
        studyTotalQuestions: safeQuestions.length,
        studyViewedIndexes: viewedIndexes
      });
    }, 300);

    return () => window.clearTimeout(timeoutId);
  }, [safeQuestions.length, seen, subject.id]);

  const viewedCount = seen.size;
  const progressPercent = safeQuestions.length
    ? Math.round((viewedCount / safeQuestions.length) * 100)
    : 0;
  const normalizedQuery = normalizeSearchText(query);

  const filteredQuestions = useMemo(() => {
    let items = safeQuestions.map((question, index) => ({
      ...question,
      idx: index,
      ...(normalizedQuery.length >= 1
        ? buildSearchResult(question, index, normalizedQuery)
        : { matchScore: 0, matchKind: "", matchText: "" })
    }));

    if (normalizedQuery.length >= 1) {
      items = items
        .filter((question) => question.matchScore > 0)
        .sort((left, right) => right.matchScore - left.matchScore)
        .slice(0, 18);
    }

    return items;
  }, [normalizedQuery, safeQuestions]);

  function scrollToQuestion(index) {
    const element = questionRefs.current[index];
    if (!element) {
      return;
    }

    if (typeof element.scrollIntoView === "function") {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }

    if (element.classList) {
      element.classList.add("question-study-focus");
      window.setTimeout(() => {
        if (element.classList) {
          element.classList.remove("question-study-focus");
        }
      }, 1600);
    }
  }

  function getPreviewText(text) {
    return truncateText(typeof text === "string" ? text : String(text || ""), normalizedQuery.length >= 1 ? 120 : 80);
  }

  function applySavedCorrection(correction) {
    setSafeQuestions((current) =>
      current.map((question) => {
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
      })
    );
  }

  return (
    <>
      <section className="study-intro">
        <span>{`Progres: ${viewedCount} din ${safeQuestions.length}`}</span>
        <div className="progress-bar">
          <div className="progress-fill" style={{ width: `${progressPercent}%` }} />
        </div>
      </section>

      <section id="questionsRoot">
        {safeQuestions.map((question, index) => (
          <div
            key={question.id}
            className="question-study"
            id={`question-${index}`}
            data-index={index}
            ref={(element) => {
              questionRefs.current[index] = element;
            }}
          >
            <div className="question-study-head">
              <h3>
                <span>{`${index + 1}. `}</span>
                <span className="question-rich-text">{question.text}</span>
              </h3>
              <QuestionCorrectionButton question={question} onSaved={applySavedCorrection} />
            </div>
            <ul className="options-study">
              {question.answers.map((answer, answerIndex) => (
                <li
                  key={`${question.id}-${answerIndex}`}
                  className={answerIndex === question.correctIndex ? "correct" : ""}
                >
                  <span className="question-rich-text">{answer}</span>
                </li>
              ))}
            </ul>
            {question.explanation ? (
              <div className="study-explanation">
                <strong>Explicatie</strong>
                <p>{question.explanation}</p>
              </div>
            ) : null}
          </div>
        ))}
      </section>

      <button
        ref={navToggleRef}
        className="nav-toggle"
        type="button"
        onClick={() => setIsNavOpen(true)}
        aria-expanded={isNavOpen}
        aria-controls="study-navigation-panel"
      >
        Navigare
      </button>

      <div
        className={`nav-overlay${isNavOpen ? " active" : ""}`}
        role="presentation"
        aria-hidden={!isNavOpen}
        onClick={(event) => {
          if (event.target === event.currentTarget) {
            setIsNavOpen(false);
          }
        }}
      >
        <div
          ref={navDialogRef}
          id="study-navigation-panel"
          className="nav-panel"
          role="dialog"
          aria-modal="true"
          aria-labelledby="study-navigation-title"
        >
          <div className="nav-panel-header">
            <h3 id="study-navigation-title">Navigare studiu</h3>
            <button
              ref={navCloseRef}
              className="nav-close"
              type="button"
              onClick={() => setIsNavOpen(false)}
              aria-label="Inchide navigarea"
            >
              <X aria-hidden="true" size={20} strokeWidth={2.2} />
            </button>
          </div>

          <div className="quick-jump-actions" aria-label="Scurtaturi in pagina">
            <button
              className="quick-jump-btn"
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            >
              Sus
            </button>
            <button
              className="quick-jump-btn"
              type="button"
              onClick={() => {
                scrollToQuestion(Math.max(0, Math.floor(safeQuestions.length / 2) - 1));
                setIsNavOpen(false);
              }}
            >
              Mijloc
            </button>
            <button
              className="quick-jump-btn"
              type="button"
              onClick={() => {
                if (typeof document !== "undefined") {
                  window.scrollTo({
                    top: document.documentElement.scrollHeight,
                    behavior: "smooth"
                  });
                }
              }}
            >
              Jos
            </button>
          </div>

          <input
            className="nav-search"
            type="text"
            inputMode="search"
            placeholder="Cauta dupa numar, intrebare sau raspuns"
            aria-label="Cauta dupa numar, intrebare sau raspuns"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <ul className="nav-list">
            {filteredQuestions.length ? (
              filteredQuestions.map((question) => {
                const isViewed = seen.has(String(question.idx));
                const correctAnswer =
                  question.answers[question.correctIndex] || "Raspuns indisponibil";

                return (
                  <li
                    key={`${question.id}-nav`}
                    className={`nav-list-item${isViewed ? " viewed" : ""}`}
                    onClick={() => {
                      scrollToQuestion(question.idx);
                      setIsNavOpen(false);
                    }}
                  >
                    <span className="nav-item-num">{question.idx + 1}</span>
                    <span className="nav-item-body">
                      <span className="nav-item-text">{getPreviewText(question.text)}</span>
                      <span className="nav-answer">
                        Raspuns corect: <strong>{correctAnswer}</strong>
                      </span>
                      {normalizedQuery.length >= 1 ? (
                        <span className="nav-match-line">
                          <span className="match-score">
                            {question.matchScore > 100
                              ? "Potrivire exacta"
                              : `${Math.round(question.matchScore)}% potrivire`}
                          </span>
                          {question.matchKind ? (
                            <span className="nav-match-kind">
                              {question.matchKind}
                              {question.matchText ? `: ${truncateText(question.matchText, 72)}` : ""}
                            </span>
                          ) : null}
                        </span>
                      ) : null}
                    </span>
                  </li>
                );
              })
            ) : (
              <li className="nav-no-results">
                Nu am gasit o potrivire clara. Incearca un alt cuvant.
              </li>
            )}
          </ul>
        </div>
      </div>
    </>
  );
}
