"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock, Gift, MessageSquareQuote, Upload } from "lucide-react";

import { activateTestimonialRewardAction, submitTestimonialRewardAction } from "@/app/review-reward/actions";
import { Button } from "@/components/ui/action";
import { SurfaceCard } from "@/components/ui/surface-card";
import styles from "./testimonial-reward-form.module.css";
import {
  TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH,
  TESTIMONIAL_REWARD_OPTIONS,
  TESTIMONIAL_REWARD_QUESTIONS
} from "@/lib/testimonial-reward-copy";

const DRAFT_STORAGE_KEY = "nota5plus:testimonial-reward-draft";

function moduleClassNames(...names) {
  return names.filter(Boolean).map((name) => styles[name] || name).filter(Boolean).join(" ");
}

function readSavedDraft() {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DRAFT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearSavedDraft() {
  if (typeof window === "undefined") {
    return;
  }

  try {
    window.localStorage.removeItem(DRAFT_STORAGE_KEY);
  } catch {
    // Local storage is optional.
  }
}

function rewardLabel(value) {
  return TESTIMONIAL_REWARD_OPTIONS[value]?.label || "Recompensa aleasa";
}

function ExistingReviewStatusCard({ latestSubmission }) {
  if (!latestSubmission?.id) {
    return null;
  }

  const testimonial = latestSubmission.public_testimonial || latestSubmission.edited_testimonial;
  const isRewardReady = latestSubmission.status === "approved" && !latestSubmission.reward_granted_at;
  const statusCopy =
    latestSubmission.status === "approved"
      ? latestSubmission.reward_granted_at
        ? {
            iconClass: "is-good",
            title: "Review aprobat.",
            text: "Recompensa este activata in contul tau."
          }
        : {
            iconClass: "is-warning",
            title: "Review aprobat. Recompensa este pregatita.",
            text: "O poti activa cand ai nevoie, ca sa nu pierzi timpul de acces inainte de examen."
          }
      : latestSubmission.status === "rejected"
        ? {
            iconClass: "",
            title: "Ai trimis deja un review.",
            text: latestSubmission.admin_note || "Review-ul tau a fost verificat si nu a fost aprobat."
          }
        : {
            iconClass: "is-warning",
            title: "Multumim! Review-ul tau a fost salvat.",
            text: "Recompensa va fi pregatita dupa verificare. Adminul a primit notificare pe Telegram."
          };

  return (
    <SurfaceCard as="section" className={moduleClassNames("testimonial-status-card", "testimonial-existing-card")} role="status">
      <span className={moduleClassNames("testimonial-status-icon", statusCopy.iconClass)}>
        {latestSubmission.status === "pending" ? (
          <Clock aria-hidden="true" size={22} />
        ) : latestSubmission.status === "approved" ? (
          <CheckCircle2 aria-hidden="true" size={22} />
        ) : (
          <MessageSquareQuote aria-hidden="true" size={22} />
        )}
      </span>
      <div>
        <strong>{statusCopy.title}</strong>
        <p className="page-copy">{statusCopy.text}</p>
        <div className={moduleClassNames("testimonial-existing-review")}>
          <span>Review-ul tau</span>
          <p>{testimonial}</p>
        </div>
        <div className={moduleClassNames("testimonial-existing-meta")}>
          <span>{rewardLabel(latestSubmission.reward_type)}</span>
          <span>
            {latestSubmission.status === "approved"
              ? latestSubmission.reward_granted_at
                ? "Activata"
                : "Gata de activat"
              : latestSubmission.status === "rejected"
                ? "Respins"
                : "In verificare"}
          </span>
        </div>
        {isRewardReady ? (
          <form action={activateTestimonialRewardAction} className={moduleClassNames("testimonial-claim-form")}>
            <input type="hidden" name="submissionId" value={latestSubmission.id} />
            <input type="hidden" name="returnTo" value="/review-reward" />
            <Button type="submit" className={moduleClassNames("testimonial-primary-action")}>
              Activeaza recompensa
            </Button>
            <span className="micro-copy">Porneste-o doar cand ai nevoie de ea.</span>
          </form>
        ) : null}
      </div>
    </SurfaceCard>
  );
}

function FormStatusCard({ status, latestSubmission }) {
  if (latestSubmission?.id) {
    return <ExistingReviewStatusCard latestSubmission={latestSubmission} />;
  }

  if (status === "saved") {
    return (
      <SurfaceCard as="section" className={moduleClassNames("testimonial-status-card")} role="status">
        <span className={moduleClassNames("testimonial-status-icon", "is-warning")}>
          <Clock aria-hidden="true" size={22} />
        </span>
        <div>
          <strong>Multumim! Review-ul tau a fost salvat.</strong>
          <p className="page-copy">
            Recompensa va fi pregatita dupa verificare. Adminul a primit notificare pe Telegram.
          </p>
        </div>
      </SurfaceCard>
    );
  }

  if (status === "reward_activated") {
    return (
      <SurfaceCard as="section" className={moduleClassNames("testimonial-status-card")} role="status">
        <span className={moduleClassNames("testimonial-status-icon", "is-good")}>
          <CheckCircle2 aria-hidden="true" size={22} />
        </span>
        <div>
          <strong>Recompensa a fost activata.</strong>
          <p className="page-copy">Acum o poti folosi in contul tau.</p>
        </div>
      </SurfaceCard>
    );
  }

  if (status === "already_rewarded" || status === "already_submitted" || status === "already_pending") {
    return (
      <SurfaceCard as="section" className={moduleClassNames("testimonial-status-card")} role="status">
        <span className={moduleClassNames("testimonial-status-icon", "is-good")}>
          <CheckCircle2 aria-hidden="true" size={22} />
        </span>
        <div>
          <strong>Ai trimis deja un review.</strong>
          <p className="page-copy">Multumim ca ne-ai ajutat cu feedback real. Formularul poate fi retrimis doar dupa resetarea review-ului de catre admin.</p>
        </div>
      </SurfaceCard>
    );
  }

  if (status && status !== "saved") {
    return (
      <SurfaceCard as="section" className={moduleClassNames("testimonial-status-card")} role="alert">
        <span className={moduleClassNames("testimonial-status-icon")}>
          <MessageSquareQuote aria-hidden="true" size={22} />
        </span>
        <div>
          <strong>Nu am putut salva review-ul acum.</strong>
          <p className="page-copy">
            Fiecare raspuns trebuie sa aiba minim {TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH} caractere.
          </p>
        </div>
      </SurfaceCard>
    );
  }

  return null;
}

function answerLength(value) {
  return String(value || "").trim().length;
}

export function TestimonialRewardForm({ latestSubmission = null, status = "" }) {
  const [answers, setAnswers] = useState(() =>
    Object.fromEntries(TESTIMONIAL_REWARD_QUESTIONS.map((question) => [question.key, ""]))
  );
  const [rewardType, setRewardType] = useState("ai_upload_1");
  const [draftLoaded, setDraftLoaded] = useState(false);

  const isLocked = Boolean(latestSubmission?.id);
  const completedCount = useMemo(
    () =>
      TESTIMONIAL_REWARD_QUESTIONS.filter(
        (question) => answerLength(answers[question.key]) >= TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH
      ).length,
    [answers]
  );
  const progressPercent = Math.round((completedCount / TESTIMONIAL_REWARD_QUESTIONS.length) * 100);
  const allFilled = completedCount === TESTIMONIAL_REWARD_QUESTIONS.length;

  useEffect(() => {
    if (isLocked) {
      clearSavedDraft();
      return;
    }

    const saved = readSavedDraft();
    if (saved?.answers && typeof saved.answers === "object") {
      setAnswers((current) => ({
        ...current,
        ...Object.fromEntries(
          TESTIMONIAL_REWARD_QUESTIONS.map((question) => [
            question.key,
            typeof saved.answers[question.key] === "string" ? saved.answers[question.key] : current[question.key]
          ])
        )
      }));
    }
    if (saved?.rewardType === "premium_24h" || saved?.rewardType === "ai_upload_1") {
      setRewardType(saved.rewardType);
    }
    setDraftLoaded(true);
  }, [isLocked]);

  useEffect(() => {
    if (!draftLoaded || isLocked || typeof window === "undefined") {
      return;
    }

    const hasContent = Object.values(answers).some((answer) => String(answer || "").trim());

    if (!hasContent) {
      clearSavedDraft();
      return;
    }

    try {
      window.localStorage.setItem(
        DRAFT_STORAGE_KEY,
        JSON.stringify({
          answers,
          rewardType
        })
      );
    } catch {
      // Local storage is optional.
    }
  }, [answers, draftLoaded, isLocked, rewardType]);

  function updateAnswer(key, value) {
    setAnswers((current) => ({
      ...current,
      [key]: value
    }));
  }

  return (
    <div className={moduleClassNames("testimonial-reward-stack")}>
      <FormStatusCard status={status} latestSubmission={latestSubmission} />

      {!isLocked ? (
        <form action={submitTestimonialRewardAction} className={moduleClassNames("testimonial-reward-form")}>
          <SurfaceCard as="section" className={moduleClassNames("testimonial-intro-card")}>
            <div className={moduleClassNames("testimonial-intro-icon")} aria-hidden="true">
              <MessageSquareQuote size={26} />
            </div>
            <div>
          <h1>Ajuta-ne cu un review si primesti o recompensa</h1>
              <p>
                Raspunde la 5 intrebari scurte. Noi pregatim testimonialul pentru verificare,
                iar dupa aprobare activezi tu recompensa cand ai nevoie.
              </p>
            </div>
          </SurfaceCard>

          <SurfaceCard as="section" className={moduleClassNames("testimonial-reward-choice")} aria-label="Alege recompensa">
            <div className={moduleClassNames("testimonial-section-head")}>
              <span className={moduleClassNames("account-section-label")}>Recompensa</span>
              <strong>Alege ce iti foloseste acum</strong>
            </div>
            <div className={moduleClassNames("testimonial-choice-grid")}>
              <label className={moduleClassNames("testimonial-choice", rewardType === "ai_upload_1" && "is-selected")}>
                <input
                  type="radio"
                  name="rewardType"
                  value="ai_upload_1"
                  checked={rewardType === "ai_upload_1"}
                  onChange={() => setRewardType("ai_upload_1")}
                />
                <span className={moduleClassNames("testimonial-choice-icon")}>
                  <Upload aria-hidden="true" size={20} />
                </span>
                <span>
                  <strong>{TESTIMONIAL_REWARD_OPTIONS.ai_upload_1.label}</strong>
                  <small>Pentru urmatorul PDF, curs sau set de poze.</small>
                </span>
              </label>
              <label className={moduleClassNames("testimonial-choice", rewardType === "premium_24h" && "is-selected")}>
                <input
                  type="radio"
                  name="rewardType"
                  value="premium_24h"
                  checked={rewardType === "premium_24h"}
                  onChange={() => setRewardType("premium_24h")}
                />
                <span className={moduleClassNames("testimonial-choice-icon")}>
                  <Gift aria-hidden="true" size={20} />
                </span>
                <span>
                  <strong>{TESTIMONIAL_REWARD_OPTIONS.premium_24h.label}</strong>
                  <small>Pentru recapitulare rapida inainte de examen.</small>
                </span>
              </label>
            </div>
          </SurfaceCard>

          <SurfaceCard as="section" className={moduleClassNames("testimonial-questions-card")}>
            <div className={moduleClassNames("testimonial-section-head")}>
              <span className={moduleClassNames("account-section-label")}>ReviewReward</span>
              <strong>5 raspunsuri scurte</strong>
              <div className={moduleClassNames("testimonial-progress")} aria-label={`${completedCount} din 5 raspunsuri completate`}>
                <span style={{ width: `${progressPercent}%` }} />
              </div>
              <small className={moduleClassNames("testimonial-progress-label")}>
                {`${completedCount}/5 completate - minim ${TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH} caractere fiecare`}
              </small>
            </div>
            <div className={moduleClassNames("testimonial-question-list")}>
              {TESTIMONIAL_REWARD_QUESTIONS.map((question, index) => {
                const currentLength = answerLength(answers[question.key]);
                const isComplete = currentLength >= TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH;

                return (
                  <label className={moduleClassNames("testimonial-question-field")} key={question.key}>
                    <span className={moduleClassNames("testimonial-question-label")}>
                      <span>{`${index + 1}. ${question.label}`}</span>
                      {isComplete ? <CheckCircle2 aria-hidden="true" size={17} /> : null}
                    </span>
                    <textarea
                      required
                      rows={3}
                      name={question.key}
                      value={answers[question.key]}
                      onChange={(event) => updateAnswer(question.key, event.target.value)}
                      className={moduleClassNames("textarea-input", "testimonial-question-textarea")}
                      minLength={TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH}
                      maxLength={700}
                    />
                    <span className={moduleClassNames("testimonial-answer-count", isComplete && "is-complete")}>
                      {`${Math.min(currentLength, TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH)}/${TESTIMONIAL_REWARD_MIN_ANSWER_LENGTH} caractere minime`}
                    </span>
                  </label>
                );
              })}
            </div>
            <div className={moduleClassNames("testimonial-form-actions")}>
              <Button type="submit" className={moduleClassNames("testimonial-primary-action")} disabled={!allFilled}>
                Trimite review
              </Button>
              <span className="micro-copy">Dupa aprobare, recompensa ramane pregatita pana o activezi.</span>
            </div>
          </SurfaceCard>
        </form>
      ) : null}
    </div>
  );
}
