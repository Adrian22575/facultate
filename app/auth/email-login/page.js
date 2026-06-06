import { redirect } from "next/navigation";

import { EmailAuthPanel } from "@/components/email-auth-panel";
import { getAcademicContext, getOnboardingHref, isAcademicContextComplete } from "@/lib/academic/server";
import { getSafeNextPath } from "@/lib/auth/password-auth";
import { isDemoUser } from "@/lib/demo-user";
import { getOptionalUser } from "@/lib/supabase/guards";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Login cu email | Nota 5+"
};

export default async function EmailLoginPage({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const nextPath = getSafeNextPath(resolvedSearchParams?.next);
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

  const error = typeof resolvedSearchParams?.error === "string" ? resolvedSearchParams.error : "";
  const message = typeof resolvedSearchParams?.message === "string" ? resolvedSearchParams.message : "";
  const detail = typeof resolvedSearchParams?.detail === "string" ? resolvedSearchParams.detail : "";
  const hasReferralInvite = resolvedSearchParams?.ref === "1";
  const mode = typeof resolvedSearchParams?.mode === "string" ? resolvedSearchParams.mode : hasReferralInvite ? "signup" : "login";

  const errorLabels = {
    password_login_invalid: "Completeaza emailul si parola.",
    password_login_missing_account: "Nu exista niciun cont cu acest email. Verifica adresa sau creeaza un cont nou.",
    password_login_email_unconfirmed:
      "Emailul nu este confirmat inca. Verifica inboxul si apasa pe linkul de confirmare primit, apoi revino la autentificare.",
    password_login_failed: detail || "Emailul sau parola nu sunt corecte.",
    signup_name_invalid: "Completeaza numele tau.",
    signup_email_invalid: "Introdu un email valid.",
    signup_phone_invalid: "Introdu un numar de telefon valid.",
    signup_password_invalid: "Parola trebuie sa aiba cel putin 8 caractere, iar confirmarile trebuie sa coincida.",
    signup_email_exists: "Exista deja un cont cu acest email. Intra in cont sau reseteaza parola.",
    signup_phone_exists: "Acest numar de telefon este deja folosit.",
    signup_duplicate: "Exista deja un cont cu acest email sau numar de telefon.",
    signup_failed: "Nu am putut crea contul acum. Incearca din nou.",
    forgot_email_invalid: "Introdu emailul contului tau.",
    forgot_email_unconfirmed:
      "Contul exista, dar emailul nu este confirmat. Pentru resetarea parolei, confirma mai intai emailul primit la creare.",
    forgot_rate_limited: "Ai cerut prea multe emailuri intr-un timp scurt. Asteapta cateva minute si incearca din nou.",
    forgot_failed:
      "Nu am putut trimite emailul de resetare. Daca tocmai ai creat contul, confirma mai intai emailul primit; altfel asteapta cateva minute si incearca din nou."
  };

  const messageLabels = {
    forgot_sent: "Daca exista un cont pentru acest email, trimitem linkul de resetare.",
    password_reset: "Parola a fost schimbata. Te poti autentifica acum.",
    check_email: "Verifica emailul pentru confirmarea contului, apoi intra cu parola."
  };

  return (
    <main className="nota5plus-page email-auth-page">
      <EmailAuthPanel
        initialMode={mode}
        nextPath={nextPath}
        hasReferralInvite={hasReferralInvite}
        errorMessage={errorLabels[error] || ""}
        successMessage={messageLabels[message] || ""}
      />
    </main>
  );
}
