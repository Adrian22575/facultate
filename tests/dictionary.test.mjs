import assert from "node:assert/strict";
import test from "node:test";

import { dictionarySlug, normalizeDictionaryText, scoreDictionaryTerm } from "../lib/dictionary/shared.js";

const term = {
  term: "Repetare spațiată",
  slug: "repetare-spatiata",
  shortDefinition: "O metodă de recapitulare la intervale, care te ajută să revii la informație înainte să o uiți complet.",
  simpleExplanation: "În loc să citești aceeași pagină de multe ori într-o seară, revii la ea după una sau mai multe zile și verifici ce poți explica din memorie.",
  analogy: "Este ca udarea unei plante în mai multe zile, nu cu toată apa într-o singură seară.",
  example: "După un capitol, verifici trei întrebări miercuri, apoi duminică și încă o dată săptămâna următoare.",
  whyItMatters: "Te ajută să păstrezi materia disponibilă pentru examen și să identifici mai repede întrebările nesigure.",
  howToApply: ["Învață o porție mică de materie.", "Revino peste una sau două zile.", "Mărește intervalul când răspunzi sigur."],
  category: "Învățare și memorie",
  synonyms: ["spaced repetition"],
  relatedTermCandidates: ["active recall"],
  frequentlyAskedQuestions: [
    { question: "La ce interval repet materia?", answer: "Începe cu una sau două zile și ajustează intervalul după cât de sigur răspunzi la întrebări." },
    { question: "Funcționează și pentru grile?", answer: "Da, păstrează întrebările greșite și revino la ele mai des decât la cele deja stăpânite." },
    { question: "Pot folosi metoda fără aplicație?", answer: "Da, un calendar și o listă de întrebări sunt suficiente dacă notezi următoarea recapitulare." }
  ],
  seoTitle: "Ce înseamnă repetare spațiată? | Nota 5+",
  metaDescription: "Află ce înseamnă repetarea spațiată și cum te ajută să recapitulezi mai clar înainte de examen.",
  searchIntent: "Explicație simplă despre repetarea spațiată.",
  ctaType: "review",
  sourcesNeeded: false,
  qualityNotes: "Conținut editorial verificat pentru claritate."
};

test("normalizarea păstrează căutarea indiferent de diacritice", () => {
  assert.equal(normalizeDictionaryText("Învățare  activă!"), "invatare activa");
  assert.equal(dictionarySlug("Repetare spațiată"), "repetare-spatiata");
});

test("un termen complet trece controlul de calitate", () => {
  const result = scoreDictionaryTerm(term);
  assert.equal(result.valid, true);
  assert.equal(result.score, 100);
});

test("întrebările frecvente duplicate sunt respinse", () => {
  const invalid = { ...term, frequentlyAskedQuestions: [term.frequentlyAskedQuestions[0], term.frequentlyAskedQuestions[0], term.frequentlyAskedQuestions[2]] };
  const result = scoreDictionaryTerm(invalid);
  assert.equal(result.valid, false);
  assert.ok(result.reasons.some((reason) => reason.includes("distincte")));
});
