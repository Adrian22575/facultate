"use client";

import { Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

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
  const normalizedQuery = normalizeText(query.trim());
  const showLicenta =
    Number(licentaExam?.questionCount || 0) > 0 &&
    (!normalizedQuery || normalizeText("licenta").includes(normalizedQuery));
  const totalVisible = filteredRows.length + (showLicenta ? 1 : 0);
  const isSearchEmpty = Boolean(query.trim() || hasActiveFilters) && !totalVisible;

  return (
    <section
      id={sectionId}
      className={`section-card subjects-section-card subjects-library${embedded ? " is-embedded" : ""}`}
    >
      {title ? (
        <div className="subjects-library-heading">
          <div>
            <h1>{title}</h1>
            {description ? <p>{description}</p> : null}
          </div>
          <span className="subject-count">{`${totalVisible} ${totalVisible === 1 ? "optiune" : "optiuni"}`}</span>
        </div>
      ) : null}

      {headerAction ? <div className="subjects-library-header-action">{headerAction}</div> : null}

      <div className="subjects-toolbar" aria-label="Cautare si sortare materii">
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

        <label className="subjects-sort-field">
          <span>Sortare</span>
          <select value={sort} onChange={(event) => setSort(event.target.value)}>
            <option value="recent">Activitate recenta</option>
            <option value="progress">Progres</option>
            <option value="alphabetical">Ordine alfabetica</option>
          </select>
        </label>
      </div>

      {hasFilters ? (
        <details
          className="subjects-filter-disclosure"
          open={filtersOpen}
          onToggle={(event) => setFiltersOpen(event.currentTarget.open)}
        >
          <summary>{hasActiveFilters ? "Filtre active" : "Filtreaza lista"}</summary>
          <div className="subjects-filter-options">
            {userType === "student" && filterOptions.years.length ? (
              <label className="subject-filter-field">
                <span>An</span>
                <select value={yearFilter} onChange={(event) => setYearFilter(event.target.value)}>
                  <option value="all">Toti anii</option>
                  {filterOptions.years.map((year) => (
                    <option key={year} value={year}>{`Anul ${year}`}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {userType === "elev" && filterOptions.classes.length ? (
              <label className="subject-filter-field">
                <span>Clasa</span>
                <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                  <option value="all">Toate clasele</option>
                  {filterOptions.classes.map((schoolClass) => (
                    <option key={schoolClass} value={schoolClass}>{schoolClass}</option>
                  ))}
                </select>
              </label>
            ) : null}

            {filterOptions.semesters.length ? (
              <label className="subject-filter-field">
                <span>Semestru</span>
                <select value={semesterFilter} onChange={(event) => setSemesterFilter(event.target.value)}>
                  <option value="all">Toate semestrele</option>
                  {filterOptions.semesters.map((semester) => (
                    <option key={semester} value={semester}>{`Semestrul ${semester}`}</option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </details>
      ) : null}

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
              setYearFilter("all");
              setSemesterFilter("all");
              setClassFilter("all");
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
