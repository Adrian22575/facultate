"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

const YEARS = Array.from({ length: 10 }, (_, index) => index + 1);

function normalizeText(value) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

export function SubjectsListClient({
  subjects,
  subjectAllocations,
  userType = "student",
  sectionId = "materii-list",
  embedded = false,
  title = "Alege materia",
  description = "Mai intai alegi contextul, apoi vezi doar materiile disponibile pentru el.",
  headerAction = null
}) {
  const [selectedYear, setSelectedYear] = useState(userType === "student" ? "1" : "all");
  const [selectedSemester, setSelectedSemester] = useState("1");
  const [schoolClass, setSchoolClass] = useState("");

  const subjectMap = useMemo(
    () => new Map(subjects.map((subject) => [subject.id, subject])),
    [subjects]
  );

  const contextAllocations = useMemo(
    () => subjectAllocations.filter((allocation) => allocation.userType === userType),
    [subjectAllocations, userType]
  );

  useEffect(() => {
    if (!contextAllocations.length) {
      return;
    }

    if (userType === "student") {
      const selectedStillExists = contextAllocations.some(
        (allocation) =>
          allocation.studyYear === Number(selectedYear) &&
          allocation.semester === Number(selectedSemester)
      );

      if (!selectedStillExists) {
        const firstAllocation = contextAllocations[0];
        setSelectedYear(String(firstAllocation.studyYear || 1));
        setSelectedSemester(String(firstAllocation.semester || 1));
      }

      return;
    }

    const selectedStillExists = contextAllocations.some(
      (allocation) =>
        allocation.semester === Number(selectedSemester) &&
        normalizeText(allocation.schoolClass || "") === normalizeText(schoolClass)
    );

    if (!selectedStillExists) {
      const firstAllocation = contextAllocations[0];
      setSchoolClass(firstAllocation.schoolClass || "");
      setSelectedSemester(String(firstAllocation.semester || 1));
    }
  }, [contextAllocations, schoolClass, selectedSemester, selectedYear, userType]);

  const filteredSubjects = useMemo(() => {
    const filteredAllocations = contextAllocations.filter((allocation) => {
      if (userType === "student") {
        return (
          allocation.studyYear === Number(selectedYear) &&
          allocation.semester === Number(selectedSemester)
        );
      }

      if (!schoolClass.trim()) {
        return false;
      }

      return (
        allocation.semester === Number(selectedSemester) &&
        normalizeText(allocation.schoolClass || "") === normalizeText(schoolClass)
      );
    });

    const seenSubjectIds = new Set();

    return filteredAllocations
      .map((allocation) => {
        const subject = subjectMap.get(allocation.subjectId);
        if (!subject || seenSubjectIds.has(subject.id)) {
          return null;
        }

        seenSubjectIds.add(subject.id);
        return {
          ...subject,
          allocation
        };
      })
      .filter(Boolean)
      .sort((left, right) => left.title.localeCompare(right.title, "ro"));
  }, [contextAllocations, schoolClass, selectedSemester, selectedYear, subjectMap, userType]);

  return (
    <section
      id={sectionId}
      className={`section-card subjects-section-card${embedded ? " is-embedded" : ""}`}
    >
      <div className="dashboard-header">
        <h2>{title}</h2>
        <span className="subject-count">{`${filteredSubjects.length} materii`}</span>
      </div>

      {description ? <p className="section-sub">{description}</p> : null}

      {headerAction ? <div className="subjects-section-action">{headerAction}</div> : null}

      <div className="subject-helper-note">
        <span>Nu gasesti materia?</span>
        <Link href="/materiale">
          O poti adauga chiar tu din Workspace daca ai intrebarile si raspunsurile.
        </Link>
      </div>

      {userType === "student" ? (
        <div className="selector-grid">
          <div className="selector-container">
            <label>
              An
              <select value={selectedYear} onChange={(event) => setSelectedYear(event.target.value)}>
                {YEARS.map((value) => (
                  <option key={value} value={String(value)}>
                    {`Anul ${value}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="selector-container">
            <label>
              Semestru
              <select
                value={selectedSemester}
                onChange={(event) => setSelectedSemester(event.target.value)}
              >
                <option value="1">Semestrul 1</option>
                <option value="2">Semestrul 2</option>
              </select>
            </label>
          </div>
        </div>
      ) : (
        <div className="selector-grid">
          <div className="selector-container">
            <label>
              Clasa
              <input
                className="input-search"
                type="text"
                value={schoolClass}
                onChange={(event) => setSchoolClass(event.target.value)}
                placeholder="Ex: Clasa a 11-a"
              />
            </label>
          </div>

          <div className="selector-container">
            <label>
              Semestru
              <select
                value={selectedSemester}
                onChange={(event) => setSelectedSemester(event.target.value)}
              >
                <option value="1">Semestrul 1</option>
                <option value="2">Semestrul 2</option>
              </select>
            </label>
          </div>
        </div>
      )}

      {filteredSubjects.length ? (
        <ul className="action-list">
          {filteredSubjects.map((subject) => (
            <li key={subject.id}>
              <Link className="test-link" href={`/materii/${subject.id}`}>
                <strong>{subject.title}</strong>
                <span>
                  {userType === "student"
                    ? `Disponibila in Anul ${subject.allocation.studyYear} - Semestrul ${subject.allocation.semester}`
                    : `${subject.allocation.schoolClass} - Semestrul ${subject.allocation.semester}`}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="empty-state">
          {userType === "student"
            ? "Nu exista materii pentru anul si semestrul ales. Le poti adauga din Workspace."
            : schoolClass.trim()
              ? "Nu exista materii pentru clasa si semestrul ales. Le poti adauga din Workspace."
              : "Completeaza clasa, apoi iti afisam materiile disponibile."}
        </div>
      )}
    </section>
  );
}
