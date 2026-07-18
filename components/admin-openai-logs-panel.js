"use client";

import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, BarChart3, FileText, Files, ListFilter, ReceiptText } from "lucide-react";
import { AdminTabsContainer } from "@/components/admin-tabs-container";
import { useDialogFocus } from "@/lib/ui/dialog";
import { handleTablistKeyDown } from "@/lib/ui/tablist";

const PAGE_SIZE = 8;
const SUMMARY_LIMIT = 180;

function normalizeText(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function matchesSearch(target, query) {
  return normalizeText(target).includes(normalizeText(query));
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

function formatShortDay(value) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit"
  }).format(new Date(value));
}

function formatUsd(value) {
  const amount = Number(value || 0);
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: amount >= 10 ? 2 : 4,
    maximumFractionDigits: amount >= 10 ? 2 : 4
  }).format(amount);
}

function formatPercent(value) {
  return `${Number(value || 0).toFixed(1)}%`;
}

function formatCount(value) {
  return new Intl.NumberFormat("ro-RO").format(Number(value || 0));
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

function FilterButton({ active, onClick, children, icon: Icon = null, count = null }) {
  return (
    <button
      type="button"
      className={`btn-link secondary admin-filter-chip ${active ? "is-active-filter" : ""}`}
      onClick={onClick}
    >
      <span className="admin-tab-content">
        {Icon ? <Icon className="admin-tab-icon" aria-hidden="true" size={15} strokeWidth={2.2} /> : null}
        <span className="admin-tab-label">{children}</span>
        {Number.isFinite(count) ? <span className="admin-tab-count">{count}</span> : null}
      </span>
    </button>
  );
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

function AdminTable({ columns, children, minWidth = 1180 }) {
  return (
    <div className="table-scroll admin-table-scroll">
      <table className="admin-table" style={{ minWidth }}>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

function formatScopeLabel(value) {
  if (value === "question_bank_chunk_extract") return "Chunk extract";
  if (value === "pdf_batch_extract") return "PDF batch";
  if (value === "pdf_fallback_extract") return "PDF fallback";
  if (value === "pdf_file_upload") return "Upload fisier";
  if (value === "pdf_file_delete") return "Stergere fisier";
  if (value === "generate_quiz") return "Test din text";
  return value || "necunoscut";
}

function formatOperationLabel(value) {
  if (value === "responses.parse") return "Responses";
  if (value === "files.create") return "Files upload";
  if (value === "files.delete") return "Files delete";
  return value || "-";
}

function formatOpenAIStatusTone(value) {
  return value === "succeeded" ? "good" : "bad";
}

function formatJobStatusTone(value) {
  if (value === "succeeded" || value === "published") return "good";
  if (value === "failed") return "bad";
  if (value === "processing" || value === "pending") return "warning";
  return "default";
}

function formatJobStatusLabel(value) {
  if (value === "succeeded") return "Gata";
  if (value === "failed") return "Eroare";
  if (value === "processing") return "In lucru";
  if (value === "pending") return "In asteptare";
  if (value === "published") return "Publicat";
  return value || "-";
}

function formatJobStageLabel(value) {
  if (value === "queued") return "Pregatim";
  if (value === "profiling") return "Verificam";
  if (value === "extracting") return "Extragere";
  if (value === "consolidating") return "Consolidare";
  if (value === "publishing") return "Publicare";
  if (value === "review") return "Review";
  if (value === "failed") return "Oprit";
  return value || "-";
}

function formatFailureReasonLabel(value) {
  if (value === "consolidation_too_few_valid_items") return "Prea putine iteme valide";
  if (value === "pdf_fallback_not_publishable") return "Fallback PDF nepublicabil";
  if (value === "pdf_fallback_timeout") return "Timeout PDF fallback";
  if (value === "pdf_fallback_failed") return "Eroare PDF fallback";
  if (value === "pdf_fallback_persist_failed") return "Salvare fallback esuata";
  if (value === "pdf_fallback_review_finalize_failed") return "Finalizare fallback esuata";
  if (value === "question_bank_persist_failed") return "Salvare banca esuata";
  if (value === "review_finalize_failed") return "Finalizare review esuata";
  return value || "-";
}

function formatPricingStatusLabel(value) {
  if (value === "estimated") return "Cost salvat";
  if (value === "zero_usage") return "Cost 0";
  if (value === "pricing_missing") return "Pricing lipsa";
  return value || "-";
}

function formatPricingStatusTone(value) {
  if (value === "estimated" || value === "zero_usage") return "good";
  if (value === "pricing_missing") return "warning";
  return "default";
}

function formatCostOriginLabel(value) {
  if (value === "stored") return "Istoric salvat";
  if (value === "runtime_fallback") return "Estimare la citire";
  return value || "-";
}

function stringifyValue(value) {
  if (!value) {
    return "-";
  }

  if (typeof value === "string") {
    return value;
  }

  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return String(value);
  }
}

function buildExcerpt(value, limit = SUMMARY_LIMIT) {
  const normalized = String(value || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!normalized) {
    return "-";
  }

  if (normalized.length <= limit) {
    return normalized;
  }

  return `${normalized.slice(0, limit).trim()}...`;
}

function buildSummary(row) {
  return buildExcerpt(
    row.job_error_message ||
      row.error_message ||
      row.output_preview ||
      row.input_preview ||
      row.job_status_detail ||
      ""
  );
}

function CostOverviewCard({ title, value, caption, tone = "default" }) {
  return (
    <article className={`admin-cost-card ${tone !== "default" ? `is-${tone}` : ""}`}>
      <span className="admin-cost-card-label">{title}</span>
      <strong>{value}</strong>
      <span className="admin-cost-card-copy">{caption}</span>
    </article>
  );
}

function CostTableSection({ title, copy, columns, children, minWidth = 820 }) {
  return (
    <section className="admin-table-section">
      <div className="admin-table-section-head">
        <div>
          <h3>{title}</h3>
          <p className="page-copy">{copy}</p>
        </div>
      </div>
      <AdminTable columns={columns} minWidth={minWidth}>
        {children}
      </AdminTable>
    </section>
  );
}

function OpenAILogDetailModal({ row, onClose }) {
  const dialogRef = useDialogFocus(Boolean(row), onClose);

  if (!row) {
    return null;
  }

  return (
    <div
      className="workspace-modal-backdrop"
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        ref={dialogRef}
        className="workspace-modal-card admin-openai-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="admin-openai-log-title"
      >
        <div className="workspace-modal-head">
          <div>
            <strong id="admin-openai-log-title">Detalii procesare</strong>
            <p>
              Un apel reusit nu inseamna automat ca procesarea s-a terminat cu succes.
              Verifica separat statusul providerului si statusul jobului. Daca jobul era in lucru,
              pagina poate necesita refresh manual pentru verdictul final.
            </p>
          </div>
          <button
            className="workspace-modal-close feedback-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Inchide"
          >
            Inchide
          </button>
        </div>

        <div className="admin-openai-modal-statuses">
          <CellPill tone={formatOpenAIStatusTone(row.status)}>
            {row.status === "succeeded" ? "Provider: succes" : "Provider: eroare"}
          </CellPill>
          <CellPill tone={formatJobStatusTone(row.job_status)}>
            {`Job: ${formatJobStatusLabel(row.job_status)}`}
          </CellPill>
          <CellPill>{`Stage: ${formatJobStageLabel(row.job_stage)}`}</CellPill>
          <CellPill tone={formatPricingStatusTone(row.cost_pricing_status)}>
            {`Cost: ${formatPricingStatusLabel(row.cost_pricing_status)}`}
          </CellPill>
        </div>

        <div className="admin-kv-list">
          <div className="admin-kv-row">
            <span className="admin-kv-label">Utilizator</span>
            <span className="admin-kv-value">{row.user_email || row.user_id || "-"}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Model si reasoning</span>
            <span className="admin-kv-value">{`${row.model || "-"} / ${row.reasoning_effort || "-"}`}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Cost estimat</span>
            <span className="admin-kv-value">{formatUsd(row.cost_estimate_usd || 0)}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Breakdown cost</span>
            <span className="admin-kv-value">
              {`${formatUsd(row.cost_input_usd || 0)} input • ${formatUsd(row.cost_cached_input_usd || 0)} cached • ${formatUsd(row.cost_output_usd || 0)} output`}
            </span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Origine cost</span>
            <span className="admin-kv-value">{formatCostOriginLabel(row.cost_origin)}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Pricing version</span>
            <span className="admin-kv-value">{row.cost_pricing_version || "-"}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Tokeni normalizati</span>
            <span className="admin-kv-value">
              {`${formatCount(row.input_tokens_normalized || 0)} input • ${formatCount(row.cached_input_tokens_normalized || 0)} cached • ${formatCount(row.output_tokens_normalized || 0)} output • ${formatCount(row.reasoning_tokens_normalized || 0)} reasoning`}
            </span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Response ID</span>
            <span className="admin-kv-value">{row.response_id || "-"}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">File ID provider</span>
            <span className="admin-kv-value">{row.openai_file_id || "-"}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Job status</span>
            <span className="admin-kv-value">{formatJobStatusLabel(row.job_status)}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Job stage</span>
            <span className="admin-kv-value">{formatJobStageLabel(row.job_stage)}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Progres job</span>
            <span className="admin-kv-value">
              {typeof row.job_progress_percent === "number" ? `${row.job_progress_percent}%` : "-"}
            </span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Coverage job</span>
            <span className="admin-kv-value">
              {row.job_coverage_target_count
                ? `${row.job_coverage_percent || 0}% (${row.job_coverage_target_count} tinta)`
                : "-"}
            </span>
          </div>
          {row.request_scope === "question_bank_chunk_extract" ? (
            <div className="admin-kv-row">
              <span className="admin-kv-label">Interpretare log</span>
              <span className="admin-kv-value">
                {`Acest apel a extras un chunk. Verdictul final al jobului a fost dat ulterior in etapa ${formatJobStageLabel(row.job_stage)}.`}
              </span>
            </div>
          ) : null}
          {row.request_scope === "pdf_fallback_extract" ? (
            <div className="admin-kv-row">
              <span className="admin-kv-label">Interpretare log</span>
              <span className="admin-kv-value">
                {row.job_processing_mode === "openai_pdf_primary"
                  ? "Acest apel a procesat PDF-ul direct cu providerul, ca traseu principal pentru aceasta banca."
                  : row.job_processing_mode === "openai_fallback"
                    ? "Acest apel a procesat PDF-ul prin provider si rezultatul a fost folosit ca sursa finala pentru banca."
                    : row.job_final_failure_reason === "pdf_fallback_not_publishable"
                      ? "Providerul a procesat PDF-ul, dar rezultatul nu a trecut pragul minim de publicare."
                      : "Acest apel apartine fallback-ului PDF. Verifica separat statusul final al jobului pentru a vedea daca rezultatul a fost salvat."}
              </span>
            </div>
          ) : null}
          <div className="admin-kv-row">
            <span className="admin-kv-label">Materia</span>
            <span className="admin-kv-value">{row.job_subject_label || "-"}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Fisier sursa</span>
            <span className="admin-kv-value">{row.job_source_filename || "-"}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Mod procesare job</span>
            <span className="admin-kv-value">{row.job_processing_mode || "-"}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Sursa extractiei</span>
            <span className="admin-kv-value">{row.job_extraction_source || "-"}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Motiv final esec</span>
            <span className="admin-kv-value">{formatFailureReasonLabel(row.job_final_failure_reason)}</span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Chunk-uri reusite</span>
            <span className="admin-kv-value">
              {row.job_successful_chunk_count != null ? row.job_successful_chunk_count : "-"}
            </span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Iteme extrase brut din chunk-uri</span>
            <span className="admin-kv-value">
              {row.job_successful_chunk_item_count != null ? row.job_successful_chunk_item_count : "-"}
            </span>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Job status detail</span>
            <pre className="admin-openai-pre">{stringifyValue(row.job_status_detail)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Job error</span>
            <pre className="admin-openai-pre">{stringifyValue(row.job_error_message)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Cauza tehnica job</span>
            <pre className="admin-openai-pre">{stringifyValue(row.job_last_failure_context)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Diagnostic consolidare</span>
            <pre className="admin-openai-pre">{stringifyValue(row.job_consolidation_diagnostics)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Attempt-uri extractie</span>
            <pre className="admin-openai-pre">{stringifyValue(row.job_extraction_attempts)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Rezumat consolidare</span>
            <pre className="admin-openai-pre">{stringifyValue(row.job_consolidation_summary)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Prompt trimis</span>
            <pre className="admin-openai-pre">{stringifyValue(row.prompt_text)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Input preview</span>
            <pre className="admin-openai-pre">{stringifyValue(row.input_preview)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Output preview</span>
            <pre className="admin-openai-pre">{stringifyValue(row.output_preview)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Eroare provider</span>
            <pre className="admin-openai-pre">{stringifyValue(row.error_message)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Usage</span>
            <pre className="admin-openai-pre">{stringifyValue(row.usage)}</pre>
          </div>
          <div className="admin-kv-row">
            <span className="admin-kv-label">Metadata</span>
            <pre className="admin-openai-pre">{stringifyValue(row.metadata)}</pre>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdminOpenAICostsView({ dashboard, rows, warning }) {
  if (!dashboard) {
    return (
      <div className="workspace-context-summary">
        <strong>Costurile de procesare nu sunt disponibile inca.</strong>
        <span>Verifica migrarea si logurile tehnice pentru a incepe trackingul financiar.</span>
      </div>
    );
  }

  const { overview, diagnostics, breakdowns, recommendations, meta, trendByDay } = dashboard;
  const failedRows = rows.filter((row) => row.status === "failed" || row.job_status === "failed").length;

  return (
    <div className="admin-cost-stack">
      <div className="admin-cost-copy">
        <p className="page-copy">
          Costurile de mai jos sunt estimate tehnic din usage-ul providerului si pricing-ul oficial, nu o
          factura reconciliata. Moneda este USD.
        </p>
        <p className="admin-cost-note">
          {`Pricing version: ${meta.pricingVersion} • actualizat ${meta.pricingUpdatedAt} • `}
          <a href={meta.pricingSourceUrl} target="_blank" rel="noreferrer">
            sursa oficiala provider
          </a>
        </p>
      </div>

      {warning ? <div className="error-state" role="alert">{warning}</div> : null}

      <div className="admin-cost-grid">
        <CostOverviewCard
          title="24h"
          value={formatUsd(overview.last24h.totalCostUsd)}
          caption={`${formatCount(overview.last24h.requestCount)} requesturi • ${formatUsd(
            overview.last24h.averageCostPerRequestUsd
          )} / request`}
        />
        <CostOverviewCard
          title="7 zile"
          value={formatUsd(overview.last7d.totalCostUsd)}
          caption={`${formatCount(overview.last7d.jobCount)} joburi • ${formatUsd(
            overview.last7d.averageCostPerJobUsd
          )} / job`}
        />
        <CostOverviewCard
          title="30 zile"
          value={formatUsd(overview.last30d.totalCostUsd)}
          caption={`${formatCount(overview.last30d.costableRequestCount)} requesturi costabile`}
        />
        <CostOverviewCard
          title="Cost pierdut pe esec"
          value={formatUsd(diagnostics.failedCostUsd)}
          caption={`${formatPercent(diagnostics.failedCostRatePercent)} din costul total • ${formatCount(
            failedRows
          )} requesturi sau joburi cu esec`}
          tone={diagnostics.failedCostRatePercent >= 15 ? "warning" : "default"}
        />
        <CostOverviewCard
          title="PDF fallback"
          value={formatUsd(diagnostics.pdfFallbackCostUsd)}
          caption={`${formatPercent(diagnostics.pdfFallbackCostRatePercent)} din total`}
          tone={diagnostics.pdfFallbackCostRatePercent >= 25 ? "warning" : "default"}
        />
        <CostOverviewCard
          title="Pricing map lipsa"
          value={formatCount(meta.pricingMissingCount)}
          caption={`${formatCount(meta.runtimeFallbackCount)} estimate la citire • ${formatCount(
            meta.storedEstimateCount
          )} costuri deja salvate`}
          tone={meta.pricingMissingCount > 0 ? "warning" : "good"}
        />
      </div>

      <div className="admin-cost-grid admin-cost-grid--secondary">
        <CostOverviewCard
          title="Modele puternice"
          value={formatUsd(diagnostics.strongModelCostUsd)}
          caption={`${formatPercent(diagnostics.strongModelCostRatePercent)} pe GPT-5.4 sau mai sus`}
        />
        <CostOverviewCard
          title="Reasoning mare"
          value={formatUsd(diagnostics.highReasoningCostUsd)}
          caption={`${formatPercent(diagnostics.highReasoningCostRatePercent)} pe high sau xhigh`}
        />
        <CostOverviewCard
          title="Trend 30 zile"
          value={trendByDay.length ? formatShortDay(trendByDay[trendByDay.length - 1]?.date) : "-"}
          caption={trendByDay.length ? `${formatCount(trendByDay.length)} zile cu trafic` : "Nu exista suficient istoric"}
        />
      </div>

      <section className="admin-table-section">
        <div className="admin-table-section-head">
          <div>
            <h3>Semnale de optimizare</h3>
            <p className="page-copy">
              Aici vezi rapid unde merita sa tai cost sau sa verifici daca modelul si reasoning-ul sunt bine alese.
            </p>
          </div>
        </div>
        {recommendations.length ? (
          <div className="admin-cost-recommendations">
            {recommendations.map((recommendation) => (
              <div key={recommendation} className="admin-cost-recommendation">
                {recommendation}
              </div>
            ))}
          </div>
        ) : (
          <div className="workspace-context-summary">
            <strong>Nu exista inca semnale puternice.</strong>
            <span>Pe masura ce strangi mai multe loguri, aici vor aparea sugestii clare de optimizare.</span>
          </div>
        )}
      </section>

      <div className="admin-cost-layout">
        <CostTableSection
          title="Top modele dupa cost"
          copy="Identifica rapid ce familie de model consuma bugetul."
          columns={[
            { key: "model", label: "Model" },
            { key: "cost", label: "Cost total" },
            { key: "requests", label: "Requesturi" },
            { key: "average", label: "Medie / request" },
            { key: "failed", label: "Cost pe esecuri" }
          ]}
          minWidth={760}
        >
          {breakdowns.models.map((entry) => (
            <tr key={entry.key}>
              <td>{entry.label}</td>
              <td>{formatUsd(entry.totalCostUsd)}</td>
              <td>{formatCount(entry.requestCount)}</td>
              <td>{formatUsd(entry.averageCostPerRequestUsd)}</td>
              <td>{`${formatUsd(entry.failedCostUsd)} (${formatPercent(entry.failedCostRatePercent)})`}</td>
            </tr>
          ))}
        </CostTableSection>

        <CostTableSection
          title="Top scope-uri dupa cost"
          copy="Aici vezi ce pasi din pipeline consuma cel mai mult."
          columns={[
            { key: "scope", label: "Scope" },
            { key: "cost", label: "Cost total" },
            { key: "requests", label: "Requesturi" },
            { key: "average", label: "Medie / request" },
            { key: "failed", label: "Cost pe esecuri" }
          ]}
          minWidth={760}
        >
          {breakdowns.scopes.map((entry) => (
            <tr key={entry.key}>
              <td>{formatScopeLabel(entry.label)}</td>
              <td>{formatUsd(entry.totalCostUsd)}</td>
              <td>{formatCount(entry.requestCount)}</td>
              <td>{formatUsd(entry.averageCostPerRequestUsd)}</td>
              <td>{`${formatUsd(entry.failedCostUsd)} (${formatPercent(entry.failedCostRatePercent)})`}</td>
            </tr>
          ))}
        </CostTableSection>
      </div>

      <div className="admin-cost-layout">
        <CostTableSection
          title="Top utilizatori dupa cost"
          copy="Bun pentru a intelege cine consuma cel mai mult din bugetul de procesare."
          columns={[
            { key: "user", label: "Utilizator" },
            { key: "cost", label: "Cost total" },
            { key: "requests", label: "Requesturi" },
            { key: "average", label: "Medie / request" }
          ]}
          minWidth={760}
        >
          {breakdowns.users.map((entry) => (
            <tr key={entry.key}>
              <td className="admin-table-name-cell">{entry.label}</td>
              <td>{formatUsd(entry.totalCostUsd)}</td>
              <td>{formatCount(entry.requestCount)}</td>
              <td>{formatUsd(entry.averageCostPerRequestUsd)}</td>
            </tr>
          ))}
        </CostTableSection>

        <CostTableSection
          title="Trend zilnic 30 zile"
          copy="Un rezumat simplu ca sa vezi daca bugetul urca gradual sau in spike-uri."
          columns={[
            { key: "day", label: "Zi" },
            { key: "cost", label: "Cost total" },
            { key: "requests", label: "Requesturi" }
          ]}
          minWidth={540}
        >
          {trendByDay.slice(-8).reverse().map((entry) => (
            <tr key={entry.date}>
              <td>{formatShortDay(entry.date)}</td>
              <td>{formatUsd(entry.totalCostUsd)}</td>
              <td>{formatCount(entry.requestCount)}</td>
            </tr>
          ))}
        </CostTableSection>
      </div>

      <CostTableSection
        title="Top requesturi individuale"
        copy="Aici identifici rapid apelurile cele mai scumpe, cu model, reasoning si verdict final."
        columns={[
          { key: "when", label: "Cand" },
          { key: "scope", label: "Scope" },
          { key: "model", label: "Model" },
          { key: "reasoning", label: "Reasoning" },
          { key: "cost", label: "Cost" },
          { key: "status", label: "Status" },
          { key: "user", label: "Utilizator" }
        ]}
        minWidth={980}
      >
        {breakdowns.requests.map((entry) => (
          <tr key={entry.id}>
            <td><span className="admin-table-date-cell">{formatDate(entry.created_at)}</span></td>
            <td>{formatScopeLabel(entry.request_scope)}</td>
            <td>{entry.canonical_model || entry.model || "-"}</td>
            <td>{entry.reasoning_effort || "-"}</td>
            <td>{formatUsd(entry.cost_estimate_usd)}</td>
            <td>
              <div className="admin-cell-pill-list">
                <CellPill tone={formatOpenAIStatusTone(entry.status)}>
                  {entry.status === "succeeded" ? "Provider ok" : "Provider fail"}
                </CellPill>
                <CellPill tone={formatJobStatusTone(entry.job_status)}>
                  {formatJobStatusLabel(entry.job_status)}
                </CellPill>
              </div>
            </td>
            <td className="admin-table-name-cell">{entry.user_email}</td>
          </tr>
        ))}
      </CostTableSection>

      <CostTableSection
        title="Top joburi dupa cost cumulat"
        copy="Te ajuta sa vezi ce joburi ajung sa consume cel mai mult in total, nu doar pe un singur apel."
        columns={[
          { key: "job", label: "Job" },
          { key: "cost", label: "Cost total" },
          { key: "requests", label: "Requesturi" },
          { key: "failed", label: "Cost pe esecuri" },
          { key: "status", label: "Verdict final" },
          { key: "mode", label: "Mod" }
        ]}
        minWidth={980}
      >
        {breakdowns.jobs.map((entry) => (
          <tr key={entry.job_id}>
            <td className="admin-table-name-cell">{entry.label}</td>
            <td>{formatUsd(entry.totalCostUsd)}</td>
            <td>{formatCount(entry.requestCount)}</td>
            <td>{`${formatUsd(entry.failedCostUsd)} (${formatPercent(entry.failedCostRatePercent)})`}</td>
            <td>
              <div className="admin-cell-pill-list">
                <CellPill tone={formatJobStatusTone(entry.job_status)}>
                  {formatJobStatusLabel(entry.job_status)}
                </CellPill>
                <CellPill>{formatJobStageLabel(entry.job_stage)}</CellPill>
              </div>
            </td>
            <td>{entry.job_processing_mode || "-"}</td>
          </tr>
        ))}
      </CostTableSection>
    </div>
  );
}

export function AdminOpenAILogsPanel({ rows, costDashboard = null, warning = null }) {
  const [panelTab, setPanelTab] = useState("costs");
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selectedRow, setSelectedRow] = useState(null);

  useEffect(() => {
    setPage(1);
  }, [filter, search]);

  const filteredRows = useMemo(() => {
    return (rows || []).filter((row) => {
      if (filter === "responses" && row.operation !== "responses.parse") {
        return false;
      }

      if (filter === "files" && !String(row.operation || "").startsWith("files.")) {
        return false;
      }

      if (filter === "failures" && row.status !== "failed" && row.job_status !== "failed") {
        return false;
      }

      if (
        filter === "fallback" &&
        !["pdf_fallback_extract", "pdf_batch_extract", "pdf_file_upload", "pdf_file_delete"].includes(row.request_scope)
      ) {
        return false;
      }

      if (!search.trim()) {
        return true;
      }

      return matchesSearch(
        [
          row.user_email,
          row.user_id,
          row.request_scope,
          row.operation,
          row.model,
          row.canonical_model,
          row.reasoning_effort,
          row.response_id,
          row.openai_file_id,
          row.error_message,
          row.prompt_text,
          row.input_preview,
          row.output_preview,
          row.job_status,
          row.job_stage,
          row.job_error_message,
          row.job_status_detail,
          row.job_subject_label,
          row.job_source_filename,
          row.cost_pricing_status
        ].join(" "),
        search
      );
    });
  }, [rows, filter, search]);

  const pageData = useMemo(() => paginateRows(filteredRows, page), [filteredRows, page]);
  const failureCount = useMemo(
    () => (rows || []).filter((row) => row.status === "failed" || row.job_status === "failed").length,
    [rows]
  );
  const logCounts = useMemo(
    () => ({
      all: rows.length,
      responses: rows.filter((row) => row.operation === "responses.parse").length,
      files: rows.filter((row) => String(row.operation || "").startsWith("files.")).length,
      fallback: rows.filter((row) =>
        ["pdf_fallback_extract", "pdf_batch_extract", "pdf_file_upload", "pdf_file_delete"].includes(row.request_scope)
      ).length,
      failures: rows.filter((row) => row.status === "failed" || row.job_status === "failed").length
    }),
    [rows]
  );
  const total30dCost = costDashboard?.overview?.last30d?.totalCostUsd || 0;

  return (
    <section className="admin-panel is-visible" aria-hidden={false}>
      <div className="dashboard-header admin-section-intro">
        <div>
          <h2>Loguri procesare</h2>
          <p className="page-copy">
            Vezi separat daca apelul providerului a mers si daca procesarea s-a terminat cu succes.
            Un `output preview` bun poate aparea chiar daca pipeline-ul s-a oprit ulterior.
            In tabul `Costuri` vezi estimarea financiara si zonele unde merita optimizare.
          </p>
        </div>
        <div className="admin-inline-stats">
          <span className="status-pill is-muted">{`${rows.length} apeluri`}</span>
          <span className="status-pill is-muted">{`${failureCount} opriri sau erori`}</span>
          <span className="status-pill is-muted">{`${formatUsd(total30dCost)} / 30 zile`}</span>
        </div>
      </div>

      <AdminTabsContainer
        className="admin-openai-subtabs"
        role="tablist"
        aria-label="Sectiuni procesare"
        onKeyDown={handleTablistKeyDown}
      >
        <button
          id="processing-tab-costs"
          type="button"
          role="tab"
          aria-selected={panelTab === "costs"}
          aria-controls="processing-active-panel"
          tabIndex={panelTab === "costs" ? 0 : -1}
          className={`btn-link secondary admin-main-tab ${panelTab === "costs" ? "is-active-filter" : ""}`}
          onClick={() => setPanelTab("costs")}
        >
          <span className="admin-tab-content">
            <BarChart3 className="admin-tab-icon" aria-hidden="true" size={16} strokeWidth={2.2} />
            <span className="admin-tab-label">Costuri</span>
            <span className="admin-tab-count">{rows.length}</span>
          </span>
        </button>
        <button
          id="processing-tab-logs"
          type="button"
          role="tab"
          aria-selected={panelTab === "logs"}
          aria-controls="processing-active-panel"
          tabIndex={panelTab === "logs" ? 0 : -1}
          className={`btn-link secondary admin-main-tab ${panelTab === "logs" ? "is-active-filter" : ""}`}
          onClick={() => setPanelTab("logs")}
        >
          <span className="admin-tab-content">
            <ReceiptText className="admin-tab-icon" aria-hidden="true" size={16} strokeWidth={2.2} />
            <span className="admin-tab-label">Loguri</span>
            <span className="admin-tab-count">{rows.length}</span>
          </span>
        </button>
      </AdminTabsContainer>

      <div
        id="processing-active-panel"
        role="tabpanel"
        aria-labelledby={`processing-tab-${panelTab}`}
      >
      {panelTab === "costs" ? (
        <AdminOpenAICostsView dashboard={costDashboard} rows={rows} warning={warning} />
      ) : (
        <>
          <div className="admin-toolbar">
            <AdminTabsContainer
              className="admin-filter-row"
              role="group"
              aria-label="Filtre loguri procesare"
            >
              <FilterButton active={filter === "all"} onClick={() => setFilter("all")} icon={ListFilter} count={logCounts.all}>Toate</FilterButton>
              <FilterButton active={filter === "responses"} onClick={() => setFilter("responses")} icon={ReceiptText} count={logCounts.responses}>Responses</FilterButton>
              <FilterButton active={filter === "files"} onClick={() => setFilter("files")} icon={Files} count={logCounts.files}>Files</FilterButton>
              <FilterButton active={filter === "fallback"} onClick={() => setFilter("fallback")} icon={FileText} count={logCounts.fallback}>PDF fallback</FilterButton>
              <FilterButton active={filter === "failures"} onClick={() => setFilter("failures")} icon={AlertTriangle} count={logCounts.failures}>Erori</FilterButton>
            </AdminTabsContainer>
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Cauta model, utilizator, job, eroare sau preview"
            />
          </div>

          {warning ? <div className="error-state" role="alert">{warning}</div> : null}

          {filteredRows.length ? (
            <>
              <AdminTable
                minWidth={1300}
                columns={[
                  { key: "review", label: "" },
                  { key: "createdAt", label: "Cand" },
                  { key: "scope", label: "Tip" },
                  { key: "operation", label: "Endpoint" },
                  { key: "provider", label: "Provider" },
                  { key: "job", label: "Job" },
                  { key: "stage", label: "Stage" },
                  { key: "model", label: "Model" },
                  { key: "reasoning", label: "Reasoning" },
                  { key: "cost", label: "Cost" },
                  { key: "duration", label: "Durata" },
                  { key: "summary", label: "Sumar" },
                  { key: "details", label: "Actiune" }
                ]}
              >
                {pageData.rows.map((row) => {
                  const needsReview = row.status === "failed" || row.job_status === "failed";

                  return (
                  <tr key={row.id} className={needsReview ? "has-admin-review" : undefined}>
                    <td className="admin-review-cell">
                      <ReviewDot show={needsReview} label="Procesare de verificat" />
                    </td>
                    <td><span className="admin-table-date-cell">{formatDate(row.created_at)}</span></td>
                    <td><CellPill>{formatScopeLabel(row.request_scope)}</CellPill></td>
                    <td>{formatOperationLabel(row.operation)}</td>
                    <td>
                      <CellPill tone={formatOpenAIStatusTone(row.status)}>
                        {row.status === "succeeded" ? "Succes" : "Eroare"}
                      </CellPill>
                    </td>
                    <td>
                      <CellPill tone={formatJobStatusTone(row.job_status)}>
                        {formatJobStatusLabel(row.job_status)}
                      </CellPill>
                    </td>
                    <td>{formatJobStageLabel(row.job_stage)}</td>
                    <td>{row.model || "-"}</td>
                    <td>{row.reasoning_effort || "-"}</td>
                    <td>
                      <div className="admin-openai-cost-cell">
                        <strong>{formatUsd(row.cost_estimate_usd || 0)}</strong>
                        <span>{formatPricingStatusLabel(row.cost_pricing_status)}</span>
                      </div>
                    </td>
                    <td>{`${row.duration_ms || 0} ms`}</td>
                    <td className="admin-openai-summary-cell">
                      <div className="admin-openai-summary-text" title={buildSummary(row)}>
                        {buildSummary(row)}
                      </div>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-link secondary admin-toggle-btn"
                        onClick={() => setSelectedRow(row)}
                      >
                        Vezi
                      </button>
                    </td>
                  </tr>
                );
                })}
              </AdminTable>
              <PaginationControls page={pageData.page} totalPages={pageData.totalPages} onChange={setPage} />
            </>
          ) : (
            <div className="workspace-context-summary">
              <strong>Nu exista loguri pentru filtrul ales.</strong>
              <span>Schimba filtrul sau repeta uploadul ca sa vezi apelurile de procesare.</span>
            </div>
          )}

          <OpenAILogDetailModal row={selectedRow} onClose={() => setSelectedRow(null)} />
        </>
      )}
      </div>
    </section>
  );
}
