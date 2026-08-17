import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { OverallStatsDashboard } from "@/components/overall-stats-dashboard";
import {
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { buildOverallStatsDashboard } from "@/lib/overall-stats-dashboard";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/guards";
import { measureServerTiming } from "@/lib/server-timing";

export const metadata = {
  title: "Statistici | Nota 5+"
};

async function renderStatsPage() {
  const user = await measureServerTiming("page.get_user", getOptionalUser, { route: "/statistici" });
  const demoMode = isDemoUser(user);

  if (!user) {
    redirect("/auth/login?next=/statistici");
  }

  if (demoMode) {
    redirect("/demo");
  }

  const academicContext = await getAcademicContext(user.id);
  if (!isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/statistici"));
  }

  const stats = await buildOverallStatsDashboard({
    admin: createAdminClient(),
    academicContext,
    userId: user.id
  });

  return (
    <main className="app-shell">
      <AppHeader
        user={user}
        title="Statistici"
        subtitle="Vezi ce ai lucrat și alege următorul pas."
      />

      <OverallStatsDashboard stats={stats} />
    </main>
  );
}

export default async function StatsPage() {
  return measureServerTiming("page.loader", renderStatsPage, { route: "/statistici" });
}
