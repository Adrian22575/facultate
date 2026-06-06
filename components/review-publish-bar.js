"use client";

import Link from "next/link";
import { useFormStatus } from "react-dom";

import { LoadingIconText } from "@/components/loading-spinner";

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
  const publishBlocked = !published && isLicenta && unresolvedReviewCount > 0;

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
              ? `${unresolvedReviewCount} intrebari trebuie completate manual inainte de publicarea pentru licenta.`
              : `${questionCount} intrebari sunt pregatite pentru publicare.`}
        </p>
      </div>

      <div className="review-publish-actions">
        {published ? (
          <Link className="btn-back" href={publishedHref}>
            {isLicenta ? "Deschide simularea" : "Deschide materia"}
          </Link>
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
