"use client";

import { Search, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

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
  const [filtersOpen, setFiltersOpen] = useState(false);
  const mobileFiltersRef = useRef(null);
  const mobileFiltersButtonRef = useRef(null);

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

  const hasFilters =
    filterOptions.years.length > 0 ||
    filterOptions.semesters.length > 0 ||
    filterOptions.classes.length > 0;
  const hasActiveFilters = yearFilter !== "all" || semesterFilter !== "all" || classFilter !== "all";
  const activeFilterCount = [yearFilter, semesterFilter, classFilter].filter(
    (value) => value !== "all"
  ).length;
  const normalizedQuery = normalizeText(query.trim());
  const showLicenta =
    Number(licentaExam?.questionCount || 0) > 0 &&
    (!normalizedQuery || normalizeText("licenta").includes(normalizedQuery));
  const totalVisible = filteredRows.length + (showLicenta ? 1 : 0);
  const isSearchEmpty = Boolean(query.trim() || hasActiveFilters) && !totalVisible;
  const mobileFilterPanelId = `${sectionId}-mobile-filter-panel`;

  useEffect(() => {
    if (!filtersOpen) return undefined;

    function handlePointerDown(event) {
      if (!mobileFiltersRef.current?.contains(event.target)) {
        setFiltersOpen(false);
      }
    }

    function handleKeyDown(event) {
      if (event.key !== "Escape") return;
      setFiltersOpen(false);
      mobileFiltersButtonRef.current?.focus();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);

    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [filtersOpen]);

  function resetAcademicFilters() {
    setYearFilter("all");
    setSemesterFilter("all");
    setClassFilter("all");
  }

  function renderAcademicFilters(variant) {
    const isInline = variant === "inline";
    const fieldClassName = `subject-filter-field${isInline ? " is-inline" : ""}`;

    return (
      <>
        {userType === "student" && filterOptions.years.length ? (
          <label className={`${fieldClassName} is-year`}>
            <span className={isInline ? "sr-only" : undefined}>An</span>
            <select
              value={yearFilter}
              aria-label="Filtreaza dupa anul de studiu"
              onChange={(event) => setYearFilter(event.target.value)}
            >
              <option value="all">{isInline ? "An: Toti anii" : "Toti anii"}</option>
              {filterOptions.years.map((year) => (
                <option key={year} value={year}>
                  {isInline ? `An: ${year}` : `Anul ${year}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {userType === "elev" && filterOptions.classes.length ? (
          <label className={`${fieldClassName} is-class`}>
            <span className={isInline ? "sr-only" : undefined}>Clasa</span>
            <select
              value={classFilter}
              aria-label="Filtreaza dupa clasa"
              onChange={(event) => setClassFilter(event.target.value)}
            >
              <option value="all">{isInline ? "Clasa: Toate" : "Toate clasele"}</option>
              {filterOptions.classes.map((schoolClass) => (
                <option key={schoolClass} value={schoolClass}>
                  {isInline ? `Clasa: ${schoolClass}` : schoolClass}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        {filterOptions.semesters.length ? (
          <label className={`${fieldClassName} is-semester`}>
            <span className={isInline ? "sr-only" : undefined}>Semestru</span>
            <select
              value={semesterFilter}
              aria-label="Filtreaza dupa semestru"
              onChange={(event) => setSemesterFilter(event.target.value)}
            >
              <option value="all">
                {isInline ? "Semestru: Toate semestrele" : "Toate semestrele"}
              </option>
              {filterOptions.semesters.map((semester) => (
                <option key={semester} value={semester}>
                  {isInline ? `Semestru: ${semester}` : `Semestrul ${semester}`}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </>
    );
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

      <div className="subjects-toolbar" aria-label="Cautare, sortare si filtrare materii">
        <label className="subjects-search-field">
          <span className="sr-only">Cauta materia</span>
          <Search size={18} strokeWidth={2.5} aria-hidden="true" />
          <input
            className="input-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cauta materia"
          />
        </label>

        <div className="subjects-toolbar-controls">
          <label className="subjects-sort-field">
            <span className="sr-only">Sorteaza materiile</span>
            <select
              value={sort}
              aria-label="Sorteaza materiile"
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recent">Sorteaza: Activitate recenta</option>
              <option value="progress">Sorteaza: Progres</option>
              <option value="alphabetical">Sorteaza: Ordine alfabetica</option>
            </select>
          </label>

          {hasFilters ? (
            <div className="subjects-desktop-filters">
              {renderAcademicFilters("inline")}

              {hasActiveFilters ? (
                <button
                  type="button"
                  className="subjects-toolbar-reset"
                  onClick={resetAcademicFilters}
                >
                  Reseteaza
                </button>
              ) : null}
            </div>
          ) : null}

          {hasFilters ? (
            <div className="subjects-mobile-filter" ref={mobileFiltersRef}>
              <button
                ref={mobileFiltersButtonRef}
                type="button"
                className="subjects-mobile-filter-trigger"
                aria-expanded={filtersOpen}
                aria-controls={mobileFilterPanelId}
                aria-label={
                  activeFilterCount ? `Filtre, ${activeFilterCount} active` : "Filtre"
                }
                onClick={() => setFiltersOpen((current) => !current)}
              >
                <SlidersHorizontal size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>Filtre</span>
                {activeFilterCount ? (
                  <span className="subjects-filter-count" aria-hidden="true">
                    {activeFilterCount}
                  </span>
                ) : null}
              </button>

              {filtersOpen ? (
                <div
                  id={mobileFilterPanelId}
                  className="subjects-filter-options"
                  role="region"
                  aria-label="Filtre academice"
                >
                  <div className="subjects-filter-panel-head">
                    <strong>Filtre academice</strong>
                    {hasActiveFilters ? (
                      <button type="button" onClick={resetAcademicFilters}>
                        Reseteaza
                      </button>
                    ) : null}
                  </div>

                  {renderAcademicFilters("panel")}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>

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
