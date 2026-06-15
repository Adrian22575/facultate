"use client";

import { BookOpenCheck, GraduationCap, PlayCircle } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { HeaderCreditStatus } from "@/components/header-credit-status";
import { PendingNavigationLink } from "@/components/pending-navigation-link";
import { SubjectsListClient } from "@/components/subjects-list-client";
import { getLastSession } from "@/lib/session-storage";

export function DashboardPageClient({
  subjects,
  subjectAllocations = [],
  progressItems = [],
  userType = "student",
  isAuthenticated = false,
  isAdmin = false,
  adminActionCount = 0,
  billingSnapshot = null
}) {
  const [lastSession, setLastSession] = useState(null);
  const [sessionEntryStep, setSessionEntryStep] = useState("entry");
  const fallbackSubject = subjects[0] || null;

  useEffect(() => {
    setLastSession(getLastSession());
  }, []);

  const continueTitle =
    lastSession?.subjectTitle || fallbackSubject?.title || "Analiza economico-financiara";
  const continueMode = lastSession?.mode || "Alege modul";
  const fallbackContinueUrl = fallbackSubject ? `/materii/${fallbackSubject.id}` : "/";
  const continueUrl = isAuthenticated
    ? lastSession?.url || fallbackContinueUrl
    : "/auth/login?next=/";

  return (
    <div className="dashboard-page">
      <div className="dashboard-container">
        <nav className="dashboard-top-nav">
          <div className="brand">
            <div className="brand-mark">5+</div>
            <span>Nota 5+</span>
          </div>

          <div className="dashboard-nav-actions">
            {isAuthenticated ? (
              <>
                {isAdmin ? (
                  <Link href="/admin" className={`dashboard-nav-btn ${adminActionCount > 0 ? "has-admin-action" : ""}`}>
                    Admin
                    {adminActionCount > 0 ? <span className="nav-action-badge">{adminActionCount}</span> : null}
                  </Link>
                ) : null}
                <Link href="/cont" className="dashboard-nav-btn">
                  Contul meu
                </Link>
                <form action="/auth/signout" method="post">
                  <button
                    type="submit"
                    className="dashboard-nav-btn dashboard-logout-btn"
                  >
                    Logout
                  </button>
                </form>
              </>
            ) : (
              <>
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
              </>
            )}
          </div>
        </nav>

        {isAuthenticated && billingSnapshot ? (
          <div className="dashboard-credit-row">
            <HeaderCreditStatus billingSnapshot={billingSnapshot} />
          </div>
        ) : null}

        <section className="dashboard-hero-shell">
          <div className="dashboard-pill">
            <span className="dashboard-dot" />
            Pregatire rapida pentru licenta si examene
          </div>

          <div className="dashboard-hero-grid">
            <div>
              <h1 className="dashboard-hero-title">
                Nu ai invatat cat trebuia?
                <span className="dashboard-accent">
                  {" "}
                  Repeta in 30 de minute ce are sanse sa te salveze.
                </span>
              </h1>
              <p className="section-sub dashboard-hero-subcopy">
                Teste pe materii, simulare de examen si intrebari gresite — ca sa nu mai pierzi
                timp prin cursuri cand examenul e aproape.
              </p>
            </div>

            <div className="dashboard-hero-side">
              <div className="dashboard-hero-side-label">Continua de unde ai ramas</div>
              <h3>{continueTitle}</h3>
              <p>{`Ultimul mod folosit: ${continueMode}`}</p>
              <PendingNavigationLink
                href={continueUrl}
                className="dashboard-hero-side-btn"
                pendingLabel="Se deschide sesiunea..."
                pendingMode="replace"
              >
                Continua acum
              </PendingNavigationLink>
            </div>
          </div>
        </section>

        <section className="dashboard-layout-grid">
          <div className="dashboard-main-stack">
            {sessionEntryStep === "entry" ? (
              <div className="section-card dashboard-main-card dashboard-session-focus-card">
                <div className="dashboard-session-head">
                  <div>
                    <span className="dashboard-session-kicker">Start aici</span>
                    <h2>Incepe sesiunea</h2>
                    <p className="section-sub">Alege modul potrivit pentru ritmul tau de invatare.</p>
                  </div>
                  <div className="dashboard-session-pulse" aria-hidden="true">
                    <PlayCircle size={30} strokeWidth={2.4} />
                  </div>
                </div>

                <div className="dashboard-mode-grid">
                  <div className="dashboard-mode-card dashboard-mode-card-primary">
                    <div className="dashboard-mode-icon is-blue">
                      <GraduationCap size={22} strokeWidth={2.5} />
                    </div>
                    <h3>Teste pe materii</h3>
                    <p>
                      Alege materia si intra direct in modul potrivit: Interactiv, Studiu sau Test.
                    </p>
                    <button
                      type="button"
                      className="dashboard-mode-cta dashboard-mode-cta-primary"
                      onClick={() => setSessionEntryStep("subject-picker")}
                    >
                      Alege materia
                    </button>
                  </div>

                  <div className="dashboard-mode-card">
                    <div className="dashboard-mode-icon is-orange">
                      <BookOpenCheck size={22} strokeWidth={2.5} />
                    </div>
                    <h3>Simulare examen licenta</h3>
                    <p>
                      60 de intrebari aleatorii din toate materiile, cu timer si ritm de examen real.
                    </p>
                    <PendingNavigationLink
                      href="/licenta-exam"
                      className="secondary-button dashboard-mode-cta"
                      pendingLabel="Se porneste simularea..."
                      pendingMode="replace"
                    >
                      Porneste simularea
                    </PendingNavigationLink>
                  </div>
                </div>
              </div>
            ) : (
              <div className="section-card dashboard-main-card dashboard-main-card-stepper">
                <div className="dashboard-stepper-head">
                  <div className="dashboard-stepper-copy">
                    <span className="dashboard-stepper-kicker">Pasul 2</span>
                    <h2>Alege materia</h2>
                    <p className="section-sub">
                      Alege rapid contextul, apoi deschide materia potrivita pentru Interactiv,
                      Studiu sau Test.
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
                  description=""
                  sectionId="materii-list"
                />
              </div>
            )}
          </div>

          <aside className="dashboard-side-stack">
            <div className="section-card dashboard-mini-section">
              <h3>Progresul tau</h3>
              {progressItems.length ? (
                <div className="dashboard-progress-list">
                  {progressItems.map((item) => (
                    <div key={item.id} className="dashboard-progress-item">
                      <div className="dashboard-progress-head">
                        <span>{item.title}</span>
                        <span>{`${item.percent}%`}</span>
                      </div>
                      <div className="dashboard-progress-bar">
                        <div
                          className="dashboard-progress-fill"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                      <span>{item.description}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="section-sub dashboard-progress-empty">
                  Progresul apare aici dupa ce incepi sa lucrezi o materie in Studiu, Interactiv sau
                  Test.
                </p>
              )}
            </div>

            <div className="section-card dashboard-mini-section">
              <h3>Sfat rapid</h3>
              <div className="dashboard-tip-box">
                <strong>Incepe cu ce ai gresit cel mai des.</strong>
                <p>
                  Daca mai ai putin timp pana la examen, repeta intai intrebarile gresite, apoi fa o
                  simulare completa.
                </p>
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
