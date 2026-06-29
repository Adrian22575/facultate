"use client";

import { ArrowRight, BookOpenCheck, ClipboardList, Search } from "lucide-react";
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
  headerAction = null
}) {
  const [query, setQuery] = useState("");
  const [yearFilter, setYearFilter] = useState("all");
  const [semesterFilter, setSemesterFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");

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

  return (
    <section
      id={sectionId}
      className={`section-card subjects-section-card${embedded ? " is-embedded" : ""}`}
    >
      <div className="dashboard-header">
        <h2>{title}</h2>
        <span className="subject-count">{`${filteredRows.length} din ${rows.length} materii`}</span>
      </div>

      {description ? <p className="section-sub">{description}</p> : null}

      {headerAction ? <div className="subjects-section-action">{headerAction}</div> : null}

      <div className="subject-helper-note">
        <span>Nu gasesti materia?</span>
        <Link href="/materiale">
          O poti adauga chiar tu din Workspace daca ai intrebarile si raspunsurile.
        </Link>
      </div>

      <div className="subjects-toolbar" aria-label="Filtre pentru materii">
        <label className="subjects-search-field">
          <span>Cauta</span>
          <Search size={18} strokeWidth={2.5} aria-hidden="true" />
          <input
            className="input-search"
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cauta dupa materie, an, semestru sau clasa"
          />
        </label>

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

      {filteredRows.length ? (
        <div className="subjects-table-shell">
          <table className="subjects-table">
            <thead>
              <tr>
                <th scope="col">Materie</th>
                <th scope="col">Disponibila pentru</th>
                <th scope="col">Actiuni</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.subject.id}>
                  <td>
                    <div className="subject-title-cell">
                      <strong>{row.subject.title}</strong>
                      <span>{row.subject.id}</span>
                    </div>
                  </td>
                  <td>
                    <div className="subject-context-list">
                      {row.contextLabels.slice(0, 3).map((label) => (
                        <span className="subject-context-pill" key={label}>
                          {label}
                        </span>
                      ))}
                      {row.contextLabels.length > 3 ? (
                        <span className="subject-context-pill is-muted">
                          {`+${row.contextLabels.length - 3} contexte`}
                        </span>
                      ) : null}
                    </div>
                  </td>
                  <td>
                    <div className="subject-actions-row">
                      <PendingNavigationLink
                        className="subject-table-action"
                        href={`/materii/${row.subject.id}/interactiv`}
                        pendingLabel="Se deschide modul interactiv..."
                      >
                        <ArrowRight size={16} strokeWidth={2.5} aria-hidden="true" />
                        Interactiv
                      </PendingNavigationLink>
                      <PendingNavigationLink
                        className="subject-table-action"
                        href={`/materii/${row.subject.id}/studiu`}
                        pendingLabel="Se deschide modul studiu..."
                      >
                        <BookOpenCheck size={16} strokeWidth={2.5} aria-hidden="true" />
                        Studiu
                      </PendingNavigationLink>
                      <PendingNavigationLink
                        className="subject-table-action is-primary"
                        href={`/materii/${row.subject.id}/test`}
                        pendingLabel="Se porneste testul..."
                      >
                        <ClipboardList size={16} strokeWidth={2.5} aria-hidden="true" />
                        Test
                      </PendingNavigationLink>
                    </div>
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
    </section>
  );
}
