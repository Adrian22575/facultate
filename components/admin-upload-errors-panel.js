"use client";

import { useMemo, useState } from "react";

const PAGE_SIZE = 10;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function formatDate(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function buildExcerpt(value, limit = 180) {
  const text =
    typeof value === "string"
      ? value
      : value
        ? JSON.stringify(value)
        : "";
  const normalized = text.replace(/\s+/g, " ").trim();

  if (!normalized) {
    return "-";
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit).trim()}...`;
}

function paginateRows(rows, page) {
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * PAGE_SIZE;

  return {
    rows: rows.slice(start, start + PAGE_SIZE),
    page: safePage,
    totalPages
  };
}

function SearchInput({ value, onChange, placeholder }) {
  return (
    <input
      type="search"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="admin-search-input"
      placeholder={placeholder}
      aria-label={placeholder}
    />
  );
}

function PaginationControls({ page, totalPages, onChange }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="admin-pagination">
      <button
        type="button"
        className="btn-link secondary admin-pagination-btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        Inapoi
      </button>
      <span className="admin-pagination-label">{`Pagina ${page} din ${totalPages}`}</span>
      <button
        type="button"
        className="btn-link secondary admin-pagination-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Inainte
      </button>
    </div>
  );
}

function CellPill({ children, tone = "default" }) {
  return (
    <span className={`admin-table-pill ${tone !== "default" ? `is-${tone}` : ""}`}>{children}</span>
  );
}

function ReviewDot({ show, label = "De verificat" }) {
  if (!show) {
    return null;
  }

  return <span className="admin-review-dot" title={label} aria-label={label} />;
}

function formatSourceKind(value) {
  if (value === "pdf") return "PDF";
  if (value === "docx") return "DOCX";
  if (value === "txt") return "TXT";
  if (value === "manual") return "Manual";
  return value || "-";
}

function formatStage(value) {
  if (value === "queued") return "Pregatim";
  if (value === "profiling") return "Verificam";
  if (value === "extracting") return "Extragere";
  if (value === "consolidating") return "Consolidare";
  if (value === "publishing") return "Publicare";
  if (value === "failed") return "Oprit";
  return value || "-";
}

function formatFailureReason(value) {
  if (value === "failed") return "Eroare upload/extractie";
  if (value === "rejected") return "Fisier respins";
  if (value === "consolidation_too_few_valid_items") return "Prea putine iteme valide";
  if (value === "pdf_fallback_not_publishable") return "Fallback PDF nepublicabil";
  if (value === "pdf_fallback_timeout") return "Timeout PDF fallback";
  if (value === "pdf_fallback_failed") return "Eroare PDF fallback";
  if (value === "question_bank_persist_failed") return "Salvare banca esuata";
  if (value === "review_finalize_failed") return "Finalizare review esuata";
  return value || "-";
}

function toneForFile(entry) {
  if (entry.file_available) {
    return "good";
  }

  return entry.entry_type === "source_failed" ? "warning" : "bad";
}

export function AdminUploadErrorsPanel({ rows = [] }) {
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  const filteredRows = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return rows;
    }

    return rows.filter((row) =>
      normalizeText(
        [
          row.user_email,
          row.user_id,
          row.filename,
          row.source_kind,
          row.job_stage,
          row.subject_label,
          row.user_message,
          row.technical_detail,
          row.failure_reason
        ].join(" ")
      ).includes(normalizeText(trimmed))
    );
  }, [query, rows]);

  const paginated = useMemo(() => paginateRows(filteredRows, page), [filteredRows, page]);

  return (
    <section className="admin-table-section">
      <div className="admin-table-section-head">
        <div>
          <h3>Upload-uri cu erori</h3>
          <p className="page-copy">
            Vezi rapid fisierele care au picat la upload, extractie sau procesare si descarca sursa
            atunci cand este disponibila.
          </p>
        </div>
        <div className="admin-table-head-actions">
          <span className="status-pill is-muted">{`${filteredRows.length} cazuri`}</span>
        </div>
      </div>

      <div className="admin-toolbar">
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Cauta dupa email, fisier, materie sau text de eroare"
        />
      </div>

      <div className="table-scroll admin-table-scroll">
        <table className="admin-table" style={{ minWidth: 1420 }}>
          <thead>
            <tr>
              <th aria-label="De verificat"></th>
              <th>Creat la</th>
              <th>Utilizator</th>
              <th>Fisier</th>
              <th>Tip</th>
              <th>Status</th>
              <th>Etapa</th>
              <th>Eroare utilizator</th>
              <th>Detaliu tehnic</th>
              <th>Motiv</th>
              <th>Fisier sursa</th>
            </tr>
          </thead>
          <tbody>
            {paginated.rows.length ? (
              paginated.rows.map((entry) => (
                <tr key={entry.id} className="has-admin-review">
                  <td className="admin-review-cell">
                    <ReviewDot show label="Upload de verificat" />
                  </td>
                  <td>{formatDate(entry.created_at)}</td>
                  <td className="admin-table-text-cell">{entry.user_email || entry.user_id || "-"}</td>
                  <td className="admin-table-text-cell">
                    <div className="admin-upload-errors-cell">
                      <strong>{entry.filename || "Input fara nume"}</strong>
                      <span>{entry.subject_label || "Fara materie detectata"}</span>
                    </div>
                  </td>
                  <td>{formatSourceKind(entry.source_kind)}</td>
                  <td>
                    <CellPill tone="bad">{entry.job_status || entry.extraction_status || "eroare"}</CellPill>
                  </td>
                  <td>{formatStage(entry.job_stage)}</td>
                  <td className="admin-table-text-cell">{buildExcerpt(entry.user_message)}</td>
                  <td className="admin-table-text-cell">
                    <div className="admin-upload-errors-cell">
                      <span>{buildExcerpt(entry.technical_detail)}</span>
                      {entry.failure_context ? (
                        <span>{buildExcerpt(entry.failure_context, 120)}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{formatFailureReason(entry.failure_reason)}</td>
                  <td>
                    <div className="admin-upload-errors-actions">
                      <CellPill tone={toneForFile(entry)}>
                        {entry.file_available ? "salvat" : "indisponibil"}
                      </CellPill>
                      {entry.download_path ? (
                        <a className="btn-link secondary admin-upload-errors-link" href={entry.download_path}>
                          Descarca
                        </a>
                      ) : null}
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={11}>
                  <div className="workspace-context-summary">
                    <strong>Nu exista upload-uri cu erori pentru filtrul curent.</strong>
                    <span>Schimba cautarea sau revino dupa urmatoarele procesari.</span>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={paginated.page}
        totalPages={paginated.totalPages}
        onChange={setPage}
      />
    </section>
  );
}
