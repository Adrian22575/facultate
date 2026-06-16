"use client";

import { useFormStatus } from "react-dom";

import { LoadingIconText } from "@/components/loading-spinner";
import { PendingNavigationLink } from "@/components/pending-navigation-link";

function PublishButton({ isLicenta, blocked }) {
  const { pending } = useFormStatus();
  const label = blocked
    ? "Rezolva intrebarile marcate"
    : isLicenta
      ? "Confirma si publica pentru licenta"
      : "Confirma si publica in materie";

  return (
    <button type="submit" disabled={pending || blocked}>
      <LoadingIconText loading={pending} loadingLabel="Se publica...">
        {label}
      </LoadingIconText>
    </button>
  );
}

export function ReviewPublishBar({
  bankId,
  published,
  isLicenta,
  questionCount,
  unresolvedReviewCount = 0,
  publishedHref,
  publishAction
}) {
  const publishBlocked = !published && unresolvedReviewCount > 0;

  return (
    <section
      className={`review-publish-bar${published ? " is-published" : ""}${
        publishBlocked ? " is-blocked" : ""
      }`}
    >
      <div className="review-publish-copy">
        <span className="step-eyebrow">{published ? "Publicat" : "Ultimul pas"}</span>
        <strong>
          {published
            ? isLicenta
              ? "Intrebarile sunt deja active in simularea de licenta."
              : "Intrebarile sunt deja active in aceasta materie."
            : "Verifica intrebarile si confirma publicarea cand totul este clar."}
        </strong>
        <p>
          {published
            ? "Modificarile tale se vad direct aici."
            : publishBlocked
              ? `${unresolvedReviewCount} intrebari trebuie completate manual inainte de publicare.`
              : `${questionCount} intrebari sunt pregatite pentru publicare.`}
        </p>
      </div>

      <div className="review-publish-actions">
        {published ? (
          <PendingNavigationLink
            className="btn-back"
            href={publishedHref}
            pendingLabel={isLicenta ? "Se deschide simularea..." : "Se deschide materia..."}
            pendingMode="replace"
          >
            {isLicenta ? "Deschide simularea" : "Deschide materia"}
          </PendingNavigationLink>
        ) : (
          <form action={publishAction}>
            <input type="hidden" name="bankId" value={bankId} />
            <PublishButton isLicenta={isLicenta} blocked={publishBlocked} />
          </form>
        )}
      </div>
    </section>
  );
}
