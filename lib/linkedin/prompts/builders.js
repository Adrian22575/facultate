import {
  getLinkedInPostAudience,
  getLinkedInPostCta,
  getLinkedInPostLength,
  getLinkedInPostLinkPlacement,
  getLinkedInPostNarrative,
  getLinkedInPostObjective,
  getLinkedInPostTemplate,
  getLinkedInPostVoice
} from "../templates.js";
import { BANNED_LINKEDIN_PHRASES, LINKEDIN_PROMPT_VERSION } from "./banned-phrases.js";

function optionContext(options) {
  const audience = getLinkedInPostAudience(options.audienceKey);
  return {
    objective: getLinkedInPostObjective(options.objectiveKey),
    type: getLinkedInPostTemplate(options.templateKey),
    tone: getLinkedInPostVoice(options.voiceKey),
    audience: audience.key === "custom" && options.customAudience ? { ...audience, label: options.customAudience } : audience,
    cta: getLinkedInPostCta(options.ctaKey),
    narrative: getLinkedInPostNarrative(options.narrativeKey),
    length: getLinkedInPostLength(options.lengthKey),
    linkPlacement: getLinkedInPostLinkPlacement(options.linkPlacementKey)
  };
}

export function buildLinkedInSystemPrompt() {
  return [
    `Versiune editorială: ${LINKEDIN_PROMPT_VERSION}.`,
    "Lucrezi ca editor senior pentru postări LinkedIn în limba română.",
    "Scrii pentru oameni care scanează pe telefon și decid în primele două rânduri dacă merită să continue.",
    "Păstrezi o singură idee centrală, o progresie logică și o concluzie câștigată prin dovezi.",
    "Nu inventezi experiențe, opinii, clienți, proiecte, cifre, citate, rezultate sau predicții prezentate ca fapte.",
    "Nu descrii procesul tău și nu menționezi modelul, promptul sau etapele interne.",
    "Eviți clișeele, dramatizarea, jargonul corporatist, opozițiile mecanice și fragmentele scrise pentru efect.",
    `Expresii interzise: ${BANNED_LINKEDIN_PHRASES.join("; ")}.`
  ].join("\n");
}

export function buildArticleAnalysisPrompt(options) {
  const selected = optionContext(options);
  return [
    "ETAPA 1 — ANALIZĂ, UNGHI ȘI HOOK.",
    `Scop: ${selected.objective.label}. ${selected.objective.description}`,
    `Tip: ${selected.type.label}. ${selected.type.description}`,
    `Ton: ${selected.tone.label}. ${selected.tone.description}`,
    `Audiență: ${selected.audience.label}. ${selected.audience.description}`,
    `Perspectivă: ${selected.narrative.label}. ${selected.narrative.description}`,
    "Extrage mai întâi faptele, tensiunile, exemplele, datele și limitele articolului.",
    "Propune exact trei unghiuri structural diferite, apoi alege unul singur. Nu rezuma articolul.",
    "Generează exact cinci hook-uri structural diferite. Evaluează relevanța, claritatea, curiozitatea, credibilitatea, specificitatea, potrivirea cu audiența și riscul de clickbait.",
    "Selectează hook-ul care promite exact ceea ce postarea poate demonstra.",
    "Câmpul prohibitedInferences trebuie să enumere afirmațiile pe care articolul nu le permite."
  ].join("\n");
}

export function buildPostGenerationPrompt(options, articleUrl) {
  const selected = optionContext(options);
  return [
    "ETAPA 2 — SCRIEREA POSTĂRII.",
    `Scop: ${selected.objective.label}. Tip: ${selected.type.label}. Ton: ${selected.tone.label}.`,
    `Audiență: ${selected.audience.label}. Perspectivă: ${selected.narrative.label}.`,
    `Acțiune dorită: ${selected.cta.label}. ${selected.cta.description}`,
    `Lungime: ${selected.length.label}. ${selected.length.description}`,
    `Poziționarea linkului: ${selected.linkPlacement.label}. ${selected.linkPlacement.description}`,
    "Folosește hook-ul și unghiul selectate în etapa 1. Construiește: problemă → tensiune → descoperire → implicație → concluzie, sau o structură echivalentă potrivită tipului.",
    "Scrie paragrafe scurte, dar nu transforma fiecare propoziție într-un paragraf. Evită trei idei independente, emoji-urile decorative, listele mecanice și întrebările retorice.",
    "CTA-ul poate fi null când ideea se încheie mai bine fără cerere. Nu cere like, distribuire sau opinii generice.",
    "Hashtagurile sunt 0–4, specifice, și vor fi adăugate de server la final. Nu le introduce în body.",
    selected.linkPlacement.key === "natural" ? `linkSentence trebuie să includă natural URL-ul exact ${articleUrl}.` : null,
    selected.linkPlacement.key === "end" ? "linkSentence trebuie să fie null; serverul adaugă URL-ul la final." : null,
    selected.linkPlacement.key === "first_comment" ? `linkSentence trebuie să fie o frază naturală pentru primul comentariu și să includă URL-ul exact ${articleUrl}.` : null,
    selected.linkPlacement.key === "none" ? "linkSentence trebuie să fie null și postarea trebuie să funcționeze fără link." : null,
    "claims conține fragmente factuale copiate exact din articol, fără parafrazare."
  ].filter(Boolean).join("\n");
}

export function buildCritiquePrompt(options) {
  const selected = optionContext(options);
  return [
    "ETAPA 3 — CRITICĂ ȘI RESCRIERE CONTROLATĂ.",
    `Evaluează potrivirea cu scopul «${selected.objective.label}», tipul «${selected.type.label}» și audiența «${selected.audience.label}».`,
    "Acordă scoruri 1–10 pentru fiecare criteriu din schemă. qualityScore este media editorială argumentată.",
    "Verifică limbajul artificial, generalitățile, repetiția, promisiunea hook-ului, factualitatea, CTA-ul, tonul corporatist, clișeele și existența unei singure idei centrale.",
    "Dacă qualityScore este sub 8 sau există o problemă de factualitate, rescrie. Dacă varianta este deja bună, păstrează conținutul și corectează numai detaliile necesare.",
    "revisedDraft este întotdeauna varianta finală completă. Nu adăuga informații care nu apar în dovezi."
  ].join("\n");
}

export function buildRefinementPrompt(kind) {
  const instructions = {
    alternate_angle: "Alege un alt unghi credibil din articol și rescrie postarea în jurul lui.",
    alternate_hook: "Generează un hook structural diferit, specific și credibil. Păstrează restul postării neschimbat.",
    shorter: "Scurtează postarea cu aproximativ 25%, păstrând ideea și dovezile.",
    more_direct: "Elimină introducerile și formulează ideea mai direct, fără agresivitate.",
    more_personal: "Apropie vocea de cititor fără a inventa experiențe la persoana întâi.",
    less_promotional: "Elimină presiunea comercială și pune problema cititorului înaintea produsului.",
    more_provocative: "Crește tensiunea intelectuală printr-o afirmație susținută, fără conflict sau clickbait inventat."
  };
  return `REFINARE EDITORIALĂ — ${instructions[kind] || instructions.more_direct}`;
}

export function getLinkedInPromptPreview(options) {
  return {
    promptVersion: LINKEDIN_PROMPT_VERSION,
    system: buildLinkedInSystemPrompt(),
    analysis: buildArticleAnalysisPrompt(options),
    draft: buildPostGenerationPrompt(options, "[URL_ARTICOL]"),
    critique: buildCritiquePrompt(options)
  };
}
