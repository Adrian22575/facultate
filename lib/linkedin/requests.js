import { z } from "zod";

import { LINKEDIN_MODELS } from "./models.js";
import { LINKEDIN_MODES } from "./shared.js";
import {
  LINKEDIN_POST_AUDIENCE_KEYS,
  LINKEDIN_POST_CTA_KEYS,
  LINKEDIN_POST_LENGTH_KEYS,
  LINKEDIN_POST_LINK_PLACEMENT_KEYS,
  LINKEDIN_POST_NARRATIVE_KEYS,
  LINKEDIN_POST_OBJECTIVE_KEYS,
  LINKEDIN_POST_TEMPLATE_KEYS,
  LINKEDIN_POST_VOICE_KEYS
} from "./templates.js";

export const linkedinGenerationOptionsShape = {
  templateKey: z.enum(LINKEDIN_POST_TEMPLATE_KEYS).optional(),
  objectiveKey: z.enum(LINKEDIN_POST_OBJECTIVE_KEYS).optional(),
  voiceKey: z.enum(LINKEDIN_POST_VOICE_KEYS).optional(),
  audienceKey: z.enum(LINKEDIN_POST_AUDIENCE_KEYS).optional(),
  customAudience: z.string().trim().min(2).max(180).optional(),
  ctaKey: z.enum(LINKEDIN_POST_CTA_KEYS).optional(),
  narrativeKey: z.enum(LINKEDIN_POST_NARRATIVE_KEYS).optional(),
  lengthKey: z.enum(LINKEDIN_POST_LENGTH_KEYS).optional(),
  linkPlacementKey: z.enum(LINKEDIN_POST_LINK_PLACEMENT_KEYS).optional()
};

export const linkedinGenerationOptionsSchema = z.object(linkedinGenerationOptionsShape).superRefine((value, context) => {
  if (value.audienceKey === "custom" && !value.customAudience) context.addIssue({ code: z.ZodIssueCode.custom, path: ["customAudience"], message: "custom_audience_required" });
});

export const linkedinSettingsSchema = z.object({
  mode: z.enum(LINKEDIN_MODES),
  notifyTelegram: z.boolean(),
  model: z.enum(LINKEDIN_MODELS),
  defaultTemplate: z.enum(LINKEDIN_POST_TEMPLATE_KEYS),
  defaultObjective: z.enum(LINKEDIN_POST_OBJECTIVE_KEYS),
  defaultVoice: z.enum(LINKEDIN_POST_VOICE_KEYS),
  defaultAudience: z.enum(LINKEDIN_POST_AUDIENCE_KEYS),
  defaultCustomAudience: z.string().trim().min(2).max(180).nullable().optional(),
  defaultCta: z.enum(LINKEDIN_POST_CTA_KEYS),
  defaultNarrative: z.enum(LINKEDIN_POST_NARRATIVE_KEYS),
  defaultLength: z.enum(LINKEDIN_POST_LENGTH_KEYS),
  defaultLinkPlacement: z.enum(LINKEDIN_POST_LINK_PLACEMENT_KEYS)
}).superRefine((value, context) => {
  if (value.defaultAudience === "custom" && !value.defaultCustomAudience) context.addIssue({ code: z.ZodIssueCode.custom, path: ["defaultCustomAudience"], message: "default_custom_audience_required" });
});

export const LINKEDIN_REFINEMENT_ACTIONS = ["alternate_angle", "alternate_hook", "shorter", "more_direct", "more_personal", "less_promotional", "more_provocative"];
