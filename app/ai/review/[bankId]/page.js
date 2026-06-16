import { notFound, redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { AIQuestionBankReviewClient } from "@/components/ai-question-bank-review-client";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { ReviewPublishBar } from "@/components/review-publish-bar";
import { publishQuestionBankAction } from "@/app/ai/actions";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { buildPublishedQuestionBankHref } from "@/lib/ai/published-destination";
import { getQuestionBankReview } from "@/lib/ai/question-bank-pipeline";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }) {
  const resolvedParams = await params;
  return {
    title: `Verificare banca | ${resolvedParams.bankId}`
  };
}

function getPublishedCopy(bank) {
  if (bank.exam_type === "licenta") {
    return "Intrebarile sunt deja active in simularea de licenta.";
  }

  return "Intrebarile sunt deja active in aceasta materie.";
}

function getPublishedHint() {
  return "Modificarile tale se vad direct aici.";
}

function buildExtractionSummary(review) {
  const estimatedItems =
    review.job?.metadata?.estimatedItems ||
    review.bank?.metadata?.estimatedItems ||
    null;
  const consolidationSummary = review.bank?.metadata?.summary || review.job?.metadata?.consolidationSummary || null;
  const diagnostics = review.job?.metadata?.consolidationDiagnostics || null;
  const extractedCount = review.items.length;
  const needsReviewCount = review.items.filter((item) => item.quality_status === "needs_review").length;
  const duplicateCount = diagnostics?.duplicateCount || consolidationSummary?.duplicateCount || 0;
  const rejectedCount = diagnostics?.rejectedCount || consolidationSummary?.rejectedCount || 0;
  const rawExtractedCount =
    diagnostics?.rawExtractedCount ||
    review.job?.metadata?.lastPdfPrimaryRawExtractedCount ||
    null;
  const coverageTargetCount = Number(diagnostics?.coverageTargetCount || diagnostics?.publishableThreshold || 0) || 0;
  const coveragePercent =
    Number(
      diagnostics?.coveragePercent ||
        (coverageTargetCount > 0 ? Math.round((extractedCount / coverageTargetCount) * 100) : 0)
    ) || 0;
  const notes = [];

  if (duplicateCount > 0) {
    notes.push("Intrebarile repetate au fost unite ca sa nu apara de doua ori.");
  }

  if (rejectedCount > 0 || (estimatedItems && extractedCount < estimatedItems)) {
    notes.push("Unele intrebari au avut format neclar sau raspunsul corect nu a fost suficient de clar.");
  }

  if (needsReviewCount > 0) {
    notes.push(`${needsReviewCount} intrebari au fost pastrate, dar cer verificare mai atenta.`);
  }

  if (review.job?.metadata?.extractionSource === "openai_file") {
    notes.push("Pentru acest PDF am pastrat mai multe intrebari utile pentru verificare, nu doar pe cele perfecte din prima trecere.");
  }

  if (coverageTargetCount > 0) {
    notes.push(`Acoperire curenta: ${coveragePercent}% din tinta de ${coverageTargetCount} itemi.`);
  }

  return {
    title:
      rawExtractedCount && estimatedItems
        ? `Am detectat aproximativ ${estimatedItems} intrebari, am extras ${extractedCount} pentru verificare, iar in procesarea initiala au fost extrase brut ${rawExtractedCount}.`
        : estimatedItems
          ? `Am detectat aproximativ ${estimatedItems} intrebari si am extras ${extractedCount} pentru verificare.`
          : `Am extras ${extractedCount} intrebari pentru verificare.`,
    notes
  };
}

export default async function AIQuestionBankReviewPage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/auth/login?next=/materiale/review/${resolvedParams.bankId}`);
  }

  if (isDemoUser(user)) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref(`/materiale/review/${resolvedParams.bankId}`));
  }

  const review = await getQuestionBankReview({
    bankId: resolvedParams.bankId,
    userId: user.id
  });

  if (!review) {
    notFound();
  }

  const { bank, items } = review;
  const published = resolvedSearchParams?.published === "1" || bank.status === "published";
  const publishedHref = buildPublishedQuestionBankHref(bank);
  const isLicenta = bank.exam_type === "licenta";
  const extractionSummary = buildExtractionSummary(review);
  const unresolvedReviewCount = items.filter((item) => item.quality_status === "needs_review").length;

  return (
    <main className="app-shell review-page-shell has-review-publish-bar">
      <AppHeader
        action={
          <PendingNavigationLink
            className="btn-back"
            href="/materiale"
            pendingLabel="Se revine..."
            pendingMode="replace"
          >
            Inapoi la workspace
          </PendingNavigationLink>
        }
        kicker={published ? "Publicat" : "Gata de verificat"}
        title={bank.title}
        subtitle={
          published
            ? "Poti corecta intrebarile in continuare. Modificarile se vad direct aici."
            : "Verifica intrebarile, corecteaza unde este nevoie si publica doar cand totul este clar."
        }
      />

      {published ? (
        <section className="surface">
          <div className="success-state review-success-block">
            <strong>{getPublishedCopy(bank)}</strong>
            <p>{getPublishedHint()}</p>
          </div>
        </section>
      ) : null}

      <section className="surface">
        <div className="status-stack">
          <div className="status-row">
            <strong>Tip</strong>
            <span className={`status-pill ${published ? "is-good" : "is-muted"}`}>
              {isLicenta ? "Licenta" : "Materie"}
            </span>
          </div>
          <div className="status-row">
            <strong>Stare</strong>
            <span className={`status-pill ${published ? "is-good" : "is-warning"}`}>
              {published ? "Publicat" : "Gata de verificat"}
            </span>
          </div>
          <div className="status-row">
            <strong>Intrebari</strong>
            <span className="status-pill is-muted">{items.length}</span>
          </div>
        </div>
        <div className="review-extraction-summary">
          <strong>{extractionSummary.title}</strong>
          {extractionSummary.notes.length ? (
            <div className="review-summary-notes">
              {extractionSummary.notes.map((note) => (
                <p key={note}>{note}</p>
              ))}
            </div>
          ) : null}
        </div>
      </section>

      <AIQuestionBankReviewClient bank={bank} initialItems={items} />

      <ReviewPublishBar
        bankId={bank.id}
        published={published}
        isLicenta={isLicenta}
        questionCount={items.length}
        unresolvedReviewCount={unresolvedReviewCount}
        publishedHref={publishedHref}
        publishAction={publishQuestionBankAction}
      />
    </main>
  );
}
