import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { ExamPageClient } from "@/components/exam-page-client";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getAllExamQuestions } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getActiveLicentaMistakeIds } from "@/lib/licenta-exam-mistakes";
import { getOptionalUser } from "@/lib/supabase/guards";

export const metadata = {
  title: "Pregatire licenta | Nota 5+"
};

export default async function ExamPage() {
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);
  let academicContext = null;

  if (!user) {
    redirect("/auth/login?next=/licenta-exam");
  }

  if (demoMode) {
    redirect("/demo");
  }

  if (!demoMode) {
    academicContext = await getAcademicContext(user.id);
    if (!isAcademicContextComplete(academicContext)) {
      redirect(getOnboardingHref("/licenta-exam"));
    }
  }

  const { questions, subjects } = await getAllExamQuestions(
    !demoMode && academicContext?.membership
      ? { userId: user.id, membership: academicContext.membership }
      : {}
  );
  let initialMistakeIds = [];
  try {
    initialMistakeIds = await getActiveLicentaMistakeIds(user.id);
  } catch (error) {
    console.error("licenta_mistakes_load_failed", error);
  }

  return (
    <main className="app-shell">
      <AppHeader title="Pregatire licenta" hidePageTitle />
      <h1 className="sr-only">Pregatire licenta</h1>

      <ExamPageClient
        questions={questions}
        subjectCount={subjects.length}
        initialMistakeIds={initialMistakeIds}
      />
    </main>
  );
}
