"use client";

import { useMemo, useState, useTransition } from "react";

import { deleteQuestionBankJobActivityAction } from "@/app/ai/actions";
import { LoadingIconText } from "@/components/loading-spinner";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { getJobPresentation } from "@/lib/ai/job-presentation";
import { useDialogFocus } from "@/lib/ui/dialog";

function ConfirmDialog({ confirmState, isPending, onClose, onConfirm }) {
  const dialogRef = useDialogFocus(Boolean(confirmState), () => {
    if (!isPending) onClose();
  });

  if (!confirmState) {
    return null;
  }

  return (
    <div className="workspace-modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="workspace-modal-card review-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-history-confirm-title"
      >
        <div className="workspace-modal-head">
          <div>
            <strong id="workspace-history-confirm-title">{confirmState.title}</strong>
            <p>{confirmState.copy}</p>
          </div>
          <button
            className="workspace-modal-close feedback-modal-close"
            type="button"
            onClick={onClose}
            aria-label="Inchide"
            disabled={isPending}
          >
            Inchide
          </button>
        </div>

        <div className="workspace-modal-form">
          <div className="inline-actions">
            <button type="button" className="secondary review-delete-btn" onClick={onConfirm} disabled={isPending}>
              <LoadingIconText loading={isPending} loadingLabel="Se sterge...">
                Da, sterge
              </LoadingIconText>
            </button>
            <button type="button" className="btn-link secondary" onClick={onClose} disabled={isPending}>
              Renunta
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function WorkspaceJobHistoryClient({ initialJobs }) {
  const [jobs, setJobs] = useState(initialJobs || []);
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [confirmState, setConfirmState] = useState(null);
  const [isMutating, startTransition] = useTransition();

  const visibleJobs = useMemo(() => jobs || [], [jobs]);

  function closeDeleteConfirm() {
    if (isMutating) {
      return;
    }

    setConfirmState(null);
  }

  function handleDelete(job) {
    setFeedback("");
    setErrorMessage("");
    setConfirmState({
      jobId: job.id,
      title: "Stergi aceasta intrare?",
      copy: "Dispare din activitatea ta. Materia si alte fisiere nu sunt afectate."
    });
  }

  function handleConfirmDelete() {
    if (!confirmState?.jobId) {
      return;
    }

    setFeedback("");
    setErrorMessage("");

    startTransition(async () => {
      try {
        const result = await deleteQuestionBankJobActivityAction({
          jobId: confirmState.jobId
        });

        if (!result?.ok) {
          throw new Error("Nu am putut sterge aceasta intrare acum.");
        }

        setJobs((current) => current.filter((job) => job.id !== confirmState.jobId));
        setConfirmState(null);
        setFeedback(result.message || "Intrarea a fost stearsa.");
      } catch (error) {
        setConfirmState(null);
        setErrorMessage(
          error instanceof Error ? error.message : "Nu am putut sterge aceasta intrare acum."
        );
      }
    });
  }

  return (
    <>
      {feedback ? <div className="success-state workspace-inline-feedback" role="status">{feedback}</div> : null}
      {errorMessage ? <div className="error-state workspace-inline-feedback" role="alert">{errorMessage}</div> : null}

      {visibleJobs.length ? (
        <div className="draft-list ai-workspace-history-list">
          {visibleJobs.map((job) => {
            const presentation = getJobPresentation(job);
            const isImport = job.kind === "import";
            const href = isImport ? job.href || `/materiale/imports/${job.id}` : `/materiale/jobs/${job.id}`;
            const title =
              job.metadata?.lastKnownSubjectLabel ||
              job.title ||
              job.fileName ||
              job.metadata?.subjectLabel ||
              "Fisier incarcat";

            return (
            <article key={job.id} className="ai-workspace-history-card ui-panel-card">
              <div className="ai-workspace-history-card-head">
                <div className="ai-workspace-history-card-copy">
                  <span className={`status-pill ${presentation.tone}`}>{presentation.statusLabel}</span>
                  <strong>{title}</strong>
                  <p className="choice-row-meta">{presentation.primaryMessage}</p>
                  <p className="choice-row-meta">
                    {presentation.isTerminal
                      ? `${presentation.progressLabel} - ${presentation.elapsedCaption}: ${presentation.elapsedLabel}`
                      : `${presentation.progressLabel} - Astepti de ${presentation.elapsedLabel}`}
                  </p>
                  <p className="choice-row-meta">
                    {new Date(job.createdAt).toLocaleString("ro-RO")}
                  </p>
                </div>
                <div className="inline-actions ai-workspace-history-actions">
                  {job.activityState !== "deleted" ? (
                    <PendingNavigationLink
                      className="btn-link secondary"
                      href={href}
                      pendingLabel="Se deschide..."
                      pendingMode="replace"
                    >
                      Deschide
                    </PendingNavigationLink>
                  ) : null}
                  {(job.status === "succeeded" || job.status === "ready_for_preview") && job.activityState !== "deleted" ? (
                    <PendingNavigationLink
                      className="btn-back job-primary-cta"
                      href={isImport ? href : job.reviewHref || job.resultHref}
                      pendingLabel={isImport ? "Se deschide importul..." : "Se deschid intrebarile..."}
                      pendingMode="replace"
                    >
                      {isImport ? "Verifica importul" : "Verifica intrebarile"}
                    </PendingNavigationLink>
                  ) : null}
                  {job.status === "succeeded" &&
                  job.bankStatus === "published" &&
                  job.activityState !== "deleted" ? (
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
                      {job.metadata?.examType === "licenta"
                        ? "Deschide simularea"
                        : "Deschide materia"}
                    </PendingNavigationLink>
                  ) : null}
                  {job.activityState === "deleted" && !isImport ? (
                    <button
                      type="button"
                      className="secondary review-delete-btn"
                      onClick={() => handleDelete(job)}
                    >
                      Sterge
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
            );
          })}
        </div>
      ) : (
        <div className="draft-card review-empty-card ui-panel-card ai-workspace-history-empty">
          <strong>Nu mai exista fisiere recente.</strong>
          <p className="page-copy">Aici vei vedea urmatoarele uploaduri si modificarile lor.</p>
        </div>
      )}

      <ConfirmDialog
        confirmState={confirmState}
        isPending={isMutating}
        onClose={closeDeleteConfirm}
        onConfirm={handleConfirmDelete}
      />
    </>
  );
}
