"use client";

import { useMemo, useRef, useState } from "react";
import { usePathname } from "next/navigation";

import { LoadingIconText } from "@/components/loading-spinner";
import { useDialogFocus } from "@/lib/ui/dialog";

const FEEDBACK_OPTIONS = [
  { value: "problem", label: "Problema" },
  { value: "feature", label: "Cerinta noua" },
  { value: "idea", label: "Idee" }
];
const MIN_FEEDBACK_MESSAGE_LENGTH = 10;
const MAX_FEEDBACK_MESSAGE_LENGTH = 3000;

function shouldHideFeedback(pathname) {
  if (!pathname) {
    return true;
  }

  if (
    pathname.startsWith("/auth") ||
    pathname.startsWith("/onboarding") ||
    pathname.startsWith("/setup") ||
    pathname === "/licenta-exam"
  ) {
    return true;
  }

  return (
    pathname.endsWith("/studiu") ||
    pathname.endsWith("/test") ||
    pathname.endsWith("/interactiv")
  );
}

export function FeedbackLauncher() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("problem");
  const [message, setMessage] = useState("");
  const [optionalDetail, setOptionalDetail] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messageRef = useRef(null);
  const dialogRef = useDialogFocus(isOpen, () => setIsOpen(false), messageRef);

  const isHidden = useMemo(() => shouldHideFeedback(pathname), [pathname]);
  const trimmedMessageLength = message.trim().length;
  const isValid = trimmedMessageLength >= MIN_FEEDBACK_MESSAGE_LENGTH;

  if (isHidden) {
    return null;
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!isValid || isSubmitting) {
      return;
    }

    setError("");
    setSuccess("");
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          feedbackType,
          message: message.trim(),
          optionalDetail: optionalDetail.trim(),
          pagePath: pathname || "/"
        })
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Nu am putut trimite feedback-ul acum.");
      }

      setSuccess("Multumim. Am primit mesajul tau.");
      setMessage("");
      setOptionalDetail("");
      setFeedbackType("problem");

      window.setTimeout(() => {
        setIsOpen(false);
        setSuccess("");
      }, 900);
    } catch (submitError) {
      setError(
        submitError instanceof Error
          ? submitError.message
          : "Nu am putut trimite feedback-ul acum."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className="feedback-fab"
        onClick={() => {
          setError("");
          setSuccess("");
          setIsOpen(true);
        }}
      >
        Feedback
      </button>

      {isOpen ? (
        <div
          className="feedback-backdrop"
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) {
              setIsOpen(false);
            }
          }}
        >
          <section
            ref={dialogRef}
            className="feedback-panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="feedback-title"
          >
            <div className="feedback-head">
              <div>
                <strong id="feedback-title">Trimite feedback</strong>
                <p>Spune-ne ce nu merge, ce lipseste sau ce ai vrea sa vezi.</p>
              </div>
              <button
                type="button"
                className="workspace-modal-close feedback-modal-close"
                onClick={() => setIsOpen(false)}
              >
                Inchide
              </button>
            </div>

            <form className="feedback-form" onSubmit={handleSubmit}>
              <label className="onboarding-form-field">
                <span>Tip feedback</span>
                <select
                  value={feedbackType}
                  onChange={(event) => setFeedbackType(event.target.value)}
                >
                  {FEEDBACK_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="onboarding-form-field">
                <span>Mesaj</span>
                <textarea
                  ref={messageRef}
                  className="textarea-input feedback-textarea"
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Descrie pe scurt problema, cerinta sau ideea ta."
                  maxLength={MAX_FEEDBACK_MESSAGE_LENGTH}
                />
                <div className="feedback-message-meta">
                  <span className={`feedback-message-hint ${isValid ? "is-valid" : "is-pending"}`}>
                    {isValid
                      ? "Poti trimite feedback-ul."
                      : `Scrie cel putin ${MIN_FEEDBACK_MESSAGE_LENGTH} caractere.`}
                  </span>
                  <span className="feedback-message-count">
                    {trimmedMessageLength}/{MIN_FEEDBACK_MESSAGE_LENGTH} minim
                  </span>
                </div>
              </label>

              <label className="onboarding-form-field">
                <span>Link sau detaliu optional</span>
                <input
                  className="input-search"
                  type="text"
                  value={optionalDetail}
                  onChange={(event) => setOptionalDetail(event.target.value)}
                  placeholder="Ex: pagina unde apare problema sau un detaliu util"
                  maxLength={500}
                />
              </label>

              {error ? <div className="error-state" role="alert">{error}</div> : null}
              {success ? <div className="success-state" role="status">{success}</div> : null}

              <div className="inline-actions feedback-actions">
                <button type="submit" disabled={!isValid || isSubmitting}>
                  <LoadingIconText loading={isSubmitting} loadingLabel="Trimitem...">
                    Trimite feedback
                  </LoadingIconText>
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
