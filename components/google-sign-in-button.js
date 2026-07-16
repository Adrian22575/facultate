"use client";

import { useState } from "react";
import { Target, Upload } from "lucide-react";

import { LoadingIconText } from "@/components/loading-spinner";
import { createClient } from "@/lib/supabase/client";

function GoogleLogo() {
  return (
    <svg className="google-signin-logo" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
      />
    </svg>
  );
}

const SEMANTIC_ICONS = {
  upload: Upload,
  target: Target
};

export function GoogleSignInButton({
  next = "/",
  disabled = false,
  icon = "",
  className = "",
  buttonClassName = "",
  errorClassName = "",
  children = null
}) {
  const Icon = SEMANTIC_ICONS[icon] || null;
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin() {
    if (disabled || loading) return;

    setLoading(true);
    setErrorMessage("");

    try {
      const supabase = createClient();
      const redirectTo = new URL("/auth/callback", window.location.origin);
      redirectTo.searchParams.set("next", next);

      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: redirectTo.toString(),
          queryParams: {
            prompt: "select_account"
          }
        }
      });

      if (error) {
        setErrorMessage("Autentificarea cu Google nu a pornit. Incearca din nou.");
        setLoading(false);
      }
    } catch (error) {
      setErrorMessage(
        "Autentificarea cu Google nu a pornit. Verifica conexiunea si incearca din nou."
      );
      setLoading(false);
    }
  }

  return (
    <div className={className || "auth-cta-stack"}>
      <button
        className={buttonClassName || undefined}
        type="button"
        onClick={handleLogin}
        disabled={disabled || loading}
      >
        <span className="google-signin-content">
          {loading ? null : Icon ? <Icon aria-hidden="true" size={24} strokeWidth={2.1} /> : <GoogleLogo />}
          <LoadingIconText loading={loading} loadingLabel="Se deschide Google...">
            {children || "Continua cu Google"}
          </LoadingIconText>
        </span>
      </button>
      {errorMessage ? (
        <div className={errorClassName || "error-state"} role="alert">{errorMessage}</div>
      ) : null}
    </div>
  );
}
