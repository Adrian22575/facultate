"use server";

import { redirect } from "next/navigation";
import { cookies } from "next/headers";

import {
  getPostLoginNextPath,
  isValidEmail,
  normalizeEmailInput,
  normalizePhoneInput
} from "@/lib/auth/password-auth";
import { getSupabasePublicEnv } from "@/lib/env/public";
import { clearDemoSession } from "@/lib/demo-session";
import { ensurePremiumGrantFromAllowlist } from "@/lib/free-access";
import { notifyAdminUserCreated } from "@/lib/notifications/telegram";
import {
  REFERRAL_COOKIE_NAME,
  captureReferralForUser,
  getExpiredReferralCookieOptions,
  markReferralReadyAfterAccountConfirmation
} from "@/lib/referrals";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

function loginRedirect(params) {
  const query = new URLSearchParams(params);
  redirect(`/auth/email-login?${query.toString()}`);
}

function addReferralParam(params, referralCode) {
  return referralCode ? { ...params, ref: "1" } : params;
}

function buildOnboardingRedirect(nextPath) {
  return nextPath && nextPath !== "/"
    ? `/onboarding?next=${encodeURIComponent(nextPath)}`
    : "/onboarding";
}

function validatePasswordPair(password, confirmPassword) {
  if (password.length < 8) {
    return "Parola trebuie sa aiba cel putin 8 caractere.";
  }

  if (password !== confirmPassword) {
    return "Parolele nu coincid.";
  }

  return null;
}

function mapAuthErrorMessage(message, fallback) {
  const normalized = String(message || "").toLowerCase();

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("email_not_confirmed") ||
    normalized.includes("not confirmed")
  ) {
    return "Emailul nu este confirmat inca. Deschide emailul primit de la Nota 5+ si apasa pe linkul de confirmare, apoi revino la autentificare.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Emailul sau parola nu sunt corecte.";
  }

  if (normalized.includes("already registered") || normalized.includes("already been registered")) {
    return "Exista deja un cont cu acest email. Intra in cont sau reseteaza parola.";
  }

  return fallback;
}

function mapAuthErrorCode(message, fallbackCode) {
  const normalized = String(message || "").toLowerCase();

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("email_not_confirmed") ||
    normalized.includes("not confirmed")
  ) {
    return "password_login_email_unconfirmed";
  }

  return fallbackCode;
}

function mapForgotPasswordErrorCode(message) {
  const normalized = String(message || "").toLowerCase();

  if (
    normalized.includes("email not confirmed") ||
    normalized.includes("email_not_confirmed") ||
    normalized.includes("not confirmed")
  ) {
    return "forgot_email_unconfirmed";
  }

  if (normalized.includes("rate limit") || normalized.includes("too many") || normalized.includes("security purposes")) {
    return "forgot_rate_limited";
  }

  return "forgot_failed";
}

async function findDuplicateProfile({ email, phoneNormalized }) {
  const admin = createAdminClient();
  const [emailResult, phoneResult] = await Promise.all([
    admin
      .from("profiles")
      .select("id")
      .ilike("email", email)
      .limit(1),
    admin
      .from("profiles")
      .select("id")
      .eq("phone_normalized", phoneNormalized)
      .limit(1)
  ]);

  if (emailResult.error) throw emailResult.error;
  if (phoneResult.error) throw phoneResult.error;

  if (emailResult.data?.length) {
    return "email";
  }

  if (phoneResult.data?.length) {
    return "phone";
  }

  return null;
}

async function profileEmailExists(email) {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .limit(1);

  if (error) {
    throw error;
  }

  return Boolean(data?.length);
}

export async function signUpWithEmailAction(formData) {
  const nextPath = getPostLoginNextPath(formData.get("next"));
  const cookieStore = await cookies();
  const referralCode = cookieStore.get(REFERRAL_COOKIE_NAME)?.value || "";
  const fullName = String(formData.get("fullName") || "").trim();
  const email = normalizeEmailInput(formData.get("email"));
  const phoneNumber = String(formData.get("phone") || "").trim();
  const phoneNormalized = normalizePhoneInput(phoneNumber);
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");

  if (fullName.length < 2) {
    loginRedirect(addReferralParam({ mode: "signup", next: nextPath, error: "signup_name_invalid" }, referralCode));
  }

  if (!isValidEmail(email)) {
    loginRedirect(addReferralParam({ mode: "signup", next: nextPath, error: "signup_email_invalid" }, referralCode));
  }

  if (phoneNormalized.length < 9) {
    loginRedirect(addReferralParam({ mode: "signup", next: nextPath, error: "signup_phone_invalid" }, referralCode));
  }

  const passwordError = validatePasswordPair(password, confirmPassword);
  if (passwordError) {
    loginRedirect(addReferralParam({ mode: "signup", next: nextPath, error: "signup_password_invalid" }, referralCode));
  }

  try {
    const duplicate = await findDuplicateProfile({ email, phoneNormalized });
    if (duplicate === "email") {
      loginRedirect(addReferralParam({ mode: "signup", next: nextPath, error: "signup_email_exists" }, referralCode));
    }
    if (duplicate === "phone") {
      loginRedirect(addReferralParam({ mode: "signup", next: nextPath, error: "signup_phone_exists" }, referralCode));
    }

    const supabase = await createClient();
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          phone_number: phoneNumber
        }
      }
    });

    if (error) {
      loginRedirect({
        ...addReferralParam(
          {
            mode: "signup",
            next: nextPath,
            error: error.message?.toLowerCase().includes("registered")
              ? "signup_email_exists"
              : "signup_failed"
          },
          referralCode
        )
      });
    }

    if (data?.user?.id) {
      const admin = createAdminClient();
      const { error: profileError } = await admin.from("profiles").upsert(
        {
          id: data.user.id,
          email,
          full_name: fullName,
          phone_number: phoneNumber,
          phone_normalized: phoneNormalized
        },
        { onConflict: "id" }
      );

      if (profileError) {
        if (profileError.code === "23505") {
          loginRedirect(addReferralParam({ mode: "signup", next: nextPath, error: "signup_duplicate" }, referralCode));
        }
        throw profileError;
      }

      await notifyAdminUserCreated({
        user: {
          ...data.user,
          email,
          user_metadata: {
            ...(data.user.user_metadata || {}),
            full_name: fullName
          }
        },
        source: "email_password"
      });

      try {
        await ensurePremiumGrantFromAllowlist({ userId: data.user.id, email });
      } catch {
        // Ignore allowlist sync errors during signup.
      }

      if (referralCode) {
        try {
          const referralCapture = await captureReferralForUser({
            referredUserId: data.user.id,
            referralCode,
            source: "email_password"
          });
          if (data?.session && referralCapture?.referralId) {
            await markReferralReadyAfterAccountConfirmation({
              referredUserId: data.user.id,
              reason: "signup_session"
            });
          }
          cookieStore.set(REFERRAL_COOKIE_NAME, "", getExpiredReferralCookieOptions());
        } catch {
          // Referral capture must not block account creation.
        }
      }
    }

    clearDemoSession();

    if (!data?.session) {
      loginRedirect(addReferralParam({ mode: "login", next: nextPath, message: "check_email" }, referralCode));
    }

    redirect(buildOnboardingRedirect(nextPath));
  } catch (error) {
    if (error?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw error;
    }

    console.error("Email signup failed:", {
      message: error instanceof Error ? error.message : "Unknown signup error"
    });
    loginRedirect(addReferralParam({ mode: "signup", next: nextPath, error: "signup_failed" }, referralCode));
  }
}

export async function signInWithPasswordAction(formData) {
  const nextPath = getPostLoginNextPath(formData.get("next"));
  const email = normalizeEmailInput(formData.get("email"));
  const password = String(formData.get("password") || "");

  if (!isValidEmail(email) || !password) {
    loginRedirect({ mode: "login", next: nextPath, error: "password_login_invalid" });
  }

  try {
    const hasProfile = await profileEmailExists(email);
    if (!hasProfile) {
      loginRedirect({ mode: "login", next: nextPath, error: "password_login_missing_account" });
    }
  } catch (profileLookupError) {
    if (profileLookupError?.digest?.startsWith?.("NEXT_REDIRECT")) {
      throw profileLookupError;
    }

    console.error("Email login profile lookup failed:", {
      message: profileLookupError instanceof Error ? profileLookupError.message : "Unknown profile lookup error"
    });
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    loginRedirect({
      mode: "login",
      next: nextPath,
      error: mapAuthErrorCode(error.message, "password_login_failed"),
      detail: mapAuthErrorMessage(error.message, "Autentificarea nu a reusit.")
    });
  }

  clearDemoSession();

  if (data?.user?.id && data.user.email) {
    try {
      await ensurePremiumGrantFromAllowlist({
        userId: data.user.id,
        email: data.user.email
      });
    } catch {
      // Ignore allowlist sync errors during login.
    }

    try {
      await markReferralReadyAfterAccountConfirmation({
        referredUserId: data.user.id,
        reason: "email_password_login"
      });
    } catch {
      // Referral readiness must not block login.
    }
  }

  redirect(nextPath);
}

export async function forgotPasswordAction(formData) {
  const nextPath = getPostLoginNextPath(formData.get("next"));
  const email = normalizeEmailInput(formData.get("email"));

  if (!isValidEmail(email)) {
    loginRedirect({ mode: "forgot", next: nextPath, error: "forgot_email_invalid" });
  }

  const supabase = await createClient();
  const { NEXT_PUBLIC_SITE_URL } = getSupabasePublicEnv();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/auth/reset-password`
  });

  if (error) {
    loginRedirect({ mode: "forgot", next: nextPath, error: mapForgotPasswordErrorCode(error.message) });
  }

  loginRedirect({ mode: "forgot", next: nextPath, message: "forgot_sent" });
}

export async function resetPasswordAction(formData) {
  const password = String(formData.get("password") || "");
  const confirmPassword = String(formData.get("confirmPassword") || "");
  const passwordError = validatePasswordPair(password, confirmPassword);

  if (passwordError) {
    redirect("/auth/reset-password?error=password_invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });

  if (error) {
    redirect("/auth/reset-password?error=reset_failed");
  }

  redirect("/auth/email-login?mode=login&message=password_reset");
}
