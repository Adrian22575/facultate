import "server-only";

import { zodTextFormat } from "openai/helpers/zod";

import { runLoggedResponseParse } from "@/lib/openai/logging";
import { buildArticleEvidence, validateLinkedInDraft } from "@/lib/linkedin/shared";
import { LINKEDIN_PROMPT_VERSION } from "@/lib/linkedin/prompts/banned-phrases";
import {
  buildArticleAnalysisPrompt,
  buildCritiquePrompt,
  buildLinkedInSystemPrompt,
  buildPostGenerationPrompt,
  buildRefinementPrompt
} from "@/lib/linkedin/prompts/builders";
import {
  linkedinCritiqueSchema,
  linkedinDraftRefinementSchema,
  linkedinGeneratedDraftSchema,
  linkedinHookRefinementSchema,
  linkedinStrategySchema
} from "@/lib/linkedin/prompts/schemas";

const MAX_ARTICLE_CONTEXT = 60_000;

function articlePayload(article, articleUrl) {
  return {
    sourceArticleId: article.id,
    articleUrl,
    article: {
      title: article.title,
      subtitle: article.subtitle,
      summary: article.summary,
      keyTakeaways: article.key_takeaways,
      sections: article.sections,
      studentImplications: article.student_implications,
      conclusion: article.conclusion
    }
  };
}

function safeJson(value, limit = MAX_ARTICLE_CONTEXT) {
  return JSON.stringify(value).slice(0, limit);
}

function exactClaims(article) {
  const seen = new Set();
  return buildArticleEvidence(article)
    .split(/\n+/)
    .map((claim) => String(claim || "").trim())
    .filter((claim) => claim.length >= 12 && claim.length <= 500)
    .filter((claim) => {
      const key = claim.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
      if (!key || seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 8);
}

function canonicalLinkSentence(draft, fallbackDraft, options, articleUrl) {
  if (!["natural", "first_comment"].includes(options.linkPlacementKey)) return null;
  const candidates = [draft?.linkSentence, fallbackDraft?.linkSentence]
    .map((value) => String(value || "").trim())
    .filter(Boolean);
  return candidates.find((value) => value.includes(articleUrl))
    || `Articolul complet este aici: ${articleUrl}`;
}

function buildCandidate({ draft, fallbackDraft, article, articleUrl, options, qualityScore, warnings }) {
  const sourceClaims = exactClaims(article);
  return {
    ...draft,
    linkSentence: canonicalLinkSentence(draft, fallbackDraft, options, articleUrl),
    articleUrl,
    linkPlacement: options.linkPlacementKey,
    objective: options.objectiveKey,
    qualityScore,
    warnings: [...new Set(warnings || [])].slice(0, 20),
    promptVersion: LINKEDIN_PROMPT_VERSION,
    claims: sourceClaims.length >= 2 ? sourceClaims : draft.claims,
    sourceArticleId: article.id
  };
}

async function validateOrRepairCandidate({ candidate, article, articleUrl, model, options, metadata, strategy }) {
  let assessment = validateLinkedInDraft(candidate, { article, articleUrl, objective: options.objectiveKey });
  if (assessment.valid) return { assessment, repair: null };

  const repair = await parseStage({
    model,
    schema: linkedinDraftRefinementSchema,
    schemaName: "linkedin_validation_repair",
    requestScope: "linkedin_editorial_validation_repair",
    metadata: { ...metadata, stage: "validation_repair", validationReasons: assessment.reasons },
    developer: [
      "REPARAȚIE FINALĂ DUPĂ VALIDAREA LOCALĂ.",
      `Corectează strict aceste erori: ${assessment.reasons.join(", ")}.`,
      "Păstrează ideea, dovezile și opțiunile. Elimină toate formulele artificiale sau structurile mecanice semnalate.",
      "Nu elimina URL-ul cerut și nu adăuga informații noi. Returnează ciorna completă corectată."
    ].join("\n"),
    user: safeJson({ options, strategy, current: candidate, articleEvidence: buildArticleEvidence(article) }),
    effort: "low"
  });
  const repairedCandidate = buildCandidate({
    draft: repair.draft,
    fallbackDraft: candidate,
    article,
    articleUrl,
    options,
    qualityScore: candidate.qualityScore,
    warnings: [...candidate.warnings, `Reparație locală: ${assessment.reasons.join(", ")}`]
  });
  assessment = validateLinkedInDraft(repairedCandidate, { article, articleUrl, objective: options.objectiveKey });
  return { assessment, repair };
}

async function parseStage({ model, schema, schemaName, requestScope, metadata, developer, user, effort = "medium" }) {
  const response = await runLoggedResponseParse({
    requestScope,
    metadata,
    request: {
      model,
      reasoning: { effort },
      input: [
        { role: "developer", content: `${buildLinkedInSystemPrompt()}\n\n${developer}` },
        { role: "user", content: user }
      ],
      text: { format: zodTextFormat(schema, schemaName) }
    }
  });
  if (!response.output_parsed) throw new Error(`linkedin_${schemaName}_missing_structured_output`);
  return response.output_parsed;
}

export async function generateLinkedInDraftPipeline({ article, articleUrl, model, options }) {
  const metadata = { articleId: article.id, articleSlug: article.slug, channel: "linkedin", promptVersion: LINKEDIN_PROMPT_VERSION };
  const source = articlePayload(article, articleUrl);
  const strategy = await parseStage({
    model,
    schema: linkedinStrategySchema,
    schemaName: "linkedin_strategy",
    requestScope: "linkedin_editorial_strategy",
    metadata: { ...metadata, stage: "strategy" },
    developer: buildArticleAnalysisPrompt(options),
    user: safeJson({ options, source })
  });

  const draft = await parseStage({
    model,
    schema: linkedinGeneratedDraftSchema,
    schemaName: "linkedin_draft_v2",
    requestScope: "linkedin_editorial_draft",
    metadata: { ...metadata, stage: "draft" },
    developer: buildPostGenerationPrompt(options, articleUrl),
    user: safeJson({ options, strategy, source })
  });

  const critique = await parseStage({
    model,
    schema: linkedinCritiqueSchema,
    schemaName: "linkedin_critique",
    requestScope: "linkedin_editorial_critique",
    metadata: { ...metadata, stage: "critique" },
    developer: buildCritiquePrompt(options),
    user: safeJson({ options, strategy, draft, articleEvidence: buildArticleEvidence(article) })
  });

  const finalDraft = buildCandidate({
    draft: critique.revisedDraft,
    fallbackDraft: draft,
    article,
    articleUrl,
    options,
    qualityScore: critique.qualityScore,
    warnings: [...(draft.warnings || []), ...(critique.warnings || []), ...(critique.issues || [])]
  });
  const { assessment, repair } = await validateOrRepairCandidate({ candidate: finalDraft, article, articleUrl, model, options, metadata, strategy });
  if (!assessment.valid) throw new Error(`linkedin_draft_validation_failed:${assessment.reasons.join(",")}`);
  return {
    ...assessment.draft,
    generatedPayload: { promptVersion: LINKEDIN_PROMPT_VERSION, options, strategy, draft, critique, repair, final: assessment.draft }
  };
}

export async function refineLinkedInDraftPipeline({ article, articleUrl, model, options, payload, kind }) {
  const current = payload?.final || payload;
  const metadata = { articleId: article.id, articleSlug: article.slug, channel: "linkedin", promptVersion: LINKEDIN_PROMPT_VERSION, refinement: kind };
  let refined;
  let summary;

  if (kind === "alternate_hook") {
    const result = await parseStage({
      model,
      schema: linkedinHookRefinementSchema,
      schemaName: "linkedin_hook_refinement",
      requestScope: "linkedin_editorial_refinement",
      metadata,
      developer: buildRefinementPrompt(kind),
      user: safeJson({ options, current, strategy: payload?.strategy, articleEvidence: buildArticleEvidence(article) }),
      effort: "low"
    });
    refined = { ...current, hook: result.hook };
    summary = result.reason;
  } else {
    const result = await parseStage({
      model,
      schema: linkedinDraftRefinementSchema,
      schemaName: "linkedin_draft_refinement",
      requestScope: "linkedin_editorial_refinement",
      metadata,
      developer: buildRefinementPrompt(kind),
      user: safeJson({ options, current, strategy: payload?.strategy, articleEvidence: buildArticleEvidence(article) })
    });
    refined = result.draft;
    summary = result.summary;
  }

  const candidate = buildCandidate({
    draft: refined,
    fallbackDraft: current,
    article,
    articleUrl,
    options,
    qualityScore: current.qualityScore || 8,
    warnings: refined.warnings || current.warnings || []
  });
  const { assessment, repair } = await validateOrRepairCandidate({ candidate, article, articleUrl, model, options, metadata, strategy: payload?.strategy });
  if (!assessment.valid) throw new Error(`linkedin_refinement_validation_failed:${assessment.reasons.join(",")}`);
  const history = Array.isArray(payload?.refinementHistory) ? payload.refinementHistory : [];
  return {
    ...assessment.draft,
    generatedPayload: {
      ...payload,
      final: assessment.draft,
      refinementHistory: [...history, { kind, summary, repair: repair?.summary || null, previous: current, createdAt: new Date().toISOString() }].slice(-12)
    }
  };
}
