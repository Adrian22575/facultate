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

export const metadata = {
  title: "Statistici | Nota 5+"
};

export default async function StatsPage() {
  const user = await getOptionalUser();
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
        title="Statistici"
        subtitle="Vezi ce ai lucrat și alege următorul pas."
      />

      <OverallStatsDashboard stats={stats} />
    </main>
  );
}
