import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { GamificationProgressPage } from "@/components/gamification-progress-page";
import {
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { getGamificationSummary } from "@/lib/gamification";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Progresul meu | Nota 5+"
};

export default async function MyProgressPage() {
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);

  if (!user) {
    redirect("/auth/login?next=/progresul-meu");
  }

  if (demoMode) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/progresul-meu"));
  }

  const summary = await getGamificationSummary(user.id);

  return (
    <main className="app-shell">
      <AppHeader
        title="Progresul meu"
        subtitle="Puncte, streak, niveluri si realizari obtinute prin sesiuni reale de invatare."
      />
      <GamificationProgressPage summary={summary} />
    </main>
  );
}
