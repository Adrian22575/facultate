import assert from "node:assert/strict";
import test from "node:test";

import { linkedinArticleFixtures } from "./fixtures/linkedin-articles.mjs";
import { linkedinSettingsSchema } from "../lib/linkedin/requests.js";
import { estimateOpenAIRequestCost } from "../lib/openai/pricing.js";
import { findBannedLinkedInLanguage, LINKEDIN_PROMPT_VERSION } from "../lib/linkedin/prompts/banned-phrases.js";
import { buildArticleAnalysisPrompt, buildCritiquePrompt, buildLinkedInSystemPrompt, buildPostGenerationPrompt } from "../lib/linkedin/prompts/builders.js";
import { linkedinCritiqueSchema, linkedinGeneratedDraftSchema, linkedinStrategySchema } from "../lib/linkedin/prompts/schemas.js";
import { buildArticleEvidence, buildLinkedInFirstComment, buildLinkedInFullPost } from "../lib/linkedin/shared.js";
import { normalizeLinkedInGenerationOptions, LINKEDIN_POST_AUDIENCES, LINKEDIN_POST_CTAS, LINKEDIN_POST_LENGTHS, LINKEDIN_POST_LINK_PLACEMENTS, LINKEDIN_POST_NARRATIVES, LINKEDIN_POST_OBJECTIVES, LINKEDIN_POST_TEMPLATES, LINKEDIN_POST_VOICES } from "../lib/linkedin/templates.js";

test("catalogul generatorului acopera toate dimensiunile cerute", () => {
  assert.deepEqual([LINKEDIN_POST_OBJECTIVES.length, LINKEDIN_POST_TEMPLATES.length, LINKEDIN_POST_VOICES.length, LINKEDIN_POST_AUDIENCES.length, LINKEDIN_POST_CTAS.length, LINKEDIN_POST_NARRATIVES.length, LINKEDIN_POST_LENGTHS.length, LINKEDIN_POST_LINK_PLACEMENTS.length], [10, 11, 10, 10, 8, 6, 4, 4]);
  const normalized = normalizeLinkedInGenerationOptions({ audienceKey: "custom", customAudience: "  directori de licee  ", linkPlacementKey: "first_comment" });
  assert.equal(normalized.customAudience, "directori de licee");
  assert.equal(normalized.linkPlacementKey, "first_comment");
});

test("setarile cer descrierea atunci cand audienta implicita este personalizata", () => {
  const base = { mode: "approval_required", notifyTelegram: true, model: "gpt-5.6-terra", defaultTemplate: "lesson", defaultObjective: "authority", defaultVoice: "professional_human", defaultAudience: "custom", defaultCta: "auto", defaultNarrative: "neutral_editorial", defaultLength: "auto", defaultLinkPlacement: "end" };
  assert.equal(linkedinSettingsSchema.safeParse(base).success, false);
  assert.equal(linkedinSettingsSchema.safeParse({ ...base, defaultCustomAudience: "directori de licee private" }).success, true);
});

test("costul Terra este calculat cu preturile curente", () => {
  const cost = estimateOpenAIRequestCost({ model: "gpt-5.6-terra", usage: { input_tokens: 1_000_000, output_tokens: 1_000_000 } });
  assert.equal(cost.pricingStatus, "estimated");
  assert.equal(cost.estimatedCostUsd, 17.5);
});

test("prompturile sunt modulare, versionate si separa analiza de redactare si critica", () => {
  const options = normalizeLinkedInGenerationOptions({ objectiveKey: "education", templateKey: "framework", voiceKey: "analytical" });
  const system = buildLinkedInSystemPrompt();
  const analysis = buildArticleAnalysisPrompt(options);
  const draft = buildPostGenerationPrompt(options, "https://nota5plus.ro/articole/test");
  const critique = buildCritiquePrompt(options);
  assert.match(system, new RegExp(LINKEDIN_PROMPT_VERSION));
  assert.match(analysis, /exact trei unghiuri/i);
  assert.match(analysis, /exact cinci hook-uri/i);
  assert.match(draft, /claims conține fragmente factuale copiate exact/i);
  assert.match(critique, /qualityScore este media editorială/i);
});

test("limbajul artificial si structurile mecanice sunt detectate", () => {
  assert.ok(findBannedLinkedInLanguage("În lumea dinamică de astăzi, viitorul este deja aici.").length >= 2);
  assert.ok(findBannedLinkedInLanguage("Nu este despre note. Este despre viitor.").length >= 1);
  assert.deepEqual(findBannedLinkedInLanguage("Calendarul comun reduce o ambiguitate concretă pentru studenți."), []);
});

test("linkul este compus canonic pentru toate cele patru poziționări", () => {
  const base = { hook: "Un hook suficient de specific pentru verificare.", body: "Un corp suficient de amplu pentru a păstra o idee și implicația ei practică fără artificii inutile.", cta: null, articleUrl: "https://nota5plus.ro/articole/test", hashtags: ["#Educatie"] };
  assert.match(buildLinkedInFullPost({ ...base, linkPlacement: "end", linkSentence: null }), /https:\/\/nota5plus\.ro\/articole\/test/);
  assert.match(buildLinkedInFullPost({ ...base, linkPlacement: "natural", linkSentence: `Contextul complet: ${base.articleUrl}` }), /Contextul complet/);
  assert.doesNotMatch(buildLinkedInFullPost({ ...base, linkPlacement: "first_comment", linkSentence: `Context: ${base.articleUrl}` }), /https:\/\//);
  assert.match(buildLinkedInFirstComment({ linkPlacement: "first_comment", linkSentence: `Context: ${base.articleUrl}` }), /https:\/\//);
  assert.doesNotMatch(buildLinkedInFullPost({ ...base, linkPlacement: "none", linkSentence: null }), /https:\/\//);
});

test("fixture-urile acopera zece profiluri si furnizeaza dovezi auditabile", () => {
  assert.equal(linkedinArticleFixtures.length, 10);
  assert.equal(new Set(linkedinArticleFixtures.map((item) => item.kind)).size, 10);
  for (const article of linkedinArticleFixtures) {
    assert.ok(buildArticleEvidence(article).length >= 80, article.kind);
    assert.match(article.id, /^[0-9a-f-]{36}$/i);
  }
});

test("schemele structured output refuza iesiri incomplete", () => {
  assert.equal(linkedinStrategySchema.safeParse({}).success, false);
  assert.equal(linkedinGeneratedDraftSchema.safeParse({ hook: "Doar un hook incomplet" }).success, false);
  assert.equal(linkedinCritiqueSchema.safeParse({ qualityScore: 9 }).success, false);
});
