"use client";

import { CheckCircle2, XCircle } from "lucide-react";

function getResultMessage(percentage) {
  if (percentage > 80) {
    return "Esti bine. Continua sa repeti ca sa fixezi.";
  }

  if (percentage >= 50) {
    return "E decent, dar mai ai zone de consolidat.";
  }

  return "Mai ai de repetat. Incepe cu greselile.";
}

function answerLabel(index) {
  return String.fromCharCode(65 + index);
}

function formatAnswer(index, text) {
  if (index === null || index === undefined || index < 0) {
    return text || "Fara raspuns";
  }

  return `${answerLabel(index)}. ${text || "Raspuns indisponibil"}`;
}

export function TestResultPanel({
  title = "Rezultat final",
  score,
  total,
  percentage,
  wrongRows = [],
  stats = [],
  emptyMessage = "Nu ai gresit nicio intrebare in aceasta runda.",
  actions = null
}) {
  const resolvedPercentage = Number.isFinite(percentage)
    ? percentage
    : total
      ? Math.round((score / total) * 100)
      : 0;

  const resolvedStats = [
    { label: "Scor", value: `${score} din ${total}` },
    { label: "Procent", value: `${resolvedPercentage}%` },
    ...stats
  ];

  return (
    <section className="result-box licenta-prep-result test-result-panel">
      <div className="licenta-prep-result-head">
        <span className="licenta-prep-result-icon" aria-hidden="true">
          {resolvedPercentage > 80 ? <CheckCircle2 /> : <XCircle />}
        </span>
        <div>
          <h2>{title}</h2>
          <p>{getResultMessage(resolvedPercentage)}</p>
        </div>
      </div>

      <div className="licenta-prep-score-grid test-result-score-grid">
        {resolvedStats.map((stat) => (
          <div key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <hr className="result-divider" />
      <h3>Intrebari gresite</h3>

      {wrongRows.length ? (
        <div className="licenta-prep-wrong-list">
          {wrongRows.map((row, index) => (
            <article key={row.id || `${row.questionText}-${index}`} className="result-detail">
              <strong>{`${index + 1}. ${row.questionText}`}</strong>
              {row.meta ? <div className="result-meta">{row.meta}</div> : null}
              <div className="licenta-result-review-grid">
                <div className="licenta-result-review-item is-negative">
                  <span>Raspunsul tau</span>
                  <strong>{formatAnswer(row.selectedIndex, row.selectedText)}</strong>
                </div>
                <div className="licenta-result-review-item is-correct-answer">
                  <span>Raspuns corect</span>
                  <strong>{formatAnswer(row.correctIndex, row.correctText)}</strong>
                </div>
              </div>
              {row.explanation ? <p className="choice-row-meta">{row.explanation}</p> : null}
            </article>
          ))}
        </div>
      ) : (
        <p className="page-copy">{emptyMessage}</p>
      )}

      {actions ? <div className="licenta-prep-actions licenta-prep-result-actions">{actions}</div> : null}
    </section>
  );
}
