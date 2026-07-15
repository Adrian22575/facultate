"use client";

import {
  ArrowRight,
  FileUp,
  GraduationCap
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { AppHeaderNavigation } from "@/components/app-header-navigation";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { SubjectsListClient } from "@/components/subjects-list-client";
import { getLastSession } from "@/lib/session-storage";

export function DashboardPageClient({
  subjects,
  subjectAllocations = [],
  userType = "student",
  isAuthenticated = false,
  isAdmin = false,
  adminActionCount = 0,
  billingSnapshot = null,
  gamificationSummary = null
}) {
  const [lastSession, setLastSession] = useState(null);
  const [sessionEntryStep, setSessionEntryStep] = useState("entry");

  useEffect(() => {
    setLastSession(getLastSession());
  }, []);

  const hasLastSession = Boolean(lastSession?.url);

  function openSubjectPicker() {
    setSessionEntryStep("subject-picker");
    window.requestAnimationFrame(() => {
      document.getElementById("start-sesiune")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <nav className="dashboard-top-nav">
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
              <Link href="/auth/login?next=/" className="dashboard-nav-btn">
                Intra in cont
              </Link>
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

        <section className="dashboard-home-intro" aria-labelledby="dashboard-home-title">
          <div>
            <h1 id="dashboard-home-title">Cum vrei sa inveti azi?</h1>
            <p>Alege un punct de plecare. Restul optiunilor apar pe parcurs.</p>
          </div>
          {hasLastSession ? (
            <PendingNavigationLink
              href={lastSession.url}
              className="dashboard-resume-link"
              pendingLabel="Se reia sesiunea..."
              pendingMode="replace"
            >
              <span>Ultima sesiune</span>
              <strong>{lastSession.subjectTitle || "Materia ta"}</strong>
              <em>{lastSession.mode || "Reia"}</em>
              <ArrowRight aria-hidden="true" size={16} strokeWidth={2.4} />
            </PendingNavigationLink>
          ) : null}
        </section>

        <section className="dashboard-start-layout">
          <div id="start-sesiune" className="dashboard-main-stack">
            {sessionEntryStep === "entry" ? (
              <section className="dashboard-start-grid" aria-label="Alege cum incepi sa inveti">
                <article className="dashboard-start-card is-practice">
                  <div className="dashboard-start-card-icon" aria-hidden="true">
                    <GraduationCap size={28} strokeWidth={2.25} />
                  </div>
                  <div className="dashboard-start-card-copy">
                    <span>Pasul 1</span>
                    <h2>Exerseaza si recapituleaza</h2>
                    <p>Alege materia, apoi invata in ritmul tau prin studiu, teste si recapitulare.</p>
                  </div>
                  <button type="button" className="dashboard-start-card-action" onClick={openSubjectPicker}>
                    Alege o materie
                    <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
                  </button>
                </article>

                <article className="dashboard-start-card is-materials">
                  <div className="dashboard-start-card-icon" aria-hidden="true">
                    <FileUp size={27} strokeWidth={2.25} />
                  </div>
                  <div className="dashboard-start-card-copy">
                    <span>Pasul 1</span>
                    <h2>Invata din materialele tale</h2>
                    <p>Incarca un curs sau notitele tale si transforma-le intr-un punct de plecare pentru invatare.</p>
                  </div>
                  <PendingNavigationLink
                    href="/materiale/invata"
                    className="dashboard-start-card-action"
                    pendingLabel="Se deschide incarcarea..."
                    pendingMode="replace"
                  >
                    Adauga un material
                    <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
                  </PendingNavigationLink>
                </article>
              </section>
            ) : (
              <div className="section-card dashboard-main-card dashboard-main-card-stepper">
                <div className="dashboard-stepper-head">
                  <div className="dashboard-stepper-copy">
                    <span className="dashboard-stepper-kicker">Exerseaza si recapituleaza</span>
                    <h2>Alege materia</h2>
                    <p className="section-sub">
                      Dupa ce alegi materia, poti continua cu Studiu, Test sau Interactiv.
                    </p>
                  </div>

                  <button
                    type="button"
                    className="btn-link secondary dashboard-stepper-back"
                    onClick={() => setSessionEntryStep("entry")}
                  >
                    Inapoi la optiuni
                  </button>
                </div>

                <SubjectsListClient
                  subjects={subjects}
                  subjectAllocations={subjectAllocations}
                  userType={userType}
                  embedded
                  title="Materii disponibile"
                  description="Toate materiile sunt vizibile din start. Anul, semestrul si clasa sunt doar filtre optionale."
                  sectionId="materii-list"
                />

                <div className="dashboard-license-path">
                  <div>
                    <span>Pregatire pentru examen</span>
                    <h3>Ai de pregatit licenta?</h3>
                    <p>Lucreaza separat cu intrebarile si simularile pentru examenul tau.</p>
                  </div>
                  <PendingNavigationLink
                    href="/licenta-exam"
                    className="dashboard-license-path-link"
                    pendingLabel="Se deschide pregatirea..."
                    pendingMode="replace"
                  >
                    Vezi pregatirea pentru licenta
                    <ArrowRight aria-hidden="true" size={16} strokeWidth={2.4} />
                  </PendingNavigationLink>
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
