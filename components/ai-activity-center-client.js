"use client";

import { useRouter } from "next/navigation";
import {
  BookOpenCheck,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  Eye,
  FileCheck2,
  FileClock,
  FolderOpen,
  LibraryBig,
  PencilLine,
  PlayCircle,
  RotateCcw,
  Trash2,
  UploadCloud
} from "lucide-react";
import { useMemo, useRef, useState, useTransition } from "react";

import { deleteQuestionBanksAction } from "@/app/ai/actions";
import { assignLearningStudySetSubjectAction } from "@/app/ai/invata/actions";
import { LoadingIconText } from "@/components/loading-spinner";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { getJobPresentation } from "@/lib/ai/job-presentation";
import {
  AI_SOURCE_ACCEPTED_MIME_TYPES,
  AI_SOURCE_UPLOAD_MAX_BYTES,
  AI_SOURCE_UPLOAD_MAX_LABEL
} from "@/lib/ai/upload-limits";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useDialogFocus } from "@/lib/ui/dialog";
import { handleTablistKeyDown } from "@/lib/ui/tablist";

const MATERIALS_PAGE_SIZE = 8;
const ACTIVITY_PAGE_SIZE = 6;
const TESTS_PAGE_SIZE = 6;
const SOURCE_FILE_ACCEPTED_EXTENSIONS = [".pdf", ".docx", ".pptx", ".txt"];
const SOURCE_FILE_ACCEPT_ATTRIBUTE = [
  ...SOURCE_FILE_ACCEPTED_EXTENSIONS,
  ...AI_SOURCE_ACCEPTED_MIME_TYPES
].join(",");
const ACTIVITY_TABS = [
  {
    id: "learning",
    label: "Materiale de studiu",
    icon: LibraryBig,
    title: "Biblioteca de invatare",
    description: "Foloseste materialele tale sau cele publicate de colegii din comunitatea ta, fara o incarcare noua."
  },
  {
    id: "subjects",
    label: "Materiile mele",
    icon: FolderOpen,
    title: "Materii urcate",
    description: "Aici apar doar materiile urcate de tine, separat de licenta si de istoricul procesarilor."
  },
  {
    id: "licenta",
    label: "Licenta",
    icon: BookOpenCheck,
    title: "Materiale pentru licenta",
    description: "Aici vezi fiecare licenta ca o singura lucrare, cu seturile ei si statusul curent."
  },
  {
    id: "activity",
    label: "Activitate recenta",
    icon: FileClock,
    title: "Uploaduri si verificari",
    description: "Aici vezi procesele pornite: importuri in lucru, verificari gata, opriri sau reluari necesare."
  },
  {
    id: "tests",
    label: "Testele tale",
    icon: ClipboardList,
    title: "Teste generate",
    description: "Aici sunt testele active si drafturile create din materialele tale."
  }
];

function formatDate(value) {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("ro-RO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function getResponseError(payload, fallback) {
  if (typeof payload?.error === "string" && payload.error.trim()) {
    return payload.error;
  }

  return fallback;
}

function isSupportedSourceFile(file) {
  if (!file) {
    return false;
  }

  const normalizedName = file.name.toLowerCase();
  const hasAcceptedExtension = SOURCE_FILE_ACCEPTED_EXTENSIONS.some((extension) =>
    normalizedName.endsWith(extension)
  );

  return AI_SOURCE_ACCEPTED_MIME_TYPES.includes(file.type) || hasAcceptedExtension;
}

function paginateRows(rows, page, pageSize) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    rows: rows.slice(start, start + pageSize),
    page: safePage,
    totalPages
  };
}

function PaginationControls({ page, totalPages, onChange }) {
  if (totalPages <= 1) {
    return null;
  }

  return (
    <div className="admin-pagination ai-activity-pagination">
      <button
        type="button"
        className="btn-link secondary admin-pagination-btn"
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
      >
        Anterior
      </button>
      <span className="admin-pagination-label">{`Pagina ${page} din ${totalPages}`}</span>
      <button
        type="button"
        className="btn-link secondary admin-pagination-btn"
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
      >
        Urmator
      </button>
    </div>
  );
}

function IconText({ icon: Icon, children }) {
  return (
    <span className="ui-icon-text">
      <Icon aria-hidden="true" size={16} strokeWidth={2.2} />
      <span>{children}</span>
    </span>
  );
}

function materialStatusLabel(status) {
  if (status === "published") return "Publicat";
  if (status === "review") return "De verificat";
  if (status === "processing") return "In lucru";
  if (status === "failed") return "Oprit";
  return "In asteptare";
}

function materialStatusTone(status) {
  if (status === "published") return "is-good";
  if (status === "review" || status === "processing") return "is-warning";
  if (status === "failed") return "is-bad";
  return "";
}

function activityTitle(job) {
  return (
    job.metadata?.lastKnownSubjectLabel ||
    job.title ||
    job.fileName ||
    job.metadata?.subjectLabel ||
    "Fisier incarcat"
  );
}

function activityType(job) {
  if (job.kind === "import") return "Import licenta";
  if (job.kind === "learning") return "Invatare";
  if (job.metadata?.examType === "licenta") return "Licenta";
  return "Test grila";
}

function learningStatusLabel(status) {
  if (status === "ready") return "Gata de invatat";
  if (status === "ready_with_warnings") return "Gata cu observatii";
  if (status === "failed") return "Procesare oprita";
  if (["uploaded", "extracting", "outlining", "generating", "consolidating"].includes(status)) return "In pregatire";
  return "Ciorna";
}

function learningStatusTone(status) {
  if (status === "ready") return "is-good";
  if (status === "ready_with_warnings" || ["uploaded", "extracting", "outlining", "generating", "consolidating"].includes(status)) {
    return "is-warning";
  }
  if (status === "failed") return "is-bad";
  return "is-muted";
}

function SubjectAssignment({ studySet, subjects }) {
  const router = useRouter();
  const [subjectId, setSubjectId] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");

  if (!subjects.length) return null;

  async function handleAssign(event) {
    event.preventDefault();
    if (!subjectId || isSaving) return;

    setIsSaving(true);
    setError("");
    const result = await assignLearningStudySetSubjectAction({ studySetId: studySet.id, subjectId });
    setIsSaving(false);
    if (!result?.ok) {
      setError(result?.error || "Nu am putut salva materia.");
      return;
    }
    router.refresh();
  }

  return (
    <form className="learning-library-subject-form" onSubmit={handleAssign}>
      <label>
        Leaga-l de o materie
        <select value={subjectId} onChange={(event) => setSubjectId(event.target.value)} disabled={isSaving}>
          <option value="">Alege materia</option>
          {subjects.map((subject) => (
            <option key={subject.id} value={subject.id}>{subject.title}</option>
          ))}
        </select>
      </label>
      <button type="submit" className="btn-link secondary" disabled={!subjectId || isSaving}>
        {isSaving ? "Se salveaza..." : "Salveaza"}
      </button>
      {error ? <small role="alert">{error}</small> : null}
    </form>
  );
}

function LearningStudySetCard({ studySet, origin, subjects = [] }) {
  const isCommunity = origin === "community";
  const detail = `${studySet.chapterCount || 0} capitole · ${studySet.flashcardCount || 0} flashcards · ${studySet.questionCount || 0} intrebari`;

  return (
    <article className={`learning-library-card${isCommunity ? " is-community" : ""}`}>
      <PendingNavigationLink
        className="learning-library-card-main"
        href={`/materiale/invata/${studySet.id}`}
        pendingLabel="Se deschide materialul..."
        pendingMode="replace"
      >
      <div className="learning-library-card-head">
        <span className={`status-pill ${learningStatusTone(studySet.status)}`}>{learningStatusLabel(studySet.status)}</span>
        <span className="learning-library-origin">
          {isCommunity ? "Din comunitate" : studySet.publishedAt ? "Publicat de tine" : "Doar pentru tine"}
        </span>
      </div>
      <strong>{studySet.title}</strong>
      <p>{detail}</p>
      <span className="learning-library-card-action">
        Deschide materialul
        <ExternalLink aria-hidden="true" size={16} strokeWidth={2.3} />
      </span>
      </PendingNavigationLink>
      {!isCommunity && !studySet.subjectId ? <SubjectAssignment studySet={studySet} subjects={subjects} /> : null}
    </article>
  );
}

function LearningLibrary({ learningStudySets, communityLearningStudySets, subjects }) {
  if (!learningStudySets.length && !communityLearningStudySets.length) {
    return (
      <div className="learning-library-empty">
        <strong>Biblioteca nu are materiale inca.</strong>
        <p>Incarca primul curs. Dupa ce alegi sa il publici, colegii din comunitatea ta il pot folosi fara o procesare noua.</p>
        <PendingNavigationLink
          className="btn-back"
          href="/materiale/invata"
          pendingLabel="Se deschide incarcarea..."
          pendingMode="replace"
        >
          <IconText icon={UploadCloud}>Adauga primul material</IconText>
        </PendingNavigationLink>
      </div>
    );
  }

  return (
    <div className="learning-library">
      {communityLearningStudySets.length ? (
        <section className="learning-library-group" aria-labelledby="community-materials-title">
          <div className="learning-library-group-head">
            <h3 id="community-materials-title">Din comunitate</h3>
          </div>
          <div className="learning-library-grid">
            {communityLearningStudySets.map((studySet) => (
              <LearningStudySetCard key={studySet.id} studySet={studySet} origin="community" subjects={subjects} />
            ))}
          </div>
        </section>
      ) : null}

      {learningStudySets.length ? (
        <section className="learning-library-group" aria-labelledby="owned-materials-title">
          <div className="learning-library-group-head">
            <h3 id="owned-materials-title">Materialele tale</h3>
          </div>
          <div className="learning-library-grid">
            {learningStudySets.map((studySet) => (
              <LearningStudySetCard key={studySet.id} studySet={studySet} origin="owned" subjects={subjects} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}

function withReturnTo(href, returnTo) {
  if (!href) return href;
  const separator = href.includes("?") ? "&" : "?";
  return `${href}${separator}returnTo=${encodeURIComponent(returnTo)}`;
}

function activityHref(job) {
  if (job.kind === "import") return job.href || `/materiale/imports/${job.id}`;
  if (job.kind === "learning") return job.resultHref || `/materiale/invata/${job.resultStudySetId || job.metadata?.studySetId || ""}`;
  if (job.status === "succeeded") return job.reviewHref || job.resultHref || `/materiale/jobs/${job.id}`;
  return `/materiale/jobs/${job.id}`;
}

function activityActionLabel(job) {
  if (job.canResumeProcessing) return "Reia";
  if (job.kind === "learning" && job.status === "succeeded") return "Deschide";
  if (job.kind === "import" && job.status === "ready_for_preview") return "Verifica";
  if (job.status === "succeeded" || job.status === "ready_for_preview") return "Verifica";
  return "Detalii";
}

function activityActionIcon(job) {
  if (job.canResumeProcessing) return RotateCcw;
  if (job.kind === "import" && job.status === "ready_for_preview") return CheckCircle2;
  if (job.status === "succeeded" || job.status === "ready_for_preview") return CheckCircle2;
  return Eye;
}

function TableSection({ title, description, actions, children }) {
  return (
    <section className="workspace-history-block ai-workspace-history-block ai-activity-tab-panel">
      <div className="dashboard-header ai-workspace-subsection-head ai-activity-section-head">
        <div>
          <h2>{title}</h2>
          <p className="page-copy">{description}</p>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ title, copy }) {
  return (
    <article className="ui-panel-card ai-workspace-activity-empty">
      <strong>{title}</strong>
      <p className="page-copy">{copy}</p>
    </article>
  );
}

function SourceDocumentAction({
  targetType,
  targetId,
  sourceDocumentHref,
  sourceDocumentName,
  onAttached
}) {
  const inputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function attachFile(file) {
    if (!file) {
      return;
    }

    setErrorMessage("");

    if (!isSupportedSourceFile(file)) {
      setErrorMessage("Alege PDF, DOCX, PPTX sau TXT.");
      return;
    }

    if (file.size > AI_SOURCE_UPLOAD_MAX_BYTES) {
      setErrorMessage(`Fisierul depaseste limita de ${AI_SOURCE_UPLOAD_MAX_LABEL}.`);
      return;
    }

    setIsUploading(true);
    try {
      const intentResponse = await fetch("/api/source-documents/attach-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          originalFilename: file.name,
          mimeType: file.type,
          sizeBytes: file.size
        })
      });
      const intentPayload = await intentResponse.json().catch(() => null);

      if (!intentResponse.ok) {
        throw new Error(getResponseError(intentPayload, "Nu am putut pregati uploadul fisierului."));
      }

      const supabase = createSupabaseBrowserClient();
      const { error: uploadError } = await supabase.storage
        .from(intentPayload.storageBucket)
        .upload(intentPayload.storagePath, file, {
          contentType: intentPayload.mimeType || file.type,
          upsert: false
        });

      if (uploadError) {
        throw new Error("Fisierul nu a putut fi urcat. Verifica legatura si incearca din nou.");
      }

      const attachResponse = await fetch("/api/source-documents/attach", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          targetId,
          sourceDocumentId: intentPayload.sourceDocumentId
        })
      });
      const attachPayload = await attachResponse.json().catch(() => null);

      if (!attachResponse.ok) {
        throw new Error(getResponseError(attachPayload, "Nu am putut atasa fisierul original."));
      }

      onAttached?.({
        targetType,
        targetId,
        sourceDocumentId: attachPayload.sourceDocumentId,
        sourceDocumentHref: attachPayload.sourceDocumentHref,
        sourceDocumentName: attachPayload.sourceDocumentName
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Uploadul a esuat.");
    } finally {
      setIsUploading(false);
      if (inputRef.current) {
        inputRef.current.value = "";
      }
    }
  }

  if (!targetType || !targetId) {
    return null;
  }

  if (sourceDocumentHref) {
    return (
      <a
        className="admin-table-link secondary ai-source-document-link"
        href={sourceDocumentHref}
        target="_blank"
        rel="noreferrer"
        title={sourceDocumentName || "Deschide fisierul original"}
      >
        <IconText icon={ExternalLink}>Fisier sursa</IconText>
      </a>
    );
  }

  return (
    <span className="ai-source-document-action">
      <input
        ref={inputRef}
        className="sr-only"
        type="file"
        accept={SOURCE_FILE_ACCEPT_ATTRIBUTE}
        aria-label="Alege fisierul original"
        onChange={(event) => attachFile(event.target.files?.[0] || null)}
        disabled={isUploading}
      />
      <button
        type="button"
        className="admin-table-link secondary ai-source-document-upload"
        onClick={() => inputRef.current?.click()}
        disabled={isUploading}
      >
        <LoadingIconText icon={UploadCloud} loading={isUploading} loadingLabel="Se urca...">
          Adauga sursa
        </LoadingIconText>
      </button>
      {errorMessage ? (
        <span className="ai-source-document-error" role="alert">
          {errorMessage}
        </span>
      ) : null}
    </span>
  );
}

function DeleteMaterialDialog({ target, confirmText, isPending, errorMessage, onTextChange, onClose, onConfirm }) {
  const dialogRef = useDialogFocus(Boolean(target), () => {
    if (!isPending) onClose();
  });

  if (!target) {
    return null;
  }

  const canConfirm = confirmText.trim() === "STERGE";
  const isBulk = target.count > 1;
  const title = isBulk ? "Stergi materialele selectate?" : "Stergi materialul?";
  const body = isBulk
    ? `${target.count} materiale selectate vor fi sterse, iar materiile nu vor mai fi disponibile pentru nimeni. Pentru siguranta, scrie STERGE mai jos.`
    : `Materialul "${target.title}" va fi sters, iar materia nu va mai fi disponibila pentru nimeni. Pentru siguranta, scrie STERGE mai jos.`;

  return (
    <div className="workspace-modal-backdrop" role="presentation">
      <div
        ref={dialogRef}
        className="workspace-modal-card review-confirm-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="material-delete-confirm-title"
      >
        <div className="workspace-modal-head">
          <div>
            <strong id="material-delete-confirm-title">{title}</strong>
            <p>{body}</p>
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
          <label className="onboarding-form-field">
            <span>Cuvant de confirmare</span>
            <input
              className="input-search"
              value={confirmText}
              onChange={(event) => onTextChange(event.target.value)}
              placeholder="Scrie STERGE"
              autoComplete="off"
              disabled={isPending}
            />
          </label>
          {errorMessage ? <div className="error-state" role="alert">{errorMessage}</div> : null}
          <div className="inline-actions">
            <button
              type="button"
              className="secondary review-delete-btn"
              onClick={onConfirm}
              disabled={isPending || !canConfirm}
            >
              <LoadingIconText icon={Trash2} loading={isPending} loadingLabel="Se sterge...">
                {isBulk ? "Sterge materialele" : "Sterge materialul"}
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

function MaterialsTable({ materials, emptyTitle, emptyCopy, onDeleted, onSourceDocumentAttached }) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState([]);
  const [feedback, setFeedback] = useState("");
  const [deleteError, setDeleteError] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [confirmText, setConfirmText] = useState("");
  const [isPending, startTransition] = useTransition();
  const paginated = useMemo(
    () => paginateRows(materials, page, MATERIALS_PAGE_SIZE),
    [materials, page]
  );
  const visibleIds = paginated.rows.map((material) => material.id);
  const selectedVisibleCount = visibleIds.filter((id) => selectedIds.includes(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const selectedMaterials = materials.filter((material) => selectedIds.includes(material.id));

  function openDeleteDialog(material) {
    setFeedback("");
    setDeleteError("");
    setConfirmText("");
    setDeleteTarget({
      ids: [material.id],
      title: material.title,
      count: 1
    });
  }

  function openBulkDeleteDialog() {
    if (!selectedMaterials.length) {
      return;
    }

    setFeedback("");
    setDeleteError("");
    setConfirmText("");
    setDeleteTarget({
      ids: selectedMaterials.map((material) => material.id),
      count: selectedMaterials.length
    });
  }

  function closeDeleteDialog() {
    if (isPending) {
      return;
    }

    setDeleteTarget(null);
    setConfirmText("");
    setDeleteError("");
  }

  function toggleSelected(materialId) {
    setSelectedIds((current) =>
      current.includes(materialId)
        ? current.filter((id) => id !== materialId)
        : [...current, materialId]
    );
  }

  function toggleVisibleSelected() {
    setSelectedIds((current) => {
      const currentSet = new Set(current);

      if (allVisibleSelected) {
        return current.filter((id) => !visibleIds.includes(id));
      }

      visibleIds.forEach((id) => currentSet.add(id));
      return [...currentSet];
    });
  }

  function confirmDeleteMaterial() {
    if (!deleteTarget?.ids?.length || confirmText.trim() !== "STERGE") {
      setDeleteError("Scrie exact STERGE ca sa confirmi stergerea.");
      return;
    }

    const materialIds = deleteTarget.ids;
    startTransition(async () => {
      try {
        const result = await deleteQuestionBanksAction({ bankIds: materialIds });
        if (!result?.ok) {
          throw new Error("Nu am putut sterge materialele acum.");
        }

        const deletedIds = result.deletedIds || materialIds;
        onDeleted(deletedIds);
        setSelectedIds((current) => current.filter((id) => !deletedIds.includes(id)));
        setDeleteTarget(null);
        setConfirmText("");
        setDeleteError("");
        setFeedback(result.message || (deletedIds.length === 1 ? "Materialul a fost sters." : "Materialele au fost sterse."));
        router.refresh();
      } catch (error) {
        setDeleteError(error instanceof Error ? error.message : "Nu am putut sterge materialele acum.");
      }
    });
  }

  if (!materials.length) {
    return (
      <>
        {feedback ? <div className="success-state workspace-inline-feedback" role="status">{feedback}</div> : null}
        <EmptyState
          title={emptyTitle}
          copy={emptyCopy}
        />
      </>
    );
  }

  return (
    <>
      {feedback ? <div className="success-state workspace-inline-feedback" role="status">{feedback}</div> : null}
      {selectedIds.length ? (
        <div className="ai-activity-bulk-actions">
          <span>{`${selectedIds.length} selectate`}</span>
          <button
            type="button"
            className="admin-table-link secondary review-delete-btn"
            onClick={openBulkDeleteDialog}
            disabled={isPending}
          >
            <IconText icon={Trash2}>Sterge selectate</IconText>
          </button>
        </div>
      ) : null}
      <div className="table-scroll admin-table-scroll ai-activity-table-scroll">
        <table className="admin-table ai-activity-table">
          <thead>
            <tr>
              <th className="ai-activity-select-cell">
                <input
                  type="checkbox"
                  aria-label="Selecteaza materialele vizibile"
                  checked={allVisibleSelected}
                  onChange={toggleVisibleSelected}
                />
              </th>
              <th>Material</th>
              <th>Tip</th>
              <th>Materie</th>
              <th className="table-center">Intrebari</th>
              <th>Status</th>
              <th>Ultima actualizare</th>
              <th>Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {paginated.rows.map((material) => (
              <tr key={material.id}>
                <td className="ai-activity-select-cell" data-label="Selecteaza">
                  <input
                    type="checkbox"
                    aria-label={`Selecteaza ${material.title}`}
                    checked={selectedIds.includes(material.id)}
                    onChange={() => toggleSelected(material.id)}
                  />
                </td>
                <td className="admin-table-name-cell admin-table-name-cell--xl" data-label="Material" data-mobile-wide="true">
                  {material.title}
                </td>
                <td className="admin-table-text-cell" data-label="Tip">{material.typeLabel}</td>
                <td className="admin-table-text-cell" data-label="Materie">{material.subjectLabel}</td>
                <td className="table-center admin-table-count-cell" data-label="Intrebari">{material.questionCount}</td>
                <td data-label="Status">
                  <span className={`admin-table-pill ${materialStatusTone(material.status)}`}>
                    {materialStatusLabel(material.status)}
                  </span>
                </td>
                <td className="admin-table-date-cell" data-label="Actualizat">{formatDate(material.updatedAt)}</td>
                <td data-label="Actiuni" data-mobile-wide="true">
                  <div className="inline-actions ai-activity-table-actions">
                      {material.reviewHref ? (
                        <PendingNavigationLink
                          className="admin-table-link"
                          href={withReturnTo(
                            material.reviewHref,
                            "/materiale/activitate?tab=subjects"
                          )}
                          pendingLabel="Se deschide editorul..."
                          pendingMode="replace"
                        >
                          <IconText icon={material.canReview ? CheckCircle2 : PencilLine}>
                            {material.canReview ? "Verifica" : "Corecteaza"}
                          </IconText>
                        </PendingNavigationLink>
                      ) : null}
                      {material.resultHref && material.resultHref !== material.reviewHref ? (
                        <PendingNavigationLink
                          className="admin-table-link secondary"
                          href={material.resultHref}
                          pendingLabel="Se deschide..."
                          pendingMode="replace"
                        >
                          <IconText icon={FileCheck2}>{material.primaryActionLabel}</IconText>
                        </PendingNavigationLink>
                      ) : null}
                    <button
                      type="button"
                      className="admin-table-link secondary review-delete-btn"
                      onClick={() => openDeleteDialog(material)}
                    >
                      <IconText icon={Trash2}>Sterge</IconText>
                    </button>
                    <SourceDocumentAction
                      targetType="question_bank"
                      targetId={material.id}
                      sourceDocumentHref={material.sourceDocumentHref}
                      sourceDocumentName={material.sourceDocumentName}
                      onAttached={onSourceDocumentAttached}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <PaginationControls page={paginated.page} totalPages={paginated.totalPages} onChange={setPage} />
      <DeleteMaterialDialog
        target={deleteTarget}
        confirmText={confirmText}
        isPending={isPending}
        errorMessage={deleteError}
        onTextChange={setConfirmText}
        onClose={closeDeleteDialog}
        onConfirm={confirmDeleteMaterial}
      />
    </>
  );
}

function getLicentaSessionTitle(session) {
  return (
    session.metadata?.title ||
    session.metadata?.lastKnownSubjectLabel ||
    session.metadata?.subjectLabel ||
    "Licenta generala"
  );
}

function getLicentaStatusLabel(row) {
  if (row.status === "failed") return "Oprita";
  if (row.status === "completed" || row.resultBankId) return "Finalizata";
  if (row.hasOpenSets || row.completedSetCount < row.setCount) return "In lucru";
  if (row.status === "active") return "De finalizat";
  return "In asteptare";
}

function getLicentaStatusTone(row) {
  if (row.status === "failed") return "is-bad";
  if (row.status === "completed" || row.resultBankId) return "is-good";
  return "is-warning";
}

function getLicentaActions(row) {
  const actions = [];

  if (row.reviewHref) {
    actions.push({
      href: withReturnTo(row.reviewHref, "/materiale/activitate?tab=licenta"),
      label: "Corecteaza",
      icon: PencilLine
    });
  }

  if (row.status === "completed" && row.resultHref && row.resultHref !== row.reviewHref) {
    actions.push({ href: row.resultHref, label: "Simulare", icon: PlayCircle });
  }

  if (!actions.length) {
    actions.push({
      href: row.href,
      label: row.status === "failed" ? "Detalii" : "Continua",
      icon: row.status === "failed" ? Eye : CheckCircle2
    });
  }

  return actions;
}

function buildStandaloneLicentaRow(materials) {
  if (!materials.length) {
    return null;
  }

  const sorted = [...materials].sort(
    (left, right) => Date.parse(right.updatedAt || right.createdAt || "") - Date.parse(left.updatedAt || left.createdAt || "")
  );
  const first = sorted[0];
  const completedSetCount = materials.filter((material) => material.status === "published").length;
  const hasOpenSets = materials.some((material) => material.status === "review" || material.status === "processing");

  return {
    id: "licenta-standalone-materials",
    href: first.primaryHref,
    status: completedSetCount === materials.length ? "completed" : "active",
    resultBankId: first.status === "published" ? first.id : null,
    resultHref: first.primaryHref,
    reviewHref: first.reviewHref,
    title: materials.length === 1 ? first.title : "Licenta generala",
    setCount: materials.length,
    completedSetCount,
    totalQuestions: materials.reduce((total, material) => total + (material.questionCount || 0), 0),
    questionsWithAnswers: materials.reduce((total, material) => total + (material.questionCount || 0), 0),
    hasOpenSets,
    updatedAt: first.updatedAt,
    createdAt: first.createdAt,
    sourceDocumentId: first.sourceDocumentId || null,
    sourceDocumentHref: first.sourceDocumentHref || null,
    sourceDocumentName: first.sourceDocumentName || null,
    sourceAttachmentTargetType: "question_bank",
    sourceAttachmentTargetId: first.id
  };
}

function buildLicentaRows({ sessions, materials }) {
  const sessionIds = new Set((sessions || []).map((session) => session.id));
  const standaloneMaterials = materials.filter((material) => {
    const licentaSessionId = material.metadata?.licentaSessionId;
    return !licentaSessionId || !sessionIds.has(licentaSessionId);
  });
  const standaloneRow = buildStandaloneLicentaRow(standaloneMaterials);

  return [
    ...(sessions || []).map((session) => ({
      ...session,
      title: getLicentaSessionTitle(session),
      updatedAt: session.updatedAt || session.completedAt || session.createdAt,
      sourceAttachmentTargetType: "licenta_session",
      sourceAttachmentTargetId: session.id
    })),
    ...(standaloneRow ? [standaloneRow] : [])
  ].sort((left, right) => Date.parse(right.updatedAt || "") - Date.parse(left.updatedAt || ""));
}

function LicentaTable({ rows, onSourceDocumentAttached }) {
  const [page, setPage] = useState(1);
  const paginated = useMemo(
    () => paginateRows(rows, page, MATERIALS_PAGE_SIZE),
    [rows, page]
  );

  if (!rows.length) {
    return (
      <EmptyState
        title="Nu ai materiale pentru licenta inca."
        copy="Dupa ce pornesti o lucrare pe seturi, o vei vedea aici ca o singura intrare."
      />
    );
  }

  return (
    <>
      <div className="table-scroll admin-table-scroll ai-activity-table-scroll">
        <table className="admin-table ai-activity-table">
          <thead>
            <tr>
              <th>Licenta</th>
              <th className="table-center">Seturi</th>
              <th className="table-center">Intrebari</th>
              <th>Status</th>
              <th>Ultima actualizare</th>
              <th>Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {paginated.rows.map((row) => {
              const actions = getLicentaActions(row);
              return (
                <tr key={row.id}>
                  <td className="admin-table-name-cell admin-table-name-cell--xl" data-label="Licenta" data-mobile-wide="true">
                    <div className="ai-activity-name-cell">
                      <strong>{row.title}</strong>
                      <span>{`${row.completedSetCount || 0}/${row.setCount || 0} seturi salvate`}</span>
                    </div>
                  </td>
                  <td className="table-center admin-table-count-cell" data-label="Seturi">{row.setCount || 0}</td>
                  <td className="table-center admin-table-count-cell" data-label="Intrebari">{row.questionsWithAnswers || row.totalQuestions || 0}</td>
                  <td data-label="Status">
                    <span className={`admin-table-pill ${getLicentaStatusTone(row)}`}>
                      {getLicentaStatusLabel(row)}
                    </span>
                  </td>
                  <td className="admin-table-date-cell" data-label="Actualizat">{formatDate(row.updatedAt || row.completedAt || row.createdAt)}</td>
                  <td data-label="Actiuni" data-mobile-wide="true">
                    <div className="inline-actions ai-activity-table-actions">
                      {actions.map((action, index) => (
                        <PendingNavigationLink
                          key={`${row.id}-${action.href}-${action.label}`}
                          className={`admin-table-link${index > 0 ? " secondary" : ""}`}
                          href={action.href}
                          pendingLabel={action.label === "Continua" ? "Se continua..." : "Se deschide..."}
                          pendingMode="replace"
                        >
                          <IconText icon={action.icon}>{action.label}</IconText>
                        </PendingNavigationLink>
                      ))}
                      <SourceDocumentAction
                        targetType={row.sourceAttachmentTargetType}
                        targetId={row.sourceAttachmentTargetId}
                        sourceDocumentHref={row.sourceDocumentHref}
                        sourceDocumentName={row.sourceDocumentName}
                        onAttached={onSourceDocumentAttached}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls page={paginated.page} totalPages={paginated.totalPages} onChange={setPage} />
    </>
  );
}

function ActivityTable({ jobs }) {
  const [page, setPage] = useState(1);
  const paginated = useMemo(
    () => paginateRows(jobs, page, ACTIVITY_PAGE_SIZE),
    [jobs, page]
  );

  if (!jobs.length) {
    return (
      <EmptyState
        title="Nu ai procesari recente."
        copy="Uploadurile, importurile si verificarile pornite vor aparea aici."
      />
    );
  }

  return (
    <>
      <div className="table-scroll admin-table-scroll ai-activity-table-scroll">
        <table className="admin-table ai-activity-table">
          <thead>
            <tr>
              <th>Procesare</th>
              <th>Tip</th>
              <th>Status</th>
              <th>Progres</th>
              <th>Ultima actualizare</th>
              <th>Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {paginated.rows.map((job) => {
              const presentation = getJobPresentation(job);
              return (
                <tr key={`${job.kind || "job"}-${job.id}`}>
                  <td className="admin-table-name-cell admin-table-name-cell--xl" data-label="Procesare" data-mobile-wide="true">
                    <div className="ai-activity-name-cell">
                      <strong>{activityTitle(job)}</strong>
                      <span>{presentation.primaryMessage}</span>
                    </div>
                  </td>
                  <td className="admin-table-text-cell" data-label="Tip">{activityType(job)}</td>
                  <td data-label="Status">
                    <span className={`status-pill ${presentation.tone}`}>{presentation.statusLabel}</span>
                  </td>
                  <td className="admin-table-text-cell" data-label="Progres" data-mobile-wide="true">
                    {presentation.isTerminal
                      ? `${presentation.progressLabel} - ${presentation.elapsedCaption}: ${presentation.elapsedLabel}`
                      : `${presentation.progressLabel} - astepti de ${presentation.elapsedLabel}`}
                  </td>
                  <td className="admin-table-date-cell" data-label="Actualizat">{formatDate(job.updatedAt || job.completedAt || job.createdAt)}</td>
                  <td data-label="Actiuni">
                    <div className="inline-actions ai-activity-table-actions">
                      <PendingNavigationLink
                        className="admin-table-link"
                        href={activityHref(job)}
                        pendingLabel="Se deschide..."
                        pendingMode="replace"
                      >
                        <IconText icon={activityActionIcon(job)}>
                          {activityActionLabel(job)}
                        </IconText>
                      </PendingNavigationLink>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls page={paginated.page} totalPages={paginated.totalPages} onChange={setPage} />
    </>
  );
}

function buildTestRows(testGroups) {
  return [
    ...(testGroups.active || []).map((test) => ({ ...test, displayStatus: "Activ" })),
    ...(testGroups.drafts || []).map((test) => ({ ...test, displayStatus: "Draft" }))
  ];
}

function TestsTable({ testGroups }) {
  const rows = useMemo(() => buildTestRows(testGroups), [testGroups]);
  const [page, setPage] = useState(1);
  const paginated = useMemo(
    () => paginateRows(rows, page, TESTS_PAGE_SIZE),
    [rows, page]
  );

  if (!rows.length) {
    return (
      <EmptyState
        title="Nu ai teste pregatite inca."
        copy="Testele generate si drafturile vor aparea aici."
      />
    );
  }

  return (
    <>
      <div className="table-scroll admin-table-scroll ai-activity-table-scroll">
        <table className="admin-table ai-activity-table">
          <thead>
            <tr>
              <th>Test</th>
              <th>Status</th>
              <th className="table-center">Intrebari</th>
              <th>Creat</th>
              <th>Actiuni</th>
            </tr>
          </thead>
          <tbody>
            {paginated.rows.map((test) => {
              const isActive = test.status === "active";
              return (
                <tr key={test.id}>
                  <td className="admin-table-name-cell admin-table-name-cell--xl" data-label="Test" data-mobile-wide="true">{test.title}</td>
                  <td data-label="Status">
                    <span className={`admin-table-pill ${isActive ? "is-good" : "is-warning"}`}>
                      {test.displayStatus}
                    </span>
                  </td>
                  <td className="table-center admin-table-count-cell" data-label="Intrebari">{test.total_questions}</td>
                  <td className="admin-table-date-cell" data-label="Creat">{formatDate(test.published_at || test.created_at)}</td>
                  <td data-label="Actiuni" data-mobile-wide="true">
                    <div className="inline-actions ai-activity-table-actions">
                      {isActive ? (
                        <PendingNavigationLink
                          className="admin-table-link"
                          href={`/testele-mele/${test.id}`}
                          pendingLabel="Se deschide testul..."
                          pendingMode="replace"
                        >
                          <IconText icon={PlayCircle}>Rezolva</IconText>
                        </PendingNavigationLink>
                      ) : null}
                      <PendingNavigationLink
                        className="admin-table-link secondary"
                        href={`/materiale/drafts/${test.id}`}
                        pendingLabel="Se deschide..."
                        pendingMode="replace"
                      >
                        <IconText icon={Eye}>Deschide</IconText>
                      </PendingNavigationLink>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <PaginationControls page={paginated.page} totalPages={paginated.totalPages} onChange={setPage} />
    </>
  );
}

export function AIActivityCenterClient({
  materials = [],
  learningStudySets = [],
  communityLearningStudySets = [],
  subjects = [],
  activityJobs = [],
  licentaSessions = [],
  testGroups = { active: [], drafts: [] },
  initialTab = "learning"
}) {
  const [activeTab, setActiveTab] = useState(
    ACTIVITY_TABS.some((tab) => tab.id === initialTab) ? initialTab : "learning"
  );
  const [visibleMaterials, setVisibleMaterials] = useState(materials);
  const [visibleLicentaSessions, setVisibleLicentaSessions] = useState(licentaSessions);
  function handleMaterialsDeleted(deletedIds) {
    setVisibleMaterials((current) => current.filter((material) => !deletedIds.includes(material.id)));
  }

  function handleSourceDocumentAttached(attachment) {
    const patch = {
      sourceDocumentId: attachment.sourceDocumentId,
      sourceDocumentHref: attachment.sourceDocumentHref,
      sourceDocumentName: attachment.sourceDocumentName
    };

    if (attachment.targetType === "question_bank") {
      setVisibleMaterials((current) =>
        current.map((material) =>
          material.id === attachment.targetId ? { ...material, ...patch } : material
        )
      );
      return;
    }

    if (attachment.targetType === "licenta_session") {
      setVisibleLicentaSessions((current) =>
        current.map((session) =>
          session.id === attachment.targetId ? { ...session, ...patch } : session
        )
      );
    }
  }

  const subjectMaterials = useMemo(
    () => visibleMaterials.filter((material) => material.examType !== "licenta"),
    [visibleMaterials]
  );
  const licentaMaterials = useMemo(
    () => visibleMaterials.filter((material) => material.examType === "licenta"),
    [visibleMaterials]
  );
  const licentaRows = useMemo(
    () => buildLicentaRows({ sessions: visibleLicentaSessions, materials: licentaMaterials }),
    [visibleLicentaSessions, licentaMaterials]
  );
  const selectedTab = ACTIVITY_TABS.find((tab) => tab.id === activeTab) || ACTIVITY_TABS[0];
  const tabCounts = {
    learning: learningStudySets.length + communityLearningStudySets.length,
    subjects: subjectMaterials.length,
    licenta: licentaRows.length,
    activity: activityJobs.length,
    tests: (testGroups.active || []).length + (testGroups.drafts || []).length
  };

  function selectTab(tabId) {
    setActiveTab(tabId);
    if (typeof window !== "undefined") {
      window.history.replaceState(window.history.state, "", `/materiale/activitate?tab=${tabId}`);
    }
  }

  return (
    <section className="surface ai-workspace-activity-surface ai-activity-management-surface">
      <div
        className="ui-segmented-tabs ai-activity-tabs"
        role="tablist"
        aria-label="Sectiuni activitate"
        onKeyDown={handleTablistKeyDown}
      >
        {ACTIVITY_TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              id={`activity-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.id}
              aria-controls="activity-main-panel"
              tabIndex={activeTab === tab.id ? 0 : -1}
              className={`ui-segmented-tab secondary ai-activity-tab ${activeTab === tab.id ? "is-active" : ""}`}
              onClick={() => selectTab(tab.id)}
            >
              <Icon aria-hidden="true" size={17} strokeWidth={2.2} />
              <span>{tab.label}</span>
              <span className="ai-activity-tab-count">{tabCounts[tab.id] || 0}</span>
            </button>
          );
        })}
      </div>

      <div
        id="activity-main-panel"
        role="tabpanel"
        aria-labelledby={`activity-tab-${activeTab}`}
      >
        <TableSection
          title={selectedTab.title}
          description={selectedTab.description}
          actions={
            activeTab === "tests" ? (
              <div className="ai-activity-section-actions">
                <PendingNavigationLink
                  className="btn-link secondary"
                  href="/testele-mele"
                  pendingLabel="Se deschid testele..."
                  pendingMode="replace"
                >
                  <IconText icon={BookOpenCheck}>Vezi toate testele</IconText>
                </PendingNavigationLink>
              </div>
            ) : null
          }
        >
          {activeTab === "learning" ? (
            <LearningLibrary
              learningStudySets={learningStudySets}
              communityLearningStudySets={communityLearningStudySets}
              subjects={subjects}
            />
          ) : null}
          {activeTab === "subjects" ? (
            <MaterialsTable
              key="subjects"
              materials={subjectMaterials}
              emptyTitle="Nu ai materii urcate inca."
              emptyCopy="Dupa ce verifici si salvezi o materie, ea apare aici."
              onDeleted={handleMaterialsDeleted}
              onSourceDocumentAttached={handleSourceDocumentAttached}
            />
          ) : null}
          {activeTab === "licenta" ? (
            <LicentaTable rows={licentaRows} onSourceDocumentAttached={handleSourceDocumentAttached} />
          ) : null}
          {activeTab === "activity" ? <ActivityTable jobs={activityJobs} /> : null}
          {activeTab === "tests" ? <TestsTable testGroups={testGroups} /> : null}
        </TableSection>
      </div>
    </section>
  );
}
