"use client";

import {
  ArrowRight,
  BookOpenCheck,
  FileUp,
  GraduationCap,
  PlayCircle,
  Trophy
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
  progressItems = [],
  userType = "student",
  isAuthenticated = false,
  isAdmin = false,
  adminActionCount = 0,
  billingSnapshot = null,
  gamificationSummary = null
}) {
  const [lastSession, setLastSession] = useState(null);
  const [sessionEntryStep, setSessionEntryStep] = useState("entry");
  const fallbackSubject = subjects[0] || null;
  const hasSubjects = subjects.length > 0;

  useEffect(() => {
    setLastSession(getLastSession());
  }, []);

  const hasLastSession = Boolean(lastSession?.url);
  const gamificationLevel = gamificationSummary?.level?.current || null;
  const nextLevel = gamificationSummary?.level?.next || null;
  const continueTitle = hasLastSession
    ? lastSession.subjectTitle || "Continua materia"
    : hasSubjects
      ? "Alege prima materie"
      : "Incarca prima ta materie";
  const continueCopy = hasLastSession
    ? `Ultimul mod folosit: ${lastSession.mode || "Materie"}`
    : hasSubjects
      ? `${subjects.length} ${subjects.length === 1 ? "materie disponibila" : "materii disponibile"}. Alege una si incepe.`
      : "Incarca un curs sau notitele tale si incepe de acolo.";

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

        <section className="dashboard-hero-shell">
          <div className="dashboard-home-hero-grid">
            <div className="dashboard-home-copy">
              <h1 className="dashboard-hero-title">
                Ce inveti azi?
              </h1>
              <p className="section-sub dashboard-hero-subcopy">
                Continua sesiunea inceputa sau alege rapid un mod de lucru. Totul ramane in acelasi parcurs:
                materii, teste, greseli si progres.
              </p>
              <div className="dashboard-home-actions">
                {hasLastSession ? (
                  <PendingNavigationLink
                    href={lastSession.url}
                    className="dashboard-home-primary-action"
                    pendingLabel="Se deschide sesiunea..."
                    pendingMode="replace"
                  >
                    Continua acum
                    <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
                  </PendingNavigationLink>
                ) : hasSubjects ? (
                  <button type="button" className="dashboard-home-primary-action" onClick={openSubjectPicker}>
                    Alege materia
                    <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
                  </button>
                ) : (
                  <PendingNavigationLink
                    href="/materiale/invata"
                    className="dashboard-home-primary-action"
                    pendingLabel="Se deschide incarcarea..."
                    pendingMode="replace"
                  >
                    Incarca materia
                    <ArrowRight aria-hidden="true" size={18} strokeWidth={2.4} />
                  </PendingNavigationLink>
                )}
                <PendingNavigationLink
                  href="/materiale"
                  className="dashboard-home-secondary-action"
                  pendingLabel="Se deschide workspace-ul..."
                  pendingMode="replace"
                >
                  Deschide Workspace
                </PendingNavigationLink>
              </div>
            </div>

            <article className="dashboard-hero-side dashboard-continue-card">
              <div className="dashboard-hero-side-label">
                {hasLastSession ? "Continua de unde ai ramas" : "Primul pas"}
              </div>
              <h3>{continueTitle}</h3>
              <p>{continueCopy}</p>
              {hasLastSession ? (
                <PendingNavigationLink
                  href={lastSession.url}
                  className="dashboard-hero-side-btn"
                  pendingLabel="Se deschide sesiunea..."
                  pendingMode="replace"
                >
                  Continua acum
                </PendingNavigationLink>
              ) : hasSubjects ? (
                <button type="button" className="secondary dashboard-hero-side-btn" onClick={openSubjectPicker}>
                  Alege materia
                </button>
              ) : (
                <PendingNavigationLink
                  href="/materiale/invata"
                  className="dashboard-hero-side-btn"
                  pendingLabel="Se deschide incarcarea..."
                  pendingMode="replace"
                >
                  Incarca materia
                </PendingNavigationLink>
              )}
            </article>
          </div>
        </section>

        <section className="dashboard-layout-grid">
          <div id="start-sesiune" className="dashboard-main-stack">
            {sessionEntryStep === "entry" ? (
              <div className="section-card dashboard-main-card dashboard-session-focus-card">
                <div className="dashboard-session-head">
                  <div>
                    <span className="dashboard-session-kicker">Actiuni rapide</span>
                    <h2>Alege ce faci acum</h2>
                    <p className="section-sub">Cele mai folosite fluxuri, fara pasi inutili.</p>
                  </div>
                  <div className="dashboard-session-pulse" aria-hidden="true">
                    <PlayCircle size={30} strokeWidth={2.4} />
                  </div>
                </div>

                <div className="dashboard-mode-grid">
                  <div className="dashboard-mode-card">
                    <div className="dashboard-mode-icon is-blue">
                      <GraduationCap size={22} strokeWidth={2.5} />
                    </div>
                    <h3>Teste pe materii</h3>
                    <p>
                      Pentru cand vrei sa exersezi rapid din materia deja disponibila.
                    </p>
                    <button
                      type="button"
                      className="dashboard-mode-cta dashboard-mode-cta-primary"
                      onClick={openSubjectPicker}
                    >
                      Alege materia
                    </button>
                  </div>

                  <div className="dashboard-mode-card">
                    <div className="dashboard-mode-icon is-blue">
                      <FileUp size={22} strokeWidth={2.5} />
                    </div>
                    <h3>Invata din materia ta</h3>
                    <p>
                      Incarca PDF, DOCX, PPTX, TXT sau lipeste text si construieste materialul de lucru.
                    </p>
                    <PendingNavigationLink
                      href="/materiale/invata"
                      className="secondary-button dashboard-mode-cta"
                      pendingLabel="Se deschide uploadul..."
                      pendingMode="replace"
                    >
                      Incarca materia
                    </PendingNavigationLink>
                  </div>

                  <div className="dashboard-mode-card">
                    <div className="dashboard-mode-icon is-orange">
                      <BookOpenCheck size={22} strokeWidth={2.5} />
                    </div>
                    <h3>Simulare examen licenta</h3>
                    <p>
                      Porneste o simulare completa cand vrei sa testezi ritmul de examen.
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
            {gamificationSummary ? (
              <div className="section-card dashboard-mini-section dashboard-gamification-card">
                <div className="dashboard-gamification-head">
                  <span className="dashboard-mode-icon is-orange" aria-hidden="true">
                    <Trophy size={22} strokeWidth={2.5} />
                  </span>
                  <div>
                    <h3>Progresul meu</h3>
                    <p>{gamificationSummary.todayMessage}</p>
                  </div>
                </div>
                <div className="dashboard-gamification-level">
                  <span>{gamificationLevel?.title || "Incepator"}</span>
                  <strong>{`${gamificationSummary.totalPoints || 0} puncte`}</strong>
                </div>
                <div className="dashboard-progress-bar" aria-label="Progres catre nivelul urmator">
                  <div
                    className="dashboard-progress-fill"
                    style={{ width: `${gamificationSummary.level?.progressPercent || 0}%` }}
                  />
                </div>
                <div className="dashboard-gamification-meta">
                  <span>{`${gamificationSummary.currentStreak || 0} zile streak`}</span>
                  <span>
                    {nextLevel
                      ? `${gamificationSummary.level.pointsToNext} puncte pana la ${nextLevel.title}`
                      : "Nivel maxim"}
                  </span>
                </div>
                <PendingNavigationLink
                  href="/progresul-meu"
                  className="btn-link secondary dashboard-gamification-link"
                  pendingLabel="Se deschide progresul..."
                  pendingMode="replace"
                >
                  Vezi progresul
                </PendingNavigationLink>
              </div>
            ) : null}

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
                <div className="dashboard-progress-empty">
                  <p className="section-sub">
                    Progresul apare aici dupa prima sesiune de Studiu, Interactiv sau Test.
                  </p>
                  {hasSubjects ? (
                    <button type="button" className="btn-link secondary" onClick={openSubjectPicker}>
                      Alege materia
                    </button>
                  ) : (
                    <PendingNavigationLink
                      href="/materiale/invata"
                      className="btn-link secondary"
                      pendingLabel="Se deschide incarcarea..."
                      pendingMode="replace"
                    >
                      Incarca materia
                    </PendingNavigationLink>
                  )}
                </div>
              )}
            </div>

            <div className="section-card dashboard-mini-section">
              <h3>Sfat rapid</h3>
              <div className="dashboard-tip-box">
                {progressItems.length ? (
                  <>
                    <strong>Incepe cu ce ai gresit cel mai des.</strong>
                    <p>Repeta intrebarile gresite, apoi fa o simulare completa.</p>
                  </>
                ) : (
                  <>
                    <strong>{hasSubjects ? "Incepe cu o singura materie." : "Incepe cu materialul pe care il ai."}</strong>
                    <p>
                      {hasSubjects
                        ? "Alege modul Studiu si parcurge primele intrebari. Progresul se salveaza automat."
                        : "Incarca un curs sau lipeste notitele. Vei primi pasii de invatare in acelasi loc."}
                    </p>
                  </>
                )}
              </div>
            </div>
          </aside>
        </section>
      </div>
    </div>
  );
}
