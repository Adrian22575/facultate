import OpenAI from "openai";
import { zodTextFormat } from "openai/helpers/zod";

import { estimateOpenAIRequestCost } from "../lib/openai/pricing.js";
import { linkedinArticleFixtures } from "../tests/fixtures/linkedin-articles.mjs";
import { buildArticleEvidence, validateLinkedInDraft } from "../lib/linkedin/shared.js";
import { LINKEDIN_PROMPT_VERSION } from "../lib/linkedin/prompts/banned-phrases.js";
import { buildArticleAnalysisPrompt, buildCritiquePrompt, buildLinkedInSystemPrompt, buildPostGenerationPrompt } from "../lib/linkedin/prompts/builders.js";
import { linkedinCritiqueSchema, linkedinDraftRefinementSchema, linkedinGeneratedDraftSchema, linkedinStrategySchema } from "../lib/linkedin/prompts/schemas.js";
import { normalizeLinkedInGenerationOptions } from "../lib/linkedin/templates.js";

const limitArg = process.argv.find((value) => value.startsWith("--limit="));
const limit = Math.min(10, Math.max(1, Number(limitArg?.split("=")[1] || 5)));
const modelArg = process.argv.find((value) => value.startsWith("--model="));
const model = modelArg?.split("=")[1] || "gpt-5.6-terra";
const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY_missing");

const configurations = [
  { objectiveKey: "authority", templateKey: "analysis", voiceKey: "analytical", audienceKey: "educators", ctaKey: "comment", narrativeKey: "expert", lengthKey: "medium", linkPlacementKey: "end" },
  { objectiveKey: "education", templateKey: "framework", voiceKey: "educational_simple", audienceKey: "professionals", ctaKey: "save", narrativeKey: "educator", lengthKey: "medium", linkPlacementKey: "natural" },
  { objectiveKey: "traffic", templateKey: "lesson", voiceKey: "professional_human", audienceKey: "general", ctaKey: "click", narrativeKey: "neutral_editorial", lengthKey: "short", linkPlacementKey: "end" },
  { objectiveKey: "leads", templateKey: "case_study", voiceKey: "direct_lucid", audienceKey: "managers", ctaKey: "message", narrativeKey: "company", lengthKey: "long", linkPlacementKey: "first_comment" },
  { objectiveKey: "promotion", templateKey: "short_post", voiceKey: "constructive_critical", audienceKey: "entrepreneurs", ctaKey: "test_product", narrativeKey: "company", lengthKey: "short", linkPlacementKey: "none" }
];

function exactClaims(article) {
  const seen = new Set();
  return buildArticleEvidence(article).split(/\n+/).map((value) => value.trim()).filter((value) => value.length >= 12 && value.length <= 500).filter((value) => {
    const key = value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 8);
}

function candidateFrom(draft, fallbackDraft, article, articleUrl, options, qualityScore, warnings) {
  const linkSentence = ["natural", "first_comment"].includes(options.linkPlacementKey)
    ? [draft.linkSentence, fallbackDraft?.linkSentence].map((value) => String(value || "").trim()).find((value) => value.includes(articleUrl)) || `Articolul complet este aici: ${articleUrl}`
    : null;
  return { ...draft, linkSentence, articleUrl, linkPlacement: options.linkPlacementKey, objective: options.objectiveKey, qualityScore, warnings: [...new Set(warnings)].slice(0, 20), promptVersion: LINKEDIN_PROMPT_VERSION, claims: exactClaims(article), sourceArticleId: article.id };
}

async function parse(schema, name, developer, user, effort = "medium") {
  const response = await client.responses.parse({
    model,
    reasoning: { effort },
    max_output_tokens: 7000,
    input: [
      { role: "developer", content: `${buildLinkedInSystemPrompt()}\n\n${developer}` },
      { role: "user", content: JSON.stringify(user) }
    ],
    text: { format: zodTextFormat(schema, name) }
  });
  if (!response.output_parsed) throw new Error(`${name}_missing_output`);
  return { parsed: response.output_parsed, usage: response.usage || {} };
}

function mergeUsage(items) {
  return items.reduce((sum, item) => ({
    input_tokens: sum.input_tokens + Number(item.input_tokens || 0),
    output_tokens: sum.output_tokens + Number(item.output_tokens || 0),
    total_tokens: sum.total_tokens + Number(item.total_tokens || 0),
    input_tokens_details: { cached_tokens: sum.input_tokens_details.cached_tokens + Number(item.input_tokens_details?.cached_tokens || 0) }
  }), { input_tokens: 0, output_tokens: 0, total_tokens: 0, input_tokens_details: { cached_tokens: 0 } });
}

async function evaluate(article, index) {
  const options = normalizeLinkedInGenerationOptions(configurations[index % configurations.length]);
  const articleUrl = `https://nota5plus.ro/articole/${article.slug}`;
  const source = { sourceArticleId: article.id, articleUrl, article };
  const strategyResult = await parse(linkedinStrategySchema, "linkedin_strategy_eval", buildArticleAnalysisPrompt(options), { options, source });
  const draftResult = await parse(linkedinGeneratedDraftSchema, "linkedin_draft_eval", buildPostGenerationPrompt(options, articleUrl), { options, strategy: strategyResult.parsed, source });
  const critiqueResult = await parse(linkedinCritiqueSchema, "linkedin_critique_eval", buildCritiquePrompt(options), { options, strategy: strategyResult.parsed, draft: draftResult.parsed, articleEvidence: buildArticleEvidence(article) });
  const critique = critiqueResult.parsed;
  let candidate = candidateFrom(critique.revisedDraft, draftResult.parsed, article, articleUrl, options, critique.qualityScore, [...(draftResult.parsed.warnings || []), ...(critique.warnings || []), ...(critique.issues || [])]);
  let assessment = validateLinkedInDraft(candidate, { article, articleUrl, objective: options.objectiveKey });
  const usages = [strategyResult.usage, draftResult.usage, critiqueResult.usage];
  if (!assessment.valid) {
    const repairResult = await parse(linkedinDraftRefinementSchema, "linkedin_validation_repair_eval", `REPARAȚIE FINALĂ. Corectează strict: ${assessment.reasons.join(", ")}. Elimină formulele artificiale, păstrează dovezile și URL-ul cerut și returnează ciorna completă.`, { options, strategy: strategyResult.parsed, current: candidate, articleEvidence: buildArticleEvidence(article) }, "low");
    usages.push(repairResult.usage);
    candidate = candidateFrom(repairResult.parsed.draft, candidate, article, articleUrl, options, critique.qualityScore, [...candidate.warnings, `Reparație locală: ${assessment.reasons.join(", ")}`]);
    assessment = validateLinkedInDraft(candidate, { article, articleUrl, objective: options.objectiveKey });
  }
  const usage = mergeUsage(usages);
  const cost = estimateOpenAIRequestCost({ model, usage, operation: "linkedin_generator_eval" });
  return { article, options, strategy: strategyResult.parsed, critique, assessment, usage, cost };
}

const settled = await Promise.allSettled(linkedinArticleFixtures.slice(0, limit).map(evaluate));
const results = settled.map((item, index) => item.status === "fulfilled" ? item.value : ({ article: linkedinArticleFixtures[index], error: item.reason?.message || String(item.reason) }));

for (const [index, result] of results.entries()) {
  if (result.error) {
    console.log(`\n[${index + 1}] ${result.article.kind} — EȘUAT: ${result.error}`);
    continue;
  }
  console.log(`\n[${index + 1}] ${result.article.kind} — ${result.assessment.valid ? "VALID" : "INVALID"} — scor ${result.critique.qualityScore.toFixed(1)} — ${result.assessment.draft?.characterCount || 0} caractere`);
  console.log(`Unghi: ${result.strategy.selectedAngle.centralIdea}`);
  console.log(`Hook: ${result.assessment.draft?.hook || result.critique.revisedDraft.hook}`);
  console.log(`Motive: ${result.assessment.reasons.join(", ") || "niciunul"}`);
  console.log(`Cost estimat: ${result.cost.estimatedCostUsd == null ? "indisponibil" : `$${result.cost.estimatedCostUsd.toFixed(4)}`} (${result.usage.total_tokens} tokenuri)`);
}

const valid = results.filter((item) => item.assessment?.valid).length;
const totalCost = results.reduce((sum, item) => sum + Number(item.cost?.estimatedCostUsd || 0), 0);
console.log(`\nREZUMAT ${valid}/${limit} valide | model ${model} | cost total estimat $${totalCost.toFixed(4)} | medie $${(totalCost / limit).toFixed(4)}`);
if (valid !== limit) process.exitCode = 1;
