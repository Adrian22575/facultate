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
  getAdminNotificationViews,
  getAdminOpenAIRequestLogs,
  getAdminSubjectsOverview,
  getAdminTestimonialRewardEntries,
  getAdminUsersOverview
} from "@/lib/admin-center";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Admin Center | Nota 5+"
};

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

  const platformItemCount =
    feedbackEntries.length +
    billingData.premiumRows.length +
    billingData.creditRows.length +
    billingData.webhookRows.length +
    usersData.length +
    Number(subjectsData.totalSubjects || subjectsData.rows?.length || 0) +
    Number(academicData.counts?.institutions || 0) +
    Number(academicData.counts?.faculties || 0) +
    freeAccessData.rows.length +
    testimonialRewardEntries.length;
  const adminActionSummary = buildAdminActionSummary({
    testimonialRewardEntries,
    failedUploads,
    openAILogs,
    billingData,
    notificationViews
  });

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
        subtitle="Vezi rapid feedback-ul, platile, utilizatorii si gestioneaza accesul gratuit premium."
      />

      <section className="surface admin-hero">
        <div className="admin-overview-grid">
          <article className="admin-overview-card">
            <span className="admin-overview-label">Feedback recent</span>
            <strong>{feedbackEntries.length}</strong>
            <span className="status-pill is-muted">intrari</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Granturi premium</span>
            <strong>{billingData.premiumRows.length}</strong>
            <span className="status-pill is-muted">recente</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Webhook-uri Stripe</span>
            <strong>{billingData.webhookRows.length}</strong>
            <span className="status-pill is-muted">recente</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Utilizatori</span>
            <strong>{usersData.length}</strong>
            <span className="status-pill is-muted">incarcati</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Materii</span>
            <strong>{subjectsData.totalSubjects}</strong>
            <span className="status-pill is-muted">totale</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Institutii</span>
            <strong>{academicData.counts.institutions}</strong>
            <span className="status-pill is-muted">totale</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Facultati</span>
            <strong>{academicData.counts.faculties}</strong>
            <span className="status-pill is-muted">totale</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Acces gratuit</span>
            <strong>{freeAccessData.active}</strong>
            <span className="status-pill is-muted">active</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Review-uri</span>
            <strong>{testimonialRewardEntries.filter((entry) => entry.status === "pending").length}</strong>
            <span className="status-pill is-muted">de aprobat</span>
          </article>
          <article className="admin-overview-card">
            <span className="admin-overview-label">Procesari</span>
            <strong>{openAILogs.length}</strong>
            <span className="status-pill is-muted">recente</span>
          </article>
        </div>
      </section>

      <AdminMainTabsClient
        defaultTab={adminTab}
        tabCounts={{
          platform: platformItemCount,
          processing: openAILogs.length,
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
