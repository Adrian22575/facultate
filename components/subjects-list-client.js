"use client";

import { CalendarDays, GraduationCap } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import {
  FilterSearch,
  FilterSelect,
  FilterSortSelect,
  FiltersToolbar
} from "@/components/filter-controls";
import { SubjectLibraryCard } from "@/components/subject-library-card";
import { sortSubjectLibrary } from "@/lib/subject-library";

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function uniqueSorted(values, compare = (left, right) => left.localeCompare(right, "ro")) {
  return Array.from(new Set(values.filter(Boolean))).sort(compare);
}

function formatAllocationContext(allocation, userType) {
  const semester = allocation.semester ? `Semestrul ${allocation.semester}` : "Semestru nesetat";

  if (userType === "student") {
    const year = allocation.studyYear ? `Anul ${allocation.studyYear}` : "An nesetat";
    return `${year} / ${semester}`;
  }

  return `${allocation.schoolClass || "Clasa nesetata"} / ${semester}`;
}

function createSubjectRows(subjects, subjectLibrary, subjectAllocations, userType) {
  const allocationsBySubject = new Map();
  const libraryBySubject = new Map(subjectLibrary.map((subject) => [subject.id, subject]));

  for (const allocation of subjectAllocations) {
    if (allocation.userType !== userType) continue;

    const existing = allocationsBySubject.get(allocation.subjectId) || [];
    existing.push(allocation);
    allocationsBySubject.set(allocation.subjectId, existing);
  }

  return subjects.map((subject) => {
    const allocations = allocationsBySubject.get(subject.id) || [];
    const contextLabels = allocations.length
      ? uniqueSorted(allocations.map((allocation) => formatAllocationContext(allocation, userType)))
      : ["Fara an/semestru setat"];
    const librarySubject = libraryBySubject.get(subject.id) || {
      ...subject,
      questionCount: 0,
      progress: { percent: 0 },
      lastActivityAt: null,
      lastMode: null
    };

    return {
      ...librarySubject,
      allocations,
      searchText: normalizeText([subject.title, subject.id, ...contextLabels].join(" "))
    };
  });
}

export function SubjectsListClient({
  subjects = [],
  subjectLibrary = [],
  subjectAllocations = [],
  licentaExam = null,
  userType = "student",
  sectionId = "materii-list",
  embedded = false,
  title = "Alege materia",
  description = "Gaseste materia si alege cum vrei sa lucrezi.",
  headerAction = null
}) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState("recent");
  const [yearFilter, setYearFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

  const rows = useMemo(
    () => createSubjectRows(subjects, subjectLibrary, subjectAllocations, userType),
    [subjectAllocations, subjectLibrary, subjects, userType]
  );

  const filterOptions = useMemo(() => {
    const allocations = rows.flatMap((row) => row.allocations);

    return {
      years: uniqueSorted(
        allocations.map((allocation) => allocation.studyYear && String(allocation.studyYear)),
        (left, right) => Number(left) - Number(right)
      ),
      semesters: uniqueSorted(
        allocations.map((allocation) => allocation.semester && String(allocation.semester)),
        (left, right) => Number(left) - Number(right)
      ),
      classes: uniqueSorted(allocations.map((allocation) => allocation.schoolClass))
    };
  }, [rows]);

  const filteredRows = useMemo(() => {
    const normalizedQuery = normalizeText(query.trim());

    return sortSubjectLibrary(
      rows.filter((row) => {
        if (normalizedQuery && !row.searchText.includes(normalizedQuery)) return false;

        if (
          yearFilter !== "all" &&
          !row.allocations.some((allocation) => allocation.studyYear === Number(yearFilter))
        ) {
          return false;
        }

        if (
          semesterFilter !== "all" &&
          !row.allocations.some((allocation) => allocation.semester === Number(semesterFilter))
        ) {
          return false;
        }

        if (
          classFilter !== "all" &&
          !row.allocations.some(
            (allocation) => normalizeText(allocation.schoolClass) === normalizeText(classFilter)
          )
        ) {
          return false;
        }

        return true;
      }),
      sort
    );
  }, [classFilter, query, rows, semesterFilter, sort, yearFilter]);

  const hasActiveFilters = yearFilter !== "all" || semesterFilter !== "all" || classFilter !== "all";
  const normalizedQuery = normalizeText(query.trim());
  const showLicenta =
    Number(licentaExam?.questionCount || 0) > 0 &&
    (!normalizedQuery || normalizeText("licenta").includes(normalizedQuery));
  const totalVisible = filteredRows.length + (showLicenta ? 1 : 0);
  const isSearchEmpty = Boolean(query.trim() || hasActiveFilters) && !totalVisible;
  function resetAcademicFilters() {
    setYearFilter("all");
    setSemesterFilter("all");
    setClassFilter("all");
  }

  return (
    <section
      id={sectionId}
      className={`section-card subjects-section-card subjects-library${embedded ? " is-embedded" : ""}`}
    >
      {title || headerAction ? (
        <div className="subjects-library-topbar">
          {title ? (
            <div className="subjects-library-heading">
              <h1>{title}</h1>
              {description ? <p>{description}</p> : null}
            </div>
          ) : null}

          {headerAction ? <div className="subjects-library-header-action">{headerAction}</div> : null}
        </div>
      ) : null}

      <FiltersToolbar
        className="subjects-toolbar"
        layout="subjects"
        ariaLabel="Cautare, sortare si filtrare materii"
      >
        <FilterSearch
          value={query}
          onChange={setQuery}
          placeholder="Cauta materia"
          ariaLabel="Cauta materia"
          clearable
          onClear={() => setQuery("")}
        />

        {userType === "student" && filterOptions.years.length ? (
          <FilterSelect
            label="An"
            value={yearFilter}
            onChange={setYearFilter}
            icon={GraduationCap}
            ariaLabel="Filtreaza dupa anul de studiu"
            clearable
            onClear={() => setYearFilter("all")}
            options={[
              { value: "all", label: "Toti anii" },
              ...filterOptions.years.map((year) => ({ value: year, label: `Anul ${year}` }))
            ]}
          />
        ) : userType === "elev" && filterOptions.classes.length ? (
          <FilterSelect
            label="Clasa"
            value={classFilter}
            onChange={setClassFilter}
            icon={GraduationCap}
            ariaLabel="Filtreaza dupa clasa"
            clearable
            onClear={() => setClassFilter("all")}
            options={[
              { value: "all", label: "Toate clasele" },
              ...filterOptions.classes.map((schoolClass) => ({
                value: schoolClass,
                label: schoolClass
              }))
            ]}
          />
        ) : (
          <span className="subjects-toolbar-placeholder" aria-hidden="true" />
        )}

        {filterOptions.semesters.length ? (
          <FilterSelect
            label="Semestru"
            value={semesterFilter}
            onChange={setSemesterFilter}
            icon={CalendarDays}
            ariaLabel="Filtreaza dupa semestru"
            clearable
            onClear={() => setSemesterFilter("all")}
            options={[
              { value: "all", label: "Toate semestrele" },
              ...filterOptions.semesters.map((semester) => ({
                value: semester,
                label: `Semestrul ${semester}`
              }))
            ]}
          />
        ) : (
          <span className="subjects-toolbar-placeholder" aria-hidden="true" />
        )}

        <FilterSortSelect
          value={sort}
          onChange={setSort}
          ariaLabel="Sorteaza materiile"
          options={[
            { value: "recent", label: "Activitate recenta" },
            { value: "progress", label: "Progres" },
            { value: "alphabetical", label: "Ordine alfabetica" }
          ]}
        />
      </FiltersToolbar>

      {totalVisible ? (
        <div className="subjects-grid">
          {filteredRows.map((subject) => (
            <SubjectLibraryCard key={subject.id} subject={subject} />
          ))}
          {showLicenta ? (
            <SubjectLibraryCard
              subject={{
                id: "licenta",
                title: "Licenta",
                questionCount: licentaExam.questionCount,
                progress: { percent: 0 }
              }}
              href="/licenta-exam"
              kind="licenta"
              pendingLabel="Se deschide Licenta..."
            />
          ) : null}
        </div>
      ) : isSearchEmpty ? (
        <div className="subjects-empty-state">
          <strong>Nu am gasit aceasta materie</strong>
          <p>Verifica denumirea sau reseteaza cautarea.</p>
          <button
            type="button"
            className="btn-link secondary"
            onClick={() => {
              setQuery("");
              resetAcademicFilters();
            }}
          >
            Reseteaza cautarea
          </button>
        </div>
      ) : (
        <div className="subjects-empty-state">
          <strong>Nu ai inca nicio materie</strong>
          <p>Adauga prima materie sau un set de grile pentru a incepe sa inveti.</p>
          <Link className="subject-empty-action" href="/materiale">Adauga o materie</Link>
        </div>
      )}

      <div className="subject-helper-note">
        <span>Nu gasesti materia?</span>
        <Link href="/materiale">Adauga o materie sau un set de grile din Materiale.</Link>
      </div>
    </section>
  );
}
