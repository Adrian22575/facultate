import { redirect } from "next/navigation";

import { LearningUploadForm } from "@/components/learning-upload-form";
import { WorkspaceUploadShell } from "@/components/workspace-upload-shell";
import {
  getAcademicCommunityLabel,
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { getBillingSnapshot } from "@/lib/billing";
import { getAccessibleSubjectsForUser } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";
import { getLearningSetupErrorMessage } from "@/lib/supabase/setup-status";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Invata din materia ta | Nota 5+"
};

export default async function LearningUploadPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) {
    redirect("/auth/login?next=/materiale/invata");
  }

  if (demoMode) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/materiale/invata"));
  }

  let billingSnapshot = { aiCredits: 0 };
  let subjects = [];
  let setupWarning = null;

  try {
    const [snapshot, catalog] = await Promise.all([
      getBillingSnapshot(user.id),
      getAccessibleSubjectsForUser({
        userId: user.id,
        membership: academicContext.membership,
        userType: academicContext.profile?.user_type === "elev" ? "elev" : "student"
      })
    ]);
    billingSnapshot = snapshot;
    subjects = catalog.subjects;
  } catch (error) {
    setupWarning =
      getLearningSetupErrorMessage(error) ||
      "Pagina nu a putut fi pregatita complet momentan. Incearca din nou.";
  }

  const error =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : null;
  const message =
    typeof resolvedSearchParams?.message === "string" ? resolvedSearchParams.message : null;
  const communityLabel = getAcademicCommunityLabel(academicContext);
  const title = "Invata din materia ta";
  const subtitle = "Incarca un curs, notite sau prezentari si primesti capitole, flashcards si teste.";
  const meta = [
    `${billingSnapshot.aiCredits || 0} incarcari disponibile`,
    communityLabel
  ].filter(Boolean);
  const alerts = (
    <>
      {setupWarning ? <div className="error-state" role="alert">{setupWarning}</div> : null}
      {error ? <div className="error-state" role="alert">{error}</div> : null}
      {message ? <div className="learning-upload-success" role="status">{message}</div> : null}
    </>
  );

  return (
    <WorkspaceUploadShell
      title={title}
      subtitle={subtitle}
      meta={meta}
      alerts={alerts}
    >
      <LearningUploadForm
        billingSnapshot={billingSnapshot}
        setupWarning={setupWarning}
        subjects={subjects}
        initialSubjectId={typeof resolvedSearchParams?.subjectId === "string" ? resolvedSearchParams.subjectId : ""}
      />
    </WorkspaceUploadShell>
  );
}
