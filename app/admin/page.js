import { AppHeader } from "@/components/app-header";
import { AdminCenterClient } from "@/components/admin-center-client";
import { AdminMainTabsClient } from "@/components/admin-main-tabs-client";
import { AdminOpenAILogsPanel } from "@/components/admin-openai-logs-panel";
import { AdminUploadErrorsPanel } from "@/components/admin-upload-errors-panel";
import { AdminDictionaryPanel } from "@/components/admin-dictionary-panel";
import { AdminEditorialPanel } from "@/components/admin-editorial-panel";
import { requireAdmin } from "@/lib/admin";
import { getDictionaryAdminOverview } from "@/lib/dictionary/server";
import { getEditorialAdminOverview } from "@/lib/editorial/server";
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

export default async function AdminPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const adminUser = await requireAdmin("/admin");
  const adminTab =
    resolvedSearchParams?.admin_tab === "processing" || resolvedSearchParams?.admin_tab === "openai"
      ? "processing"
      : resolvedSearchParams?.admin_tab === "uploads"
        ? "uploads"
        : resolvedSearchParams?.admin_tab === "dictionary"
          ? "dictionary"
          : resolvedSearchParams?.admin_tab === "editorial"
            ? "editorial"
            : "platform";

  let platformData = null;
  let failedUploads = [];
  let openAILogs = [];
  let openAICostDashboard = null;
  let openAILogsWarning = null;
  let dictionaryData = null;
  let editorialData = null;

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

  if (adminTab === "dictionary") {
    dictionaryData = await getDictionaryAdminOverview();
  }
  if (adminTab === "editorial") editorialData = await getEditorialAdminOverview();

  const adminActionSummary = {
    platform: 0,
    processing: openAILogs.filter((row) => row.status === "failed" || row.job_status === "failed").length,
    uploads: failedUploads.length,
    dictionary: 0,
    editorial: 0,
    billing: 0,
    testimonials: 0
  };
  return (
    <main className="app-shell">
      <AppHeader suppressAdminActionCount hidePageTitle />

      <AdminMainTabsClient
        defaultTab={adminTab}
        tabCounts={{
          platform: null,
          processing: adminTab === "processing" ? openAILogs.length : null,
          uploads: adminTab === "uploads" ? failedUploads.length : null,
          dictionary: adminTab === "dictionary" ? dictionaryData?.terms.length || 0 : null,
          editorial: adminTab === "editorial" ? editorialData?.articles.length || 0 : null
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
        dictionaryContent={adminTab === "dictionary" ? <AdminDictionaryPanel {...dictionaryData} /> : null}
        editorialContent={adminTab === "editorial" ? <AdminEditorialPanel {...editorialData} /> : null}
      />
    </main>
  );
}
