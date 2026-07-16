"use client";

import { ArrowRight, Search } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";

import { PendingNavigationLink } from "@/components/pending-navigation-link";

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

function createSubjectRows(subjects, subjectAllocations, userType) {
  const allocationsBySubject = new Map();

  for (const allocation of subjectAllocations) {
    if (allocation.userType !== userType) {
      continue;
    }

    const existing = allocationsBySubject.get(allocation.subjectId) || [];
    existing.push(allocation);
    allocationsBySubject.set(allocation.subjectId, existing);
  }

  return subjects
    .map((subject) => {
      const allocations = allocationsBySubject.get(subject.id) || [];
      const contextLabels = allocations.length
        ? uniqueSorted(allocations.map((allocation) => formatAllocationContext(allocation, userType)))
        : ["Fara an/semestru setat"];

      return {
        subject,
        allocations,
        contextLabels,
        searchText: normalizeText([subject.title, subject.id, ...contextLabels].join(" "))
      };
    })
    .sort((left, right) => left.subject.title.localeCompare(right.subject.title, "ro"));
}

export function SubjectsListClient({
  subjects = [],
  subjectAllocations = [],
  userType = "student",
  sectionId = "materii-list",
  embedded = false,
  title = "Alege materia",
  description = "Vezi toate materiile disponibile si filtreaza doar daca vrei sa restrangi lista.",
  headerAction = null,
  recentSubjects = []
}) {
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const rows = useMemo(
    () => createSubjectRows(subjects, subjectAllocations, userType),
    [subjectAllocations, subjects, userType]
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

    return rows.filter((row) => {
      if (normalizedQuery && !row.searchText.includes(normalizedQuery)) {
        return false;
      }

      if (yearFilter !== "all") {
        const matchesYear = row.allocations.some(
          (allocation) => allocation.studyYear === Number(yearFilter)
        );

        if (!matchesYear) {
          return false;
        }
      }

      if (semesterFilter !== "all") {
        const matchesSemester = row.allocations.some(
          (allocation) => allocation.semester === Number(semesterFilter)
        );

        if (!matchesSemester) {
          return false;
        }
      }

      if (classFilter !== "all") {
        const matchesClass = row.allocations.some(
          (allocation) => normalizeText(allocation.schoolClass) === normalizeText(classFilter)
        );

        if (!matchesClass) {
          return false;
        }
      }

      return true;
    });
  }, [classFilter, query, rows, semesterFilter, yearFilter]);

  const hasFilters =
    filterOptions.years.length > 0 ||
    filterOptions.semesters.length > 0 ||
    filterOptions.classes.length > 0;
  const hasActiveFilters = yearFilter !== "all" || semesterFilter !== "all" || classFilter !== "all";

  return (
    <section
      id={sectionId}
      className={`section-card subjects-section-card${embedded ? " is-embedded" : ""}`}
    >
      {title ? (
        <div className="dashboard-header">
          <h2>{title}</h2>
          <span className="subject-count">{`${filteredRows.length} din ${rows.length} materii`}</span>
        </div>
      ) : null}

      {description ? <p className="section-sub">{description}</p> : null}

      {headerAction ? <div className="subjects-section-action">{headerAction}</div> : null}

      {recentSubjects.length ? (
        <section className="subjects-recent" aria-label="Materii de continuat">
          <div className="subjects-recent-list">
            {recentSubjects.map((subject) => (
              <PendingNavigationLink
                key={subject.id}
                className="subjects-recent-row"
                href={`/materii/${subject.id}`}
                pendingLabel="Se deschide materia..."
              >
                <span>
                  <strong>{subject.title}</strong>
                  <small>{subject.description}</small>
                </span>
                <em>
                  Continua
                  <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
                </em>
              </PendingNavigationLink>
            ))}
          </div>
        </section>
      ) : null}

      <div className="subjects-toolbar" aria-label="Filtre pentru materii">
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
                    <option key={year} value={year}>
                      {`Anul ${year}`}
                    </option>
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
                    <option key={schoolClass} value={schoolClass}>
                      {schoolClass}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}

            {filterOptions.semesters.length ? (
              <label className="subject-filter-field">
                <span>Semestru</span>
                <select
                  value={semesterFilter}
                  onChange={(event) => setSemesterFilter(event.target.value)}
                >
                  <option value="all">Toate semestrele</option>
                  {filterOptions.semesters.map((semester) => (
                    <option key={semester} value={semester}>
                      {`Semestrul ${semester}`}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
        </details>
      ) : null}

      {filteredRows.length ? (
        <div className="subjects-table-shell">
          <table className="subjects-table">
            <thead>
              <tr>
                <th scope="col">Materie</th>
                <th scope="col"><span className="sr-only">Actiune</span></th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.subject.id}>
                  <td data-label="Materie">
                    <div className="subject-title-cell">
                      <strong>{row.subject.title}</strong>
                    </div>
                  </td>
                  <td data-label="">
                    <PendingNavigationLink
                      className="subject-table-action is-primary"
                      href={`/materii/${row.subject.id}`}
                      pendingLabel="Se deschide materia..."
                    >
                      Deschide materia
                      <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
                    </PendingNavigationLink>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          {hasFilters || query.trim()
            ? "Nu exista materii pentru filtrele alese. Sterge cautarea sau alege Toate."
            : "Nu exista materii disponibile momentan. Le poti adauga din Workspace."}
        </div>
      )}

      <div className="subject-helper-note">
        <span>Nu gasesti materia?</span>
        <Link href="/materiale">
          Adauga o materie sau un set de grile din Materiale.
        </Link>
      </div>
    </section>
  );
}
