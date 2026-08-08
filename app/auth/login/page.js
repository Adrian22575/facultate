import { redirect } from "next/navigation";
import Image from "next/image";
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Rocket,
  Target,
  Upload,
  Users
} from "lucide-react";

import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { InlineFeedback } from "@/components/ui/status";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getPostLoginNextPath } from "@/lib/auth/password-auth";
import { isDemoUser } from "@/lib/demo-user";
import { hasSupabasePublicEnv } from "@/lib/env/public";
import { getOptionalUser } from "@/lib/supabase/guards";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Învață mai ușor | Nota 5+",
  description: "Alege cum vrei să înveți pentru următorul examen, cu materia ta sau cu grile."
};

export default async function LoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const nextPath = getPostLoginNextPath(resolvedSearchParams?.next);
  const error =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : undefined;
  const hasReferralInvite = resolvedSearchParams?.ref === "1";
  const emailLoginHref = `/auth/email-login?next=${encodeURIComponent(nextPath)}${hasReferralInvite ? "&ref=1" : ""}`;
  const materialStartPath = nextPath === "/" ? "/materiale/invata" : nextPath;
  const gridsStartPath = nextPath === "/" ? "/materii" : nextPath;

  const isConfigured = hasSupabasePublicEnv();
  const user = await getOptionalUser();

  if (user) {
    if (!isDemoUser(user) && !nextPath.startsWith("/onboarding")) {
      const academicContext = await getAcademicContext(user.id);
      if (!isAcademicContextComplete(academicContext)) {
        redirect(getOnboardingHref(nextPath));
      }
    }

    redirect(nextPath);
  }

  const errorLabels = {
    missing_code: "Lipseste codul de autentificare intors de Google.",
    oauth_exchange_failed: "Autentificarea nu a putut fi finalizata. Incearca din nou.",
    unexpected: "A aparut o eroare neasteptata in timpul autentificarii."
  };

  const flowCards = [
    {
      icon: Upload,
      title: "Incarci materia",
      copy: "PDF, curs, notite sau material primit de la colegi. Totul porneste dintr-un singur upload."
    },
    {
      icon: Brain,
      title: "Primesti teste",
      copy: "Platforma genereaza intrebari, grile, flashcarduri si recapitulari clare."
    },
    {
      icon: Target,
      title: "Repeti greselile",
      copy: "Vezi unde ai probleme si revii exact pe intrebarile importante inainte de examen."
    }
  ];

  const communityIcons = [BookOpen, Users, CheckCircle2, Rocket];

  return (
    <main className={["nota5plus-page"].filter(Boolean).join(" ")}>
      <div className={["nota5plus-container"].filter(Boolean).join(" ")}>
        <nav className={["nota5plus-nav"].filter(Boolean).join(" ")}>
          <a className={["nota5plus-brand"].filter(Boolean).join(" ")} href="/auth/login">
            <span className={["nota5plus-brand-mark"].filter(Boolean).join(" ")}>5+</span>
            <span>Nota 5+</span>
          </a>

          <div className={[styles["nota5plus-nav-links"]].filter(Boolean).join(" ")}>
            <a className={["nota5plus-nav-link"].filter(Boolean).join(" ")} href="/dictionar">
              Dicționar
            </a>
            <a className={["nota5plus-nav-link"].filter(Boolean).join(" ")} href="/articole">
              Articole
            </a>
            <a className={["nota5plus-nav-link", styles["nota5plus-tools-link"]].filter(Boolean).join(" ")} href="/instrumente">
              Instrumente gratuite
            </a>
            <a className={["nota5plus-nav-link"].filter(Boolean).join(" ")} href="/preturi">
              Preturi
            </a>
            <a className={["nota5plus-nav-link"].filter(Boolean).join(" ")} href="/despre">
              Despre platforma
            </a>
          </div>
        </nav>

        <section className={[styles["nota5plus-hero"]].filter(Boolean).join(" ")}>
          <div className={[styles["nota5plus-hero-copy"]].filter(Boolean).join(" ")}>
            <h1 className={[styles["nota5plus-title"]].filter(Boolean).join(" ")}>Cum vrei să înveți?</h1>

            <p className={[styles["nota5plus-subtitle"]].filter(Boolean).join(" ")}>
              Alege punctul de pornire. Te ducem direct la următorul pas.
            </p>

            {error || !isConfigured ? (
              <div className={[styles["nota5plus-alert-stack"]].filter(Boolean).join(" ")}>
                {error ? (
                  <InlineFeedback className={styles["inline-error"]} tone="error" role="alert">
                    {errorLabels[error] || "Autentificarea nu a putut fi completata."}
                  </InlineFeedback>
                ) : null}

                {!isConfigured ? (
                  <InlineFeedback className={styles["inline-error"]} tone="error" role="alert">
                    Autentificarea nu este disponibila momentan. Incearca putin mai tarziu.
                  </InlineFeedback>
                ) : null}
              </div>
            ) : null}

            {hasReferralInvite ? (
              <div className={[styles["nota5plus-referral-entry"]].filter(Boolean).join(" ")} role="status">
                <span aria-hidden="true">24h</span>
                <strong>Ai link de la un coleg.</strong>
                <small>Fa cont, confirma emailul, iar colegul poate porni 24h.</small>
              </div>
            ) : null}

            <div className={[styles["nota5plus-path-grid"]].filter(Boolean).join(" ")} aria-label="Alege cum vrei să înveți">
              <GoogleSignInButton
                next={materialStartPath}
                disabled={!isConfigured}
                icon="upload"
                className={[styles["nota5plus-path-wrap"]].filter(Boolean).join(" ")}
                buttonClassName={[styles["nota5plus-path-card"], styles["is-material"]].filter(Boolean).join(" ")}
                errorClassName={["nota5plus-inline-error"].filter(Boolean).join(" ")}
              >
                <span className={[styles["nota5plus-path-copy"]].filter(Boolean).join(" ")}>
                  <span className={[styles["nota5plus-path-heading"]].filter(Boolean).join(" ")}>
                    <strong>Am un material</strong>
                    <small>Încarcă un curs sau niște notițe. Le transformi în moduri clare de învățare.</small>
                  </span>
                  <span className={[styles["nota5plus-path-preview"]].filter(Boolean).join(" ")} aria-hidden="true">
                    <Image
                      src="/images/home/materials-card.png"
                      alt=""
                      width={1600}
                      height={900}
                      sizes="(max-width: 580px) 100vw, 50vw"
                    />
                  </span>
                  <span className={[styles["nota5plus-path-cta"]].filter(Boolean).join(" ")}>Încarcă materialul <span aria-hidden="true">→</span></span>
                </span>
              </GoogleSignInButton>
              <GoogleSignInButton
                next={gridsStartPath}
                disabled={!isConfigured}
                icon="target"
                className={[styles["nota5plus-path-wrap"]].filter(Boolean).join(" ")}
                buttonClassName={[styles["nota5plus-path-card"], styles["is-grids"]].filter(Boolean).join(" ")}
                errorClassName={["nota5plus-inline-error"].filter(Boolean).join(" ")}
              >
                <span className={[styles["nota5plus-path-copy"]].filter(Boolean).join(" ")}>
                  <span className={[styles["nota5plus-path-heading"]].filter(Boolean).join(" ")}>
                    <strong>Vreau să exersez</strong>
                    <small>Alege materia și lucrează cu grile, teste rapide și greșeli salvate.</small>
                  </span>
                  <span className={[styles["nota5plus-path-preview"]].filter(Boolean).join(" ")} aria-hidden="true">
                    <Image
                      src="/images/home/practice-card.png"
                      alt=""
                      width={1600}
                      height={900}
                      sizes="(max-width: 580px) 100vw, 50vw"
                    />
                  </span>
                  <span className={[styles["nota5plus-path-cta"]].filter(Boolean).join(" ")}>Alege materia <span aria-hidden="true">→</span></span>
                </span>
              </GoogleSignInButton>
            </div>

            <div className={[styles["nota5plus-start-options"]].filter(Boolean).join(" ")}>
              <form action="/auth/demo-login" method="post" className={[styles["nota5plus-demo-form"]].filter(Boolean).join(" ")}>
                <input type="hidden" name="next" value="/demo" />
                <button type="submit" className={[styles["nota5plus-demo-link"]].filter(Boolean).join(" ")}>
                  Vezi un exemplu fără cont
                </button>
              </form>
              <span aria-hidden="true">·</span>
              <a className={[styles["nota5plus-email-link"]].filter(Boolean).join(" ")} href={emailLoginHref}>
                Intră cu email
              </a>
            </div>

            <p className={[styles["nota5plus-microcopy"]].filter(Boolean).join(" ")}>Creezi cont doar când alegi una dintre opțiuni.</p>
            <a className={[styles["nota5plus-articles-entry"]].filter(Boolean).join(" ")} href="/articole">
              Citește articole despre educație <span aria-hidden="true">→</span>
            </a>
          </div>

        </section>

        <section className={[styles["nota5plus-flow"]].filter(Boolean).join(" ")} aria-label="Cum functioneaza">
          {flowCards.map(({ icon: Icon, title, copy }) => (
            <article key={title} className={[styles["nota5plus-flow-card"]].filter(Boolean).join(" ")}>
              <div className={[styles["nota5plus-flow-icon"]].filter(Boolean).join(" ")} aria-hidden="true">
                <Icon size={24} strokeWidth={2} />
              </div>
              <h3>{title}</h3>
              <p>{copy}</p>
            </article>
          ))}
        </section>

        <section className={[styles["nota5plus-materials-lab"]].filter(Boolean).join(" ")} aria-label="Invata din materia ta">
          <div className={[styles["nota5plus-materials-copy"]].filter(Boolean).join(" ")}>
            <div className={[styles["nota5plus-community-label"]].filter(Boolean).join(" ")}>Mod nou</div>
            <h2>Transforma materia ta intr-un plan clar de invatat.</h2>
            <p>
              Urca PDF, DOCX, PPTX, TXT sau lipeste notitele. Primesti capitole, concepte importante,
              flashcards, test rapid, greseli salvate si un plan pe zile.
            </p>
            <div className={[styles["nota5plus-materials-actions"]].filter(Boolean).join(" ")}>
              <GoogleSignInButton
                next="/materiale/invata"
                disabled={!isConfigured}
                className={[styles["nota5plus-google-wrap"]].filter(Boolean).join(" ")}
                buttonClassName={["nota5plus-btn", "nota5plus-btn-primary", "nota5plus-google-btn"].filter(Boolean).join(" ")}
                errorClassName={["nota5plus-inline-error"].filter(Boolean).join(" ")}
              >
                Incarca materia ta
              </GoogleSignInButton>
              <a className={[styles["nota5plus-materials-link"]].filter(Boolean).join(" ")} href="/despre#cum-functioneaza">
                Vezi cum functioneaza
              </a>
            </div>
          </div>

          <div className={[styles["nota5plus-materials-board"]].filter(Boolean).join(" ")} aria-hidden="true">
            <div className={[styles["nota5plus-materials-file"]].filter(Boolean).join(" ")}>
              <span>PDF</span>
              <strong>Curs management</strong>
              <small>128 pagini detectate</small>
            </div>
            <div className={[styles["nota5plus-materials-result"], styles["is-main"]].filter(Boolean).join(" ")}>
              <span>7</span>
              <strong>capitole</strong>
            </div>
            <div className={[styles["nota5plus-materials-result"]].filter(Boolean).join(" ")}>
              <span>85</span>
              <strong>flashcards</strong>
            </div>
            <div className={[styles["nota5plus-materials-result"]].filter(Boolean).join(" ")}>
              <span>120</span>
              <strong>intrebari</strong>
            </div>
            <div className={[styles["nota5plus-materials-plan"]].filter(Boolean).join(" ")}>
              <strong>Ziua 1</strong>
              <span>Capitolul 1 + test rapid</span>
            </div>
          </div>
        </section>

        <section className={[styles["nota5plus-community"]].filter(Boolean).join(" ")} id="comunitate">
          <div className={[styles["nota5plus-community-content"]].filter(Boolean).join(" ")}>
            <div className={[styles["nota5plus-community-label"]].filter(Boolean).join(" ")}>Comunitate</div>
            <h2>Un coleg incarca materialul. Toti pot invata mai usor.</h2>
            <p>
              Dupa login alegi scoala sau universitatea si comunitatea ta. Vezi materialele disponibile
              pentru clasa, grupa ori programul tau si contribui cand ai ceva util.
            </p>
          </div>

          <div className={[styles["nota5plus-community-visual"]].filter(Boolean).join(" ")} aria-hidden="true">
            {communityIcons.map((Icon, index) => (
              <div key={Icon.displayName || Icon.name || index} className={[styles["nota5plus-avatar"]].filter(Boolean).join(" ")}>
                <Icon size={30} strokeWidth={1.8} />
              </div>
            ))}
          </div>
        </section>

        <footer className={["nota5plus-legal-footer"].filter(Boolean).join(" ")}>
          <span>Nota 5+</span>
          <nav aria-label="Navigare publică și informații">
            <a href="/articole">Articole</a>
            <a href="/dictionar">Dicționar</a>
            <a href="/instrumente">Instrumente gratuite</a>
            <a href="/despre">Despre</a>
            <a href="/preturi">Preturi</a>
            <a href="/confidentialitate">Confidentialitate</a>
            <a href="/termeni">Termeni</a>
          </nav>
        </footer>
      </div>
    </main>
  );
}
