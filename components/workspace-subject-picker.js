"use client";

import { useEffect, useMemo, useState } from "react";

function sortSubjects(subjects) {
  return [...subjects].sort((left, right) => left.title.localeCompare(right.title, "ro"));
}

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function getSubjectMonogram(title) {
  const words = title
    .split(/\s+/)
    .map((word) => word.trim())
    .filter(Boolean);

  if (!words.length) {
    return "MAT";
  }

  if (words.length === 1) {
    return words[0].slice(0, 3).toUpperCase();
  }

  return words
    .slice(0, 3)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export function WorkspaceSubjectPicker({
  subjects,
  userType,
  context,
  isContextReady,
  selectedSubjectId,
  onSubjectChange,
  disabled = false
}) {
  const [subjectOptions, setSubjectOptions] = useState(() => sortSubjects(subjects));
  const [searchValue, setSearchValue] = useState("");
  const [isListOpen, setIsListOpen] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [subjectTitle, setSubjectTitle] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const contextLabel = useMemo(() => {
    if (!isContextReady) {
      return userType === "student"
        ? "Alege anul si semestrul."
        : "Completeaza clasa si semestrul.";
    }

    return userType === "student"
      ? `Anul ${context.studyYear} - Semestrul ${context.semester}`
      : `${context.schoolClass} - Semestrul ${context.semester}`;
  }, [context.schoolClass, context.semester, context.studyYear, isContextReady, userType]);

  const contextKey = isContextReady
    ? `${userType}:${context.studyYear || ""}:${context.schoolClass || ""}:${context.semester || ""}`
    : "not-ready";
  const trimmedSearchValue = searchValue.trim();

  const selectedSubject = useMemo(
    () => subjectOptions.find((subject) => subject.id === selectedSubjectId) ?? null,
    [selectedSubjectId, subjectOptions]
  );

  const filteredSubjects = useMemo(() => {
    const normalizedQuery = normalizeText(searchValue.trim());

    if (!normalizedQuery) {
      return subjectOptions.slice(0, 8);
    }

    return subjectOptions
      .filter((subject) => normalizeText(subject.title).includes(normalizedQuery))
      .slice(0, 8);
  }, [searchValue, subjectOptions]);

  const pickerLocked = disabled || isSubmitting;
  const canSubmit = subjectTitle.trim().length >= 3 && !isSubmitting && isContextReady && !disabled;

  useEffect(() => {
    if (selectedSubject) {
      setSearchValue(selectedSubject.title);
    }
  }, [selectedSubject]);

  useEffect(() => {
    setSearchValue("");
    setIsListOpen(false);
    setErrorMessage("");
    setSuccessMessage("");
  }, [contextKey]);

  function openCreateSubject(prefillTitle = trimmedSearchValue) {
    if (pickerLocked) {
      return;
    }

    setErrorMessage("");
    setSuccessMessage("");
    setSubjectTitle(prefillTitle);
    setIsModalOpen(true);
    setIsListOpen(false);
  }

  async function handleCreateSubject() {
    if (pickerLocked) {
      return;
    }

    if (!isContextReady) {
      setErrorMessage(
        userType === "student"
          ? "Alege mai intai anul si semestrul."
          : "Completeaza mai intai clasa si semestrul."
      );
      return;
    }

    if (!subjectTitle.trim()) {
      setErrorMessage("Scrie numele materiei.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const requestBody = {
        title: subjectTitle,
        userType,
        semester: context.semester
      };

      if (userType === "student" && context.studyYear) {
        requestBody.studyYear = context.studyYear;
      }

      if (userType === "elev" && context.schoolClass) {
        requestBody.schoolClass = context.schoolClass;
      }

      const response = await fetch("/api/subjects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(requestBody)
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error || "Materia nu a putut fi adaugata.");
      }

      setSubjectOptions((currentSubjects) => {
        const withoutDuplicate = currentSubjects.filter(
          (subject) => subject.id !== payload.subject.id
        );

        return sortSubjects([...withoutDuplicate, payload.subject]);
      });
      onSubjectChange(payload.subject.id);
      setSearchValue(payload.subject.title);

      if (payload.subjectCreated && payload.allocationCreated) {
        setSuccessMessage("Materia a fost adaugata si este pregatita pentru contextul ales.");
      } else if (payload.allocationCreated) {
        setSuccessMessage("Materia exista deja. Am legat-o de contextul ales si am selectat-o.");
      } else {
        setSuccessMessage("Materia era deja disponibila aici si a fost selectata.");
      }

      setSubjectTitle("");
      setIsModalOpen(false);
      setIsListOpen(false);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Materia nu a putut fi adaugata."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  function selectSubject(subject) {
    if (pickerLocked) {
      return;
    }

    onSubjectChange(subject.id);
    setSearchValue(subject.title);
    setIsListOpen(false);
    setErrorMessage("");
    setSuccessMessage("");
  }

  return (
    <div className="workspace-subject-picker ai-workspace-subject-picker">
      <input type="hidden" name="subjectId" value={selectedSubjectId} />

      <div className="selector-container">
        <label>
          Materie
          <input
            className="input-search math-friendly-input"
            type="text"
            value={searchValue}
            placeholder={
              isContextReady
                ? "Cauta materia sau scrie numele ei"
                : userType === "student"
                  ? "Alege mai intai anul si semestrul"
                  : "Completeaza mai intai clasa si semestrul"
            }
            disabled={!isContextReady || pickerLocked}
            onFocus={() => {
              if (isContextReady && !pickerLocked) {
                setIsListOpen(true);
              }
            }}
            onChange={(event) => {
              if (pickerLocked) {
                return;
              }

              setSearchValue(event.target.value);
              onSubjectChange("");
              if (isContextReady && !pickerLocked) {
                setIsListOpen(true);
              }
              setSuccessMessage("");
            }}
          />
        </label>
      </div>

      {isContextReady ? (
        <div className="workspace-subject-caption ai-workspace-subject-caption">
          <span>Context: {contextLabel}</span>
          <span>Scrie cateva litere si alege materia potrivita.</span>
        </div>
      ) : null}

      {isContextReady && selectedSubject ? (
        <div className="workspace-selected-subject ui-panel-card ai-workspace-selected-subject">
          <div className="workspace-selected-subject-badge ui-chip" aria-hidden="true">
            Aleasa
          </div>
          <strong>{selectedSubject.title}</strong>
          <span>Materia este pregatita pentru contextul ales.</span>
        </div>
      ) : null}

      {isContextReady && isListOpen ? (
        <div className="workspace-subject-results ui-panel-card ai-workspace-subject-results">
          <div className="workspace-subject-results-head">
            <strong>Materii potrivite</strong>
            <span>{filteredSubjects.length ? "Alege una din lista." : "Nu am gasit nimic inca."}</span>
          </div>

          {filteredSubjects.length ? (
            <div className="workspace-subject-result-list">
              {filteredSubjects.map((subject) => (
                <button
                  key={subject.id}
                  className={`workspace-subject-result${
                    selectedSubjectId === subject.id ? " is-selected" : ""
                  }`}
                  type="button"
                  disabled={pickerLocked}
                  onClick={() => selectSubject(subject)}
                  aria-pressed={selectedSubjectId === subject.id}
                >
                  <div className="workspace-subject-result-row">
                    <span className="workspace-subject-result-mark" aria-hidden="true">
                      {getSubjectMonogram(subject.title)}
                    </span>
                    <strong className="workspace-subject-result-title">{subject.title}</strong>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="empty-state workspace-subject-empty">
              <strong>Nu am gasit materia cautata.</strong>
              <p>O poti adauga pentru {contextLabel}, apoi ramane selectata aici.</p>
              <button
                className="btn-link secondary workspace-subject-empty-action"
                type="button"
                disabled={pickerLocked}
                onClick={() => openCreateSubject(trimmedSearchValue)}
              >
                {trimmedSearchValue ? `Adauga "${trimmedSearchValue}"` : "Adauga materie"}
              </button>
            </div>
          )}
        </div>
      ) : null}

      {isContextReady ? (
        <div className="workspace-subject-helper ai-workspace-subject-helper">
          <p>
            Nu gasesti materia? Adaug-o o singura data, iar apoi o poti folosi direct pentru anul si
            semestrul ales.
          </p>
          <button
            className="btn-link secondary workspace-subject-trigger"
            type="button"
            disabled={pickerLocked}
            onClick={() => openCreateSubject()}
          >
            Adauga materie
          </button>
        </div>
      ) : (
        <div className="micro-copy">
          {userType === "student"
            ? "Alege mai intai anul si semestrul, apoi poti selecta sau adauga materia."
            : "Completeaza mai intai clasa si semestrul, apoi poti selecta sau adauga materia."}
        </div>
      )}

      {successMessage ? <div className="success-state">{successMessage}</div> : null}

      {isModalOpen ? (
        <div className="workspace-modal-backdrop" role="presentation">
          <div
            className="workspace-modal-card ai-workspace-subject-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="workspace-subject-modal-title"
          >
            <div className="workspace-modal-head">
              <div>
                <strong id="workspace-subject-modal-title">Adauga o materie noua</strong>
                <p>Daca nu exista deja, o adaugam si o pregatim pentru contextul ales acum.</p>
              </div>
              <button
                className="workspace-modal-close feedback-modal-close"
                type="button"
                onClick={() => {
                  setIsModalOpen(false);
                  setErrorMessage("");
                }}
                aria-label="Inchide"
              >
                Inchide
              </button>
            </div>

            <div className="workspace-modal-form">
              <label className="onboarding-form-field">
                <span>Numele materiei</span>
                <input
                  className="input-search math-friendly-input"
                  type="text"
                  value={subjectTitle}
                  disabled={pickerLocked}
                  onChange={(event) => setSubjectTitle(event.target.value)}
                  placeholder="Ex: Microeconomie aplicata"
                />
              </label>

              <div className="workspace-context-summary">
                <strong>Se foloseste pentru</strong>
                <span>{contextLabel}</span>
              </div>

              {errorMessage ? <div className="error-state">{errorMessage}</div> : null}

              <div className="inline-actions workspace-modal-actions">
                <button type="button" disabled={!canSubmit} onClick={handleCreateSubject}>
                  {isSubmitting ? "Se adauga..." : "Adauga si selecteaza"}
                </button>
                <button
                  className="reset-btn"
                  type="button"
                  disabled={pickerLocked}
                  onClick={() => {
                    setIsModalOpen(false);
                    setErrorMessage("");
                  }}
                >
                  Renunta
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
