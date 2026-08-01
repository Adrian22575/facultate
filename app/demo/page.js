import { redirect } from "next/navigation";

import { AppHeader } from "@/components/app-header";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { LearningModeCard } from "@/components/learning-mode-card";
import { SurfaceCard } from "@/components/ui/surface-card";
import { StatusPill } from "@/components/ui/status";
import { getDemoSubject } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";

import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Demo | Nota 5+",
  description: "Testeaza rapid cum inveti cu Nota 5+ inainte sa intri cu Google."
};

function getDemoModeHref(subjectId, mode) {
  const destination = `/materii/${subjectId}/${mode}`;
  return `/auth/demo-login?next=${encodeURIComponent(destination)}`;
}

export default async function DemoPage() {
  const user = await getOptionalUser();

  if (!user) {
    redirect("/auth/demo-login?next=/demo");
  }

  if (!isDemoUser(user)) {
    redirect("/");
  }

  const demoSubject = await getDemoSubject();
  const demoSubjectId = demoSubject?.id || null;
  const demoSubjectTitle = demoSubject?.title || "o materie demo";

  return (
    <main className="app-shell">
      <AppHeader title="Esti in demo" subtitle="Alege cum vrei sa inveti." />

      <SurfaceCard className={styles.surface}>
        <div className={styles.intro}>
          <StatusPill className={styles.status} tone="warning">Demo</StatusPill>
          <h2 className={styles.heading}>Alege cum vrei sa inveti</h2>
          <p className={styles.subject}>{`Materia demo: ${demoSubjectTitle}`}</p>
        </div>

        <div className={styles.grid}>
          <LearningModeCard
            href={demoSubjectId ? getDemoModeHref(demoSubjectId, "interactiv") : "/demo"}
            mode="interactive"
            eyebrow="Rapid"
            title="Interactiv"
            description="Raspunzi si vezi imediat."
            variant="showcase"
          />
          <LearningModeCard
            href={demoSubjectId ? getDemoModeHref(demoSubjectId, "studiu") : "/demo"}
            mode="study"
            eyebrow="Calm"
            title="Studiaza"
            description="Vezi tot, fara graba."
            variant="showcase"
          />
          <LearningModeCard
            href={demoSubjectId ? getDemoModeHref(demoSubjectId, "test") : "/demo"}
            mode="test"
            eyebrow="Verificare"
            title="Test"
            description="Te verifici rapid."
            variant="showcase"
          />
        </div>
      </SurfaceCard>

      <SurfaceCard className={styles.convert}>
        <div className={styles.convertCopy}>
          <span className={styles.kicker}>Pasul urmator</span>
          <h2 className={styles.heading}>Vrei progres real?</h2>
          <p className={styles.subtitle}>Intra cu Google.</p>
        </div>

        <GoogleSignInButton
          next="/"
          className={styles.googleWrap}
          buttonClassName="nota5plus-btn nota5plus-btn-secondary nota5plus-google-btn"
          errorClassName="nota5plus-inline-error"
        >
          Intra cu Google
        </GoogleSignInButton>
      </SurfaceCard>
    </main>
  );
}
