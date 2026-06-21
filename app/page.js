import { redirect } from "next/navigation";

import { DashboardPageClient } from "@/components/dashboard-page-client";
import LoginPage from "@/app/auth/login/page";
import { isAdminUser } from "@/lib/admin";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getBillingSnapshot } from "@/lib/billing";
import { getAdminActionSummary } from "@/lib/admin-center";
import { getAccessibleSubjectsForUser, getUserSubjectProgress } from "@/lib/data";
import { isDemoUser } from "@/lib/demo-user";
import { getPublicSiteUrl } from "@/lib/site";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Nota 5+ | Invatare rapida pentru examene si licenta",
  description:
    "Platforma pentru invatare rapida: teste grila pe materii, mod studiu, intrebari gresite si simulare examen licenta pentru elevi si studenti.",
  alternates: {
    canonical: "/"
  },
  openGraph: {
    title: "Nota 5+ | Invatare rapida pentru examene si licenta",
    description:
      "Invata mai usor din cursuri, grile si materiale de facultate. Repeta rapid cu teste, mod studiu si simulare de licenta.",
    url: "/",
    siteName: "Nota 5+",
    locale: "ro_RO",
    type: "website"
  },
  twitter: {
    card: "summary_large_image",
    title: "Nota 5+ | Invatare rapida pentru examene si licenta",
    description:
      "Teste grila, recapitulare si simulare de licenta pentru studenti si elevi."
  },
  keywords: [
    "invatare rapida",
    "teste grila",
    "simulare licenta",
    "pregatire examen",
    "recapitulare facultate",
    "teste pe materii",
    "intrebari grila facultate",
    "platforma invatare studenti"
  ]
};

function HomeStructuredData() {
  const siteUrl = getPublicSiteUrl();
  const graph = [
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      name: "Nota 5+",
      url: siteUrl,
      inLanguage: "ro-RO",
      description:
        "Platforma de invatare rapida pentru elevi si studenti: teste grila, recapitulare, mod studiu si simulare de licenta."
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${siteUrl}/#app`,
      name: "Nota 5+",
      applicationCategory: "EducationalApplication",
      operatingSystem: "Web",
      url: siteUrl,
      inLanguage: "ro-RO",
      description:
        "Aplicatie web pentru invatare rapida, teste grila pe materii, recapitulare pentru elevi si studenti si simulare examen licenta.",
      audience: [
        {
          "@type": "EducationalAudience",
          educationalRole: "student"
        },
        {
          "@type": "EducationalAudience",
          educationalRole: "elev"
        }
      ]
    }
  ];

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify({
          "@context": "https://schema.org",
          "@graph": graph
        })
      }}
    />
  );
}

export default async function HomePage() {
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);
  let academicContext = null;
  const adminStatePromise = user ? isAdminUser(user) : Promise.resolve(false);

  if (!user) {
    return (
      <>
        <HomeStructuredData />
        <LoginPage searchParams={{ next: "/" }} />
      </>
    );
  }

  if (demoMode) {
    redirect("/demo");
  }

  if (!demoMode) {
    academicContext = await getAcademicContext(user.id);

    if (!isAcademicContextComplete(academicContext)) {
      redirect(getOnboardingHref("/"));
    }
  }

  const userType = academicContext?.profile?.user_type === "elev" ? "elev" : "student";
  const [accessibleCatalog, progressItems, billingSnapshot] = await Promise.all([
    getAccessibleSubjectsForUser({
      userId: user.id,
      membership: academicContext?.membership,
      userType
    }),
    getUserSubjectProgress(user.id, 2),
    getBillingSnapshot(user.id).catch(() => null)
  ]);
  const isAdmin = await adminStatePromise;
  const adminActionCount = isAdmin
    ? await getAdminActionSummary(user.id).then((summary) => summary.total || 0).catch(() => 0)
    : 0;

  return (
    <main className="app-shell">
      <DashboardPageClient
        subjects={accessibleCatalog.subjects}
        subjectAllocations={accessibleCatalog.subjectAllocations}
        progressItems={progressItems}
        userType={userType}
        isAuthenticated
        isAdmin={isAdmin}
        adminActionCount={adminActionCount}
        billingSnapshot={billingSnapshot}
      />
    </main>
  );
}
