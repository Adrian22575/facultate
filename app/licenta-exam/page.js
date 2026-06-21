import Link from "next/link";
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
  const initialMistakeIds = await getActiveLicentaMistakeIds(user.id);

  return (
    <main className="app-shell">
      <AppHeader
        action={
          <div className="licenta-header-actions">
            <Link className="btn-back" href="/">
              Inapoi la dashboard
            </Link>
            <Link className="btn-link secondary" href="/statistici">
              Vezi statistici
            </Link>
          </div>
        }
        title="Pregatire licenta"
        subtitle="Alege cum vrei sa te pregatesti azi. Fa o runda rapida, un antrenament mai lung sau repeta doar intrebarile gresite."
      />

      <ExamPageClient
        questions={questions}
        subjectCount={subjects.length}
        initialMistakeIds={initialMistakeIds}
      />
    </main>
  );
}
