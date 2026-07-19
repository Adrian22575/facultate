"use client";

import {
  LINKEDIN_POST_AUDIENCES,
  LINKEDIN_POST_CTAS,
  LINKEDIN_POST_LENGTHS,
  LINKEDIN_POST_LINK_PLACEMENTS,
  LINKEDIN_POST_NARRATIVES,
  LINKEDIN_POST_OBJECTIVES,
  LINKEDIN_POST_TEMPLATES,
  LINKEDIN_POST_VOICES
} from "@/lib/linkedin/templates";

function OptionField({ label, options, value, onChange, disabled }) {
  const selected = options.find((option) => option.key === value) || options[0];
  return (
    <label className="linkedin-option-field">
      <span>{label}</span>
      <select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => <option key={option.key} value={option.key}>{option.label}</option>)}
      </select>
      <small>{selected?.description}</small>
    </label>
  );
}

export function LinkedInGenerationOptions({ value, onChange, disabled = false, compact = false }) {
  const set = (key) => (next) => onChange({ ...value, [key]: next });
  return (
    <div className={`linkedin-generation-options${compact ? " is-compact" : ""}`}>
      <div className="linkedin-generation-options-primary">
        <OptionField label="Scop" options={LINKEDIN_POST_OBJECTIVES} value={value.objectiveKey} onChange={set("objectiveKey")} disabled={disabled} />
        <OptionField label="Tipul postării" options={LINKEDIN_POST_TEMPLATES} value={value.templateKey} onChange={set("templateKey")} disabled={disabled} />
        <OptionField label="Ton" options={LINKEDIN_POST_VOICES} value={value.voiceKey} onChange={set("voiceKey")} disabled={disabled} />
        <OptionField label="Audiență" options={LINKEDIN_POST_AUDIENCES} value={value.audienceKey} onChange={set("audienceKey")} disabled={disabled} />
        {value.audienceKey === "custom" ? <label className="linkedin-option-field is-custom"><span>Audiența exactă</span><input value={value.customAudience || ""} maxLength={180} disabled={disabled} onChange={(event) => set("customAudience")(event.target.value)} placeholder="Ex.: directori de școli private din România" /><small>Descrie rolul, industria sau comunitatea vizată.</small></label> : null}
      </div>
      <details className="linkedin-generation-advanced">
        <summary>Opțiuni avansate <span>CTA, perspectivă, lungime și link</span></summary>
        <div>
          <OptionField label="Acțiunea dorită" options={LINKEDIN_POST_CTAS} value={value.ctaKey} onChange={set("ctaKey")} disabled={disabled} />
          <OptionField label="Persoana narativă" options={LINKEDIN_POST_NARRATIVES} value={value.narrativeKey} onChange={set("narrativeKey")} disabled={disabled} />
          <OptionField label="Lungime" options={LINKEDIN_POST_LENGTHS} value={value.lengthKey} onChange={set("lengthKey")} disabled={disabled} />
          <OptionField label="Poziționarea linkului" options={LINKEDIN_POST_LINK_PLACEMENTS} value={value.linkPlacementKey} onChange={set("linkPlacementKey")} disabled={disabled} />
        </div>
      </details>
    </div>
  );
}
