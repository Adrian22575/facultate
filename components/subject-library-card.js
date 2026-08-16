"use client";

import { moduleClassNames } from "@/lib/ui/module-class-names";
import styles from "./subject-library-card.module.css";
import { ArrowRight, FileText } from "lucide-react";

import { PendingNavigationLink } from "@/components/pending-navigation-link";
import {
  getSubjectInitials,
  getSubjectPaletteIndex,
  getSubjectProgressLabel
} from "@/lib/subject-library";

function formatQuestionCount(questionCount) {
  const count = Number(questionCount || 0);
  if (!count) return "Intrebari in pregatire";
  return `${count} ${count === 1 ? "intrebare" : "intrebari"}`;
}

function activateFromSpace(event) {
  if (event.key !== " ") return;
  event.preventDefault();
  event.currentTarget.click();
}

export function SubjectLibraryCard({
  subject,
  href = `/materii/${subject.id}`,
  kind = "subject",
  pendingLabel = "Se deschide materia..."
}) {
  const isLicenta = kind === "licenta";
  const progress = subject.progress || { percent: 0 };
  const progressLabel = getSubjectProgressLabel(progress);
  const percent = Math.min(100, Math.max(0, Number(progress.percent || 0)));
  const initials = getSubjectInitials(subject.title);
  const paletteIndex = getSubjectPaletteIndex(subject.id);

  return (
    <PendingNavigationLink
      className={moduleClassNames(styles, "subject-library-card")}
      href={href}
      pendingLabel={pendingLabel}
      aria-label={
        isLicenta
          ? `Deschide pregatirea pentru licenta. ${formatQuestionCount(subject.questionCount)} disponibile.`
          : `Deschide materia ${subject.title}. ${progressLabel.title}, ${percent} la suta.`
      }
      onKeyDown={activateFromSpace}
    >
      <span className={moduleClassNames(styles, `subject-library-cover is-palette-${paletteIndex}`)} aria-hidden="true">
        <strong>{initials}</strong>
        <FileText size={24} strokeWidth={1.7} />
      </span>

      <span className={moduleClassNames(styles, "subject-library-card-body")}>
        <strong className={moduleClassNames(styles, "subject-library-card-title")}>{subject.title}</strong>
        <span className={moduleClassNames(styles, "subject-library-card-meta")}>
          {formatQuestionCount(subject.questionCount)}
          {isLicenta ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Pregatire pentru examen</span>
            </>
          ) : null}
        </span>

        {isLicenta ? (
          <span className={moduleClassNames(styles, "subject-library-license-note")}>Simulare, test si recapitulare</span>
        ) : (
          <span className={moduleClassNames(styles, "subject-library-progress")}>
            <span className={moduleClassNames(styles, "subject-library-progress-label")}>
              <span>{progressLabel.title}</span>
              <strong>{`${percent}%`}</strong>
            </span>
            <span className={moduleClassNames(styles, "subject-library-progress-track")} aria-hidden="true">
              <span style={{ width: `${percent}%` }} />
            </span>
          </span>
        )}

        <span className={moduleClassNames(styles, "subject-library-card-action")}>
          {isLicenta ? "Deschide Licenta" : progressLabel.action}
          <ArrowRight size={17} strokeWidth={2.4} aria-hidden="true" />
        </span>
      </span>
    </PendingNavigationLink>
  );
}
