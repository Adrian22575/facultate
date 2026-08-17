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
import { measureServerTiming } from "@/lib/server-timing";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Progresul meu | Nota 5+"
};

async function renderMyProgressPage() {
  const user = await measureServerTiming("page.get_user", getOptionalUser, { route: "/progresul-meu" });
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
        user={user}
        gamificationSummary={summary}
        title="Progres"
        subtitle="Vezi ce ai făcut și alege următorul pas de învățare."
      />
      <GamificationProgressPage summary={summary} />
    </main>
  );
}

export default async function MyProgressPage() {
  return measureServerTiming("page.loader", renderMyProgressPage, { route: "/progresul-meu" });
}
