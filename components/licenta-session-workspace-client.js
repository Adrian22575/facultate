"use client";

import { CheckCircle2, ClipboardList, ExternalLink, FileText, Keyboard, ListPlus, LoaderCircle, Trash2, Upload, X } from "lucide-react";
import { useRef, useState } from "react";

import { ImportJobStatusClient } from "@/components/import-job-status-client";
import { LoadingIconText } from "@/components/loading-spinner";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import {
  AI_SOURCE_ACCEPTED_MIME_TYPES,
  AI_SOURCE_UPLOAD_MAX_BYTES,
  AI_SOURCE_UPLOAD_MAX_LABEL
} from "@/lib/ai/upload-limits";
import { useDialogFocus } from "@/lib/ui/dialog";
import { handleTablistKeyDown } from "@/lib/ui/tablist";

const BLOCKING_SET_STATUSES = new Set([
  "uploaded",
  "extracting",
  "chunking",
  "processing",
  "matching_answers",
  "ready_for_preview",
  "needs_review",
  "completed_with_warnings",
  "failed"
]);
const LICENTA_SET_MIN_CHARS = 80;
const AI_SOURCE_ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".txt"];

function formatFileSize(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) {
    return "0 KB";
  }

  if (bytes >= 1024 * 1024) {
    const decimals = bytes >= 10 * 1024 * 1024 ? 0 : 1;
    return `${(bytes / (1024 * 1024)).toFixed(decimals)} MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function isSupportedSourceFile(file) {
  if (!file) {
    return false;
  }

  const normalizedName = file.name.toLowerCase();
  const hasAcceptedExtension = AI_SOURCE_ACCEPTED_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension)
  );
  const hasAcceptedMimeType = file.type
    ? AI_SOURCE_ACCEPTED_MIME_TYPES.includes(file.type)
    : false;

  return hasAcceptedExtension || hasAcceptedMimeType;
}

function IconText({ icon: Icon, children }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

function setStatusLabel(status) {
  if (status === "completed") return "Salvat";
  if (status === "ready_for_preview") return "Corectat, nesalvat";
  if (status === "needs_review" || status === "completed_with_warnings") return "Necesita verificare";
  if (status === "failed") return "Oprit";
  if (status === "processing" || status === "matching_answers") return "In lucru";
  return "Pregatire";
}

function setStatusTone(status) {
  if (status === "completed") return "is-good";
  if (status === "failed" || status === "needs_review" || status === "completed_with_warnings") return "is-warning";
  return "is-muted";
}

function getSetIssueSummary(job) {
  const issues = [];
  const missingAnswers = Number(job.questionsMissingAnswers || 0);
  const needsReview = Number(job.needsReviewCount || 0);
  const duplicateSetWarning = job.metadata?.duplicateSetWarning;

  if (duplicateSetWarning?.detected) {
    return {
      text: duplicateSetWarning.matchedSetIndex
        ? `Pare duplicat cu setul ${duplicateSetWarning.matchedSetIndex}`
        : "Pare duplicat cu un set anterior",
      tone: "is-warning"
    };
  }
  if (missingAnswers > 0) {
    issues.push(`${missingAnswers} fara raspuns`);
  }
  if (needsReview > 0) {
    issues.push(`${needsReview} de verificat`);
  }

  if (issues.length) {
    return {
      text: issues.join(", "),
      tone: "is-warning"
    };
  }

  if (job.status === "completed" || job.status === "completed_with_warnings") {
    return {
      text: "Pregatit pentru licenta",
      tone: "is-good"
    };
  }

  if (job.status === "ready_for_preview") {
    return {
      text: "Corectat, salveaza setul",
      tone: "is-good"
    };
  }

  if (job.status === "failed") {
    return {
      text: "Necesita reprocessare sau eliminare",
      tone: "is-warning"
    };
  }

  return {
    text: "Se proceseaza",
    tone: "is-muted"
  };
}

function hasJobQuestionIssues(job) {
  return Number(job?.questionsMissingAnswers || 0) > 0 || Number(job?.needsReviewCount || 0) > 0;
}

function isJobReadyToSave(job) {
  return job?.status === "ready_for_preview" && !hasJobQuestionIssues(job);
}

function isBlockingJob(job) {
  return BLOCKING_SET_STATUSES.has(job?.status) && (job.status !== "completed_with_warnings" || hasJobQuestionIssues(job));
}

function getSetLabel(job) {
  return job?.setIndex ? `setul ${job.setIndex}` : "setul curent";
}

function summarizeJobs(jobs) {
  return jobs.reduce(
    (summary, job) => ({
      setCount: summary.setCount + 1,
      completedSetCount:
        summary.completedSetCount + (job.status === "completed" || job.status === "completed_with_warnings" ? 1 : 0),
      totalQuestions: summary.totalQuestions + Number(job.totalQuestions || 0),
      questionsWithAnswers: summary.questionsWithAnswers + Number(job.questionsWithAnswers || 0),
      questionsMissingAnswers: summary.questionsMissingAnswers + Number(job.questionsMissingAnswers || 0),
      needsReviewCount: summary.needsReviewCount + Number(job.needsReviewCount || 0)
    }),
    {
      setCount: 0,
      completedSetCount: 0,
      totalQuestions: 0,
      questionsWithAnswers: 0,
      questionsMissingAnswers: 0,
      needsReviewCount: 0
    }
  );
}

function getFinalizeHelpMessage({ error, snapshot }) {
  if (error?.code === "credits_required") {
    return "Nu ai incarcari disponibile pentru finalizare. Mergi la cont si adauga incarcari, apoi revino aici.";
  }

  if (error?.code === "sets_not_saved") {
    return "Exista seturi corectate care nu sunt salvate in licenta. Salveaza fiecare set in licenta, apoi finalizeaza licenta.";
  }

  const jobs = snapshot?.jobs || [];
  const readyToSaveJob = jobs.find(isJobReadyToSave);
  if (readyToSaveJob) {
    return `Salveaza ${getSetLabel(readyToSaveJob)} in licenta inainte de finalizare. Intrebarile sunt corectate, dar setul nu este inca adaugat la licenta.`;
  }

  const openJob = jobs.find(isBlockingJob);
  if (openJob) {
    return `Termina ${getSetLabel(openJob)} inainte de finalizare: verifica intrebarile si salveaza setul in licenta.`;
  }

  const problemJob = jobs.find(
    (job) => Number(job.questionsMissingAnswers || 0) > 0 || Number(job.needsReviewCount || 0) > 0
  );
  if (problemJob) {
    return `Revizuieste setul ${problemJob.setIndex || ""}: mai exista raspunsuri lipsa sau intrebari de verificat.`;
  }

  const rawMessage = error instanceof Error ? error.message : "";
  if (rawMessage && rawMessage !== "Nu am putut finaliza licenta.") {
    return rawMessage;
  }

  return "Finalizarea nu s-a putut incheia acum. Am reincarcat starea licentei; verifica seturile si incearca din nou.";
}

export function LicentaSessionWorkspaceClient({ initialSnapshot }) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [activeJobId, setActiveJobId] = useState(initialSnapshot.activeJob?.id || null);
  const [sourceMode, setSourceMode] = useState("text");
  const [contentText, setContentText] = useState("");
  const [selectedSetFile, setSelectedSetFile] = useState(null);
  const [feedback, setFeedback] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [creditsRequired, setCreditsRequired] = useState(false);
  const [isBusy, setIsBusy] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isAddingNextSet, setIsAddingNextSet] = useState(false);
  const [showSetManager, setShowSetManager] = useState(false);
  const [auditJob, setAuditJob] = useState(null);
  const [removeSet, setRemoveSet] = useState(null);
  const [confirmFinalize, setConfirmFinalize] = useState(false);
  const [confirmAbandon, setConfirmAbandon] = useState(false);
  const hasOpenDialog = Boolean(auditJob || removeSet || confirmFinalize || confirmAbandon);
  const dialogRef = useDialogFocus(hasOpenDialog, () => {
    if (isBusy) return;
    if (auditJob) setAuditJob(null);
    else if (removeSet) setRemoveSet(null);
    else if (confirmFinalize) setConfirmFinalize(false);
    else if (confirmAbandon) setConfirmAbandon(false);
  });
  const fileRef = useRef(null);
  const nextSetFormRef = useRef(null);
  const flowCardRef = useRef(null);

  const session = snapshot.session;
  const selectedJob = snapshot.jobs.find((job) => job.id === activeJobId) || null;
  const activeJob = selectedJob || snapshot.activeJob || null;
  const isEditable = session.status === "active";
  const isCompleted = session.status === "completed";
  const isResultPublished = session.resultBankStatus === "published";
  const isAbandoned = session.status === "failed";
  const blockingSets = snapshot.jobs.filter(isBlockingJob);
  const readyToSaveSets = snapshot.jobs.filter(isJobReadyToSave);
  const problemSets = snapshot.jobs.filter(hasJobQuestionIssues);
  const canAddSet = isEditable && blockingSets.length === 0;
  const canFinalize =
    session.completedSetCount > 0 &&
    isEditable &&
    blockingSets.length === 0 &&
    readyToSaveSets.length === 0 &&
    problemSets.length === 0;
  const nextSetNumber = Math.max(Number(session.setCount || 0), snapshot.jobs.length) + 1;
  const selectedBlockingSet = activeJob && isBlockingJob(activeJob) ? activeJob : null;
  const blockingSet = selectedBlockingSet || blockingSets[0] || null;
  const hasAnySet = Number(session.setCount || 0) > 0;
  const hasAnsweredQuestions = Number(session.questionsWithAnswers || 0) > 0;
  const hasCleanAnswers =
    Number(session.questionsMissingAnswers || 0) === 0 && Number(session.needsReviewCount || 0) === 0;
  const allSetsAdded = hasAnySet && Number(session.completedSetCount || 0) === Number(session.setCount || 0) && !blockingSet;
  const shouldShowUploadStep = canAddSet && (!hasAnySet || isAddingNextSet);
  const shouldShowSavedStep = canAddSet && hasAnySet && !isAddingNextSet;
  const flowJob = blockingSet || null;
  const setTextLength = contentText.trim().length;
  const setTextTooShort =
    sourceMode === "text" &&
    setTextLength > 0 &&
    setTextLength < LICENTA_SET_MIN_CHARS;
  const setFileUnsupported = sourceMode === "file" && selectedSetFile ? !isSupportedSourceFile(selectedSetFile) : false;
  const setFileTooLarge = sourceMode === "file" && selectedSetFile ? selectedSetFile.size > AI_SOURCE_UPLOAD_MAX_BYTES : false;
  const setFileHasIssue = setFileUnsupported || setFileTooLarge;
  const setFileSizeLabel = selectedSetFile ? formatFileSize(selectedSetFile.size) : "";
  const setInputMissing = sourceMode === "text" ? setTextLength === 0 : !selectedSetFile;
  const setInputReady = !setInputMissing && !setTextTooShort && !setFileHasIssue;
  const nextSetSubmitDisabled = isBusy || !setInputReady;
  const nextSetHint = isBusy
    ? "Procesarea setului este in curs."
    : setInputMissing
      ? sourceMode === "text"
        ? "Lipeste continutul setului ca sa poti porni procesarea."
        : "Alege fisierul setului ca sa poti porni procesarea."
      : setTextTooShort
        ? `Mai adauga ${LICENTA_SET_MIN_CHARS - setTextLength} caractere.`
        : setFileUnsupported
          ? "Alege un fisier PDF, DOCX sau TXT."
          : setFileTooLarge
            ? `Alege un fisier sub ${AI_SOURCE_UPLOAD_MAX_LABEL}.`
            : "Setul este pregatit pentru procesare.";
  const finalizationChecks = [
    {
      label: "Ai cel putin un set salvat",
      passed: Number(session.completedSetCount || 0) > 0,
      hint: hasAnySet ? "Salveaza setul verificat in licenta." : "Incarca primul set ca sa pornesti licenta."
    },
    {
      label: "Nu exista seturi in lucru",
      passed: allSetsAdded,
      hint: readyToSaveSets[0]
        ? `Salveaza ${getSetLabel(readyToSaveSets[0])} in licenta.`
        : blockingSet
          ? `Termina ${getSetLabel(blockingSet)}.`
          : "Toate seturile incarcate trebuie adaugate in licenta."
    },
    {
      label: "Intrebarile sunt curate pentru banca finala",
      passed: hasAnsweredQuestions && hasCleanAnswers,
      hint:
        session.questionsMissingAnswers > 0 || session.needsReviewCount > 0
          ? "Corecteaza raspunsurile lipsa si intrebarile de verificat."
          : "Ai nevoie de intrebari cu raspuns inainte de finalizare."
    }
  ];
  const creditsHref = `/cont?section=credits&returnTo=${encodeURIComponent(`/materiale/licenta/${session.id}`)}`;

  function selectJob(jobId) {
    if (!jobId) return;
    setActiveJobId(jobId);
    if (typeof window !== "undefined") {
      window.history.replaceState(null, "", `/materiale/licenta/${session.id}?set=${jobId}`);
      window.setTimeout(() => {
        flowCardRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 40);
    }
  }

  function scrollToNextSetForm() {
    setIsAddingNextSet(true);
    window.setTimeout(() => {
      nextSetFormRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 40);
  }

  function openFinalizeOrExplain() {
    setErrorMessage("");
    setFeedback("");
    if (canFinalize) {
      setConfirmFinalize(true);
      return;
    }

    const nextReadySet = readyToSaveSets[0];
    if (nextReadySet) {
      setErrorMessage(`Salveaza ${getSetLabel(nextReadySet)} in licenta inainte de finalizare.`);
      selectJob(nextReadySet.id);
      return;
    }

    const nextProblemSet = problemSets[0] || blockingSet;
    if (nextProblemSet) {
      setErrorMessage(`Termina ${getSetLabel(nextProblemSet)} inainte de finalizare.`);
      selectJob(nextProblemSet.id);
      return;
    }

    setErrorMessage("Ai nevoie de cel putin un set salvat in licenta inainte de finalizare.");
  }

  async function handleImportConfirmed(importStatus, options = {}) {
    await loadSnapshot(importStatus?.id || importStatus?.importJobId || activeJob?.id || null);
    setIsAddingNextSet(Boolean(options?.continueToNextSet));
    if (options?.continueToNextSet && typeof window !== "undefined") {
      window.setTimeout(() => {
        scrollToNextSetForm();
      }, 80);
    }
  }

  async function readJson(response) {
    const payload = await response.json().catch(() => null);
    if (!response.ok) {
      const error = new Error(payload?.error || "Cererea nu a putut fi finalizata.");
      error.code = payload?.code || null;
      throw error;
    }
    return payload;
  }

  async function loadSnapshot(nextActiveJobId = activeJobId) {
    const response = await fetch(`/api/licenta-import/${session.id}`, {
      method: "GET",
      credentials: "same-origin",
      cache: "no-store"
    });
    const payload = await readJson(response);
    setSnapshot(payload);
    if (nextActiveJobId) {
      selectJob(nextActiveJobId);
    } else if (payload.activeJob?.id) {
      selectJob(payload.activeJob.id);
    }
    return payload;
  }

  async function submitSet(event) {
    event.preventDefault();
    if (isBusy || !isEditable) {
      return;
    }

    if (sourceMode === "text" && !contentText.trim()) {
      setErrorMessage("Lipeste continutul setului urmator.");
      return;
    }
    if (sourceMode === "text" && setTextTooShort) {
      setErrorMessage(`Textul este prea scurt. Adauga cel putin ${LICENTA_SET_MIN_CHARS} de caractere.`);
      return;
    }
    if (sourceMode === "file" && !selectedSetFile) {
      setErrorMessage("Alege fisierul pentru setul urmator.");
      return;
    }
    if (sourceMode === "file" && setFileUnsupported) {
      setErrorMessage("Tip de fisier neacceptat. Alege PDF, DOCX sau TXT.");
      return;
    }
    if (sourceMode === "file" && setFileTooLarge) {
      setErrorMessage(`Fisierul depaseste limita maxima de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`);
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    setCreditsRequired(false);
    setFeedback("");
    try {
      const formData = new FormData();
      formData.set("licentaSessionId", session.id);
      if (sourceMode === "text") {
        formData.set("contentText", contentText);
      } else {
        formData.set("contentFile", selectedSetFile);
      }

      const response = await fetch("/api/import/set", {
        method: "POST",
        credentials: "same-origin",
        body: formData
      });
      const payload = await readJson(response);
      setContentText("");
      setSelectedSetFile(null);
      if (fileRef.current) {
        fileRef.current.value = "";
      }
      setFeedback(`Setul ${payload.setIndex || ""} a fost pornit.`);
      setIsAddingNextSet(false);
      const nextSnapshot = await loadSnapshot(payload.importJobId);
      selectJob(payload.importJobId || nextSnapshot.activeJob?.id || null);
    } catch (error) {
      setCreditsRequired(error?.code === "credits_required");
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut porni setul.");
    } finally {
      setIsBusy(false);
    }
  }

  async function finalizeSession() {
    if (isBusy) {
      return;
    }

    if (!canFinalize) {
      setConfirmFinalize(false);
      openFinalizeOrExplain();
      return;
    }

    setIsBusy(true);
    setIsFinalizing(true);
    setErrorMessage("");
    setCreditsRequired(false);
    setFeedback("");
    try {
      const response = await fetch(`/api/licenta-import/${session.id}/finalize`, {
        method: "POST",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await readJson(response);
      setSnapshot(payload);
      setFeedback("Licenta a fost finalizata. Simularea este pregatita.");
    } catch (error) {
      setCreditsRequired(error?.code === "credits_required");
      let latestSnapshot = null;
      try {
        latestSnapshot = await loadSnapshot(null);
        if (latestSnapshot?.session?.status === "completed") {
          setSnapshot(latestSnapshot);
          setFeedback("Licenta a fost finalizata. Am actualizat starea dupa verificare.");
          return;
        }
      } catch {
        // Pastram mesajul initial cand nu putem reincarca starea.
      }
      setErrorMessage(getFinalizeHelpMessage({ error, snapshot: latestSnapshot || snapshot }));
    } finally {
      setIsFinalizing(false);
      setIsBusy(false);
    }
  }

  async function deleteSet() {
    if (!removeSet?.id || isBusy || !isEditable) {
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    setCreditsRequired(false);
    setFeedback("");
    try {
      const response = await fetch(`/api/import/${removeSet.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await readJson(response);
      setSnapshot(payload);
      setActiveJobId(payload.activeJob?.id || null);
      if (typeof window !== "undefined") {
        const nextHref = payload.activeJob?.id
          ? `/materiale/licenta/${session.id}?set=${payload.activeJob.id}`
          : `/materiale/licenta/${session.id}`;
        window.history.replaceState(null, "", nextHref);
      }
      setRemoveSet(null);
      setFeedback("Setul a fost eliminat din licenta. Poti continua fara sa consumi credit.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut elimina setul.");
      setRemoveSet(null);
    } finally {
      setIsBusy(false);
    }
  }

  async function abandonSession() {
    if (isBusy || !isEditable) {
      return;
    }

    setIsBusy(true);
    setErrorMessage("");
    setCreditsRequired(false);
    setFeedback("");
    try {
      const response = await fetch(`/api/licenta-import/${session.id}`, {
        method: "DELETE",
        credentials: "same-origin",
        headers: {
          Accept: "application/json"
        }
      });
      const payload = await readJson(response);
      if (typeof window !== "undefined") {
        window.location.assign(payload.href || "/materiale");
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Nu am putut abandona licenta.");
      setConfirmAbandon(false);
    } finally {
      setIsBusy(false);
    }
  }

  function mergeUpdatedJob(updatedJob) {
    setSnapshot((current) => {
      const jobs = current.jobs.map((job) => (job.id === updatedJob.id ? { ...job, ...updatedJob } : job));
      const summary = summarizeJobs(jobs);
      return {
        ...current,
        jobs,
        session: {
          ...current.session,
          ...summary
        },
        activeJob: current.activeJob?.id === updatedJob.id ? { ...current.activeJob, ...updatedJob } : current.activeJob
      };
    });
  }

  return (
    <div className="licenta-session-workspace upload-refresh-flow">
      {feedback ? <div className="success-state" role="status">{feedback}</div> : null}
      {isBusy && !isFinalizing ? (
        <section className="learning-processing-panel" role="status" aria-live="polite" aria-atomic="true">
          <span className="learning-processing-icon" aria-hidden="true"><LoaderCircle size={20} strokeWidth={2.3} /></span>
          <div className="learning-processing-copy">
            <strong>Pregătim setul...</strong>
            <p>Păstrează pagina deschisă. Vei vedea automat întrebările imediat ce sunt gata.</p>
          </div>
        </section>
      ) : null}
      {isFinalizing ? (
        <div className="workspace-credit-alert import-warning-panel" aria-live="polite">
          <div>
            <strong>Finalizam licenta</strong>
            <p>Pregatim testul final din seturile salvate. Pentru licente mari poate dura putin.</p>
          </div>
          <span className="status-pill is-muted">In lucru</span>
        </div>
      ) : null}
      {errorMessage ? <div className="error-state" role="alert">{errorMessage}</div> : null}
      {creditsRequired ? (
        <div className="workspace-credit-alert licenta-credit-required-alert">
          <div>
            <strong>Ai nevoie de o incarcare pentru finalizare</strong>
            <p>Licenta ramane salvata aici. Adauga o incarcare, apoi revii si apesi din nou pe finalizare.</p>
          </div>
          <PendingNavigationLink
            className="btn-link secondary ai-workspace-alert-link"
            href={creditsHref}
            pendingLabel="Se deschid pachetele..."
            pendingMode="replace"
          >
            Adauga incarcari
          </PendingNavigationLink>
        </div>
      ) : null}

      {isAbandoned ? (
        <section className="surface licenta-flow-card licenta-session-abandoned-panel">
          <div>
            <span className="ui-section-label">Sesiune inchisa</span>
            <h2>Licenta aceasta nu mai poate fi modificata</h2>
            <p className="page-copy">
              Nu s-a consumat nicio incarcare. Seturile ramase aici sunt doar pentru orientare.
            </p>
          </div>
          <div className="import-next-step-actions">
            <PendingNavigationLink
              className="btn-link secondary"
              href="/materiale"
              pendingLabel="Se deschid materialele..."
              pendingMode="replace"
            >
              <IconText icon={ListPlus}>Porneste alta licenta</IconText>
            </PendingNavigationLink>
          </div>
        </section>
      ) : isCompleted ? (
        <section className="surface licenta-flow-card licenta-session-complete-panel">
          <div>
            <span className="ui-section-label">Licenta finalizata</span>
            <h2>Testul final este creat</h2>
            <p className="page-copy">
              Banca finala a fost creata din {session.completedSetCount} seturi si {session.questionsWithAnswers} intrebari cu raspuns.{" "}
              {isResultPublished
                ? "O poti porni imediat din simulare."
                : "Confirma publicarea ca sa devina disponibila in simulare."}
            </p>
          </div>
          <div className="import-next-step-actions">
            {session.resultHref ? (
              <PendingNavigationLink
                className="btn-back"
                href={session.resultHref}
                pendingLabel={isResultPublished ? "Se deschide simularea..." : "Se deschide publicarea..."}
                pendingMode="replace"
              >
                <IconText icon={isResultPublished ? FileText : ExternalLink}>
                  {isResultPublished ? "Deschide simularea" : "Confirma publicarea"}
                </IconText>
              </PendingNavigationLink>
            ) : null}
            {isResultPublished && session.reviewHref ? (
              <PendingNavigationLink
                className="btn-link secondary"
                href={session.reviewHref}
                pendingLabel="Se deschid intrebarile..."
                pendingMode="replace"
              >
                <IconText icon={ExternalLink}>Vezi intrebarile</IconText>
              </PendingNavigationLink>
            ) : null}
          </div>
        </section>
      ) : (
        <section
          ref={flowCardRef}
          className={`surface licenta-flow-card ${flowJob ? "is-review" : shouldShowSavedStep ? "is-saved" : "is-upload"}`}
        >
          <div className="licenta-flow-head">
            <div>
              <span className="ui-section-label">
                {flowJob
                  ? `Set ${flowJob.setIndex || ""}`
                  : shouldShowSavedStep
                    ? "Set salvat in licenta"
                    : snapshot.jobs.length
                      ? `Set ${nextSetNumber}`
                      : "Construim licenta"}
              </span>
              <h2>
                {flowJob
                  ? ["uploaded", "extracting", "chunking", "processing", "matching_answers"].includes(flowJob.status)
                    ? `Procesam setul ${flowJob.setIndex || ""}`
                    : `Verifica setul ${flowJob.setIndex || ""}`
                  : shouldShowSavedStep
                    ? `Setul ${session.completedSetCount} a fost salvat in licenta`
                    : snapshot.jobs.length
                      ? "Incarca urmatorul set"
                      : "Construieste licenta pe seturi"}
              </h2>
              <p className="page-copy">
                {flowJob
                  ? ["uploaded", "extracting", "chunking", "processing", "matching_answers"].includes(flowJob.status)
                    ? "Extragem intrebarile, variantele si raspunsurile corecte. Pastreaza pagina deschisa."
                    : "Setul este procesat. Salveaza-l in licenta doar dupa ce sumarul arata bine."
                  : shouldShowSavedStep
                    ? `Licenta are acum ${session.completedSetCount} seturi salvate si ${session.questionsWithAnswers} intrebari cu raspuns.`
                    : "Incarca materia pe bucati. La final, seturile salvate vor fi unite intr-un singur test final."}
              </p>
            </div>
            <div className="licenta-flow-summary" aria-label="Sumar licenta">
              <article>
                <span>Seturi salvate</span>
                <strong>{`${session.completedSetCount}/${session.setCount}`}</strong>
              </article>
              <article>
                <span>Intrebari</span>
                <strong>{session.questionsWithAnswers}</strong>
              </article>
            </div>
          </div>

          {flowJob ? (
            <ImportJobStatusClient
              key={flowJob.id}
              initialStatus={flowJob}
              sessionMode
              guidedMode
              readOnly={!isEditable || flowJob.status === "completed"}
              onStatusChange={mergeUpdatedJob}
              onImportConfirmed={handleImportConfirmed}
              onRequestNextSet={canAddSet ? scrollToNextSetForm : null}
              onRequestFinalize={openFinalizeOrExplain}
            />
          ) : shouldShowSavedStep ? (
            <div className="licenta-saved-choice" aria-live="polite">
              <div className="licenta-saved-choice-copy">
                <CheckCircle2 aria-hidden="true" size={28} strokeWidth={2.4} />
                <div>
                  <strong>S-a intamplat: setul este in licenta.</strong>
                  <p className="page-copy">Urmatorul pas este alegerea ta: mai incarci un set sau creezi testul final.</p>
                </div>
              </div>
              <div className="import-next-step-actions">
                <button type="button" className="btn-back" onClick={scrollToNextSetForm}>
                  <IconText icon={ListPlus}>Incarca urmatorul set</IconText>
                </button>
                <button type="button" className="btn-link secondary" onClick={openFinalizeOrExplain} disabled={isBusy}>
                  <IconText icon={CheckCircle2}>Finalizeaza licenta</IconText>
                </button>
              </div>
            </div>
          ) : shouldShowUploadStep ? (
            <form
              ref={nextSetFormRef}
              className="licenta-guided-upload"
              onSubmit={submitSet}
            >
              <div className="workspace-form-head">
                <div className="upload-refresh-step-head">
                  <span className="learning-upload-step-number" aria-hidden="true">{nextSetNumber}</span>
                  <div>
                    <span className="ui-section-label ai-workspace-step-label">
                      {snapshot.jobs.length ? "Set nou" : "Primul set"}
                    </span>
                    <h2>{snapshot.jobs.length ? "Adaugă setul următor" : "Adaugă primul set"}</h2>
                    <p>Alege text sau fișier. Verifici întrebările înainte ca setul să intre în licență.</p>
                  </div>
                </div>
              </div>

              <div
                className="ui-segmented-tabs ai-workspace-source-tabs"
                role="tablist"
                aria-label="Sursa setului"
                onKeyDown={handleTablistKeyDown}
              >
                <button
                  id="licenta-session-source-tab-text"
                  type="button"
                  role="tab"
                  aria-selected={sourceMode === "text"}
                  aria-controls="licenta-session-source-panel"
                  tabIndex={sourceMode === "text" ? 0 : -1}
                  className={`ui-segmented-tab secondary ai-workspace-source-tab ${sourceMode === "text" ? "is-active" : ""}`}
                  onClick={() => {
                    if (isBusy) return;
                    setSourceMode("text");
                    setErrorMessage("");
                  }}
                >
                  <span className="ai-workspace-source-tab-icon" aria-hidden="true"><Keyboard size={19} /></span>
                  <span className="upload-refresh-option-copy"><strong>Lipește text</strong><small>Întrebări copiate</small></span>
                </button>
                <button
                  id="licenta-session-source-tab-file"
                  type="button"
                  role="tab"
                  aria-selected={sourceMode === "file"}
                  aria-controls="licenta-session-source-panel"
                  tabIndex={sourceMode === "file" ? 0 : -1}
                  className={`ui-segmented-tab secondary ai-workspace-source-tab ${sourceMode === "file" ? "is-active" : ""}`}
                  onClick={() => {
                    if (isBusy) return;
                    setSourceMode("file");
                    setErrorMessage("");
                  }}
                >
                  <span className="ai-workspace-source-tab-icon" aria-hidden="true"><Upload size={19} /></span>
                  <span className="upload-refresh-option-copy"><strong>Încarcă fișier</strong><small>PDF, DOCX sau TXT</small></span>
                </button>
              </div>

              {sourceMode === "text" ? (
                <div
                  id="licenta-session-source-panel"
                  className="selector-container"
                  role="tabpanel"
                  aria-labelledby="licenta-session-source-tab-text"
                >
                  <label>
                    Lipeste continutul setului
                    <textarea
                      className="textarea-input ai-workspace-textarea"
                      rows="10"
                      value={contentText}
                      onChange={(event) => {
                        setContentText(event.target.value);
                        setErrorMessage("");
                      }}
                      placeholder="Pune aici intrebarile, variantele si raspunsurile, daca exista."
                    />
                  </label>
                  {setTextLength > 0 ? (
                    <div className={`ai-workspace-source-meta${setTextTooShort ? " is-warning" : ""}`}>
                      <span className={`ui-chip ${setTextTooShort ? "is-warning" : "is-good"}`}>
                        {setTextTooShort ? "Set scurt" : "Set pregatit"}
                      </span>
                      <span>
                        {setTextLength}/{LICENTA_SET_MIN_CHARS} caractere minime
                      </span>
                      <button
                        type="button"
                        className="btn-link secondary ai-workspace-source-action"
                        onClick={() => {
                          if (isBusy) return;
                          setContentText("");
                          setErrorMessage("");
                        }}
                        disabled={isBusy}
                      >
                        Sterge textul
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : (
                <div
                  id="licenta-session-source-panel"
                  className="selector-container"
                  role="tabpanel"
                  aria-labelledby="licenta-session-source-tab-file"
                >
                  <label>
                    Incarca fisierul setului
                    <input
                      ref={fileRef}
                      className="input-search"
                      type="file"
                      accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
                      disabled={isBusy}
                      onChange={(event) => {
                        setSelectedSetFile(event.target.files?.[0] || null);
                        setErrorMessage("");
                      }}
                    />
                  </label>
                  <p className="micro-copy ai-workspace-source-hint">
                    Un singur PDF, DOCX sau TXT pentru setul curent. Maxim {AI_SOURCE_UPLOAD_MAX_LABEL}.
                  </p>
                  {selectedSetFile ? (
                    <div className={`ai-workspace-source-meta${setFileHasIssue ? " is-warning" : ""}`}>
                      <span className={`ui-chip ${setFileHasIssue ? "is-warning" : "is-good"}`}>
                        {setFileUnsupported
                          ? "Tip neacceptat"
                          : setFileTooLarge
                            ? "Prea mare"
                            : "Fisier selectat"}
                      </span>
                      <span>{selectedSetFile.name}</span>
                      <span>
                        {setFileSizeLabel} din {AI_SOURCE_UPLOAD_MAX_LABEL}
                      </span>
                      <button
                        type="button"
                        className="btn-link secondary ai-workspace-source-action"
                        onClick={() => {
                          if (isBusy) return;
                          setSelectedSetFile(null);
                          setErrorMessage("");
                          if (fileRef.current) {
                            fileRef.current.value = "";
                          }
                        }}
                        disabled={isBusy}
                      >
                        Sterge fisierul
                      </button>
                    </div>
                  ) : null}
                </div>
              )}

              <div className="inline-actions import-actions-row">
                <button type="submit" disabled={nextSetSubmitDisabled}>
                  <LoadingIconText icon={ClipboardList} loading={isBusy} loadingLabel="Procesam...">
                    Proceseaza setul
                  </LoadingIconText>
                </button>
                <p className="ai-workspace-submit-action-hint" aria-live="polite">
                  {nextSetHint}
                </p>
              </div>
            </form>
          ) : null}

          <div className="licenta-flow-secondary-actions">
            {flowJob && isEditable ? (
              <button type="button" className="btn-link secondary review-delete-btn" onClick={() => setRemoveSet(flowJob)} disabled={isBusy}>
                <IconText icon={Trash2}>Elimina setul curent</IconText>
              </button>
            ) : null}
            <button type="button" className="btn-link secondary" onClick={() => setShowSetManager((value) => !value)}>
              <IconText icon={ClipboardList}>{showSetManager ? "Ascunde seturile" : "Gestioneaza seturile"}</IconText>
            </button>
            <PendingNavigationLink
              className="btn-link secondary"
              href="/materiale"
              pendingLabel="Se revine..."
              pendingMode="replace"
            >
              <IconText icon={FileText}>Inapoi la materiale</IconText>
            </PendingNavigationLink>
          </div>
        </section>
      )}

      {isCompleted || isAbandoned ? (
        <section className="surface licenta-manage-strip">
          <div>
            <span className="ui-section-label">Seturi si audit</span>
            <strong>Seturile raman disponibile pentru verificare.</strong>
          </div>
          <button type="button" className="btn-link secondary" onClick={() => setShowSetManager((value) => !value)}>
            <IconText icon={ClipboardList}>{showSetManager ? "Ascunde seturile" : "Gestioneaza seturile"}</IconText>
          </button>
        </section>
      ) : null}

      {showSetManager ? (
        <section className="surface licenta-set-manager">
          <div className="dashboard-header">
            <div>
              <span className="ui-section-label">Gestionare seturi</span>
              <h2>Seturile acestei licente</h2>
              <p className="page-copy">Aici vezi auditul, intrebarile si actiunile secundare. Flow-ul principal ramane curat.</p>
            </div>
          </div>
          <div className="licenta-set-list">
            {snapshot.jobs.length ? (
              snapshot.jobs.map((job) => {
                const issueSummary = getSetIssueSummary(job);

                return (
                  <article key={job.id} className="licenta-set-manager-row">
                    <div>
                      <span>{`Set ${job.setIndex || ""}`}</span>
                      <strong>{job.title || job.fileName || "Set importat"}</strong>
                      <small>{`${job.totalQuestions || 0} intrebari, ${job.questionsWithAnswers || 0} cu raspuns`}</small>
                      <small className={`licenta-set-issue ${issueSummary.tone}`}>{issueSummary.text}</small>
                    </div>
                    <em className={`status-pill ${setStatusTone(job.status)}`}>{setStatusLabel(job.status)}</em>
                    <div className="inline-actions">
                      {isBlockingJob(job) && job.id === flowJob?.id ? (
                        <span className="status-pill is-muted licenta-set-current-pill">Deschis</span>
                      ) : isBlockingJob(job) ? (
                        <button type="button" className="btn-link licenta-set-open-btn" onClick={() => selectJob(job.id)}>
                          <IconText icon={ClipboardList}>Deschide setul</IconText>
                        </button>
                      ) : (
                        <button type="button" className="btn-link secondary" onClick={() => setAuditJob(job)}>
                          Vezi intrebarile
                        </button>
                      )}
                      {isEditable ? (
                        <button type="button" className="btn-link secondary" onClick={() => setRemoveSet(job)} disabled={isBusy}>
                          <IconText icon={Trash2}>Elimina</IconText>
                        </button>
                      ) : null}
                    </div>
                  </article>
                );
              })
            ) : (
              <div className="draft-card review-empty-card">
                <strong>Niciun set inca.</strong>
                <p className="page-copy">Incarca primul set din flow-ul principal.</p>
              </div>
            )}
          </div>
          {isEditable ? (
            <div className="licenta-manager-danger">
              <div>
                <strong>Renunta la licenta curenta</strong>
                <p className="page-copy">Actiune secundara pentru material incarcat gresit. Nu consuma nicio incarcare.</p>
              </div>
              <button type="button" className="btn-link secondary" onClick={() => setConfirmAbandon(true)} disabled={isBusy}>
                <IconText icon={Trash2}>Renunta la licenta</IconText>
              </button>
            </div>
          ) : null}
      </section>
      ) : null}

      {auditJob ? (
        <div className="workspace-modal-backdrop" role="presentation">
          <div
            ref={dialogRef}
            className="workspace-modal-card licenta-questions-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="licenta-audit-dialog-title"
          >
            <div className="workspace-modal-head">
              <div>
                <strong id="licenta-audit-dialog-title">{`Set ${auditJob.setIndex || ""} - intrebari`}</strong>
                <p>Set salvat in licenta. Il poti consulta fara sa intri inapoi in flow-ul principal.</p>
              </div>
              <button
                className="workspace-modal-close feedback-modal-close"
                type="button"
                onClick={() => setAuditJob(null)}
              >
                <IconText icon={X}>Inchide</IconText>
              </button>
            </div>
            <div className="workspace-modal-form licenta-questions-modal-body">
              <ImportJobStatusClient
                key={auditJob.id}
                initialStatus={auditJob}
                sessionMode
                guidedMode
                readOnly
                onStatusChange={mergeUpdatedJob}
              />
            </div>
          </div>
        </div>
      ) : null}

      {removeSet && isEditable ? (
        <div className="workspace-modal-backdrop" role="presentation">
          <div
            ref={dialogRef}
            className="workspace-modal-card review-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="licenta-remove-dialog-title"
          >
            <div className="workspace-modal-head">
              <div>
                <strong id="licenta-remove-dialog-title">{`Elimini setul ${removeSet.setIndex || ""}?`}</strong>
                <p>Setul si intrebarile extrase din el vor fi scoase din licenta curenta.</p>
              </div>
              <button
                className="workspace-modal-close feedback-modal-close"
                type="button"
                onClick={() => setRemoveSet(null)}
                disabled={isBusy}
              >
                <IconText icon={X}>Inchide</IconText>
              </button>
            </div>
            <div className="workspace-modal-form">
              <div className="inline-actions">
                <button type="button" className="secondary review-delete-btn" onClick={deleteSet} disabled={isBusy}>
                  <LoadingIconText icon={Trash2} loading={isBusy} loadingLabel="Se elimina...">
                    Da, elimina setul
                  </LoadingIconText>
                </button>
                <button type="button" className="btn-link secondary" onClick={() => setRemoveSet(null)} disabled={isBusy}>
                  <IconText icon={X}>Renunta</IconText>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmFinalize && isEditable ? (
        <div className="workspace-modal-backdrop" role="presentation">
          <div
            ref={dialogRef}
            className="workspace-modal-card review-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="licenta-finalize-dialog-title"
          >
            <div className="workspace-modal-head">
              <div>
                <strong id="licenta-finalize-dialog-title">Finalizezi licenta?</strong>
                <p>
                  Include {session.completedSetCount} seturi si {session.questionsWithAnswers} intrebari cu raspuns.
                  Dupa finalizare cream testul final si consumam o singura incarcare.
                </p>
              </div>
              <button
                className="workspace-modal-close feedback-modal-close"
                type="button"
                onClick={() => setConfirmFinalize(false)}
                disabled={isBusy}
              >
                <IconText icon={X}>Inchide</IconText>
              </button>
            </div>
            <div className="workspace-modal-form">
              <div className="inline-actions">
                <button
                  type="button"
                  onClick={async () => {
                    setConfirmFinalize(false);
                    await finalizeSession();
                  }}
                  disabled={isBusy}
                >
                  <LoadingIconText icon={CheckCircle2} loading={isBusy} loadingLabel="Finalizam...">
                    Finalizeaza licenta
                  </LoadingIconText>
                </button>
                <button type="button" className="btn-link secondary" onClick={() => setConfirmFinalize(false)} disabled={isBusy}>
                  <IconText icon={X}>Inapoi</IconText>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmAbandon && isEditable ? (
        <div className="workspace-modal-backdrop" role="presentation">
          <div
            ref={dialogRef}
            className="workspace-modal-card review-confirm-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="licenta-abandon-dialog-title"
          >
            <div className="workspace-modal-head">
              <div>
                <strong id="licenta-abandon-dialog-title">Renunti la licenta curenta?</strong>
                <p>Seturile din aceasta sesiune vor fi sterse. Nu se consuma nicio incarcare.</p>
              </div>
              <button
                className="workspace-modal-close feedback-modal-close"
                type="button"
                onClick={() => setConfirmAbandon(false)}
                disabled={isBusy}
              >
                <IconText icon={X}>Inchide</IconText>
              </button>
            </div>
            <div className="workspace-modal-form">
              <div className="inline-actions">
                <button type="button" className="secondary review-delete-btn" onClick={abandonSession} disabled={isBusy}>
                  <LoadingIconText icon={Trash2} loading={isBusy} loadingLabel="Se renunta...">
                    Da, renunta
                  </LoadingIconText>
                </button>
                <button type="button" className="btn-link secondary" onClick={() => setConfirmAbandon(false)} disabled={isBusy}>
                  <IconText icon={X}>Pastrez licenta</IconText>
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
