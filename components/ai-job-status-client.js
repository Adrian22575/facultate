"use client";

import { ArrowLeft, CheckCircle2, ExternalLink, RefreshCw, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { deleteQuestionBankUploadAction } from "@/app/ai/actions";
import { LoadingIconText } from "@/components/loading-spinner";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import {
  formatGenerationError,
  getJobPresentation
} from "@/lib/ai/job-presentation";

const MAX_POLLING_SERVER_ERRORS = 3;

function IconText({ icon: Icon, children }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

function getFinalFailureReason(job) {
  return job?.finalFailureReason || job?.metadata?.finalFailureReason || null;
}

function isTerminal(job) {
  return job?.status === "succeeded" || (job?.status === "failed" && !job?.canRetryFailedChunks);
}

function formatJobError(errorMessage) {
  return formatGenerationError(errorMessage);
}

function buildFailureSummary(job) {
  const summary = job?.metadata?.consolidationSummary;
  const diagnostics = job?.consolidationDiagnostics || job?.metadata?.consolidationDiagnostics || null;
  const estimatedItems =
    Number(diagnostics?.estimatedItems || job?.metadata?.estimatedItems || 0) || 0;

  if (!summary && !estimatedItems) {
    return null;
  }

  const acceptedCount = Number(diagnostics?.acceptedCount || summary?.acceptedCount || 0) || 0;
  const needsReviewCount = Number(diagnostics?.needsReviewCount || summary?.needsReviewCount || 0) || 0;
  const duplicateCount = Number(diagnostics?.duplicateCount || summary?.duplicateCount || 0) || 0;
  const rejectedCount = Number(diagnostics?.rejectedCount || summary?.rejectedCount || 0) || 0;
  const coverageTargetCount =
    Number(diagnostics?.coverageTargetCount || diagnostics?.publishableThreshold || 0) || 0;
  const coveragePercent =
    Number(
      diagnostics?.coveragePercent ||
        (coverageTargetCount > 0 ? Math.round((acceptedCount / coverageTargetCount) * 100) : 0)
    ) || 0;
  const unusableCount = Math.max(rejectedCount + duplicateCount, Math.max(estimatedItems - acceptedCount, 0));

  return [
    estimatedItems
      ? { label: "Am gasit aproximativ", value: `${estimatedItems} intrebari` }
      : null,
    { label: "Au ramas bune", value: String(acceptedCount) },
    { label: "Cer verificare", value: String(needsReviewCount) },
    coverageTargetCount ? { label: "Acoperire", value: `${coveragePercent}%` } : null,
    { label: "Nu au putut fi folosite", value: String(unusableCount) }
  ].filter(Boolean);
}

function buildFailureTips(job) {
  const tips = [
    "Foloseste un fisier unde fiecare intrebare are variantele scrise clar.",
    "Pastreaza raspunsul corect usor de recunoscut.",
    "Evita paginile unde textul este taiat sau amestecat."
  ];

  if (String(job?.metadata?.sourceFilename || "").toLowerCase().endsWith(".pdf")) {
    tips.push("Verifica daca toate variantele apar complet in PDF.");
  }

  return tips;
}

function buildFailurePresentation(job) {
  if (!job || job.status !== "failed") {
    return null;
  }

  const normalizedError = String(job.errorMessage || "").toLowerCase();
  const normalizedDetail = String(job.statusDetail || "").toLowerCase();
  const finalFailureReason = getFinalFailureReason(job);
  const isConsolidationFailure =
    normalizedError.includes("nu am obtinut suficienti itemi validi") ||
    normalizedError.includes("nu am putut pregati suficient de multe intrebari clare") ||
    normalizedError.includes("am extras intrebari, dar prea multe au fost eliminate") ||
    normalizedError.includes("analiza mai atenta a pdf-ului") ||
    normalizedError.includes("nu am putut salva banca finala") ||
    normalizedError.includes("nu am putut finaliza pregatirea pentru verificare") ||
    job?.metadata?.processingMode === "pdf_fallback_failed" ||
    job?.metadata?.processingMode === "pdf_fallback_timeout" ||
    Boolean(finalFailureReason) ||
    normalizedDetail.includes("ne-am oprit la ultima verificare") ||
    Boolean(job?.metadata?.consolidationSummary);

  if (isConsolidationFailure) {
    const isPdfFallbackFailure =
      normalizedError.includes("analiza mai atenta a pdf-ului") ||
      finalFailureReason === "pdf_fallback_not_publishable" ||
      finalFailureReason === "pdf_fallback_persist_failed" ||
      finalFailureReason === "pdf_fallback_review_finalize_failed" ||
      job?.metadata?.processingMode === "pdf_fallback_failed" ||
      job?.metadata?.processingMode === "pdf_fallback_timeout" ||
      job?.metadata?.processingMode === "pdf_fallback_not_publishable" ||
      job?.metadata?.processingMode === "pdf_fallback_persist_failed" ||
      job?.metadata?.processingMode === "pdf_fallback_review_finalize_failed";
    const isPersistFailure =
      finalFailureReason === "question_bank_persist_failed" ||
      finalFailureReason === "pdf_fallback_persist_failed";
    const isReviewFailure =
      finalFailureReason === "review_finalize_failed" ||
      finalFailureReason === "pdf_fallback_review_finalize_failed";
    const isTooFewValidItems = finalFailureReason === "consolidation_too_few_valid_items";
    const isPdfFallbackNotPublishable = finalFailureReason === "pdf_fallback_not_publishable";

    return {
      primary: isPdfFallbackNotPublishable
        ? "Fisierul a fost analizat, dar rezultatul nu a avut suficiente intrebari clare pentru publicare."
        : isPdfFallbackFailure
        ? "Analiza mai atenta a PDF-ului nu a putut fi finalizata."
        : isPersistFailure
          ? "Am extras intrebarile, dar nu am putut salva banca finala."
          : isReviewFailure
            ? "Am extras intrebarile, dar nu am putut finaliza pregatirea pentru verificare."
            : isTooFewValidItems
              ? "Am extras intrebari, dar prea multe au fost eliminate la verificarea finala."
              : "Nu am putut pregati suficient de multe intrebari clare din acest fisier.",
      detail: isPdfFallbackNotPublishable
        ? "Fisierul a fost analizat, dar dupa verificare au ramas prea putine intrebari publicabile."
        : isPdfFallbackFailure
        ? "Poti relua procesarea sau reincarca un fisier mai clar daca problema revine."
        : isPersistFailure
          ? "Problema a aparut dupa verificarea finala, in etapa de salvare a bancii."
          : isReviewFailure
            ? "Problema a aparut dupa salvarea bancii, in pasul final de pregatire pentru verificare."
            : "Unele intrebari au fost incomplete, repetate sau raspunsul corect nu a fost destul de clar.",
      summary: buildFailureSummary(job),
      tips: buildFailureTips(job)
    };
  }

  return {
    primary: formatJobError(job.errorMessage),
    detail: null,
    summary: null,
    tips: []
  };
}

function canDeleteJob(job) {
  if (!job || job.activityState === "deleted") {
    return false;
  }

  if (job.bankStatus === "published") {
    return false;
  }

  if (job.status === "pending" || job.status === "processing" || job.status === "failed") {
    return true;
  }

  return job.status === "succeeded" && job.bankStatus === "review";
}

function buildTerminalFailedJob(job, { errorMessage, statusDetail }) {
  if (!job) {
    return job;
  }

  return {
    ...job,
    status: "failed",
    stage: "failed",
    errorMessage,
    statusDetail: statusDetail || job.statusDetail || null,
    canRetryFailedChunks: false
  };
}

function LoadingGlyph() {
  return (
    <div className="job-loading-glyph" aria-hidden="true">
      <svg viewBox="0 0 64 64" className="job-loading-svg">
        <circle className="job-loading-track" cx="32" cy="32" r="22" />
        <circle className="job-loading-ring" cx="32" cy="32" r="22" />
        <circle className="job-loading-core" cx="32" cy="32" r="6" />
      </svg>
    </div>
  );
}

function ConfirmDialog({ confirmState, isPending, onClose, onConfirm }) {
  if (!confirmState) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" role="presentation">
      <div
        className="workspace-modal-card review-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="job-delete-confirm-title"
      >
        <div className="workspace-modal-head">
          <div>
            <strong id="job-delete-confirm-title">{confirmState.title}</strong>
            <p>{confirmState.copy}</p>
          </div>
          <button
            className="workspace-modal-close feedback-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Inchide"
            disabled={isPending}
          >
            <IconText icon={X}>Inchide</IconText>
          </button>
        </div>

        <div className="workspace-modal-form">
          <div className="inline-actions">
            <button type="button" className="secondary review-delete-btn" onClick={onConfirm} disabled={isPending}>
              <LoadingIconText icon={Trash2} loading={isPending} loadingLabel="Se sterge...">
                Da, sterge
              </LoadingIconText>
            </button>
            <button type="button" className="btn-link secondary" onClick={onClose} disabled={isPending}>
              <IconText icon={X}>Renunta</IconText>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AIJobStatusClient({ initialJob }) {
  const router = useRouter();
  const [job, setJob] = useState(initialJob);
  const [isRetrying, setIsRetrying] = useState(false);
  const [isDeleting, startDeleteTransition] = useTransition();
  const [deleteError, setDeleteError] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [nowMs, setNowMs] = useState(null);
  const timeoutRef = useRef(null);
  const inFlightRef = useRef(false);
  const deletedRef = useRef(false);
  const jobRef = useRef(initialJob);
  const consecutiveServerErrorsRef = useRef(0);

  useEffect(() => {
    jobRef.current = job;
  }, [job]);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function tick() {
      const currentJob = jobRef.current;

      if (
        cancelled ||
        inFlightRef.current ||
        deletedRef.current ||
        !currentJob ||
        isTerminal(currentJob) ||
        currentJob.status === "failed"
      ) {
        return;
      }

      inFlightRef.current = true;

      try {
        const response = await fetch(`/api/materiale/jobs/${currentJob.id}`, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });
        const payload = await response.json().catch(() => null);

        if (!cancelled && (response.status === 404 || payload?.error === "not_found")) {
          deletedRef.current = true;
          router.push("/materiale?message=Fisierul%20a%20fost%20sters.");
          return;
        }

        if (
          !cancelled &&
          !response.ok &&
          typeof payload?.error === "string" &&
          payload.error.toLowerCase().includes("jobul nu exista")
        ) {
          deletedRef.current = true;
          router.push("/materiale?message=Fisierul%20a%20fost%20sters.");
          return;
        }

        if (!cancelled && response.status === 503 && payload?.code === "setup_incomplete") {
          consecutiveServerErrorsRef.current = 0;
          setJob((currentJob) =>
            buildTerminalFailedJob(currentJob, {
              errorMessage:
                typeof payload?.error === "string"
                  ? payload.error
                  : "Setup-ul pentru procesarea fisierelor nu este complet.",
              statusDetail: "Polling-ul a fost oprit pana cand migrarile lipsa sunt aplicate."
            })
          );
          return;
        }

        if (!cancelled && payload && response.ok) {
          consecutiveServerErrorsRef.current = 0;
          setJob(payload);
          return;
        }

        if (!cancelled && !response.ok) {
          consecutiveServerErrorsRef.current += 1;

          if (consecutiveServerErrorsRef.current >= MAX_POLLING_SERVER_ERRORS) {
            setJob((currentJob) =>
              buildTerminalFailedJob(currentJob, {
                errorMessage:
                  "Procesarea s-a oprit temporar dupa mai multe erori consecutive de server.",
                statusDetail:
                  "Reincarca pagina dupa ce verifici setup-ul local sau logurile serverului."
              })
            );
          }
        }
      } finally {
        inFlightRef.current = false;
        if (!cancelled) {
          timeoutRef.current = window.setTimeout(tick, 2200);
        }
      }
    }

    timeoutRef.current = window.setTimeout(tick, 250);

    return () => {
      cancelled = true;
      if (timeoutRef.current) {
        window.clearTimeout(timeoutRef.current);
      }
    };
  }, [job?.id, router]);

  async function handleRetryFailedChunks() {
    if (!job?.canRetryFailedChunks || isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      const response = await fetch(`/api/materiale/jobs/${job.id}/process`, {
        method: "POST",
        credentials: "same-origin"
      });
      const payload = await response.json().catch(() => null);
      if (response.status === 503 && payload?.code === "setup_incomplete") {
        setJob((currentJob) =>
          buildTerminalFailedJob(currentJob, {
            errorMessage:
              typeof payload?.error === "string"
                ? payload.error
                : "Setup-ul pentru procesarea fisierelor nu este complet.",
            statusDetail: "Retry-ul a fost oprit pana cand migrarile lipsa sunt aplicate."
          })
        );
      } else if (payload && response.ok) {
        consecutiveServerErrorsRef.current = 0;
        setJob(payload);
      }
    } finally {
      setIsRetrying(false);
    }
  }

  async function handleResumeProcessing() {
    if (!job?.canResumeProcessing || isRetrying) {
      return;
    }

    setIsRetrying(true);
    try {
      const response = await fetch(`/api/materiale/jobs/${job.id}/process`, {
        method: "POST",
        credentials: "same-origin"
      });
      const payload = await response.json().catch(() => null);

      if (payload && response.ok) {
        consecutiveServerErrorsRef.current = 0;
        setJob(payload);
      }
    } finally {
      setIsRetrying(false);
    }
  }

  function closeDeleteConfirm() {
    if (isDeleting) {
      return;
    }

    setConfirmState(null);
  }

  function handleDeleteClick() {
    setDeleteError("");
    setConfirmState({
      title: "Stergi acest fisier?",
      copy:
        job?.status === "failed"
          ? "Fisierul s-a oprit deja. Daca il stergi, dispare complet din activitatea ta."
          : "Oprim acest upload si stergem intrebarile scoase din el. Materia ramane in catalog."
    });
  }

  function handleConfirmDelete() {
    if (!job?.id) {
      return;
    }

    deletedRef.current = true;
    if (timeoutRef.current) {
      window.clearTimeout(timeoutRef.current);
    }
    inFlightRef.current = false;
    setDeleteError("");

    startDeleteTransition(async () => {
      try {
        const result = await deleteQuestionBankUploadAction({
          jobId: job.id
        });

        if (!result?.ok || !result.redirectTo) {
          throw new Error("Nu am putut sterge acest fisier acum.");
        }

        router.push(result.redirectTo);
      } catch (error) {
        deletedRef.current = false;
        setConfirmState(null);
        setDeleteError(
          error instanceof Error ? error.message : "Nu am putut sterge acest fisier acum."
        );
      }
    });
  }

  if (!job) {
    return <div className="error-state">Jobul nu a putut fi incarcat.</div>;
  }

  const initialTimestamp = Date.parse(job?.startedAt || job?.createdAt || "");
  const effectiveNowMs = nowMs ?? (Number.isFinite(initialTimestamp) ? initialTimestamp : Date.now());
  const presentation = getJobPresentation(job, effectiveNowMs);
  const failurePresentation = buildFailurePresentation(job);
  const statusLabel =
    job.status === "pending" || job.status === "processing"
      ? presentation.stageLabel
      : presentation.statusLabel;

  return (
    <div className="job-status-stack">
      {deleteError ? (
        <section className="surface">
          <div className="error-state">{deleteError}</div>
        </section>
      ) : null}

      <section className="surface workspace-job-hero">
        <div className="workspace-job-badge">
          <span className={`status-pill ${presentation.tone}`}>{statusLabel}</span>
        </div>
        {presentation.shouldShowProgressPercent ? (
          <div className="progress-bar-container job-progress-bar" aria-label="Progres procesare">
            <div className="progress-fill" style={{ width: `${presentation.progressPercent}%` }} />
          </div>
        ) : null}

        <div className="job-status-copy workspace-job-copy">
          {job.status === "processing" || job.status === "pending" ? <LoadingGlyph /> : null}
          <strong>{presentation.progressLabel}</strong>
          <p>{presentation.primaryMessage}</p>
          <div className="job-failure-detail">
            {presentation.isTerminal
              ? `${presentation.elapsedCaption}: ${presentation.elapsedLabel}. ${presentation.activityCaption}: ${presentation.lastActivityLabel}.`
              : `Astepti de ${presentation.elapsedLabel}. Activ ${presentation.lastActivityLabel}.`}
          </div>
          {presentation.detailMessage ? (
            <div className="job-failure-detail">{presentation.detailMessage}</div>
          ) : null}
          {failurePresentation?.detail ? (
            <div className="job-failure-detail">{failurePresentation.detail}</div>
          ) : null}
        </div>
      </section>

      {failurePresentation?.summary?.length ? (
        <section className="surface job-failure-surface">
          <div className="dashboard-header">
            <h2>Pe scurt</h2>
          </div>
          <div className="job-failure-summary-grid">
            {failurePresentation.summary.map((item) => (
              <article key={item.label} className="job-failure-summary-card">
                <span>{item.label}</span>
                <strong>{item.value}</strong>
              </article>
            ))}
          </div>
          {failurePresentation.tips?.length ? (
            <div className="job-failure-tips">
              <strong>Ce te ajuta data viitoare</strong>
              <ul className="check-list">
                {failurePresentation.tips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="surface">
        <div className="dashboard-header">
          <h2>Pe scurt</h2>
          <span className="status-pill is-muted">{job.metadata?.examType === "licenta" ? "Licenta" : "Materie"}</span>
        </div>
        <div className="import-count-grid">
          <article>
            <span>Materia</span>
            <strong>{job.metadata?.subjectLabel || "Materie selectata"}</strong>
          </article>
          <article>
            <span>Progres</span>
            <strong>{presentation.progressLabel}</strong>
          </article>
          <article>
            <span>Intrebari pregatite</span>
            <strong>{job.resultQuestionCount || 0}</strong>
          </article>
          <article>
            <span>Stare</span>
            <strong>{presentation.statusLabel}</strong>
          </article>
          <article>
            <span>{presentation.elapsedCaption}</span>
            <strong>{presentation.elapsedLabel}</strong>
          </article>
          <article>
            <span>{presentation.activityCaption}</span>
            <strong>{presentation.lastActivityLabel}</strong>
          </article>
        </div>

        <div className="job-actions">
          {job.status === "succeeded" ? (
            <PendingNavigationLink
              className="btn-back job-primary-cta"
              href={job.reviewHref || job.resultHref}
              pendingLabel="Se deschid intrebarile..."
              pendingMode="replace"
            >
              <IconText icon={CheckCircle2}>Verifica intrebarile</IconText>
            </PendingNavigationLink>
          ) : null}
          {job.status === "succeeded" && job.bankStatus === "published" ? (
            <PendingNavigationLink
              className="btn-link secondary"
              href={job.resultHref}
              pendingLabel={
                job.metadata?.examType === "licenta"
                  ? "Se deschide simularea..."
                  : "Se deschide materia..."
              }
              pendingMode="replace"
            >
              <IconText icon={ExternalLink}>
                {job.metadata?.examType === "licenta" ? "Deschide simularea" : "Deschide materia"}
              </IconText>
            </PendingNavigationLink>
          ) : null}
          {job.canRetryFailedChunks ? (
            <button type="button" className="btn-back" onClick={handleRetryFailedChunks} disabled={isRetrying}>
              <LoadingIconText icon={RefreshCw} loading={isRetrying} loadingLabel="Incercam din nou...">
                Incearca din nou
              </LoadingIconText>
            </button>
          ) : null}
          {job.canResumeProcessing ? (
            <button type="button" className="btn-back" onClick={handleResumeProcessing} disabled={isRetrying}>
              <LoadingIconText icon={RefreshCw} loading={isRetrying} loadingLabel="Reluam...">
                {job.metadata?.examType === "licenta" &&
                (job.metadata?.sourceKind === "pdf" ||
                  String(job.metadata?.sourceFilename || "").toLowerCase().endsWith(".pdf"))
                  ? "Reia procesarea fisierului"
                  : "Reia procesarea"}
              </LoadingIconText>
            </button>
          ) : null}
          {canDeleteJob(job) ? (
            <button
              type="button"
              className="secondary review-delete-btn"
              onClick={handleDeleteClick}
              disabled={isDeleting}
            >
              <LoadingIconText icon={Trash2} loading={isDeleting} loadingLabel="Se sterge...">
                Sterge fisierul
              </LoadingIconText>
            </button>
          ) : null}
          <PendingNavigationLink
            className="btn-link secondary"
            href="/materiale"
            pendingLabel="Se revine..."
            pendingMode="replace"
          >
            <IconText icon={ArrowLeft}>Inapoi</IconText>
          </PendingNavigationLink>
        </div>
      </section>

      <ConfirmDialog
        confirmState={confirmState}
        isPending={isDeleting}
        onClose={closeDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />
    </div>
  );
}
