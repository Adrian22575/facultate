import Link from "next/link";
import { redirect } from "next/navigation";

import { activateReferralRewardAction, activateWelcomePremiumAction } from "@/app/cont/actions";
import { activateTestimonialRewardAction } from "@/app/review-reward/actions";
import { AccountBillingTabsClient } from "@/components/account-billing-tabs-client";
import { AccountDangerZone } from "@/components/account-danger-zone";
import { AppHeader } from "@/components/app-header";
import { BillingPlanCard } from "@/components/billing-plan-card";
import { ReferralShareCard } from "@/components/referral-share-card";
import {
  getAcademicCommunityLabel,
  getAcademicContext,
  getOnboardingHref,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { isAdminUser } from "@/lib/admin";
import { getBillingSnapshot } from "@/lib/billing";
import { getSafeNextPath } from "@/lib/auth/password-auth";
import { isDemoUser } from "@/lib/demo-user";
import { hasSupabasePublicEnv } from "@/lib/env/public";
import { getReferralDashboard, getReferralInvitationForUser } from "@/lib/referrals";
import { BILLING_PLAN_LIST } from "@/lib/stripe/plans";
import { hasStripeEnv, STRIPE_MODE } from "@/lib/stripe/server";
import { getOptionalUser } from "@/lib/supabase/guards";
import { getUserTestimonialRewardStatus } from "@/lib/testimonial-rewards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Contul meu | Nota 5+"
};

const PREMIUM_PLAN_CONTENT = {
  premium_24h: {
    description: "Pentru recapitulare rapida inainte de examen.",
    comparisonText: "Mai putin decat o cafea.",
    icon: "clock"
  },
  premium_7d: {
    description: "Cea mai buna alegere pentru sesiune sau restanta.",
    comparisonText: "Cat 2 drumuri cu metroul pana la facultate si inapoi.",
    icon: "spark",
    badge: "Recomandat",
    featured: true
  },
  premium_30d: {
    description: "Pentru mai multe materii si recapitulare fara presiune.",
    comparisonText: "Mai ieftin pe zi decat un snack rapid din campus.",
    icon: "calendar"
  }
};

const CREDIT_PLAN_CONTENT = {
  ai_upload_1: {
    description: "Pentru un singur curs, PDF sau set de notite.",
    icon: "file"
  },
  ai_upload_5: {
    description: "Pentru mai multe cursuri si recapitulare pe termen mai lung.",
    icon: "layers"
  }
};

function formatPremiumSummary(snapshot) {
  if (!snapshot?.activePremium || !snapshot?.premiumProductCode) {
    return "Niciun plan activ";
  }

  const activePlan = BILLING_PLAN_LIST.find((plan) => plan.code === snapshot.premiumProductCode);
  if (!activePlan || !snapshot.premiumEndsAt) {
    return "Plan activ";
  }

  const endDate = new Intl.DateTimeFormat("ro-RO", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(snapshot.premiumEndsAt));

  return `${activePlan.name} pana la ${endDate}`;
}

function getSafeReturnTo(value) {
  const safePath = getSafeNextPath(value);
  return safePath === "/" && value !== "/" ? "" : safePath.slice(0, 300);
}

function AccountIcon({ type }) {
  const svgProps = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: "1.8",
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  };

  switch (type) {
    case "cap":
      return (
        <svg {...svgProps}>
          <path d="m3 8.5 9-4.5 9 4.5-9 4.5-9-4.5Z" />
          <path d="M7 10.5v4.25c0 .82 2.24 2.25 5 2.25s5-1.43 5-2.25V10.5" />
        </svg>
      );
    case "star":
      return (
        <svg {...svgProps}>
          <path d="m12 3.75 2.55 5.17 5.7.83-4.13 4.02.98 5.68L12 16.7l-5.1 2.75.98-5.68-4.13-4.02 5.7-.83L12 3.75Z" />
        </svg>
      );
    case "upload":
      return (
        <svg {...svgProps}>
          <path d="M12 15V6" />
          <path d="m8.5 9.5 3.5-3.5 3.5 3.5" />
          <path d="M4 15.5v1.25A2.25 2.25 0 0 0 6.25 19h11.5A2.25 2.25 0 0 0 20 16.75V15.5" />
        </svg>
      );
    case "user":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="8.5" r="3.25" />
          <path d="M6 18c1.2-2.55 3.38-3.82 6-3.82S16.8 15.45 18 18" />
        </svg>
      );
    case "clock":
      return (
        <svg {...svgProps}>
          <circle cx="12" cy="12" r="8" />
          <path d="M12 7.75v4.5l3 1.75" />
        </svg>
      );
    case "spark":
      return (
        <svg {...svgProps}>
          <path d="m12 3 1.85 4.95L19 9.8l-4.18 2.37L13.5 17 10.8 13l-5.3-.83 4.18-2.37L12 3Z" />
        </svg>
      );
    case "calendar":
      return (
        <svg {...svgProps}>
          <path d="M7 4.5V7" />
          <path d="M17 4.5V7" />
          <rect x="4.5" y="6" width="15" height="13" rx="2.5" />
          <path d="M4.5 10.25h15" />
        </svg>
      );
    case "file":
      return (
        <svg {...svgProps}>
          <path d="M8 3.75h6l3.25 3.25v10A2.25 2.25 0 0 1 15 19.25H9A2.25 2.25 0 0 1 6.75 17V6A2.25 2.25 0 0 1 9 3.75Z" />
          <path d="M14 3.75V7h3.25" />
        </svg>
      );
    case "layers":
      return (
        <svg {...svgProps}>
          <path d="m12 4-8 4 8 4 8-4-8-4Z" />
          <path d="m4 12 8 4 8-4" />
          <path d="m4 16 8 4 8-4" />
        </svg>
      );
    case "gift":
      return (
        <svg {...svgProps}>
          <path d="M5.5 10h13v8A2 2 0 0 1 16.5 20h-9A2 2 0 0 1 5.5 18v-8Z" />
          <path d="M4.5 8.5h15v3h-15z" />
          <path d="M12 8.5V20" />
          <path d="M9.1 8.5c-1.22 0-2.2-.8-2.2-1.8S7.88 5 9.1 5c1.62 0 2.9 1.53 2.9 3.5H9.1Z" />
          <path d="M14.9 8.5c1.22 0 2.2-.8 2.2-1.8S16.12 5 14.9 5c-1.62 0-2.9 1.53-2.9 3.5h2.9Z" />
        </svg>
      );
    default:
      return null;
  }
}

function SummaryCard({
  icon,
  label,
  value,
  statusLabel,
  statusTone = "default",
  actionHref,
  actionLabel,
  footerCopy,
  compact = false
}) {
  return (
    <article className={`account-summary-card${compact ? " is-compact" : ""}`}>
      <div className="account-summary-top">
        <span className="account-icon-box" aria-hidden="true">
          {icon}
        </span>
        <span className={`account-summary-pill ${statusTone === "good" ? "is-good" : ""}`}>
          {statusLabel}
        </span>
      </div>
      <div className="account-summary-copy">
        <span className="account-summary-label">{label}</span>
        <strong className="account-summary-value" title={typeof value === "string" ? value : undefined}>
          {value}
        </strong>
        {actionHref && actionLabel ? (
          <Link className="account-summary-link" href={actionHref}>
            {actionLabel}
          </Link>
        ) : footerCopy ? (
          <span className="account-summary-footnote">{footerCopy}</span>
        ) : null}
      </div>
    </article>
  );
}

function WelcomePremiumCard({ returnTo = "" }) {
  return (
    <article className="plan-card onboarding-choice-card welcome-premium-card account-welcome-card">
      <div className="account-welcome-copy">
        <span className="account-icon-box account-icon-box-warm" aria-hidden="true">
          <AccountIcon type="gift" />
        </span>
        <div className="account-welcome-text">
          <span className="account-section-label account-section-label-warm">Cadou de bun venit</span>
          <strong>Ai 24h premium gratuite</strong>
          <p className="page-copy">
            Perioada incepe doar cand apesi pe activare. Dupa pornire, beneficiul nu mai poate fi reluat.
          </p>
        </div>
      </div>
      <form action={activateWelcomePremiumAction} className="welcome-premium-form account-welcome-form">
        <input type="hidden" name="returnTo" value={returnTo || "/cont?section=plans"} />
        <button type="submit">Activeaza cele 24h gratuite</button>
      </form>
    </article>
  );
}

function testimonialRewardLabel(value) {
  return value === "premium_24h" ? "24h premium gratuite" : "O incarcare gratuita";
}

function TestimonialRewardClaimCard({ submission, returnTo = "" }) {
  if (!submission?.id || submission.status !== "approved" || submission.reward_granted_at) {
    return null;
  }

  return (
    <article className="plan-card onboarding-choice-card welcome-premium-card account-welcome-card">
      <div className="account-welcome-copy">
        <span className="account-icon-box account-icon-box-warm" aria-hidden="true">
          <AccountIcon type="gift" />
        </span>
        <div className="account-welcome-text">
          <span className="account-section-label account-section-label-warm">Recompensa review</span>
          <strong>{testimonialRewardLabel(submission.reward_type)} pregatita</strong>
          <p className="page-copy">
            Review-ul tau a fost aprobat. Activeaza recompensa doar cand vrei sa o folosesti.
          </p>
        </div>
      </div>
      <form action={activateTestimonialRewardAction} className="welcome-premium-form account-welcome-form">
        <input type="hidden" name="submissionId" value={submission.id} />
        <input type="hidden" name="returnTo" value={returnTo || "/cont?section=plans"} />
        <button type="submit">Activeaza recompensa</button>
      </form>
    </article>
  );
}

function invitedReferralStatusCopy(status) {
  if (status === "rewarded") {
    return {
      label: "Bonus activat",
      tone: "good",
      title: "Invitatia ta a ajutat deja colegul.",
      copy: "Colegului care te-a invitat i-a fost activata recompensa de 24h."
    };
  }

  if (status === "ready") {
    return {
      label: "Confirmat",
      tone: "good",
      title: "Contul tau a confirmat invitatia.",
      copy: "Colegului care te-a invitat i-a aparut bonusul de 24h pregatit de activare."
    };
  }

  if (status === "invalid") {
    return {
      label: "Inactiv",
      tone: "default",
      title: "Invitatia nu mai este activa.",
      copy: "Aceasta invitatie nu mai poate genera bonus pentru colegul care ti-a trimis linkul."
    };
  }

  return {
    label: "In asteptare",
    tone: "default",
    title: "Mai este un pas pentru bonusul colegului.",
    copy: "Dupa ce iti confirmi emailul si intri in cont, colegului care te-a invitat ii apare bonusul de 24h pregatit de activare."
  };
}

function InvitedByReferralCard({ invitation }) {
  if (!invitation?.id) {
    return null;
  }

  const statusCopy = invitedReferralStatusCopy(invitation.status);
  const referrerName = invitation.referrer?.name || invitation.referrer?.email || "colegul care te-a invitat";
  const referrerEmail =
    invitation.referrer?.email && invitation.referrer.email !== referrerName ? invitation.referrer.email : null;

  return (
    <section className="account-invited-referral-card" aria-label="Invitatie referral primita">
      <div className="account-invited-referral-icon" aria-hidden="true">
        <AccountIcon type="gift" />
      </div>
      <div className="account-invited-referral-copy">
        <span className="account-section-label account-section-label-warm">Invitatie primita</span>
        <h2>{statusCopy.title}</h2>
        <p>
          Ai intrat in Nota 5+ prin invitatia lui <strong>{referrerName}</strong>
          {referrerEmail ? <span>{` (${referrerEmail})`}</span> : null}. {statusCopy.copy}
        </p>
      </div>
      <span className={`account-invited-referral-status ${statusCopy.tone === "good" ? "is-good" : ""}`}>
        {statusCopy.label}
      </span>
    </section>
  );
}

export default async function AccountPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const section = resolvedSearchParams?.section === "credits" ? "credits" : "plans";
  const isConfigured = hasSupabasePublicEnv();
  const user = await getOptionalUser();
  const demoMode = isDemoUser(user);
  let adminUser = false;

  if (user && !demoMode) {
    try {
      adminUser = await isAdminUser(user);
    } catch (_error) {
      adminUser = false;
    }
  }

  const checkoutConfigured = adminUser ? hasStripeEnv(STRIPE_MODE.SANDBOX) : hasStripeEnv();

  if (isConfigured && !user) {
    const loginParams = new URLSearchParams({ section });
    if (typeof resolvedSearchParams?.plan === "string") {
      loginParams.set("plan", resolvedSearchParams.plan);
    }
    redirect(`/auth/login?next=${encodeURIComponent(`/cont?${loginParams.toString()}#planuri`)}`);
  }

  const academicContext = user && !demoMode ? await getAcademicContext(user.id) : null;

  if (user && !demoMode && !isAcademicContextComplete(academicContext)) {
    redirect(getOnboardingHref("/"));
  }

  const checkoutError =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : null;
  const selectedPlanCode =
    typeof resolvedSearchParams?.plan === "string" &&
    BILLING_PLAN_LIST.some(
      (plan) =>
        plan.code === resolvedSearchParams.plan &&
        (plan.family === "ai_credits" ? "credits" : "plans") === section
    )
      ? resolvedSearchParams.plan
      : "";
  const returnTo = getSafeReturnTo(resolvedSearchParams?.returnTo);
  const syncState = typeof resolvedSearchParams?.sync === "string" ? resolvedSearchParams.sync : null;
  const lockReason = typeof resolvedSearchParams?.lock === "string" ? resolvedSearchParams.lock : null;
  const welcomeState = typeof resolvedSearchParams?.welcome === "string" ? resolvedSearchParams.welcome : null;
  const referralState = typeof resolvedSearchParams?.referral === "string" ? resolvedSearchParams.referral : null;
  const testimonialState =
    typeof resolvedSearchParams?.testimonial === "string" ? resolvedSearchParams.testimonial : null;

  let billingSnapshot = null;
  let referralDashboard = null;
  let referralInvitation = null;
  let latestTestimonialReward = null;
  let setupWarning = null;

  if (isConfigured && user && !demoMode) {
    try {
      [billingSnapshot, referralDashboard, referralInvitation, latestTestimonialReward] = await Promise.all([
        getBillingSnapshot(user.id),
        getReferralDashboard(user.id),
        getReferralInvitationForUser(user.id),
        getUserTestimonialRewardStatus(user.id)
      ]);
    } catch (error) {
      setupWarning = "Momentan nu putem incarca toate informatiile de cont.";
      billingSnapshot = null;
      referralDashboard = null;
      referralInvitation = null;
      latestTestimonialReward = null;
    }
  }

  const premiumPlans = BILLING_PLAN_LIST.filter((plan) => plan.family === "premium");
  const materialPlans = BILLING_PLAN_LIST.filter((plan) => plan.family === "ai_credits");

  const communityLabel = academicContext ? getAcademicCommunityLabel(academicContext) : null;
  const premiumLabel = formatPremiumSummary(billingSnapshot);
  const creditsLabel =
    billingSnapshot && billingSnapshot.aiCredits > 0
      ? `${billingSnapshot.aiCredits} incarcari disponibile`
      : "Nicio incarcare disponibila";
  const syncMessage =
    syncState === "applied"
      ? "Plata este confirmata si actualizarea a fost aplicata in cont."
      : syncState === "already_applied"
        ? "Plata este confirmata. Contul tau era deja actualizat."
        : syncState === "pending_payment"
          ? "Plata este inca in curs de confirmare."
          : syncState === "warning"
            ? "Plata este reusita, dar actualizarea poate mai dura putin. Reimprospateaza pagina in cateva secunde."
            : null;
  const learningModesLockMessage =
    lockReason === "learning_modes"
      ? "Pentru Interactiv, Studiaza si Test ai nevoie de un plan activ."
      : null;
  const welcomeMessage =
    welcomeState === "activated"
      ? "Cele 24h premium gratuite sunt acum active."
      : welcomeState === "missing"
        ? "Beneficiul gratuit nu mai este disponibil."
        : welcomeState === "error"
          ? "Nu am putut activa acum cele 24h gratuite. Incearca din nou."
          : null;
  const referralMessage =
    referralState === "activated"
      ? "Bonusul de referral este activ."
      : referralState === "missing"
        ? "Nu ai inca un referral gata de activat."
        : referralState === "error"
          ? "Nu am putut activa bonusul de referral acum."
          : null;
  const testimonialMessage =
    testimonialState === "activated"
      ? "Recompensa din review este activa acum."
      : testimonialState === "missing"
        ? "Nu ai nicio recompensa de review gata de activat."
        : testimonialState === "error"
          ? "Nu am putut activa recompensa de review acum."
          : null;
  const hasAvailableWelcomePremium = billingSnapshot?.welcomePremiumStatus === "available";
  const hasAvailableTestimonialReward =
    latestTestimonialReward?.status === "approved" && !latestTestimonialReward?.reward_granted_at;
  const uploadCount = billingSnapshot?.aiCredits ?? 0;
  const authProviderLabel = user?.app_metadata?.provider === "google" ? "Google" : "Email";
  const uploadActionHref = uploadCount > 0 ? "/materiale/invata" : "/cont?section=credits#planuri";
  const uploadActionLabel = uploadCount > 0 ? "Adaugă material" : "Adaugă încărcări";

  return (
    <main className="app-shell account-page-shell">
      <AppHeader
        title="Contul meu"
        subtitle="Setari simple pentru comunitate, plan si incarcari."
        hidePageTitle
      />

      <section className="account-page-header">
        <div className="account-page-copy">
          <h1 className="account-page-title">Contul meu</h1>
          <p className="account-page-subtitle">Accesul, comunitatea și încărcările tale.</p>
          <div className="account-page-identity">
            <span className="account-page-identity-icon" aria-hidden="true">
              <AccountIcon type="user" />
            </span>
            <span>{user?.email ?? "Cont local"}</span>
            {!demoMode ? <span>Conectat prin {authProviderLabel.toLowerCase()}</span> : <span>Mod demo</span>}
          </div>
        </div>
      </section>

      <section className="account-summary-grid" aria-label="Rezumat cont">
        <SummaryCard
          icon={<AccountIcon type="cap" />}
          label="Comunitatea mea"
          value={communityLabel ?? "Comunitatea nu este setata"}
          statusLabel="Comunitate"
          actionHref="/onboarding?edit=1&source=query"
          actionLabel="Schimba comunitatea"
          compact
        />
        <SummaryCard
          icon={<AccountIcon type="star" />}
          label="Plan"
          value={premiumLabel}
          statusLabel={billingSnapshot?.activePremium ? "Activ" : "Inactiv"}
          statusTone={billingSnapshot?.activePremium ? "good" : "default"}
          actionHref="/cont?section=plans#planuri"
          actionLabel={billingSnapshot?.activePremium ? "Vezi opțiunile" : "Alege un plan"}
        />
        <SummaryCard
          icon={<AccountIcon type="upload" />}
          label="Incarcari"
          value={creditsLabel}
          statusLabel={uploadCount > 0 ? `${uploadCount} disponibile` : "0 disponibile"}
          statusTone={uploadCount > 0 ? "good" : "default"}
          actionHref={uploadActionHref}
          actionLabel={uploadActionLabel}
        />
      </section>

      {referralInvitation ? <InvitedByReferralCard invitation={referralInvitation} /> : null}

      {setupWarning ? (
        <section className="surface">
          <div className="error-state" role="alert">{setupWarning}</div>
        </section>
      ) : null}

      <section className="surface account-billing-surface" id="planuri">
        {syncMessage ? <div className="success-state" role="status">{syncMessage}</div> : null}
        {welcomeMessage ? (
          <div className={welcomeState === "error" ? "error-state" : "success-state"} role={welcomeState === "error" ? "alert" : "status"}>
            {welcomeMessage}
          </div>
        ) : null}
        {referralMessage ? (
          <div className={referralState === "error" ? "error-state" : "success-state"} role={referralState === "error" ? "alert" : "status"}>
            {referralMessage}
          </div>
        ) : null}
        {testimonialMessage ? (
          <div className={testimonialState === "error" ? "error-state" : "success-state"} role={testimonialState === "error" ? "alert" : "status"}>
            {testimonialMessage}
          </div>
        ) : null}

        <AccountBillingTabsClient
          initialSection={section}
          checkoutConfigured={checkoutConfigured}
          checkoutError={checkoutError}
          plansContent={
            <div className="pricing-section account-pricing-section">
              <div className="account-section-head">
                <div>
                  <div className="account-section-label">Acces</div>
                  <h2>Planul tău de studiu</h2>
                  <p className="page-copy">
                    {billingSnapshot?.activePremium
                      ? "Planul activ și alternativele disponibile."
                      : "Alege un plan pentru modurile de învățare."}
                  </p>
                </div>
              </div>

              {learningModesLockMessage ? (
                <div className="pricing-lock-banner" role="status">
                  {learningModesLockMessage}
                </div>
              ) : null}

              {hasAvailableWelcomePremium ? <WelcomePremiumCard returnTo={returnTo} /> : null}
              {hasAvailableTestimonialReward ? (
                <TestimonialRewardClaimCard submission={latestTestimonialReward} returnTo={returnTo} />
              ) : null}

              <div className="plan-grid account-plan-grid">
                {premiumPlans.map((plan) => {
                  const presentation = PREMIUM_PLAN_CONTENT[plan.code] ?? {};

                  return (
                    <BillingPlanCard
                      key={plan.code}
                      plan={plan}
                      description={presentation.description}
                      comparisonText={presentation.comparisonText}
                      badge={presentation.badge}
                      featured={presentation.featured}
                      selected={selectedPlanCode === plan.code}
                      icon={<AccountIcon type={presentation.icon} />}
                      disabled={!user || demoMode || !checkoutConfigured}
                      returnTo={returnTo}
                    />
                  );
                })}
              </div>
            </div>
          }
          creditsContent={
            <div className="pricing-section account-pricing-section">
              <div className="account-section-head">
                <div>
                  <div className="account-section-label">Materiale</div>
                  <h2>Încărcări pentru materiale</h2>
                  <p className="page-copy">
                    Alege doar numărul de materiale pe care vrei să le pregătești.
                  </p>
                </div>
              </div>

              <div className="plan-grid account-plan-grid">
                {materialPlans.map((plan) => {
                  const presentation = CREDIT_PLAN_CONTENT[plan.code] ?? {};

                  return (
                    <BillingPlanCard
                      key={plan.code}
                      plan={plan}
                      ctaLabel="Alege pachetul"
                      description={presentation.description}
                      icon={<AccountIcon type={presentation.icon} />}
                      disabled={!user || demoMode || !checkoutConfigured}
                      returnTo={returnTo}
                    />
                  );
                })}
              </div>
            </div>
          }
        />
      </section>

      {referralDashboard ? (
        <ReferralShareCard
          referralPath={referralDashboard.referralPath}
          pendingCount={referralDashboard.pendingCount}
          readyCount={referralDashboard.readyCount}
          rewardedCount={referralDashboard.rewardedCount}
          referrals={referralDashboard.referrals}
          activateAction={activateReferralRewardAction}
        />
      ) : null}

      {!demoMode ? <AccountDangerZone isAdmin={adminUser} /> : null}
    </main>
  );
}
