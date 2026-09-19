"use client";

import { moduleClassNames } from "@/lib/ui/module-class-names";
import { useMemo, useState } from "react";

import { FilterSearch, Pagination } from "@/components/ui/collection-controls";
import { DataTable } from "@/components/ui/data-table";
import { AdminReviewDot, AdminStatusPill } from "@/components/admin-table-meta";

import uploadStyles from "./admin-upload-errors-panel.module.css";
import sharedStyles from "./admin-shared.module.css";
import metaStyles from "./admin-table-meta.module.css";

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
  return <FilterSearch value={value} onChange={onChange} placeholder={placeholder} compact className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-search-input")} />;
}

const CellPill = AdminStatusPill;
const ReviewDot = AdminReviewDot;

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
    <section className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-table-section")}>
      <div className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-table-section-head")}>
        <div>
          <h3>Upload-uri cu erori</h3>
          <p className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "page-copy")}>
            Vezi rapid fisierele care au picat la upload, extractie sau procesare si descarca sursa
            atunci cand este disponibila.
          </p>
        </div>
        <div className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-table-head-actions")}>
          <span className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "status-pill is-muted")}>{`${filteredRows.length} cazuri`}</span>
        </div>
      </div>

      <div className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-toolbar")}>
        <SearchInput
          value={query}
          onChange={(value) => {
            setQuery(value);
            setPage(1);
          }}
          placeholder="Cauta dupa email, fisier, materie sau text de eroare"
        />
      </div>

      <DataTable
        caption="Upload-uri cu erori"
        minWidth={1420}
        columns={[
          { key: "review", label: "", ariaLabel: "De verificat" },
          { key: "createdAt", label: "Creat la" },
          { key: "user", label: "Utilizator" },
          { key: "file", label: "Fisier" },
          { key: "type", label: "Tip" },
          { key: "status", label: "Status" },
          { key: "stage", label: "Etapa" },
          { key: "userError", label: "Eroare utilizator" },
          { key: "technicalDetail", label: "Detaliu tehnic" },
          { key: "reason", label: "Motiv" },
          { key: "source", label: "Fisier sursa" }
        ]}
      >
            {paginated.rows.length ? (
              paginated.rows.map((entry) => (
                <tr key={entry.id} data-table-tone="review">
                  <td className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-review-cell")}>
                    <ReviewDot show label="Upload de verificat" />
                  </td>
                  <td>{formatDate(entry.created_at)}</td>
                  <td className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-table-text-cell")}>{entry.user_email || entry.user_id || "-"}</td>
                  <td className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-table-text-cell")}>
                    <div className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-upload-errors-cell")}>
                      <strong>{entry.filename || "Input fara nume"}</strong>
                      <span>{entry.subject_label || "Fara materie detectata"}</span>
                    </div>
                  </td>
                  <td>{formatSourceKind(entry.source_kind)}</td>
                  <td>
                    <CellPill tone="bad">{entry.job_status || entry.extraction_status || "eroare"}</CellPill>
                  </td>
                  <td>{formatStage(entry.job_stage)}</td>
                  <td className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-table-text-cell")}>{buildExcerpt(entry.user_message)}</td>
                  <td className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-table-text-cell")}>
                    <div className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-upload-errors-cell")}>
                      <span>{buildExcerpt(entry.technical_detail)}</span>
                      {entry.failure_context ? (
                        <span>{buildExcerpt(entry.failure_context, 120)}</span>
                      ) : null}
                    </div>
                  </td>
                  <td>{formatFailureReason(entry.failure_reason)}</td>
                  <td>
                    <div className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "admin-upload-errors-actions")}>
                      <CellPill tone={toneForFile(entry)}>
                        {entry.file_available ? "salvat" : "indisponibil"}
                      </CellPill>
                      {entry.download_path ? (
                        <a className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "btn-link secondary admin-upload-errors-link")} href={entry.download_path}>
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
                  <div className={moduleClassNames([uploadStyles, sharedStyles, metaStyles], "workspace-context-summary")}>
                    <strong>Nu exista upload-uri cu erori pentru filtrul curent.</strong>
                    <span>Schimba cautarea sau revino dupa urmatoarele procesari.</span>
                  </div>
                </td>
              </tr>
            )}
      </DataTable>

      <Pagination
        page={paginated.page}
        totalPages={paginated.totalPages}
        onPageChange={setPage}
      />
    </section>
  );
}
