"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { getJobPresentation } from "@/lib/ai/job-presentation";

const IMPORT_ACTIVE_STATUSES = new Set(["uploaded", "extracting", "chunking", "processing", "matching_answers"]);

function HighlightIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 3h7l5 5v13H7z" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M14 3v6h5" fill="none" stroke="currentColor" strokeWidth="2" />
      <path d="M9 14h6M9 17h6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function AIWorkspaceHighlightCard({ initialJob }) {
  const [job, setJob] = useState(initialJob);
  const [nowMs, setNowMs] = useState(null);
  const inFlightRef = useRef(false);
  const initialTimestamp = Date.parse(job?.startedAt || job?.createdAt || "");
  const effectiveNowMs = nowMs ?? (Number.isFinite(initialTimestamp) ? initialTimestamp : Date.now());
  const presentation = useMemo(
    () => getJobPresentation(job, effectiveNowMs),
    [effectiveNowMs, job]
  );

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const isActive =
      job?.kind === "import"
        ? IMPORT_ACTIVE_STATUSES.has(job.status)
        : job?.status === "pending" || job?.status === "processing";

    if (!job?.id || !isActive) {
      return undefined;
    }

    let cancelled = false;
    let timeoutId = null;

    async function tick() {
      if (cancelled || inFlightRef.current) {
        return;
      }

      inFlightRef.current = true;
      try {
        const statusHref =
          job.kind === "import" ? `/api/import/${job.id}/status` : `/api/materiale/jobs/${job.id}`;
        const response = await fetch(statusHref, {
          method: "GET",
          credentials: "same-origin",
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });
        const payload = await response.json().catch(() => null);
        if (!cancelled && response.ok && (payload?.id || payload?.importJobId)) {
          setJob((current) =>
            current?.kind === "import"
              ? {
                  ...current,
                  ...payload,
                  kind: "import",
                  id: payload.importJobId,
                  href: `/materiale/imports/${payload.importJobId}`,
                  fileName: payload.fileName || current.fileName,
                  title: payload.fileName || payload.title || current.title,
                  progressPercent:
                    payload.totalChunks > 0
                      ? Math.round((payload.processedChunks / Math.max(payload.totalChunks, 1)) * 100)
                      : current.progressPercent,
                  updatedAt: payload.updatedAt || current.updatedAt,
                  lastHeartbeatAt: payload.updatedAt || current.lastHeartbeatAt,
                  lastProgressAt: payload.updatedAt || current.lastProgressAt,
                  completedAt: payload.completedAt || current.completedAt,
                  message: payload.message || current.message,
                  metadata: {
                    ...(current.metadata || {}),
                    sourceFilename: payload.fileName || current.metadata?.sourceFilename,
                    importStatus: payload.status
                  }
                }
              : payload
          );
        }
      } finally {
        inFlightRef.current = false;
        if (!cancelled) {
          timeoutId = window.setTimeout(tick, 2200);
        }
      }
    }

    timeoutId = window.setTimeout(tick, 250);

    return () => {
      cancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [job?.id, job?.status]);

  if (!job) {
    return null;
  }

  const href =
    job.kind === "import"
      ? job.href || `/materiale/imports/${job.id}`
      : job.status === "succeeded"
      ? job.reviewHref || job.resultHref
      : `/materiale/jobs/${job.id}`;

  return (
    <article className={`ai-workspace-highlight-card ui-panel-card ${job.status === "failed" ? "is-warning" : ""}`}>
      <div className="ai-workspace-highlight-top">
        <div className="ai-workspace-highlight-copy">
          <span className="ui-section-label ai-workspace-inline-label">Continutul tau</span>
          <strong>
            {job.metadata?.lastKnownSubjectLabel ||
              job.title ||
              job.fileName ||
              job.metadata?.subjectLabel ||
              "Continut pregatit"}
          </strong>
          <p>{presentation.primaryMessage}</p>
        </div>
        <span className="ui-icon-box" aria-hidden="true">
          <HighlightIcon />
        </span>
      </div>

      <div className="ai-workspace-highlight-footer">
        <span className={`status-pill ${presentation.tone}`}>{presentation.statusLabel}</span>
        <strong className="ai-workspace-highlight-progress">{presentation.progressLabel}</strong>
        <span className="status-pill is-muted ai-workspace-highlight-timer">
          {presentation.isTerminal
            ? `${presentation.elapsedCaption}: ${presentation.elapsedLabel}`
            : `Astepti de ${presentation.elapsedLabel}`}
        </span>
        <Link
          className={job.status === "succeeded" ? "btn-link job-primary-cta" : "btn-link secondary"}
          href={href || "/materiale"}
        >
          {job.status === "succeeded" || job.status === "ready_for_preview"
            ? "Verifica intrebarile"
            : "Vezi continutul"}
        </Link>
      </div>
    </article>
  );
}
