"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ImagePlus, MonitorUp, X } from "lucide-react";
import { usePathname } from "next/navigation";

import {
  FEEDBACK_SCREENSHOT_MAX_BYTES,
  FEEDBACK_SCREENSHOT_MAX_LABEL,
  getFeedbackScreenshotType
} from "@/lib/feedback-screenshot";
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
  const [screenshot, setScreenshot] = useState(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isCapturing, setIsCapturing] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const messageRef = useRef(null);
  const screenshotInputRef = useRef(null);
  const dialogRef = useDialogFocus(isOpen, () => setIsOpen(false), messageRef);

  const isHidden = useMemo(() => shouldHideFeedback(pathname), [pathname]);
  const trimmedMessageLength = message.trim().length;
  const isValid = trimmedMessageLength >= MIN_FEEDBACK_MESSAGE_LENGTH;
  const canCapturePage = typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);
  const screenshotPreviewUrl = useMemo(
    () => (screenshot ? URL.createObjectURL(screenshot) : ""),
    [screenshot]
  );

  useEffect(() => {
    return () => {
      if (screenshotPreviewUrl) {
        URL.revokeObjectURL(screenshotPreviewUrl);
      }
    };
  }, [screenshotPreviewUrl]);

  if (isHidden) {
    return null;
  }

  function updateScreenshot(nextScreenshot) {
    if (!nextScreenshot) {
      setScreenshot(null);
      return;
    }

    if (!getFeedbackScreenshotType(nextScreenshot.type)) {
      setError("Alege o captură PNG, JPG sau WEBP.");
      return;
    }

    if (nextScreenshot.size > FEEDBACK_SCREENSHOT_MAX_BYTES) {
      setError(`Captura depășește limita de ${FEEDBACK_SCREENSHOT_MAX_LABEL}.`);
      return;
    }

    setError("");
    setScreenshot(nextScreenshot);
  }

  function handleScreenshotPaste(event) {
    const item = Array.from(event.clipboardData?.items || []).find((entry) => entry.type.startsWith("image/"));
    const pastedImage = item?.getAsFile();

    if (!pastedImage) {
      setError("Clipboard-ul nu conține o imagine. Alege un fișier PNG, JPG sau WEBP.");
      return;
    }

    event.preventDefault();
    updateScreenshot(pastedImage);
  }

  async function captureCurrentPage() {
    if (!canCapturePage || isCapturing || isSubmitting) {
      return;
    }

    let stream = null;
    let video = null;
    setError("");
    setIsCapturing(true);

    try {
      stream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser"
        },
        audio: false,
        preferCurrentTab: true,
        selfBrowserSurface: "include",
        surfaceSwitching: "exclude"
      });

      const track = stream.getVideoTracks()[0];
      if (!track) {
        throw new Error("Nu am primit imaginea pentru captură.");
      }

      if (track.getSettings?.().displaySurface && track.getSettings().displaySurface !== "browser") {
        throw new Error("Alege tabul aplicației din fereastra de partajare pentru a face captura.");
      }

      video = document.createElement("video");
      video.srcObject = stream;
      video.muted = true;
      video.playsInline = true;
      await video.play();

      if (video.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        await new Promise((resolve) => video.addEventListener("loadeddata", resolve, { once: true }));
      }

      const scale = Math.min(1, 1600 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
      const width = Math.max(1, Math.round(video.videoWidth * scale));
      const height = Math.max(1, Math.round(video.videoHeight * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      canvas.getContext("2d")?.drawImage(video, 0, 0, width, height);

      const qualities = [0.88, 0.76, 0.64];
      let imageBlob = null;
      for (const quality of qualities) {
        imageBlob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
        if (imageBlob && imageBlob.size <= FEEDBACK_SCREENSHOT_MAX_BYTES) {
          break;
        }
      }

      if (!imageBlob || imageBlob.size > FEEDBACK_SCREENSHOT_MAX_BYTES) {
        throw new Error(`Captura depășește limita de ${FEEDBACK_SCREENSHOT_MAX_LABEL}.`);
      }

      updateScreenshot(new File([imageBlob], `captura-feedback-${Date.now()}.jpg`, { type: "image/jpeg" }));
    } catch (captureError) {
      const captureMessage = captureError instanceof Error ? captureError.message : "Nu am putut face captura.";
      setError(
        captureError?.name === "NotAllowedError"
          ? "Captura a fost anulată. Poți atașa manual o imagine, dacă preferi."
          : captureMessage
      );
    } finally {
      stream?.getTracks().forEach((track) => track.stop());
      if (video) {
        video.pause();
        video.srcObject = null;
      }
      setIsCapturing(false);
    }
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
      const formData = new FormData();
      formData.set("feedbackType", feedbackType);
      formData.set("message", message.trim());
      formData.set("optionalDetail", optionalDetail.trim());
      formData.set("pagePath", pathname || "/");
      if (screenshot) {
        formData.set("screenshot", screenshot);
      }

      const response = await fetch("/api/feedback", {
        method: "POST",
        body: formData
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(payload?.error || "Nu am putut trimite feedback-ul acum.");
      }

      setSuccess("Mulțumim. Am primit mesajul tău.");
      setMessage("");
      setOptionalDetail("");
      setScreenshot(null);
      setFeedbackType("problem");
      if (screenshotInputRef.current) screenshotInputRef.current.value = "";

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
          className={`feedback-backdrop${isCapturing ? " is-capturing" : ""}`}
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
                <p>Spune-ne ce nu merge, ce lipsește sau ce ai vrea să vezi.</p>
              </div>
              <button
                type="button"
                className="workspace-modal-close feedback-modal-close"
                onClick={() => setIsOpen(false)}
              >
                Închide
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
                  placeholder="Descrie pe scurt problema, cerința sau ideea ta."
                  maxLength={MAX_FEEDBACK_MESSAGE_LENGTH}
                />
                <div className="feedback-message-meta">
                  <span className={`feedback-message-hint ${isValid ? "is-valid" : "is-pending"}`}>
                    {isValid
                      ? "Poți trimite feedback-ul."
                      : `Scrie cel puțin ${MIN_FEEDBACK_MESSAGE_LENGTH} caractere.`}
                  </span>
                  <span className="feedback-message-count">
                    {trimmedMessageLength}/{MIN_FEEDBACK_MESSAGE_LENGTH} minim
                  </span>
                </div>
              </label>

              <div className="onboarding-form-field feedback-screenshot-field">
                <span>Captură de ecran <em>opțional</em></span>
                {screenshot ? (
                  <div className="feedback-screenshot-preview">
                    <img src={screenshotPreviewUrl} alt="Previzualizarea capturii atașate" />
                    <div>
                      <strong>{screenshot.name || "Captură lipită"}</strong>
                      <span>{`${Math.ceil(screenshot.size / 1024)} KB`}</span>
                    </div>
                    <button type="button" className="feedback-screenshot-remove" onClick={() => updateScreenshot(null)}>
                      <X aria-hidden="true" size={16} />
                      Elimină
                    </button>
                  </div>
                ) : (
                  <div className="feedback-screenshot-empty">
                    <input
                      ref={screenshotInputRef}
                      type="file"
                      accept="image/png,image/jpeg,image/webp"
                      aria-label="Alege captura de ecran"
                      onChange={(event) => updateScreenshot(event.target.files?.[0] || null)}
                      hidden
                    />
                    <div className="feedback-screenshot-actions">
                      {canCapturePage ? (
                        <button
                          type="button"
                          className="btn-link secondary feedback-screenshot-add"
                          onClick={captureCurrentPage}
                          disabled={isCapturing || isSubmitting}
                        >
                          <LoadingIconText icon={MonitorUp} loading={isCapturing} loadingLabel="Pregătim captura...">
                            Capturează pagina
                          </LoadingIconText>
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn-link secondary feedback-screenshot-add"
                        onClick={() => screenshotInputRef.current?.click()}
                        onPaste={handleScreenshotPaste}
                        disabled={isCapturing || isSubmitting}
                      >
                        <ImagePlus aria-hidden="true" size={17} />
                        Adaugă o captură
                      </button>
                    </div>
                    <span>
                      Pentru captură, alege tabul aplicației în fereastra browserului. Poți și încărca sau lipi o imagine PNG, JPG ori WEBP, de maximum {FEEDBACK_SCREENSHOT_MAX_LABEL}.
                    </span>
                  </div>
                )}
              </div>

              <label className="onboarding-form-field">
                <span>Link sau detaliu opțional</span>
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
