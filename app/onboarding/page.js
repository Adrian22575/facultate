import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, GraduationCap, School } from "lucide-react";

import { OnboardingActionForm } from "@/components/onboarding-action-form";
import { AppHeader } from "@/components/app-header";
import { OnboardingRoleChoiceLock } from "@/components/onboarding-role-choice-lock";
import { OnboardingSelectionStep } from "@/components/onboarding-selection-step";
import { OnboardingSubmitButton } from "@/components/onboarding-submit-button";
import {
  getAcademicCommunityLabel,
  getAcademicContext,
  getInstitutionTypeForUserType,
  isAcademicContextComplete
} from "@/lib/academic/server";
import { isDemoUser } from "@/lib/demo-user";
import { getPostLoginNextPath } from "@/lib/auth/password-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { getOptionalUser } from "@/lib/supabase/guards";
import { ActionLink } from "@/components/ui/action";
import { SurfaceCard } from "@/components/ui/surface-card";
import { InlineFeedback } from "@/components/ui/status";
import { SectionLabel } from "@/components/ui/section-label";
import {
  createAcademicUnitAction,
  createInstitutionAction,
  savePrimaryMembershipAction,
  updateUserTypeAction
} from "@/app/onboarding/actions";

import confirmationStyles from "./confirmation.module.css";
import styles from "./page.module.css";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Comunitatea mea | Nota 5+"
};

function HiddenQueryFields({ entries, exclude = [] }) {
  return Object.entries(entries).map(([key, value]) => {
    if (exclude.includes(key) || typeof value !== "string" || !value) {
      return null;
    }

    return <input key={key} type="hidden" name={key} value={value} />;
  });
}

function buildHref(searchParams, overrides) {
  const nextParams = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (typeof value === "string" && value) {
      nextParams.set(key, value);
    }
  });

  Object.entries(overrides).forEach(([key, value]) => {
    if (typeof value === "string" && value) {
      nextParams.set(key, value);
    } else {
      nextParams.delete(key);
    }
  });

  const query = nextParams.toString();
  return query ? `/onboarding?${query}` : "/onboarding";
}

function getSafeNextPath(path) {
  const safePath = getPostLoginNextPath(path);
  return safePath !== "/" && !safePath.startsWith("/onboarding") ? safePath : "";
}

function getReturnDestinationLabel(path) {
  if (!path || path === "/") {
    return "dashboard";
  }

  if (path.startsWith("/ai/licenta/") || path.startsWith("/materiale/licenta/")) {
    return "licenta in lucru";
  }

  if (
    path.startsWith("/ai/jobs/") ||
    path.startsWith("/ai/imports/") ||
    path.startsWith("/materiale/jobs/") ||
    path.startsWith("/materiale/imports/")
  ) {
    return "procesarea materialului";
  }

  if (path.startsWith("/ai/review/") || path.startsWith("/materiale/review/")) {
    return "verificarea intrebarilor";
  }

  if (path.startsWith("/ai/drafts/") || path.startsWith("/materiale/drafts/")) {
    return "editorul testului";
  }

  if (path === "/ai" || path === "/materiale") {
    return "Materiale";
  }

  if (path === "/ai/activitate" || path === "/materiale/activitate") {
    return "activitatea materialelor";
  }

  if (path.startsWith("/materii/")) {
    return "materia deschisa";
  }

  if (path.startsWith("/testele-mele")) {
    return "Testele mele";
  }

  if (path === "/cont") {
    return "Contul meu";
  }

  if (path === "/licenta-exam") {
    return "Pregatire licenta";
  }

  return "pagina ceruta";
}

function buildLoginNextPath(searchParams) {
  const allowedKeys = new Set([
    "edit",
    "source",
    "step",
    "userType",
    "institutionId",
    "facultyId",
    "programId",
    "profileId"
  ]);
  const nextParams = new URLSearchParams();

  Object.entries(searchParams || {}).forEach(([key, value]) => {
    if (typeof value !== "string" || !value) {
      return;
    }

    if (key === "next") {
      const safeNext = getSafeNextPath(value);
      if (safeNext) {
        nextParams.set("next", safeNext);
      }
      return;
    }

    if (allowedKeys.has(key)) {
      nextParams.set(key, value);
    }
  });

  const query = nextParams.toString();
  return query ? `/onboarding?${query}` : "/onboarding";
}

function normalizeRequestedStep(step) {
  return ["user-type", "institution", "faculty", "program", "profile"].includes(step)
    ? step
    : "";
}

function StepIntro({ step, title, subtitle }) {
  return (
    <div className={["dashboard-header", styles["onboarding-step-header"]].filter(Boolean).join(" ")}>
      <div className={["status-copy"].filter(Boolean).join(" ")}>
        <SectionLabel variant="eyebrow">{step}</SectionLabel>
        <h2>{title}</h2>
        {subtitle ? <p className={["page-copy"].filter(Boolean).join(" ")}>{subtitle}</p> : null}
      </div>
    </div>
  );
}

function getStepPresentation(currentStep, userType, steps) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStep)
  );

  if (currentStep === "user-type") {
    return {
      badge: `Pasul ${currentIndex + 1} din ${steps.length}`,
      title: "Spune-ne cine esti",
      subtitle: "Alegerea asta schimba pasii urmatori.",
      status: "In lucru",
      sectionTitle: "Alege tipul contului"
    };
  }

  if (currentStep === "institution") {
    return {
      badge: `Pasul ${currentIndex + 1} din ${steps.length}`,
      title: userType === "student" ? "Alege universitatea" : "Alege liceul sau scoala",
      subtitle: "Verifica rezumatul de pana acum, apoi cauta institutia potrivita.",
      status: "Selecteaza",
      sectionTitle: userType === "student" ? "Universitate" : "Institutie"
    };
  }

  if (currentStep === "faculty") {
    return {
      badge: `Pasul ${currentIndex + 1} din ${steps.length}`,
      title: "Alege facultatea",
      subtitle: "Pastrezi universitatea aleasa si mergi mai departe cu facultatea.",
      status: "Selecteaza",
      sectionTitle: "Facultate"
    };
  }

  if (currentStep === "program") {
    return {
      badge: `Pasul ${currentIndex + 1} din ${steps.length}`,
      title: "Alege specializarea",
      subtitle: "Dupa selectie ajungi la confirmarea finala.",
      status: "Aproape gata",
      sectionTitle: "Specializare"
    };
  }

  if (currentStep === "profile") {
    return {
      badge: `Pasul ${currentIndex + 1} din ${steps.length}`,
      title: "Alege profilul",
      subtitle: "Daca nu conteaza, poti continua si fara profil.",
      status: "Selecteaza",
      sectionTitle: "Profil"
    };
  }

  return {
    badge: `Pasul ${currentIndex + 1} din ${steps.length}`,
    title: steps[currentIndex]?.label || "Onboarding",
    subtitle: "Completeaza pasul curent ca sa mergi mai departe.",
    status: "In lucru",
    sectionTitle: "Pas curent"
  };
}

function getOnboardingSteps(userType) {
  if (userType === "student") {
    return [
      { key: "user-type", label: "Rol" },
      { key: "institution", label: "Universitate" },
      { key: "faculty", label: "Facultate" },
      { key: "program", label: "Specializare" },
      { key: "confirm", label: "Confirmare" }
    ];
  }

  if (userType === "elev") {
    return [
      { key: "user-type", label: "Rol" },
      { key: "institution", label: "Institutie" },
      { key: "profile", label: "Profil" },
      { key: "confirm", label: "Confirmare" }
    ];
  }

  return [
    { key: "user-type", label: "Rol" },
    { key: "institution", label: "Institutie" },
    { key: "profile", label: "Detalii" },
    { key: "confirm", label: "Confirmare" }
  ];
}

function OnboardingProgress({ currentStep, steps }) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStep)
  );

  return (
    <div className={[styles["onboarding-progress"], confirmationStyles["onboarding-progress"]].filter(Boolean).join(" ")} aria-label="Progres onboarding">
      <div className={[styles["onboarding-progress-head"], confirmationStyles["onboarding-progress-head"]].filter(Boolean).join(" ")}>
        <SectionLabel variant="eyebrow">
          Pasul {currentIndex + 1} din {steps.length}
        </SectionLabel>
        <strong>{steps[currentIndex]?.label || "Onboarding"}</strong>
      </div>
      <ol className={[styles["onboarding-progress-list"], confirmationStyles["onboarding-progress-list"]].filter(Boolean).join(" ")} style={{ "--onboarding-step-count": steps.length }}>
        {steps.map((step, index) => {
          const status = index < currentIndex ? "is-done" : index === currentIndex ? "is-active" : "is-next";
          return (
            <li
              key={step.key}
              className={[
                styles["onboarding-progress-item"],
                confirmationStyles["onboarding-progress-item"],
                styles[status],
                confirmationStyles[status]
              ].filter(Boolean).join(" ")}
              aria-current={index === currentIndex ? "step" : undefined}
            >
              <span aria-hidden="true">{index < currentIndex ? "✓" : index + 1}</span>
              <small>{step.label}</small>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function OnboardingReviewPanel({ summaryItems }) {
  if (!summaryItems.length) {
    return (
      <div className={[confirmationStyles["onboarding-confirm-review-panel"], confirmationStyles["onboarding-confirm-review-empty"]].filter(Boolean).join(" ")}>
        <div className={[confirmationStyles["onboarding-confirm-row"]].filter(Boolean).join(" ")}>
          <div className={[confirmationStyles["onboarding-confirm-label"]].filter(Boolean).join(" ")}>Rezumat</div>
          <div className={[confirmationStyles["onboarding-confirm-value"]].filter(Boolean).join(" ")}>
            <strong>Incepe cu primul pas</strong>
            <span>Alegerile tale vor aparea aici pe masura ce continui.</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={[confirmationStyles["onboarding-confirm-review-panel"]].filter(Boolean).join(" ")}>
      {summaryItems.map((item) => (
        <div className={[confirmationStyles["onboarding-confirm-row"]].filter(Boolean).join(" ")} key={item.key}>
          <div className={[confirmationStyles["onboarding-confirm-label"]].filter(Boolean).join(" ")}>{item.label}</div>
          <div className={[confirmationStyles["onboarding-confirm-value"]].filter(Boolean).join(" ")}>
            <strong>{item.value}</strong>
            {item.meta ? <span>{item.meta}</span> : null}
          </div>
          {item.clearHref ? (
            <Link className={[confirmationStyles["onboarding-confirm-change"]].filter(Boolean).join(" ")} href={item.clearHref}>
              Schimba
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function OnboardingSelectionContext({ summaryItems }) {
  if (!summaryItems.length) {
    return null;
  }

  return (
    <div className={[confirmationStyles["onboarding-selection-context"]].filter(Boolean).join(" ")} aria-label="Alegerile tale de până acum">
      {summaryItems.map((item) => (
        <div key={item.key} className={[confirmationStyles["onboarding-selection-context-item"]].filter(Boolean).join(" ")}>
          <span>{item.label}</span>
          <strong>{item.value}</strong>
          {item.clearHref ? (
            <Link href={item.clearHref} className={[confirmationStyles["onboarding-selection-context-change"]].filter(Boolean).join(" ")}>
              Schimbă
            </Link>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function OnboardingStepCard({
  currentStep,
  steps,
  title,
  subtitle,
  badge,
  status,
  sectionTitle,
  summaryItems,
  children
}) {
  return (
    <SurfaceCard as="section" className={confirmationStyles["onboarding-confirm-card"]} aria-label="Onboarding comunitate">
      <div className={[confirmationStyles["onboarding-confirm-top"]].filter(Boolean).join(" ")}>
        <div className={[confirmationStyles["onboarding-confirm-head"]].filter(Boolean).join(" ")}>
          <div>
            <div className={[confirmationStyles["onboarding-confirm-badge"]].filter(Boolean).join(" ")}>{badge}</div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          <div className={[confirmationStyles["onboarding-confirm-status"], confirmationStyles["onboarding-confirm-status-blue"]].filter(Boolean).join(" ")}>
            <span aria-hidden="true" />
            {status}
          </div>
        </div>

        <OnboardingProgress currentStep={currentStep} steps={steps} />
      </div>

      <div className={[confirmationStyles["onboarding-confirm-body"]].filter(Boolean).join(" ")}>
        {summaryItems.length ? (
          <OnboardingSelectionContext summaryItems={summaryItems} />
        ) : null}

        <div className={[
          styles["onboarding-step-content"],
          confirmationStyles["onboarding-step-content"],
          !summaryItems.length && styles["onboarding-step-content-first"]
        ].filter(Boolean).join(" ")}>
          <p className={[confirmationStyles["onboarding-confirm-section-title"]].filter(Boolean).join(" ")}>{sectionTitle}</p>
          {children}
        </div>
      </div>
    </SurfaceCard>
  );
}

function OnboardingConfirmCard({
  currentStep,
  steps,
  summaryItems,
  communityLabel,
  returnDestinationLabel,
  isEditingCommunity,
  userType,
  institutionId,
  selectedProgramUnitId,
  requestedNextPath,
  backHref
}) {
  const currentIndex = Math.max(
    0,
    steps.findIndex((step) => step.key === currentStep)
  );
  const communityPreview =
    communityLabel ||
    summaryItems
      .filter((item) => item.key !== "user-type")
      .map((item) => item.value)
      .filter(Boolean)
      .join(" · ") ||
    "Comunitatea aleasa";

  return (
    <SurfaceCard as="section" className={confirmationStyles["onboarding-confirm-card"]} aria-label="Confirmare comunitate">
      <div className={[confirmationStyles["onboarding-confirm-top"]].filter(Boolean).join(" ")}>
        <div className={[confirmationStyles["onboarding-confirm-head"]].filter(Boolean).join(" ")}>
          <div>
            <div className={[confirmationStyles["onboarding-confirm-badge"]].filter(Boolean).join(" ")}>
              Pasul {currentIndex + 1} din {steps.length}
            </div>
            <h1>Confirma comunitatea</h1>
            <p>
              Verifica daca datele sunt corecte inainte sa mergi mai departe. Le poti
              modifica acum, fara sa pierzi selectiile deja facute.
            </p>
          </div>
          <div className={[confirmationStyles["onboarding-confirm-status"]].filter(Boolean).join(" ")}>
            <span aria-hidden="true" />
            Gata de salvat
          </div>
        </div>

        <OnboardingProgress currentStep={currentStep} steps={steps} />
      </div>

      <div className={[confirmationStyles["onboarding-confirm-body"]].filter(Boolean).join(" ")}>
        <p className={[confirmationStyles["onboarding-confirm-section-title"]].filter(Boolean).join(" ")}>Rezumat selectie</p>

        <OnboardingReviewPanel summaryItems={summaryItems} />

        <div className={[styles["onboarding-community-preview"]].filter(Boolean).join(" ")}>
          <div className={[styles["onboarding-community-left"]].filter(Boolean).join(" ")}>
            <div className={[styles["onboarding-community-mark"]].filter(Boolean).join(" ")}>5+</div>
            <div className={[styles["onboarding-community-copy"]].filter(Boolean).join(" ")}>
              <p>Vei intra in comunitatea</p>
              <strong>{communityPreview}</strong>
            </div>
          </div>
        </div>

        <form action={savePrimaryMembershipAction} className={[confirmationStyles["onboarding-confirm-actions"]].filter(Boolean).join(" ")}>
          <input type="hidden" name="userType" value={userType} />
          <input type="hidden" name="institutionId" value={institutionId} />
          <input type="hidden" name="programUnitId" value={selectedProgramUnitId} />
          <input type="hidden" name="edit" value={isEditingCommunity ? "1" : ""} />
          <input type="hidden" name="returnTo" value={isEditingCommunity ? "/cont" : requestedNextPath || "/"} />

          <div className={[confirmationStyles["onboarding-confirm-help"]].filter(Boolean).join(" ")}>
            <strong>Ultimul pas.</strong> Dupa salvare, vei fi trimis la {returnDestinationLabel}.
          </div>

          <div className={[confirmationStyles["onboarding-confirm-button-group"]].filter(Boolean).join(" ")}>
            <ActionLink variant="secondary" className={confirmationStyles["onboarding-confirm-secondary"]} href={backHref}>
              Inapoi
            </ActionLink>
            <OnboardingSubmitButton
              className={[confirmationStyles["onboarding-confirm-primary"]].filter(Boolean).join(" ")}
              pendingLabel="Se salveaza comunitatea..."
            >
              Salveaza comunitatea
            </OnboardingSubmitButton>
          </div>
        </form>
      </div>
    </SurfaceCard>
  );
}

function OnboardingOutcome({ returnDestinationLabel }) {
  return (
    <div className={[confirmationStyles["onboarding-outcome"]].filter(Boolean).join(" ")}>
      <SectionLabel variant="eyebrow">Dupa confirmare</SectionLabel>
      <div className={[confirmationStyles["onboarding-outcome-list"]].filter(Boolean).join(" ")}>
        <span>Testele generate folosesc automat comunitatea aleasa.</span>
        <span>Materialele pot fi grupate corect pe institutie.</span>
        <span>Testele partajate ajung la colegii potriviti.</span>
        <span className={[confirmationStyles["onboarding-outcome-return"]].filter(Boolean).join(" ")}>
          Te trimitem la {returnDestinationLabel}.
        </span>
      </div>
    </div>
  );
}

function SummaryItem({ label, value, meta, clearHref, clearLabel = "Schimba" }) {
  return (
    <SurfaceCard as="article" className={[confirmationStyles["selected-summary"], confirmationStyles["selected-summary-compact"]].filter(Boolean).join(" ")}>
      <div className={confirmationStyles["summary-card-head"]}>
        <div className={["status-copy"].filter(Boolean).join(" ")}>
          <SectionLabel variant="eyebrow">{label}</SectionLabel>
          <strong>{value}</strong>
          {meta ? <p className={["page-copy"].filter(Boolean).join(" ")}>{meta}</p> : null}
        </div>
        {clearHref ? (
          <ActionLink variant="secondary" size="compact" href={clearHref}>
            {clearLabel}
          </ActionLink>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

function SummarySection({ items }) {
  if (!items.length) {
    return null;
  }

  return (
    <SurfaceCard>
      <div className={["status-copy"].filter(Boolean).join(" ")}>
        <SectionLabel variant="eyebrow">Rezumat</SectionLabel>
      </div>
      <div className={confirmationStyles["onboarding-summary-list"]}>
        {items.map((item) => (
          <SummaryItem
            key={item.key}
            label={item.label}
            value={item.value}
            meta={item.meta}
            clearHref={item.clearHref}
            clearLabel={item.clearLabel}
          />
        ))}
      </div>
    </SurfaceCard>
  );
}

export default async function OnboardingPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const user = await getOptionalUser();

  if (!user) {
    redirect(`/auth/login?next=${encodeURIComponent(buildLoginNextPath(resolvedSearchParams))}`);
  }

  if (isDemoUser(user)) {
    redirect("/");
  }

  const context = await getAcademicContext(user.id);
  const isOnboardingComplete = isAcademicContextComplete(context);
  const isEditingCommunity = resolvedSearchParams?.edit === "1";
  const useQueryState = resolvedSearchParams?.source === "query";
  const requestedStep = normalizeRequestedStep(resolvedSearchParams?.step);
  const forceUserTypeStep = requestedStep === "user-type";
  const forceInstitutionStep = requestedStep === "institution";
  const forceFacultyStep = requestedStep === "faculty";
  const forceProgramStep = requestedStep === "program";
  const forceProfileStep = requestedStep === "profile";
  const onboardingError =
    typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : "";
  const requestedNextPath = isEditingCommunity ? "" : getSafeNextPath(resolvedSearchParams?.next);
  const returnDestinationLabel = isEditingCommunity
    ? "Contul meu"
    : getReturnDestinationLabel(requestedNextPath);

  if (isOnboardingComplete && !isEditingCommunity) {
    redirect(requestedNextPath || "/");
  }

  const currentCommunityLabel = getAcademicCommunityLabel(context);
  const userType =
    forceUserTypeStep
      ? ""
      : useQueryState
        ? typeof resolvedSearchParams?.userType === "string"
          ? resolvedSearchParams.userType
          : context?.profile?.user_type || ""
        : typeof resolvedSearchParams?.userType === "string"
          ? resolvedSearchParams.userType
          : context?.profile?.user_type || "";
  const institutionType = getInstitutionTypeForUserType(userType);
  const institutionId =
    forceUserTypeStep || forceInstitutionStep
      ? ""
      : useQueryState
        ? typeof resolvedSearchParams?.institutionId === "string"
          ? resolvedSearchParams.institutionId
          : context?.membership?.institution_id || ""
        : typeof resolvedSearchParams?.institutionId === "string"
          ? resolvedSearchParams.institutionId
          : context?.membership?.institution_id || "";
  let facultyId =
    forceUserTypeStep || forceInstitutionStep || forceFacultyStep || userType !== "student"
      ? ""
      : typeof resolvedSearchParams?.facultyId === "string"
        ? resolvedSearchParams.facultyId
        : "";
  const programId =
    forceUserTypeStep || forceInstitutionStep || forceFacultyStep || forceProgramStep
      ? ""
      : useQueryState
        ? typeof resolvedSearchParams?.programId === "string"
          ? resolvedSearchParams.programId
          : userType === "student"
            ? context?.membership?.program_unit_id || ""
            : ""
        : typeof resolvedSearchParams?.programId === "string"
          ? resolvedSearchParams.programId
          : userType === "student"
            ? context?.membership?.program_unit_id || ""
            : "";
  const profileId =
    forceUserTypeStep || forceInstitutionStep || forceProfileStep
      ? ""
      : useQueryState
        ? typeof resolvedSearchParams?.profileId === "string"
          ? resolvedSearchParams.profileId
          : userType === "elev"
            ? context?.membership?.program_unit_id || ""
            : ""
        : typeof resolvedSearchParams?.profileId === "string"
          ? resolvedSearchParams.profileId
          : userType === "elev"
            ? context?.membership?.program_unit_id || ""
            : "";

  let allSearchParams = null;

  const supabase = createAdminClient();
  let institutions = [];
  let selectedInstitution = null;
  let faculties = [];
  let programs = [];
  let profiles = [];
  let setupWarning = null;

  try {
    if (userType === "student" && institutionId && !facultyId && programId) {
      const { data: selectedProgramUnit, error: selectedProgramUnitError } = await supabase
        .from("academic_units")
        .select("id, parent_unit_id")
        .eq("id", programId)
        .eq("unit_type", "program")
        .maybeSingle();

      if (selectedProgramUnitError) throw selectedProgramUnitError;
      facultyId = selectedProgramUnit?.parent_unit_id || "";
    }

    if (institutionType) {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, city, county")
        .eq("institution_type", institutionType)
        .order("name", { ascending: true })
        .limit(100);

      if (error) throw error;
      institutions = data || [];
    }

    if (institutionId) {
      const { data, error } = await supabase
        .from("institutions")
        .select("id, name, city, county, institution_type")
        .eq("id", institutionId)
        .maybeSingle();

      if (error) throw error;
      selectedInstitution = data || null;
    }

    if (userType === "student" && institutionId) {
      const { data, error } = await supabase
        .from("academic_units")
        .select("id, name")
        .eq("institution_id", institutionId)
        .eq("unit_type", "faculty")
        .order("name", { ascending: true })
        .limit(100);

      if (error) throw error;
      faculties = data || [];
    }

    if (userType === "student" && institutionId && facultyId) {
      const { data, error } = await supabase
        .from("academic_units")
        .select("id, name")
        .eq("institution_id", institutionId)
        .eq("unit_type", "program")
        .eq("parent_unit_id", facultyId)
        .order("name", { ascending: true })
        .limit(100);

      if (error) throw error;
      programs = data || [];
    }

    if (userType === "elev" && institutionId) {
      const { data, error } = await supabase
        .from("academic_units")
        .select("id, name")
        .eq("institution_id", institutionId)
        .eq("unit_type", "profile")
        .order("name", { ascending: true })
        .limit(100);

      if (error) throw error;
      profiles = data || [];
    }
  } catch (error) {
    setupWarning = "Momentan nu putem incarca lista. Incearca din nou.";
  }

  allSearchParams = {
    edit: isEditingCommunity ? "1" : "",
    source: isEditingCommunity ? "query" : "",
    step: requestedStep,
    userType,
    institutionId,
    facultyId,
    programId,
    profileId,
    next: requestedNextPath
  };

  const selectedFaculty = faculties.find((item) => item.id === facultyId) || null;
  const selectedProgram = programs.find((item) => item.id === programId) || null;
  const selectedProfile =
    profileId === "none"
      ? { id: "none", name: "Fara profil" }
      : profiles.find((item) => item.id === profileId) || null;
  const selectedProgramUnitId =
    userType === "student"
      ? selectedProgram?.id || ""
      : profileId === "none"
        ? ""
        : selectedProfile?.id || "";

  const currentStep = !userType
    ? "user-type"
    : forceInstitutionStep || !selectedInstitution
      ? "institution"
      : userType === "student" && (forceFacultyStep || !selectedFaculty)
        ? "faculty"
        : userType === "student" && (forceProgramStep || !selectedProgram)
          ? "program"
          : userType === "elev" && (forceProfileStep || !selectedProfile)
            ? "profile"
          : "confirm";
  const onboardingSteps = getOnboardingSteps(userType);

  const summaryItems = [];

  if (userType) {
    summaryItems.push({
      key: "user-type",
      label: "Tip cont",
      value: userType === "student" ? "Student" : "Elev",
      clearHref: buildHref(allSearchParams, {
        step: "user-type",
        userType: "",
        institutionId: "",
        facultyId: "",
        programId: "",
        profileId: ""
      })
    });
  }

  if (institutionId && selectedInstitution) {
    summaryItems.push({
      key: "institution",
      label: userType === "student" ? "Universitate" : "Institutie",
      value: selectedInstitution.name,
      meta: [selectedInstitution.city, selectedInstitution.county].filter(Boolean).join(" · "),
      clearHref: buildHref(allSearchParams, {
        step: "institution",
        institutionId: "",
        facultyId: "",
        programId: "",
        profileId: ""
      })
    });
  }

  if (userType === "student" && facultyId && selectedFaculty) {
    summaryItems.push({
      key: "faculty",
      label: "Facultate",
      value: selectedFaculty.name,
      clearHref: buildHref(allSearchParams, {
        step: "faculty",
        facultyId: "",
        programId: ""
      })
    });
  }

  if (userType === "student" && programId && selectedProgram) {
    summaryItems.push({
      key: "program",
      label: "Specializare",
      value: selectedProgram.name,
      clearHref: buildHref(allSearchParams, {
        step: "program",
        programId: ""
      })
    });
  }

  if (userType === "elev" && profileId) {
    summaryItems.push({
      key: "profile",
      label: "Profil",
      value: selectedProfile?.name || "Fara profil",
      clearHref: buildHref(allSearchParams, {
        step: "profile",
        profileId: ""
      })
    });
  }

  const confirmBackHref =
    summaryItems[summaryItems.length - 1]?.clearHref ||
    buildHref(allSearchParams, {
      step: userType ? "institution" : "user-type"
    });
  const selectedCommunityLabel =
    summaryItems
      .filter((item) => item.key !== "user-type")
      .map((item) => item.value)
      .filter(Boolean)
      .join(" · ");

  const stepPresentation = getStepPresentation(currentStep, userType, onboardingSteps);
  const nonConfirmSummaryItems = currentStep === "user-type" ? [] : summaryItems;

  function renderStepContent() {
    if (currentStep === "user-type") {
      return (
        <OnboardingRoleChoiceLock>
          <SurfaceCard as="form" action={updateUserTypeAction} className={styles["onboarding-choice-card"]}>
            <input type="hidden" name="userType" value="student" />
            <input type="hidden" name="redirectBase" value="/onboarding" />
            <HiddenQueryFields
              entries={allSearchParams}
              exclude={["userType", "institutionId", "facultyId", "programId", "profileId"]}
            />
            <div className={[styles["onboarding-choice-icon"]].filter(Boolean).join(" ")} aria-hidden="true">
              <GraduationCap size={28} strokeWidth={2.1} />
            </div>
            <div className={[styles["pricing-copy"], styles["onboarding-choice-copy"]].filter(Boolean).join(" ")}>
              <span className={[styles["onboarding-choice-kicker"]].filter(Boolean).join(" ")}>Universitate</span>
              <strong>Student</strong>
              <p className={["page-copy"].filter(Boolean).join(" ")}>Alegi universitatea, facultatea si specializarea.</p>
            </div>
            <div className={[styles["onboarding-choice-route"]].filter(Boolean).join(" ")} aria-hidden="true">
              <span>Universitate</span>
              <ArrowRight size={14} strokeWidth={2.3} />
              <span>Facultate</span>
              <ArrowRight size={14} strokeWidth={2.3} />
              <span>Specializare</span>
            </div>
            <OnboardingSubmitButton className={[styles["onboarding-choice-action"]].filter(Boolean).join(" ")} pendingLabel="Pregatim pasul urmator...">
              <span>Continua ca student</span>
              <ArrowRight aria-hidden="true" size={17} strokeWidth={2.4} />
            </OnboardingSubmitButton>
          </SurfaceCard>

          <SurfaceCard as="form" action={updateUserTypeAction} className={styles["onboarding-choice-card"]}>
            <input type="hidden" name="userType" value="elev" />
            <input type="hidden" name="redirectBase" value="/onboarding" />
            <HiddenQueryFields
              entries={allSearchParams}
              exclude={["userType", "institutionId", "facultyId", "programId", "profileId"]}
            />
            <div className={[styles["onboarding-choice-icon"], styles["is-school"]].filter(Boolean).join(" ")} aria-hidden="true">
              <School size={28} strokeWidth={2.1} />
            </div>
            <div className={[styles["pricing-copy"], styles["onboarding-choice-copy"]].filter(Boolean).join(" ")}>
              <span className={[styles["onboarding-choice-kicker"]].filter(Boolean).join(" ")}>Liceu sau scoala</span>
              <strong>Elev</strong>
              <p className={["page-copy"].filter(Boolean).join(" ")}>Alegi liceul sau scoala. Profilul ramane optional.</p>
            </div>
            <div className={[styles["onboarding-choice-route"]].filter(Boolean).join(" ")} aria-hidden="true">
              <span>Institutie</span>
              <ArrowRight size={14} strokeWidth={2.3} />
              <span>Profil optional</span>
            </div>
            <OnboardingSubmitButton className={[styles["onboarding-choice-action"]].filter(Boolean).join(" ")} pendingLabel="Pregatim pasul urmator...">
              <span>Continua ca elev</span>
              <ArrowRight aria-hidden="true" size={17} strokeWidth={2.4} />
            </OnboardingSubmitButton>
          </SurfaceCard>
        </OnboardingRoleChoiceLock>
      );
    }

    if (currentStep === "institution") {
      return (
        <OnboardingSelectionStep
          key="institution-step"
          searchPlaceholder={
            userType === "student"
              ? "Scrie numele universitatii..."
              : "Scrie numele liceului sau scolii..."
          }
          selectionKind="institution"
          searchRequired
          items={institutions.map((institution) => ({
            id: institution.id,
            title: institution.name,
            subtitle: [institution.city, institution.county].filter(Boolean).join(" - "),
            selected: institution.id === institutionId,
            href: buildHref(allSearchParams, {
              step: "",
              institutionId: institution.id,
              facultyId: "",
              programId: "",
              profileId: ""
            })
          }))}
          emptyMessage="Nu exista inca institutii aici. Adauga una si continui imediat."
          addButtonLabel="Nu gasesti institutia? Adauga"
          addPanel={
            <OnboardingActionForm
              action={createInstitutionAction}
              className={styles["onboarding-inline-panel"]}
              hiddenFields={[
                { name: "userType", value: userType },
                { name: "edit", value: isEditingCommunity ? "1" : "" },
                { name: "source", value: isEditingCommunity ? "query" : "" },
                { name: "next", value: requestedNextPath },
                { name: "redirectBase", value: "/onboarding" }
              ]}
              rows={[
                [
                  {
                    name: "name",
                    label: "Nume",
                    placeholder:
                      userType === "student"
                        ? "Ex: Universitatea Babes-Bolyai"
                        : "Ex: Colegiul National Gheorghe Lazar",
                    required: true,
                    minLength: 2,
                    errorMessage: "Scrie numele institutiei."
                  },
                  {
                    name: "city",
                    label: "Oras",
                    placeholder: "Ex: Cluj-Napoca",
                    required: true,
                    minLength: 2,
                    errorMessage: "Scrie orasul."
                  }
                ],
                [
                  {
                    name: "county",
                    label: "Judet",
                    placeholder: "Optional",
                    required: false,
                    maxLength: 120
                  }
                ]
              ]}
              submitLabel="Adauga institutia"
            />
          }
        />
      );
    }

    if (currentStep === "faculty") {
      return (
        <OnboardingSelectionStep
          key="faculty-step"
          searchPlaceholder="Scrie numele facultatii..."
          selectionKind="faculty"
          items={faculties.map((faculty) => ({
            id: faculty.id,
            title: faculty.name,
            selected: faculty.id === facultyId,
            href: buildHref(allSearchParams, {
              step: "",
              facultyId: faculty.id,
              programId: ""
            })
          }))}
          emptyMessage="Nu exista inca facultati pentru universitatea asta. Adauga prima facultate."
          addButtonLabel="Nu gasesti facultatea? Adauga"
          addPanel={
            <OnboardingActionForm
              action={createAcademicUnitAction}
              className={styles["onboarding-inline-panel"]}
              hiddenFields={[
                { name: "userType", value: userType },
                { name: "institutionId", value: institutionId },
                { name: "unitType", value: "faculty" },
                { name: "edit", value: isEditingCommunity ? "1" : "" },
                { name: "source", value: isEditingCommunity ? "query" : "" },
                { name: "next", value: requestedNextPath },
                { name: "redirectBase", value: "/onboarding" }
              ]}
              rows={[
                [
                  {
                    name: "name",
                    label: "Numele facultatii",
                    placeholder: "Ex: Facultatea de Informatica",
                    required: true,
                    minLength: 2,
                    errorMessage: "Scrie numele facultatii."
                  }
                ]
              ]}
              submitLabel="Adauga facultatea"
            />
          }
        />
      );
    }

    if (currentStep === "program") {
      return (
        <OnboardingSelectionStep
          key="program-step"
          searchPlaceholder="Scrie numele specializarii..."
          selectionKind="program"
          items={programs.map((program) => ({
            id: program.id,
            title: program.name,
            selected: program.id === programId,
            href: buildHref(allSearchParams, {
              step: "",
              programId: program.id
            })
          }))}
          emptyMessage="Nu exista inca specializari pentru facultatea asta. Adauga prima specializare."
          addButtonLabel="Nu gasesti specializarea? Adauga"
          addPanel={
            <OnboardingActionForm
              action={createAcademicUnitAction}
              className={styles["onboarding-inline-panel"]}
              hiddenFields={[
                { name: "userType", value: userType },
                { name: "institutionId", value: institutionId },
                { name: "unitType", value: "program" },
                { name: "parentUnitId", value: facultyId },
                { name: "edit", value: isEditingCommunity ? "1" : "" },
                { name: "source", value: isEditingCommunity ? "query" : "" },
                { name: "next", value: requestedNextPath },
                { name: "redirectBase", value: "/onboarding" }
              ]}
              rows={[
                [
                  {
                    name: "name",
                    label: "Numele specializarii",
                    placeholder: "Ex: Informatica Economica",
                    required: true,
                    minLength: 2,
                    errorMessage: "Scrie numele specializarii."
                  }
                ]
              ]}
              submitLabel="Adauga specializarea"
            />
          }
        />
      );
    }

    if (currentStep === "profile") {
      return (
        <OnboardingSelectionStep
          key="profile-step"
          searchPlaceholder="Scrie numele profilului..."
          selectionKind="profile"
          items={[
            ...profiles.map((profile) => ({
              id: profile.id,
              title: profile.name,
              selected: profile.id === profileId,
              href: buildHref(allSearchParams, {
                step: "",
                profileId: profile.id
              })
            })),
            {
              id: "none",
              title: "Continua fara profil",
              subtitle: "Folosim doar institutia aleasa.",
              kind: "skip",
              selected: profileId === "none",
              href: buildHref(allSearchParams, {
                step: "",
                profileId: "none"
              })
            }
          ]}
          emptyMessage="Nu exista inca profiluri aici. Poti continua fara profil sau poti adauga unul."
          addButtonLabel="Nu gasesti profilul? Adauga"
          addPanel={
            <OnboardingActionForm
              action={createAcademicUnitAction}
              className={styles["onboarding-inline-panel"]}
              hiddenFields={[
                { name: "userType", value: userType },
                { name: "institutionId", value: institutionId },
                { name: "unitType", value: "profile" },
                { name: "edit", value: isEditingCommunity ? "1" : "" },
                { name: "source", value: isEditingCommunity ? "query" : "" },
                { name: "next", value: requestedNextPath },
                { name: "redirectBase", value: "/onboarding" }
              ]}
              rows={[
                [
                  {
                    name: "name",
                    label: "Numele profilului",
                    placeholder: "Ex: Matematica-Informatica",
                    required: true,
                    minLength: 2,
                    errorMessage: "Scrie numele profilului."
                  }
                ]
              ]}
              submitLabel="Adauga profilul"
            />
          }
        />
      );
    }

    return null;
  }

  return (
    <main className={["app-shell", styles["onboarding-shell"]].filter(Boolean).join(" ")}>
      <AppHeader
        action={
          isOnboardingComplete ? (
            <ActionLink variant="secondary" href="/cont">
              Inapoi la cont
            </ActionLink>
          ) : null
        }
        hidePrivateNav={!isOnboardingComplete}
        kicker="Comunitatea ta"
        title="Alege unde inveti"
        subtitle="Un pas pe rand. Dupa fiecare selectie mergi direct mai departe."
      />

      {setupWarning ? (
        <SurfaceCard>
          <InlineFeedback tone="error" role="alert">{setupWarning}</InlineFeedback>
        </SurfaceCard>
      ) : null}

      {onboardingError ? (
        <SurfaceCard>
          <InlineFeedback tone="error" role="alert">{onboardingError}</InlineFeedback>
        </SurfaceCard>
      ) : null}

      {currentCommunityLabel && isEditingCommunity ? (
        <SurfaceCard className={styles["onboarding-current-community"]}>
          <SummaryItem label="Comunitatea actuala" value={currentCommunityLabel} />
        </SurfaceCard>
      ) : null}

      {currentStep !== "confirm" ? (
        <OnboardingStepCard
          currentStep={currentStep}
          steps={onboardingSteps}
          title={stepPresentation.title}
          subtitle={stepPresentation.subtitle}
          badge={stepPresentation.badge}
          status={stepPresentation.status}
          sectionTitle={stepPresentation.sectionTitle}
          summaryItems={nonConfirmSummaryItems}
        >
          {renderStepContent()}
        </OnboardingStepCard>
      ) : null}

      {currentStep === "confirm" ? (
        <OnboardingConfirmCard
          currentStep={currentStep}
          steps={onboardingSteps}
          summaryItems={summaryItems}
          communityLabel={selectedCommunityLabel}
          returnDestinationLabel={returnDestinationLabel}
          isEditingCommunity={isEditingCommunity}
          userType={userType}
          institutionId={institutionId}
          selectedProgramUnitId={selectedProgramUnitId}
          requestedNextPath={requestedNextPath}
          backHref={confirmBackHref}
        />
      ) : null}
    </main>
  );
}
