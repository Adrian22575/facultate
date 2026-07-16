import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { AdminCenterClient } from "@/components/admin-center-client";
import { AdminMainTabsClient } from "@/components/admin-main-tabs-client";
import { AdminOpenAILogsPanel } from "@/components/admin-openai-logs-panel";
import { AdminUploadErrorsPanel } from "@/components/admin-upload-errors-panel";
import { requireAdmin } from "@/lib/admin";
import {
  getAdminAcademicStructureOverview,
  getAdminBillingOverview,
  getAdminFeedbackEntries,
  getAdminFailedUploadsOverview,
  getAdminFreeAccessOverview,
  getAdminLearningStudySetsOverview,
  getAdminOpenAIRequestLogs,
  getAdminSubjectsOverview,
  getAdminTestimonialRewardEntries,
  getAdminUsageAnalyticsOverview,
  getAdminUsersOverview
} from "@/lib/admin-center";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Center | Nota 5+"
};

function getAdminFocus({ processing = 0, uploads = 0 }) {
  if (uploads > 0) {
    return {
      label: "Necesită atenție",
      title: "Upload-uri de verificat",
      detail: `${uploads} upload-uri au nevoie de revizuire înainte de a continua procesarea.`,
      action: "Vezi upload-urile",
      href: "/admin?admin_tab=uploads"
    };
  }

  if (processing > 0) {
    return {
      label: "Necesită atenție",
      title: "Procesări oprite",
      detail: `${processing} procesări nu s-au finalizat și au nevoie de verificare.`,
      action: "Vezi procesările",
      href: "/admin?admin_tab=processing"
    };
  }

  return {
    label: "Operațiuni",
    title: "Alege zona pe care o gestionezi",
    detail: "Datele se deschid numai pentru tabul selectat, ca administrarea să rămână rapidă.",
    action: "Vezi platforma",
    href: "/admin"
  };
}

export default async function AdminPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const adminUser = await requireAdmin("/admin");
  const adminTab =
    resolvedSearchParams?.admin_tab === "processing" || resolvedSearchParams?.admin_tab === "openai"
      ? "processing"
      : resolvedSearchParams?.admin_tab === "uploads"
        ? "uploads"
        : "platform";

  let platformData = null;
  let failedUploads = [];
  let openAILogs = [];
  let openAICostDashboard = null;
  let openAILogsWarning = null;

  if (adminTab === "platform") {
    const [
      feedbackEntries,
      billingData,
      usersData,
      subjectsData,
      academicData,
      freeAccessData,
      testimonialRewardEntries,
      usageAnalytics,
      learningAnalytics
    ] = await Promise.all([
      getAdminFeedbackEntries(),
      getAdminBillingOverview(),
      getAdminUsersOverview(),
      getAdminSubjectsOverview(),
      getAdminAcademicStructureOverview(),
      getAdminFreeAccessOverview(),
      getAdminTestimonialRewardEntries(),
      getAdminUsageAnalyticsOverview(),
      getAdminLearningStudySetsOverview()
    ]);

    platformData = {
      feedbackEntries,
      billingData,
      usersData,
      subjectsData,
      academicData,
      freeAccessData,
      testimonialRewardEntries,
      usageAnalytics,
      learningAnalytics
    };
  }

  if (adminTab === "processing") {
    try {
      const openAIData = await getAdminOpenAIRequestLogs();
      openAILogs = openAIData.rows || [];
      openAICostDashboard = openAIData.costDashboard || null;
      openAILogsWarning = openAIData.warning || null;
    } catch {
      openAILogsWarning =
        "Logurile de procesare nu sunt disponibile inca. Ruleaza migrarea de logging tehnic 0017.";
    }
  }

  if (adminTab === "uploads") {
    failedUploads = await getAdminFailedUploadsOverview();
  }

  const adminActionSummary = {
    platform: 0,
    processing: openAILogs.filter((row) => row.status === "failed" || row.job_status === "failed").length,
    uploads: failedUploads.length,
    billing: 0,
    testimonials: 0
  };
  const adminFocus = getAdminFocus(adminActionSummary);

  return (
    <main className="app-shell">
      <AppHeader
        suppressAdminActionCount
        action={
          <Link className="btn-back" href="/">
            Inapoi la aplicatie
          </Link>
        }
        title="Admin Center"
        subtitle="Urmărești ce are nevoie de atenție și gestionezi platforma."
      />

      <section className="surface admin-hero">
        <div className="admin-focus-card">
          <div>
            <span className="ui-section-label">{adminFocus.label}</span>
            <h2>{adminFocus.title}</h2>
            <p>{adminFocus.detail}</p>
          </div>
          <Link className="btn-link" href={adminFocus.href}>
            {adminFocus.action}
          </Link>
        </div>

        {platformData ? (
          <div className="admin-overview-grid admin-overview-grid-compact">
            <article className="admin-overview-card">
              <span className="admin-overview-label">Utilizatori</span>
              <strong>{platformData.usersData.length}</strong>
              <span className="status-pill is-muted">înregistrări recente</span>
            </article>
            <article className="admin-overview-card">
              <span className="admin-overview-label">Materiale</span>
              <strong>{platformData.learningAnalytics.totalStudySets}</strong>
              <span className="status-pill is-muted">pregătite</span>
            </article>
            <article className="admin-overview-card">
              <span className="admin-overview-label">Activitate</span>
              <strong>{platformData.usageAnalytics.totalEvents}</strong>
              <span className="status-pill is-muted">ultimele 30 zile</span>
            </article>
          </div>
        ) : null}
      </section>

      <AdminMainTabsClient
        defaultTab={adminTab}
        tabCounts={{
          platform: null,
          processing: adminTab === "processing" ? openAILogs.length : null,
          uploads: adminTab === "uploads" ? failedUploads.length : null
        }}
        tabActionCounts={adminActionSummary}
        platformContent={
          platformData ? (
            <AdminCenterClient
              initialQuery={resolvedSearchParams || {}}
              feedbackEntries={platformData.feedbackEntries}
              billingData={platformData.billingData}
              usersData={platformData.usersData}
              subjectsData={platformData.subjectsData}
              academicData={platformData.academicData}
              freeAccessData={platformData.freeAccessData}
              testimonialRewardEntries={platformData.testimonialRewardEntries}
              usageAnalytics={platformData.usageAnalytics}
              learningAnalytics={platformData.learningAnalytics}
              adminActionSummary={adminActionSummary}
              currentAdminUserId={adminUser.id}
            />
          ) : null
        }
        openaiContent={
          adminTab === "processing" ? (
            <AdminOpenAILogsPanel
              rows={openAILogs}
              costDashboard={openAICostDashboard}
              warning={openAILogsWarning}
            />
          ) : null
        }
        uploadsContent={adminTab === "uploads" ? <AdminUploadErrorsPanel rows={failedUploads} /> : null}
      />
    </main>
  );
}
