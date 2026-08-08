"use client";

import { CheckCircle2, XCircle } from "lucide-react";

import { SurfaceCard } from "@/components/ui/surface-card";

import styles from "./test-result-panel.module.css";

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
  insights = null,
  emptyMessage = "Nu ai gresit nicio intrebare in aceasta runda.",
  actions = null,
  description,
  wrongTitle = "Intrebari gresite",
  renderWrongDetails
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
    <SurfaceCard className={styles.panel}>
      <div className={styles.head}>
        <span className={styles.icon} aria-hidden="true">
          {resolvedPercentage > 80 ? <CheckCircle2 /> : <XCircle />}
        </span>
        <div>
          <h2>{title}</h2>
          <p>{description || getResultMessage(resolvedPercentage)}</p>
        </div>
      </div>

      <div className={styles.scoreGrid}>
        {resolvedStats.map((stat) => (
          <div key={stat.label}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      <hr className={styles.divider} />
      <h3>{wrongTitle}</h3>

      {wrongRows.length ? (
        <div className={styles.wrongList}>
          {wrongRows.map((row, index) => (
            <article key={row.id || `${row.questionText}-${index}`} className={styles.detail}>
              <strong>{`${index + 1}. ${row.questionText}`}</strong>
              {row.meta ? <div className="result-meta">{row.meta}</div> : null}
              {renderWrongDetails ? renderWrongDetails(row, index) : (
                <>
                  <div className={styles.reviewGrid}>
                    <div className={`${styles.reviewItem} ${styles.negative}`}>
                      <span>Raspunsul tau</span>
                      <strong>{formatAnswer(row.selectedIndex, row.selectedText)}</strong>
                    </div>
                    <div className={`${styles.reviewItem} ${styles.correctAnswer}`}>
                      <span>Raspuns corect</span>
                      <strong>{formatAnswer(row.correctIndex, row.correctText)}</strong>
                    </div>
                  </div>
                  {row.explanation ? <p className={styles.explanation}>{row.explanation}</p> : null}
                </>
              )}
            </article>
          ))}
        </div>
      ) : (
        <p className="page-copy">{emptyMessage}</p>
      )}

      {actions ? <div className={styles.actions}>{actions}</div> : null}
      {insights ? <div className={styles.followup}>{insights}</div> : null}
    </SurfaceCard>
  );
}
