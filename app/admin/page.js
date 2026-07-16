import Link from "next/link";

import { AppHeader } from "@/components/app-header";
import { AdminCenterClient } from "@/components/admin-center-client";
import { AdminMainTabsClient } from "@/components/admin-main-tabs-client";
import { AdminOpenAILogsPanel } from "@/components/admin-openai-logs-panel";
import { AdminUploadErrorsPanel } from "@/components/admin-upload-errors-panel";
import { requireAdmin } from "@/lib/admin";
import {
  buildAdminActionSummary,
  getAdminAcademicStructureOverview,
  getAdminBillingOverview,
  getAdminFeedbackEntries,
  getAdminFailedUploadsOverview,
  getAdminFreeAccessOverview,
  getAdminLearningStudySetsOverview,
  getAdminNotificationViews,
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

function getAdminFocus(actionSummary) {
  const pending = actionSummary.raw || {};

  if (pending.uploads > 0) {
    return {
      label: "Necesită atenție",
      title: "Upload-uri de verificat",
      detail: `${pending.uploads} upload-uri au nevoie de revizuire înainte de a continua procesarea.`,
      action: "Vezi upload-urile",
      href: "/admin?admin_tab=uploads"
    };
  }

  if (pending.processing > 0) {
    return {
      label: "Necesită atenție",
      title: "Procesări oprite",
      detail: `${pending.processing} procesări nu s-au finalizat și au nevoie de verificare.`,
      action: "Vezi procesările",
      href: "/admin?admin_tab=processing"
    };
  }

  if (pending.billing > 0) {
    return {
      label: "Necesită atenție",
      title: "Plăți de verificat",
      detail: `${pending.billing} webhook-uri au raportat o problemă.`,
      action: "Vezi plățile",
      href: "/admin?section=billing"
    };
  }

  if (pending.testimonials > 0) {
    return {
      label: "Necesită atenție",
      title: "Testimoniale în așteptare",
      detail: `${pending.testimonials} testimoniale așteaptă aprobarea.`,
      action: "Vezi testimonialele",
      href: "/admin?section=testimonials&testimonials=pending"
    };
  }

  return {
    label: "Operațiuni",
    title: "Nu sunt acțiuni urgente",
    detail: "Platforma nu are erori sau aprobări în așteptare.",
    action: "Vezi feedback-ul",
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

  const [
    feedbackEntries,
    billingData,
    usersData,
    subjectsData,
    academicData,
    freeAccessData,
    testimonialRewardEntries,
    usageAnalytics,
    learningAnalytics,
    failedUploads,
    notificationViews
  ] = await Promise.all([
    getAdminFeedbackEntries(),
    getAdminBillingOverview(),
    getAdminUsersOverview(),
    getAdminSubjectsOverview(),
    getAdminAcademicStructureOverview(),
    getAdminFreeAccessOverview(),
    getAdminTestimonialRewardEntries(),
    getAdminUsageAnalyticsOverview(),
    getAdminLearningStudySetsOverview(),
    getAdminFailedUploadsOverview(),
    getAdminNotificationViews(adminUser.id)
  ]);

  let openAILogs = [];
  let openAICostDashboard = null;
  let openAILogsWarning = null;

  try {
    const openAIData = await getAdminOpenAIRequestLogs();
    openAILogs = openAIData.rows || [];
    openAICostDashboard = openAIData.costDashboard || null;
    openAILogsWarning = openAIData.warning || null;
  } catch (error) {
    openAILogsWarning =
      "Logurile de procesare nu sunt disponibile inca. Ruleaza migrarea de logging tehnic 0017.";
  }

  const adminActionSummary = buildAdminActionSummary({
    testimonialRewardEntries,
    failedUploads,
    openAILogs,
    billingData,
    notificationViews
  });
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
        subtitle="Urmărește ce are nevoie de atenție și gestionează platforma."
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

        <div className="admin-overview-grid admin-overview-grid-compact">
          <article className="admin-overview-card">
            <span className="admin-overview-label">Utilizatori</span>
            <strong>{usersData.length}</strong>
            <span className="status-pill is-muted">înregistrări recente</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Materiale</span>
            <strong>{learningAnalytics.totalStudySets}</strong>
            <span className="status-pill is-muted">pregătite</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Activitate</span>
            <strong>{usageAnalytics.totalEvents}</strong>
            <span className="status-pill is-muted">ultimele 30 zile</span>
          </article>
        </div>
      </section>

      <AdminMainTabsClient
        defaultTab={adminTab}
        tabCounts={{
          platform: null,
          processing: null,
          uploads: failedUploads.length
        }}
        tabActionCounts={{
          platform: adminActionSummary.platform,
          processing: adminActionSummary.processing,
          uploads: adminActionSummary.uploads
        }}
        platformContent={
          <AdminCenterClient
            initialQuery={resolvedSearchParams || {}}
            feedbackEntries={feedbackEntries}
            billingData={billingData}
            usersData={usersData}
            subjectsData={subjectsData}
            academicData={academicData}
            freeAccessData={freeAccessData}
            testimonialRewardEntries={testimonialRewardEntries}
            usageAnalytics={usageAnalytics}
            learningAnalytics={learningAnalytics}
            adminActionSummary={adminActionSummary}
            currentAdminUserId={adminUser.id}
          />
        }
        openaiContent={
          <AdminOpenAILogsPanel
            rows={openAILogs}
            costDashboard={openAICostDashboard}
            warning={openAILogsWarning}
          />
        }
        uploadsContent={<AdminUploadErrorsPanel rows={failedUploads} />}
      />
    </main>
  );
}
