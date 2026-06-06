"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";

import { resetPasswordAction } from "@/app/auth/password-actions";
import { createClient } from "@/lib/supabase/client";

export function PasswordResetForm({ errorMessage = "" }) {
  const [ready, setReady] = useState(false);
  const [setupError, setSetupError] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function prepareRecoverySession() {
      try {
        const supabase = createClient();
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");

        if (code) {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
          url.searchParams.delete("code");
          window.history.replaceState({}, "", url.toString());
        }

        if (!cancelled) {
          setReady(true);
        }
      } catch {
        if (!cancelled) {
          setSetupError("Linkul de resetare nu mai este valid. Cere unul nou.");
        }
      }
    }

    prepareRecoverySession();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <section className="auth-password-panel email-auth-panel">
      <a className="email-auth-back" href="/auth/email-login">
        <ArrowLeft aria-hidden="true" size={16} />
        Inapoi la autentificare
      </a>
      <div className="email-auth-kicker">
        <ShieldCheck aria-hidden="true" size={16} />
        Resetare securizata
      </div>
      <h1>Seteaza parola noua</h1>
      <p>Alege o parola noua pentru contul tau. Parola trebuie sa aiba minim 8 caractere.</p>

      {errorMessage || setupError ? (
        <div className="nota5plus-inline-error" role="alert">
          {setupError || errorMessage}
        </div>
      ) : null}

      <form action={resetPasswordAction} className="auth-password-form">
        <div className="email-auth-field">
          <span className="email-auth-label-row">
            <label htmlFor="reset-password">Parola noua</label>
            <small>Minim 8 caractere</small>
          </span>
          <span className="email-auth-input-wrap">
            <LockKeyhole aria-hidden="true" size={18} strokeWidth={2.2} />
            <input
              id="reset-password"
              className="email-auth-input"
              type="password"
              name="password"
              minLength={8}
              autoComplete="new-password"
              required
              disabled={!ready}
            />
          </span>
        </div>
        <div className="email-auth-field">
          <span className="email-auth-label-row">
            <label htmlFor="reset-confirm-password">Confirma parola</label>
          </span>
          <span className="email-auth-input-wrap">
            <CheckCircle2 aria-hidden="true" size={18} strokeWidth={2.2} />
            <input
              id="reset-confirm-password"
              className="email-auth-input"
              type="password"
              name="confirmPassword"
              minLength={8}
              autoComplete="new-password"
              required
              disabled={!ready}
            />
          </span>
        </div>
        <button className="email-auth-primary" type="submit" disabled={!ready}>
          Schimba parola
        </button>
      </form>
    </section>
  );
}
