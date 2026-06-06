"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import { getJobPresentation } from "@/lib/ai/job-presentation";

const DISMISSED_KEY = "ai_job_notifier_dismissed";
const ACTIVE_POLL_MS = 7000;
const PROCESS_POLL_MS = 2200;
const IMPORT_ACTIVE_STATUSES = new Set(["uploaded", "extracting", "chunking", "processing", "matching_answers"]);

function readDismissedIds() {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(DISMISSED_KEY) || "[]");
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function writeDismissedIds(ids) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(Array.from(new Set(ids)).slice(-30)));
}

function dismissalKey(job, kind) {
  const jobKind = job?.kind || "generation";
  if (kind === "active") {
    return `active:${jobKind}:${job?.id}`;
  }

  return `terminal:${jobKind}:${job?.id}:${job?.status}`;
}

function formatTimeEstimate(seconds) {
  if (!Number.isFinite(seconds) || seconds <= 0) {
    return "mai poate dura cateva minute";
  }

  if (seconds < 60) {
    return "sub 1 min ramas";
  }

  const minutes = Math.max(1, Math.round(seconds / 60));
  return `aprox. ${minutes} min ramase`;
}

function jobTitle(job) {
  return (
    job?.title ||
    job?.fileName ||
    job?.metadata?.sourceFilename ||
    job?.metadata?.lastKnownSubjectLabel ||
    job?.metadata?.subjectLabel ||
    "Fisier incarcat"
  );
}

function jobHref(job) {
  if (!job) {
    return "/materiale";
  }

  if (job.kind === "import") {
    return job.href || `/materiale/imports/${job.id}`;
  }

  if (job.status === "succeeded") {
    return job.reviewHref || job.resultHref || `/materiale/jobs/${job.id}`;
  }

  return `/materiale/jobs/${job.id}`;
}

function isActiveJob(job) {
  if (job?.kind === "import") {
    return IMPORT_ACTIVE_STATUSES.has(job.status);
  }

  return job?.status === "pending" || job?.status === "processing";
}

export function AIJobGlobalNotifier() {
  const [monitor, setMonitor] = useState({ activeJobs: [], terminalJob: null });
  const [dismissedIds, setDismissedIds] = useState([]);
  const [isReady, setIsReady] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const activeJobsRef = useRef([]);

  useEffect(() => {
    setDismissedIds(readDismissedIds());
    setIsReady(true);
  }, []);

  useEffect(() => {
    const intervalId = window.setInterval(() => setNowMs(Date.now()), 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    let isCancelled = false;
    let timeoutId = null;
    let inFlight = false;

    function scheduleLoad(delayMs) {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(loadMonitor, delayMs);
    }

    async function loadMonitor() {
      if (inFlight) {
        return;
      }

      inFlight = true;
      let nextPollMs = null;

      try {
        const response = await fetch("/api/materiale/jobs/monitor", {
          cache: "no-store",
          headers: {
            Accept: "application/json"
          }
        });

        if (response.status === 401) {
          if (!isCancelled) {
            setMonitor({ activeJobs: [], terminalJob: null });
          }
          return;
        }

        if (!response.ok) {
          throw new Error("monitor_failed");
        }

        const payload = await response.json();
        const activeJobs = Array.isArray(payload.activeJobs) ? payload.activeJobs : [];
        nextPollMs = activeJobs.length ? ACTIVE_POLL_MS : null;

        if (!isCancelled) {
          setMonitor({
            activeJobs,
            terminalJob: payload.terminalJob || null
          });
        }
      } catch {
        if (!isCancelled) {
          setMonitor((current) => current);
        }
      } finally {
        inFlight = false;
        if (!isCancelled && nextPollMs !== null) {
          scheduleLoad(nextPollMs);
        }
      }
    }

    function loadWhenVisible() {
      if (document.visibilityState === "visible") {
        loadMonitor();
      }
    }

    loadMonitor();
    window.addEventListener("focus", loadMonitor);
    document.addEventListener("visibilitychange", loadWhenVisible);

    return () => {
      isCancelled = true;
      window.removeEventListener("focus", loadMonitor);
      document.removeEventListener("visibilitychange", loadWhenVisible);
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isReady]);

  useEffect(() => {
    activeJobsRef.current = monitor.activeJobs || [];
  }, [monitor.activeJobs]);

  useEffect(() => {
    if (!isReady) {
      return undefined;
    }

    if (!activeJobsRef.current.length) {
      return undefined;
    }

    let isCancelled = false;
    let timeoutId = null;
    let inFlight = false;

    function mergeProcessedJob(payload) {
      if (!payload?.id) {
        return;
      }

      setMonitor((current) => {
        const activeJobs = current.activeJobs || [];
        const isActivePayload =
          isActiveJob(payload);

        if (isActivePayload) {
          return {
            ...current,
            activeJobs: activeJobs.map((job) => (job.id === payload.id ? payload : job))
          };
        }

        return {
          ...current,
          activeJobs: activeJobs.filter((job) => job.id !== payload.id),
          terminalJob: payload
        };
      });
    }

    async function processActiveJob() {
      const activeJob = activeJobsRef.current?.[0] || null;

      if (!activeJob || inFlight) {
        return;
      }

      inFlight = true;

      try {
        const processHref =
          activeJob.kind === "import"
            ? `/api/import/${activeJob.id}/process`
            : `/api/materiale/jobs/${activeJob.id}/process`;
        const response = await fetch(processHref, {
          method: "POST",
          credentials: "same-origin",
          headers: {
            Accept: "application/json"
          }
        });
        const payload = await response.json().catch(() => null);
        const normalizedPayload =
          activeJob.kind === "import" && payload?.importJobId
            ? {
                ...activeJob,
                ...payload,
                kind: "import",
                id: payload.importJobId,
                href: `/materiale/imports/${payload.importJobId}`,
                fileName: payload.fileName || activeJob.fileName,
                title: payload.fileName || payload.title || activeJob.title,
                progressPercent:
                  Number.isFinite(payload.progressPercent)
                    ? payload.progressPercent
                    : payload.totalChunks > 0
                    ? Math.round((payload.processedChunks / Math.max(payload.totalChunks, 1)) * 100)
                    : activeJob.progressPercent,
                updatedAt: payload.updatedAt || new Date().toISOString(),
                completedAt: payload.completedAt || activeJob.completedAt,
                lastHeartbeatAt: payload.updatedAt || new Date().toISOString(),
                lastProgressAt: payload.updatedAt || new Date().toISOString(),
                message: payload.message || activeJob.message,
                metadata: {
                  ...(activeJob.metadata || {}),
                  sourceFilename: payload.fileName || activeJob.metadata?.sourceFilename,
                  importStatus: payload.status
                }
              }
            : payload;

        if (!isCancelled && response.ok && normalizedPayload) {
          mergeProcessedJob(normalizedPayload);
        }
      } catch {
        // The monitor GET loop remains the source of truth if a processing tick fails.
      } finally {
        inFlight = false;
        if (!isCancelled && activeJobsRef.current.length) {
          timeoutId = window.setTimeout(processActiveJob, PROCESS_POLL_MS);
        }
      }
    }

    timeoutId = window.setTimeout(processActiveJob, 300);

    return () => {
      isCancelled = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
    };
  }, [isReady, monitor.activeJobs]);

  const notification = useMemo(() => {
    const activeJobs = monitor.activeJobs || [];
    const visibleActiveJobs = activeJobs.filter((job) => !dismissedIds.includes(dismissalKey(job, "active")));
    if (visibleActiveJobs.length) {
      return {
        kind: "active",
        job: visibleActiveJobs[0],
        extraCount: Math.max(activeJobs.length - 1, 0)
      };
    }

    const terminalJob = monitor.terminalJob;
    if (
      terminalJob &&
      !dismissedIds.includes(terminalJob.id) &&
      !dismissedIds.includes(dismissalKey(terminalJob, "terminal"))
    ) {
      return {
        kind: "terminal",
        job: terminalJob,
        extraCount: 0
      };
    }

    return null;
  }, [dismissedIds, monitor]);

  if (!notification) {
    return null;
  }

  const { kind, job, extraCount } = notification;
  const isActive = kind === "active";
  const isFailed = job.status === "failed";
  const href = jobHref(job);
  const presentation = getJobPresentation(job, nowMs);

  function dismiss() {
    const nextIds = [...dismissedIds, dismissalKey(job, kind)];
    setDismissedIds(nextIds);
    writeDismissedIds(nextIds);
  }

  return (
    <aside
      className={`ai-job-notifier ${isActive ? "is-active" : ""} ${isFailed ? "is-failed" : "is-ready"}`}
      role="status"
      aria-live="polite"
    >
      <div className="ai-job-notifier-top">
        <span className="ai-job-notifier-dot" aria-hidden="true" />
        <div className="ai-job-notifier-copy">
          <strong>{presentation.title}</strong>
          <span>{jobTitle(job)}</span>
        </div>
        <button
          type="button"
          className="ai-job-notifier-close feedback-modal-close"
          onClick={dismiss}
          aria-label="Inchide notificarea"
        >
          Inchide
        </button>
      </div>

      {isActive ? (
        <>
          {presentation.shouldShowProgressPercent ? (
            <div className="ai-job-notifier-progress" aria-label={`Progres ${presentation.progressPercent}%`}>
              <span style={{ width: `${presentation.progressPercent}%` }} />
            </div>
          ) : null}
          <div className="ai-job-notifier-meta">
            <span>{presentation.progressLabel}</span>
            <span>{presentation.stageLabel}</span>
            <span>{formatTimeEstimate(job.estimatedRemainingSeconds)}</span>
          </div>
          <div className="ai-job-notifier-meta">
            <span>{`astepti ${presentation.elapsedLabel}`}</span>
            <span>{`activ ${presentation.lastActivityLabel}`}</span>
          </div>
          {presentation.detailMessage || presentation.primaryMessage ? (
            <p className="ai-job-notifier-message">
              {presentation.detailMessage || presentation.primaryMessage}
            </p>
          ) : null}
          {extraCount ? <div className="ai-job-notifier-extra">{`+ inca ${extraCount} in procesare`}</div> : null}
        </>
      ) : (
        <>
          {presentation.shouldShowProgressPercent ? (
            <div className="ai-job-notifier-progress" aria-label={`Progres ${presentation.progressPercent}%`}>
              <span style={{ width: `${presentation.progressPercent}%` }} />
            </div>
          ) : null}
          <div className="ai-job-notifier-meta">
            <span>{presentation.progressLabel}</span>
            <span>{presentation.statusLabel}</span>
            <span>{`${presentation.elapsedCaption.toLowerCase()} ${presentation.elapsedLabel}`}</span>
          </div>
          <p className="ai-job-notifier-message">{presentation.primaryMessage}</p>
        </>
      )}

      <Link className="ai-job-notifier-link" href={href}>
        {isActive ? "Vezi progresul" : isFailed ? "Vezi detaliile" : "Deschide"}
      </Link>
    </aside>
  );
}
