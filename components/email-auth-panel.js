"use client";

import { useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Gift,
  LockKeyhole,
  Mail,
  Phone,
  ShieldCheck,
  UserRound
} from "lucide-react";

import {
  forgotPasswordAction,
  signInWithPasswordAction,
  signUpWithEmailAction
} from "@/app/auth/password-actions";
import { LoadingIconText } from "@/components/loading-spinner";
import { Button } from "@/components/ui/action";
import { SurfaceCard } from "@/components/ui/surface-card";
import { InlineFeedback } from "@/components/ui/status";
import { handleTablistKeyDown } from "@/lib/ui/tablist";
import styles from "./email-auth-panel.module.css";

function normalizeInitialMode(mode) {
  return ["login", "signup", "forgot"].includes(mode) ? mode : "login";
}

function AuthInput({ id, label, hint = "", action = null, icon: Icon, children }) {
  return (
    <div className={[styles["email-auth-field"]].filter(Boolean).join(" ")}>
      <span className={[styles["email-auth-label-row"]].filter(Boolean).join(" ")}>
        <label htmlFor={id}>{label}</label>
        {action || (hint ? <small>{hint}</small> : null)}
      </span>
      <span className={[styles["email-auth-input-wrap"]].filter(Boolean).join(" ")}>
        <Icon aria-hidden="true" size={18} strokeWidth={2.2} />
        {children}
      </span>
    </div>
  );
}

function EmailAuthSubmitButton({ children, pendingLabel }) {
  const { pending } = useFormStatus();

  return (
    <Button className={styles["email-auth-primary"]} type="submit" fullWidth disabled={pending}>
      <LoadingIconText loading={pending} loadingLabel={pendingLabel}>
        {children}
      </LoadingIconText>
    </Button>
  );
}

export function EmailAuthPanel({
  initialMode = "login",
  nextPath = "/",
  hasReferralInvite = false,
  errorMessage = "",
  successMessage = ""
}) {
  const [mode, setMode] = useState(normalizeInitialMode(initialMode));
  const [signupStep, setSignupStep] = useState(1);
  const [showServerMessage, setShowServerMessage] = useState(true);
  const [signupIdentity, setSignupIdentity] = useState({
    fullName: "",
    email: "",
    phone: ""
  });

  const canContinueSignup = useMemo(
    () =>
      signupIdentity.fullName.trim().length >= 2 &&
      /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signupIdentity.email.trim()) &&
      signupIdentity.phone.replace(/\D/g, "").length >= 9,
    [signupIdentity]
  );

  function showMode(nextMode) {
    setMode(nextMode);
    setSignupStep(1);
    setShowServerMessage(false);
  }

  const loginBackHref = `/auth/login?next=${encodeURIComponent(nextPath)}${hasReferralInvite ? "&ref=1" : ""}`;

  return (
    <SurfaceCard as="section" className={styles["email-auth-panel"]} aria-label="Autentificare cu email">
      <div className={[styles["email-auth-head"]].filter(Boolean).join(" ")}>
        <a className={[styles["email-auth-back"]].filter(Boolean).join(" ")} href={loginBackHref}>
          <ArrowLeft aria-hidden="true" size={16} />
          Inapoi la Google
        </a>
        <div className={[styles["email-auth-kicker"]].filter(Boolean).join(" ")}>
          <ShieldCheck aria-hidden="true" size={16} />
          Autentificare securizata
        </div>
        <h1>{mode === "signup" ? "Creeaza cont" : mode === "forgot" ? "Reseteaza parola" : "Intra cu email"}</h1>
        <p>
          {mode === "signup"
            ? "Ai nevoie doar de datele de contact si o parola."
            : mode === "forgot"
              ? "Trimitem un link de resetare daca emailul exista in platforma."
              : "Foloseste emailul si parola create pentru Nota 5+."}
        </p>
      </div>

      {hasReferralInvite ? (
        <div className={[styles["email-auth-referral-badge"]].filter(Boolean).join(" ")} role="status">
          <Gift aria-hidden="true" size={18} strokeWidth={2.3} />
          <div>
            <strong>Link de coleg</strong>
            <span>Cont nou + cadou activat = colegul poate porni 24h.</span>
          </div>
        </div>
      ) : null}

      <div
        className={[styles["email-auth-segment"]].filter(Boolean).join(" ")}
        role="tablist"
        aria-label="Alege actiunea"
        onKeyDown={handleTablistKeyDown}
      >
        <button
          id="email-auth-tab-login"
          type="button"
          role="tab"
          aria-selected={mode !== "signup"}
          aria-controls="email-auth-active-panel"
          tabIndex={mode !== "signup" ? 0 : -1}
          className={[styles["email-auth-tab"], mode !== "signup" && styles["is-active"]].filter(Boolean).join(" ")}
          onClick={() => showMode("login")}
        >
          <Mail aria-hidden="true" size={16} />
          Intra
        </button>
        <button
          id="email-auth-tab-signup"
          type="button"
          role="tab"
          aria-selected={mode === "signup"}
          aria-controls="email-auth-active-panel"
          tabIndex={mode === "signup" ? 0 : -1}
          className={[styles["email-auth-tab"], mode === "signup" && styles["is-active"]].filter(Boolean).join(" ")}
          onClick={() => showMode("signup")}
        >
          <UserRound aria-hidden="true" size={16} />
          Creeaza cont
        </button>
      </div>

      <div
        id="email-auth-active-panel"
        role="tabpanel"
        aria-labelledby={`email-auth-tab-${mode === "signup" ? "signup" : "login"}`}
      >
      {showServerMessage && errorMessage ? (
        <InlineFeedback className={styles["inline-error"]} tone="error" role="alert">
          {errorMessage}
        </InlineFeedback>
      ) : null}

      {showServerMessage && successMessage ? (
        <InlineFeedback className={styles["auth-inline-success"]} tone="success" role="status">
          {successMessage}
        </InlineFeedback>
      ) : null}

      {mode === "login" ? (
        <form action={signInWithPasswordAction} className={[styles["email-auth-form"]].filter(Boolean).join(" ")}>
          <input type="hidden" name="next" value={nextPath} />
          <AuthInput id="login-email" label="Email" icon={Mail}>
            <input id="login-email" className={[styles["email-auth-input"]].filter(Boolean).join(" ")} type="email" name="email" autoComplete="email" required />
          </AuthInput>
          <AuthInput
            id="login-password"
            label="Parola"
            icon={LockKeyhole}
            action={
              <button type="button" className={[styles["email-auth-text-button"]].filter(Boolean).join(" ")} onClick={() => showMode("forgot")}>
                Ai uitat parola?
              </button>
            }
          >
            <input
              id="login-password"
              className={[styles["email-auth-input"]].filter(Boolean).join(" ")}
              type="password"
              name="password"
              autoComplete="current-password"
              required
            />
          </AuthInput>
          <EmailAuthSubmitButton pendingLabel="Se autentifica...">Intra</EmailAuthSubmitButton>
          <p className={[styles["email-auth-switch"]].filter(Boolean).join(" ")}>
            Nu ai cont?{" "}
            <button className={[styles["email-auth-switch-button"]].filter(Boolean).join(" ")} type="button" onClick={() => showMode("signup")}>
              Creeaza unul
            </button>
          </p>
        </form>
      ) : null}

      {mode === "signup" && signupStep === 1 ? (
        <div className={[styles["email-auth-form"]].filter(Boolean).join(" ")}>
          <div className={[styles["email-auth-step-row"]].filter(Boolean).join(" ")} aria-label="Pasul 1 din 2">
            <span className={[styles["is-active"]].filter(Boolean).join(" ")} />
            <span />
          </div>
          <AuthInput id="signup-name" label="Nume" icon={UserRound}>
            <input
              id="signup-name"
              className={[styles["email-auth-input"]].filter(Boolean).join(" ")}
              type="text"
              autoComplete="name"
              value={signupIdentity.fullName}
              onChange={(event) => setSignupIdentity((current) => ({ ...current, fullName: event.target.value }))}
              required
            />
          </AuthInput>
          <AuthInput id="signup-email" label="Email" icon={Mail}>
            <input
              id="signup-email"
              className={[styles["email-auth-input"]].filter(Boolean).join(" ")}
              type="email"
              autoComplete="email"
              value={signupIdentity.email}
              onChange={(event) => setSignupIdentity((current) => ({ ...current, email: event.target.value }))}
              required
            />
          </AuthInput>
          <AuthInput id="signup-phone" label="Numar de telefon" icon={Phone}>
            <input
              id="signup-phone"
              className={[styles["email-auth-input"]].filter(Boolean).join(" ")}
              type="tel"
              autoComplete="tel"
              value={signupIdentity.phone}
              onChange={(event) => setSignupIdentity((current) => ({ ...current, phone: event.target.value }))}
              required
            />
          </AuthInput>
          <Button
            className={[styles["email-auth-primary"]].filter(Boolean).join(" ")}
            type="button"
            fullWidth
            disabled={!canContinueSignup}
            onClick={() => setSignupStep(2)}
          >
            Continua
          </Button>
          <p className={[styles["email-auth-switch"]].filter(Boolean).join(" ")}>
            Ai deja cont?{" "}
            <button className={[styles["email-auth-switch-button"]].filter(Boolean).join(" ")} type="button" onClick={() => showMode("login")}>
              Intra
            </button>
          </p>
        </div>
      ) : null}

      {mode === "signup" && signupStep === 2 ? (
        <form action={signUpWithEmailAction} className={[styles["email-auth-form"]].filter(Boolean).join(" ")}>
          <input type="hidden" name="next" value={nextPath} />
          <input type="hidden" name="fullName" value={signupIdentity.fullName} />
          <input type="hidden" name="email" value={signupIdentity.email} />
          <input type="hidden" name="phone" value={signupIdentity.phone} />
          <div className={[styles["email-auth-step-row"]].filter(Boolean).join(" ")} aria-label="Pasul 2 din 2">
            <span />
            <span className={[styles["is-active"]].filter(Boolean).join(" ")} />
          </div>
          <AuthInput id="signup-password" label="Parola" hint="Minim 8 caractere" icon={LockKeyhole}>
            <input
              id="signup-password"
              className={[styles["email-auth-input"]].filter(Boolean).join(" ")}
              type="password"
              name="password"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </AuthInput>
          <AuthInput id="signup-confirm-password" label="Confirma parola" icon={CheckCircle2}>
            <input
              id="signup-confirm-password"
              className={[styles["email-auth-input"]].filter(Boolean).join(" ")}
              type="password"
              name="confirmPassword"
              minLength={8}
              autoComplete="new-password"
              required
            />
          </AuthInput>
          <p className={[styles["email-auth-legal-copy"]].filter(Boolean).join(" ")}>
            Prin crearea contului confirmi ca ai citit si accepti{" "}
            <a href="/termeni" target="_blank" rel="noreferrer">Termenii</a> si{" "}
            <a href="/confidentialitate" target="_blank" rel="noreferrer">Politica de confidentialitate</a>.
          </p>
          <EmailAuthSubmitButton pendingLabel="Se creeaza contul...">Creeaza cont</EmailAuthSubmitButton>
          <Button variant="secondary" fullWidth className={styles["email-auth-secondary-button"]} type="button" onClick={() => setSignupStep(1)}>
            Inapoi la datele de contact
          </Button>
        </form>
      ) : null}

      {mode === "forgot" ? (
        <form action={forgotPasswordAction} className={[styles["email-auth-form"]].filter(Boolean).join(" ")}>
          <input type="hidden" name="next" value={nextPath} />
          <AuthInput id="forgot-email" label="Email" icon={Mail}>
            <input id="forgot-email" className={[styles["email-auth-input"]].filter(Boolean).join(" ")} type="email" name="email" autoComplete="email" required />
          </AuthInput>
          <EmailAuthSubmitButton pendingLabel="Se trimite linkul...">Trimite link</EmailAuthSubmitButton>
          <Button variant="secondary" fullWidth className={styles["email-auth-secondary-button"]} type="button" onClick={() => showMode("login")}>
            Inapoi la autentificare
          </Button>
        </form>
      ) : null}
      </div>
    </SurfaceCard>
  );
}
