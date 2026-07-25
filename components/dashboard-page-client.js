"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { AppHeaderNavigation } from "@/components/app-header-navigation";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { SubjectsListClient } from "@/components/subjects-list-client";
import { getLastSession } from "@/lib/session-storage";
import { getSubjectResumeCandidate } from "@/lib/subject-library";

export function DashboardPageClient({
  subjects,
  subjectLibrary = [],
  subjectAllocations = [],
  licentaExam = null,
  userType = "student",
  isAuthenticated = false,
  isAdmin = false,
  adminActionCount = 0,
  billingSnapshot = null,
  gamificationSummary = null
}) {
  const [lastSession, setLastSession] = useState(null);

  useEffect(() => {
    setLastSession(getLastSession());
  }, []);

  const resumeSession = useMemo(() => {
    const candidate = getSubjectResumeCandidate({ lastSession, subjectLibrary });
    if (!candidate) return null;

    return {
      href: candidate.href,
      title: candidate.subject.title
    };
  }, [lastSession, subjectLibrary]);

  const resumeAction = resumeSession ? (
    <PendingNavigationLink
      href={resumeSession.href}
      className="subjects-resume-link"
      pendingLabel="Se reia sesiunea..."
      pendingMode="replace"
    >
      <span>Continua:</span>
      <strong>{resumeSession.title}</strong>
      <ArrowRight aria-hidden="true" size={17} strokeWidth={2.4} />
    </PendingNavigationLink>
  ) : null;

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <nav className="dashboard-top-nav app-mobile-navigation-bar">
          <Link className="brand" href="/">
            <div className="brand-mark">5+</div>
            <span>Nota 5+</span>
          </Link>

          {isAuthenticated ? (
            <AppHeaderNavigation
              showPrivateNav
              showLogout
              showAdminLink={isAdmin}
              adminActionCount={adminActionCount}
              logoutLabel="Logout"
              billingSnapshot={billingSnapshot}
              gamificationSummary={gamificationSummary}
            />
          ) : (
            <div className="dashboard-nav-actions">
              <Link href="/auth/exit-demo?target=login" className="dashboard-nav-btn">Intra in cont</Link>
              <GoogleSignInButton
                next="/"
                className="dashboard-google-wrap"
                buttonClassName="dashboard-nav-btn dashboard-nav-btn-primary"
                errorClassName="nota5plus-inline-error"
              >
                Continua cu Google
              </GoogleSignInButton>
            </div>
          )}
        </nav>

        <section className="dashboard-subject-library-layout" aria-label="Biblioteca de materii">
          <SubjectsListClient
            subjects={subjects}
            subjectLibrary={subjectLibrary}
            subjectAllocations={subjectAllocations}
            licentaExam={licentaExam}
            userType={userType}
            embedded
            headerAction={resumeAction}
            sectionId="materii-list"
          />
        </section>
      </div>
    </div>
  );
}
