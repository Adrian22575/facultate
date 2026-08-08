"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, LockKeyhole, ShieldCheck } from "lucide-react";

import { resetPasswordAction } from "@/app/auth/password-actions";
import { Button } from "@/components/ui/action";
import { SurfaceCard } from "@/components/ui/surface-card";
import { InlineFeedback } from "@/components/ui/status";
import { createClient } from "@/lib/supabase/client";
import emailStyles from "./email-auth-panel.module.css";
import styles from "./password-reset-form.module.css";

export function PasswordResetForm({ errorMessage = "", nextPath = "/" }) {
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

        const {
          data: { user },
          error: userError
        } = await supabase.auth.getUser();
        if (userError || !user) {
          throw userError || new Error("recovery_session_missing");
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
    <SurfaceCard as="section" className={[styles["auth-password-panel"], emailStyles["email-auth-panel"]].filter(Boolean).join(" ")}>
      <a className={[emailStyles["email-auth-back"]].filter(Boolean).join(" ")} href={`/auth/email-login?next=${encodeURIComponent(nextPath)}`}>
        <ArrowLeft aria-hidden="true" size={16} />
        Inapoi la autentificare
      </a>
      <div className={[emailStyles["email-auth-kicker"]].filter(Boolean).join(" ")}>
        <ShieldCheck aria-hidden="true" size={16} />
        Resetare securizata
      </div>
      <h1>Seteaza parola noua</h1>
      <p>Alege o parola noua pentru contul tau. Parola trebuie sa aiba minim 8 caractere.</p>

      {errorMessage || setupError ? (
        <InlineFeedback className={emailStyles["inline-error"]} tone="error" role="alert">
          {setupError || errorMessage}
        </InlineFeedback>
      ) : null}

      <form action={resetPasswordAction} className={[styles["auth-password-form"]].filter(Boolean).join(" ")}>
        <input type="hidden" name="next" value={nextPath} />
        <div className={[emailStyles["email-auth-field"]].filter(Boolean).join(" ")}>
          <span className={[emailStyles["email-auth-label-row"]].filter(Boolean).join(" ")}>
            <label htmlFor="reset-password">Parola noua</label>
            <small>Minim 8 caractere</small>
          </span>
          <span className={[emailStyles["email-auth-input-wrap"]].filter(Boolean).join(" ")}>
            <LockKeyhole aria-hidden="true" size={18} strokeWidth={2.2} />
            <input
              id="reset-password"
              className={[emailStyles["email-auth-input"]].filter(Boolean).join(" ")}
              type="password"
              name="password"
              minLength={8}
              autoComplete="new-password"
              required
              disabled={!ready}
            />
          </span>
        </div>
        <div className={[emailStyles["email-auth-field"]].filter(Boolean).join(" ")}>
          <span className={[emailStyles["email-auth-label-row"]].filter(Boolean).join(" ")}>
            <label htmlFor="reset-confirm-password">Confirma parola</label>
          </span>
          <span className={[emailStyles["email-auth-input-wrap"]].filter(Boolean).join(" ")}>
            <CheckCircle2 aria-hidden="true" size={18} strokeWidth={2.2} />
            <input
              id="reset-confirm-password"
              className={[emailStyles["email-auth-input"]].filter(Boolean).join(" ")}
              type="password"
              name="confirmPassword"
              minLength={8}
              autoComplete="new-password"
              required
              disabled={!ready}
            />
          </span>
        </div>
        <Button className={[emailStyles["email-auth-primary"], styles["auth-password-submit"]].filter(Boolean).join(" ")} fullWidth type="submit" disabled={!ready}>
          Schimba parola
        </Button>
      </form>
    </SurfaceCard>
  );
}
