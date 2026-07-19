import { notFound } from "next/navigation";

import { AdminCenterClient } from "@/components/admin-center-client";
import { AdminDictionaryPanel } from "@/components/admin-dictionary-panel";
import { AdminEditorialPanel } from "@/components/admin-editorial-panel";
import { AdminOpenAILogsPanel } from "@/components/admin-openai-logs-panel";
import { AdminPageShell } from "@/components/admin-page-shell";
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
import { getAdminRoute } from "@/lib/admin-routes";
import { getDictionaryAdminOverview } from "@/lib/dictionary/server";
import { getEditorialAdminOverview } from "@/lib/editorial/server";
import { getLinkedInAdminOverview } from "@/lib/linkedin/server";

export const dynamic = "force-dynamic";

const EMPTY_PLATFORM_DATA = {
  feedbackEntries: [],
  billingData: { premiumRows: [], creditRows: [], webhookRows: [] },
  usersData: [],
  subjectsData: { rows: [], totalSubjects: 0 },
  academicData: { institutionRows: [], facultyRows: [], counts: { institutions: 0, faculties: 0, programs: 0, cohorts: 0 } },
  freeAccessData: { rows: [] },
  testimonialRewardEntries: [],
  usageAnalytics: null,
  learningAnalytics: null
};

export async function generateMetadata({ params }) {
  const route = getAdminRoute((await params)?.adminPath || []);
  return { title: route ? `${route.label} | Admin Nota 5+` : "Admin Center | Nota 5+" };
}

async function getPlatformData(route) {
  const data = { ...EMPTY_PLATFORM_DATA };
  if (route.section === "feedback") data.feedbackEntries = await getAdminFeedbackEntries();
  if (route.section === "billing") data.billingData = await getAdminBillingOverview();
  if (route.section === "users") data.usersData = await getAdminUsersOverview();
  if (route.section === "subjects") data.subjectsData = await getAdminSubjectsOverview();
  if (route.section === "academic") data.academicData = await getAdminAcademicStructureOverview();
  if (route.section === "free-access") data.freeAccessData = await getAdminFreeAccessOverview();
  if (route.section === "testimonials") data.testimonialRewardEntries = await getAdminTestimonialRewardEntries();
  if (route.section === "analytics") {
    [data.usageAnalytics, data.learningAnalytics] = await Promise.all([
      getAdminUsageAnalyticsOverview(),
      getAdminLearningStudySetsOverview()
    ]);
  }
  return data;
}

export default async function AdminSubpage({ params, searchParams }) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;
  const route = getAdminRoute(resolvedParams?.adminPath || []);
  if (!route) notFound();

  const adminUser = await requireAdmin(route.path);
  let content = null;

  if (route.kind === "platform") {
    const platformData = await getPlatformData(route);
    content = (
      <AdminCenterClient
        key={route.path}
        {...platformData}
        initialQuery={resolvedSearchParams || {}}
        fixedSection={route.section}
        fixedBillingView={route.billingView || ""}
        fixedAcademicView={route.academicView || ""}
        routeBase={route.path}
        showSectionNavigation={false}
        currentAdminUserId={adminUser.id}
      />
    );
  }

  if (route.kind === "processing") {
    let rows = [];
    let costDashboard = null;
    let warning = null;
    try {
      const data = await getAdminOpenAIRequestLogs();
      rows = data.rows || [];
      costDashboard = data.costDashboard || null;
      warning = data.warning || null;
    } catch {
      warning = "Logurile de procesare nu sunt disponibile momentan.";
    }
    content = <AdminOpenAILogsPanel key={route.path} rows={rows} costDashboard={costDashboard} warning={warning} />;
  }

  if (route.kind === "uploads") {
    content = <AdminUploadErrorsPanel key={route.path} rows={await getAdminFailedUploadsOverview()} />;
  }

  if (route.kind === "dictionary") {
    content = <AdminDictionaryPanel key={route.path} {...await getDictionaryAdminOverview()} />;
  }

  if (route.kind === "editorial") {
    const [editorialData, linkedInData] = await Promise.all([
      getEditorialAdminOverview(),
      getLinkedInAdminOverview()
    ]);
    content = (
      <AdminEditorialPanel
        key={route.path}
        {...editorialData}
        linkedIn={linkedInData}
        initialPane={route.pane}
        initialLinkedInPostId={resolvedSearchParams?.linkedin_post || ""}
      />
    );
  }

  return <AdminPageShell activeRoute={route}>{content}</AdminPageShell>;
}
