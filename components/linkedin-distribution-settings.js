"use client";

import { Cpu, Save, Settings2, ShieldCheck, Unplug } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { LinkedInGenerationOptions } from "@/components/linkedin-generation-options";
import { LoadingSpinner } from "@/components/loading-spinner";
import { LINKEDIN_MODEL_OPTIONS, normalizeLinkedInModel } from "@/lib/linkedin/models";
import {
  DEFAULT_LINKEDIN_POST_AUDIENCE,
  DEFAULT_LINKEDIN_POST_CTA,
  DEFAULT_LINKEDIN_POST_LENGTH,
  DEFAULT_LINKEDIN_POST_LINK_PLACEMENT,
  DEFAULT_LINKEDIN_POST_NARRATIVE,
  DEFAULT_LINKEDIN_POST_OBJECTIVE,
  DEFAULT_LINKEDIN_POST_TEMPLATE,
  DEFAULT_LINKEDIN_POST_VOICE
} from "@/lib/linkedin/templates";

const MODE_OPTIONS = [
  ["approval_required", "Necesită aprobare"],
  ["draft_only", "Doar ciornă"],
  ["auto_publish", "Publică automat"],
  ["disabled", "Dezactivat"]
];

export function getLinkedInOptionsFromSettings(settings = {}) {
  return {
    templateKey: settings.default_template || DEFAULT_LINKEDIN_POST_TEMPLATE,
    objectiveKey: settings.default_objective || DEFAULT_LINKEDIN_POST_OBJECTIVE,
    voiceKey: settings.default_voice || DEFAULT_LINKEDIN_POST_VOICE,
    audienceKey: settings.default_audience || DEFAULT_LINKEDIN_POST_AUDIENCE,
    customAudience: settings.default_custom_audience || "",
    ctaKey: settings.default_cta || DEFAULT_LINKEDIN_POST_CTA,
    narrativeKey: settings.default_narrative || DEFAULT_LINKEDIN_POST_NARRATIVE,
    lengthKey: settings.default_length || DEFAULT_LINKEDIN_POST_LENGTH,
    linkPlacementKey: settings.default_link_placement || DEFAULT_LINKEDIN_POST_LINK_PLACEMENT
  };
}

function settingsFromOptions(settings, options) {
  return {
    ...settings,
    default_template: options.templateKey,
    default_objective: options.objectiveKey,
    default_voice: options.voiceKey,
    default_audience: options.audienceKey,
    default_custom_audience: options.audienceKey === "custom" ? options.customAudience : null,
    default_cta: options.ctaKey,
    default_narrative: options.narrativeKey,
    default_length: options.lengthKey,
    default_link_placement: options.linkPlacementKey
  };
}

export function LinkedInDistributionSettings({
  data,
  disabled = false,
  defaultOpen = false,
  onSettingsSaved,
  onConnectionChanged
}) {
  const router = useRouter();
  const [settings, setSettings] = useState(data?.settings || {});
  const [connection, setConnection] = useState(data?.connection || null);
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [messageTone, setMessageTone] = useState("success");

  useEffect(() => setSettings(data?.settings || {}), [data?.settings]);
  useEffect(() => setConnection(data?.connection || null), [data?.connection]);

  const connected = connection?.status === "connected";
  const defaults = getLinkedInOptionsFromSettings(settings);
  const isBusy = Boolean(busy) || disabled;

  function showMessage(text, tone = "success") {
    setMessage(text);
    setMessageTone(tone);
  }

  async function saveSettings() {
    if (isBusy) return;
    setBusy("settings");
    setMessage("");
    const configuredDefaults = getLinkedInOptionsFromSettings(settings);
    const response = await fetch("/api/admin/linkedin/settings", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        mode: settings.mode,
        notifyTelegram: settings.notify_telegram,
        model: normalizeLinkedInModel(settings.model),
        defaultTemplate: configuredDefaults.templateKey,
        defaultObjective: configuredDefaults.objectiveKey,
        defaultVoice: configuredDefaults.voiceKey,
        defaultAudience: configuredDefaults.audienceKey,
        defaultCustomAudience:
          configuredDefaults.audienceKey === "custom" ? configuredDefaults.customAudience : null,
        defaultCta: configuredDefaults.ctaKey,
        defaultNarrative: configuredDefaults.narrativeKey,
        defaultLength: configuredDefaults.lengthKey,
        defaultLinkPlacement: configuredDefaults.linkPlacementKey
      })
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    if (!response?.ok) return showMessage("Setările nu au putut fi salvate.", "error");
    setSettings(result.settings);
    onSettingsSaved?.(result.settings);
    showMessage("Setările LinkedIn au fost salvate.");
  }

  async function disconnect() {
    if (
      !connection ||
      isBusy ||
      !window.confirm("Deconectezi profilul LinkedIn? Orice publicare viitoare se oprește imediat.")
    ) {
      return;
    }
    setBusy("disconnect");
    setMessage("");
    const response = await fetch(`/api/admin/linkedin/connections/${connection.id}/disconnect`, {
      method: "POST"
    }).catch(() => null);
    const result = await response?.json().catch(() => ({}));
    setBusy("");
    if (!response?.ok) return showMessage("Profilul nu a putut fi deconectat.", "error");
    setConnection(result.connection);
    onConnectionChanged?.(result.connection);
    showMessage("Profilul a fost deconectat. Publicarea este oprită.");
    router.refresh();
  }

  return (
    <details className="admin-linkedin-settings" open={defaultOpen || undefined}>
      <summary>
        <Settings2 size={16} aria-hidden="true" />
        Setări LinkedIn și automatizare
      </summary>
      <div className="admin-linkedin-controls">
        <label>
          <span>Mod de lucru</span>
          <select
            value={settings.mode}
            disabled={isBusy}
            onChange={(event) => setSettings((current) => ({ ...current, mode: event.target.value }))}
          >
            {MODE_OPTIONS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        <label className="admin-linkedin-model">
          <span><Cpu size={14} aria-hidden="true" />Model postare</span>
          <select
            value={normalizeLinkedInModel(settings.model)}
            disabled={isBusy}
            onChange={(event) => setSettings((current) => ({ ...current, model: event.target.value }))}
          >
            {LINKEDIN_MODEL_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>{option.label} — {option.description}</option>
            ))}
          </select>
        </label>
        <button type="button" className="btn-back admin-linkedin-secondary" onClick={saveSettings} disabled={isBusy}>
          {busy === "settings" ? <LoadingSpinner size={16} /> : <Save size={16} />}
          Salvează setările
        </button>
        {connected ? (
          <button type="button" className="admin-linkedin-disconnect" onClick={disconnect} disabled={isBusy}>
            <Unplug size={16} />Deconectează
          </button>
        ) : (
          <a
            className={`admin-linkedin-connect${data?.config?.ready ? "" : " is-disabled"}`}
            href={data?.config?.ready ? "/api/admin/linkedin/oauth/start" : undefined}
          >
            Conectează LinkedIn
          </a>
        )}
      </div>
      <label className="admin-linkedin-telegram">
        <input
          type="checkbox"
          checked={Boolean(settings.notify_telegram)}
          disabled={isBusy}
          onChange={(event) => setSettings((current) => ({ ...current, notify_telegram: event.target.checked }))}
        />
        <span>Notificări Telegram</span>
      </label>
      <LinkedInGenerationOptions
        value={defaults}
        onChange={(next) => setSettings((current) => settingsFromOptions(current, next))}
        disabled={isBusy}
        compact
      />
      {!data?.config?.ready ? (
        <p className="admin-linkedin-config-note">
          <ShieldCheck size={16} aria-hidden="true" />
          Completează variabilele LinkedIn și cheia de criptare înainte de conectare.
        </p>
      ) : null}
      {message ? <p className={`admin-linkedin-message is-${messageTone}`} role="status" aria-live="polite">{message}</p> : null}
    </details>
  );
}
