const CONSOLIDATING_TIMEOUT_NOTE = "Incercam o analiza mai atenta a PDF-ului. Poate dura 1-3 minute.";

export function formatJobDuration(seconds) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "-";
  }

  if (seconds < 60) {
    return `${Math.max(0, Math.round(seconds))} sec`;
  }

  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  if (minutes < 60) {
    return remainingSeconds ? `${minutes} min ${remainingSeconds} sec` : `${minutes} min`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes ? `${hours} h ${remainingMinutes} min` : `${hours} h`;
}

export function secondsSinceIso(value, nowMs = Date.now()) {
  if (!value) {
    return null;
  }

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) {
    return null;
  }

  return Math.max(0, Math.round((nowMs - parsed) / 1000));
}

export function getLiveElapsedSeconds(job, nowMs = Date.now()) {
  const fromStartedAt = secondsSinceIso(job?.startedAt || job?.createdAt, nowMs);
  return fromStartedAt ?? job?.elapsedSeconds ?? null;
}

export function getLiveAgeSeconds(value, fallback, nowMs = Date.now()) {
  return secondsSinceIso(value, nowMs) ?? fallback ?? null;
}

function secondsBetweenIso(startValue, endValue) {
  if (!startValue || !endValue) {
    return null;
  }

  const start = Date.parse(startValue);
  const end = Date.parse(endValue);
  if (!Number.isFinite(start) || !Number.isFinite(end)) {
    return null;
  }

  return Math.max(0, Math.round((end - start) / 1000));
}

function getTerminalElapsedSeconds(job, nowMs) {
  const startedAt = job?.startedAt || job?.createdAt;
  const completedAt = job?.completedAt;
  return (
    secondsBetweenIso(startedAt, completedAt) ??
    job?.elapsedSeconds ??
    getLiveElapsedSeconds(job, nowMs)
  );
}

function getTerminalLastActivitySeconds(job) {
  const completedAt = job?.completedAt;
  const activityAt = job?.lastProgressAt || job?.lastHeartbeatAt;
  return (
    secondsBetweenIso(activityAt, completedAt) ??
    job?.lastProgressAgeSeconds ??
    job?.lastHeartbeatAgeSeconds ??
    null
  );
}

function formatTerminalActivityLabel(seconds, terminalNoun = "oprire") {
  if (!Number.isFinite(seconds)) {
    return `la ${terminalNoun}`;
  }

  if (seconds <= 1) {
    return `la ${terminalNoun}`;
  }

  return `cu ${formatJobDuration(seconds)} inainte de ${terminalNoun}`;
}

export function getJobTone(job) {
  if (job?.kind === "import") {
    if (job?.status === "failed" || job?.status === "needs_review" || job?.status === "completed_with_warnings") {
      return "is-warning";
    }
    if (job?.status === "ready_for_preview" || job?.status === "completed") {
      return "is-good";
    }
    return "is-muted";
  }

  if (job?.activityState === "deleted") return "is-warning";
  if (job?.activityState === "modified") return "is-muted";
  if (job?.status === "failed") return "is-warning";
  if (job?.status === "succeeded") return "is-good";
  return "is-muted";
}

export function getJobStageLabel(jobOrStage) {
  const stage = typeof jobOrStage === "string" ? jobOrStage : jobOrStage?.stage;
  const status = typeof jobOrStage === "string" ? null : jobOrStage?.status;
  const kind = typeof jobOrStage === "string" ? null : jobOrStage?.kind;

  if (kind === "import") {
    if (status === "uploaded" || status === "extracting") return "Pregatim fisierul";
    if (status === "chunking") return "Pregatim continutul";
    if (status === "processing") return "Cautam intrebarile";
    if (status === "matching_answers") return "Cautam raspunsurile";
    if (status === "ready_for_preview") return "Gata de verificat";
    if (status === "completed") return "Salvat";
    if (status === "completed_with_warnings") return "Salvat cu atentionari";
    if (status === "needs_review") return "Necesita verificare";
    if (status === "failed") return "Oprit";
    return "Pregatim importul";
  }

  if (kind === "learning") {
    if (status === "failed") return "Oprit";
    if (status === "succeeded") return "Gata";
    if (stage === "queued") return "A inceput";
    if (stage === "extracting") return "Citim materia";
    if (stage === "generating") return "Construim materialele";
    if (stage === "finalizing") return "Finalizam";
    return "Procesam materia";
  }

  if (status === "failed") return "Eroare";
  if (status === "succeeded") return "Gata";

  if (stage === "queued") return "A inceput";
  if (stage === "profiling") return "Verificam fisierul";
  if (stage === "extracting") return "Scoatem intrebarile";
  if (stage === "consolidating") return "Aranjam totul";
  if (stage === "publishing") return "Punem totul la locul lui";
  if (stage === "review") return "Gata de verificat";
  if (stage === "completed") return "Gata";
  if (stage === "failed") return "Eroare";
  return "Se pregateste";
}

export function formatGenerationError(errorMessage) {
  if (!errorMessage) {
    return null;
  }

  const normalized = errorMessage.toLowerCase();
  if (
    normalized.includes("nu am obtinut suficienti itemi validi") ||
    normalized.includes("nu am putut pregati suficient de multe intrebari clare")
  ) {
    return "Nu am putut pregati suficient de multe intrebari clare din acest fisier.";
  }

  if (normalized.includes("am extras intrebari, dar prea multe au fost eliminate")) {
    return "Am extras intrebari, dar prea multe au fost eliminate la verificarea finala.";
  }

  if (normalized.includes("analiza mai atenta a pdf-ului")) {
    return "Analiza mai atenta a PDF-ului nu a putut fi finalizata.";
  }

  if (
    normalized.includes("openai a procesat pdf-ul") ||
    normalized.includes("fisierul a fost analizat, dar rezultatul nu a avut suficiente intrebari clare")
  ) {
    return "Fisierul a fost analizat, dar rezultatul nu a avut suficiente intrebari clare pentru publicare.";
  }

  if (normalized.includes("nu am putut salva banca finala")) {
    return "Am extras intrebarile, dar nu am putut salva banca finala.";
  }

  if (normalized.includes("nu am putut finaliza pregatirea pentru verificare")) {
    return "Am extras intrebarile, dar nu am putut finaliza pregatirea pentru verificare.";
  }

  if (normalized.includes("documentul nu pare sa contina o banca valida")) {
    return "Fisierul nu pare sa aiba suficiente intrebari si raspunsuri clare.";
  }

  const userSafeMessages = [
    "pdf-ul pare scanat",
    "incarca un fisier",
    "fisierul depaseste limita",
    "docx nu contine text",
    "txt este gol",
    "textul introdus manual este prea scurt",
    "sunt acceptate doar fisiere",
    "nu ai incarcari disponibile",
    "documentul nu pare sa contina o banca valida",
    "nu am obtinut suficienti itemi validi"
  ];

  if (userSafeMessages.some((token) => normalized.includes(token))) {
    return errorMessage;
  }

  return "Fisierul s-a oprit si are nevoie de o noua incercare.";
}

export function getJobStatusLabel(job) {
  if (job?.kind === "import") {
    if (job.status === "ready_for_preview") return "Gata de verificat";
    if (job.status === "completed") return "Salvat";
    if (job.status === "completed_with_warnings") return "Salvat cu atentionari";
    if (job.status === "needs_review") return "Necesita verificare";
    if (job.status === "failed") return "Oprit";
    if (job.status === "uploaded" || job.status === "extracting" || job.status === "chunking") return "In pregatire";
    if (job.status === "matching_answers") return "Cautam raspunsurile";
    if (job.status === "processing") return "Se proceseaza";
    return "In lucru";
  }

  if (job?.canResumeProcessing) return "Poate fi reluat";
  if (job?.activityState === "deleted") return "Sters";
  if (job?.activityState === "modified") return "Modificat";
  if (job?.bankStatus === "review") return "Gata de verificat";
  if (job?.bankStatus === "published") return "Publicat";
  if (job?.status === "succeeded") return "Gata";
  if (job?.status === "failed") return "Eroare";
  if (job?.status === "processing") return "Se proceseaza";
  if (job?.status === "pending") return "A inceput";
  return "In lucru";
}

export function getJobPrimaryMessage(job) {
  if (!job) {
    return "Pregatim fisierul.";
  }

  if (job.kind === "import") {
    return job.message || job.statusDetail || "Pregatim importul.";
  }

  if (job.kind === "learning") {
    if (job.status === "succeeded") {
      return "Materia este gata de invatat.";
    }
    if (job.status === "failed") {
      return job.errorMessage || "Procesarea s-a oprit.";
    }
    return job.statusDetail || "Pregatim materialele de invatare.";
  }

  if (job.canResumeProcessing) {
    return "Fisierul s-a oprit si are nevoie de o noua incercare.";
  }

  if (job.activityState === "deleted") {
    return job.activityMessage || "Fisierul a fost sters.";
  }

  if (job.activityState === "modified") {
    return job.activityMessage || "Intrebarile au fost modificate.";
  }

  if (job.status === "succeeded") {
    if (
      (job.metadata?.pdfProcessingMode === "openai_fallback" ||
        job.extractionSource === "openai_file") &&
      job.bankStatus !== "published"
    ) {
      return "Rezultatul este gata. Verifica intrebarile si confirma publicarea.";
    }

    if (job.bankStatus === "published") {
      return job.metadata?.examType === "licenta"
        ? "Intrebarile sunt deja active in simularea de licenta."
        : "Intrebarile sunt deja active in aceasta materie.";
    }

    return "Intrebarile sunt gata. Verifica raspunsurile si confirma publicarea.";
  }

  if (job.status === "failed") {
    return formatGenerationError(job.errorMessage);
  }

  if (job.stage === "profiling") {
    return "Verificam daca fisierul are intrebari si raspunsuri clare.";
  }

  if (job.stage === "extracting") {
    if (job.processingMode === "openai_pdf_single_file" || job.processingMode === "openai_pdf_batched") {
      return "Analizam fisierul.";
    }

    return "Scoatem intrebarile din fisier.";
  }

  if (job.stage === "consolidating") {
    if (job.processingMode === "pdf_fallback_pending") {
      return CONSOLIDATING_TIMEOUT_NOTE;
    }

    return "Verificam daca intrebarile sunt suficient de clare pentru publicare.";
  }

  if (job.stage === "publishing") {
    return "Punem totul in materia ta.";
  }

  return getJobStageLabel(job);
}

export function getJobDetailMessage(job) {
  if (!job) {
    return null;
  }

  if (job.kind === "import") {
    return job.detailMessage || null;
  }

  if (job.canResumeProcessing) {
    return "Procesarea poate fi reluata fara sa reincarci fisierul.";
  }

  if (job.stage === "consolidating" && job.processingMode === "pdf_fallback_pending") {
    return job.statusDetail || CONSOLIDATING_TIMEOUT_NOTE;
  }

  if ((job.status === "pending" || job.status === "processing") && job.statusDetail) {
    return job.statusDetail;
  }

  return null;
}

export function getJobPresentation(job, nowMs = Date.now()) {
  const isImport = job?.kind === "import";
  const isFailed = job?.status === "failed";
  const isImportTerminal =
    isImport &&
    ["ready_for_preview", "completed", "completed_with_warnings", "needs_review", "failed"].includes(job?.status);
  const isSucceeded =
    job?.status === "succeeded" ||
    (isImport && ["ready_for_preview", "completed", "completed_with_warnings"].includes(job?.status));
  const isTerminal = isFailed || isSucceeded || isImportTerminal;
  const elapsedSeconds = isTerminal
    ? getTerminalElapsedSeconds(job, nowMs)
    : getLiveElapsedSeconds(job, nowMs);
  const lastActivitySeconds = isTerminal
    ? getTerminalLastActivitySeconds(job)
    : getLiveAgeSeconds(job?.lastHeartbeatAt, job?.lastHeartbeatAgeSeconds, nowMs);
  const rawProgressPercent = Number.isFinite(job?.progressPercent)
    ? Math.max(0, Math.min(100, job.progressPercent))
    : 0;
  const progressPercent = isSucceeded ? 100 : rawProgressPercent;
  const shouldShowProgressPercent = !isFailed && job?.status !== "needs_review";
  const progressLabel =
    isFailed ? "Oprit" : job?.status === "needs_review" ? "De verificat" : `${progressPercent}%`;
  const elapsedLabel = formatJobDuration(elapsedSeconds);
  const terminalNoun = isSucceeded ? "finalizare" : "oprire";
  const lastActivityLabel = isTerminal
    ? formatTerminalActivityLabel(lastActivitySeconds, terminalNoun)
    : Number.isFinite(lastActivitySeconds)
      ? `acum ${formatJobDuration(lastActivitySeconds)}`
      : "in curs de pornire";

  return {
    isTerminal,
    isFailed,
    rawProgressPercent,
    progressPercent,
    shouldShowProgressPercent,
    progressLabel,
    tone: getJobTone(job),
    statusLabel: getJobStatusLabel(job),
    stageLabel: getJobStageLabel(job),
    title:
      isImport && job?.status === "ready_for_preview"
        ? "Import gata de verificat"
        : isImport && job?.status === "completed"
          ? "Import salvat"
          : isImport && job?.status === "completed_with_warnings"
            ? "Import salvat cu atentionari"
            : isImport && job?.status === "needs_review"
              ? "Importul cere verificare"
              : job?.kind === "learning" && job?.status === "succeeded"
                ? "Materia este gata"
                : job?.kind === "learning" && job?.status === "failed"
                  ? "Procesarea s-a oprit"
                  : job?.kind === "learning"
                    ? "Materia se proceseaza"
              : job?.status === "failed"
        ? "Procesarea s-a oprit"
        : job?.status === "succeeded"
          ? "Intrebarile sunt gata"
          : isImport
            ? "Import in procesare"
            : "Fisier in procesare",
    primaryMessage: getJobPrimaryMessage(job),
    detailMessage: getJobDetailMessage(job),
    elapsedSeconds,
    elapsedLabel,
    elapsedCaption: isFailed
      ? "Durata pana la oprire"
      : isSucceeded
        ? "Durata procesare"
        : "Timp asteptare",
    lastActivitySeconds,
    lastActivityLabel,
    activityCaption: isTerminal ? "Ultima activitate" : "Ultima activitate"
  };
}
