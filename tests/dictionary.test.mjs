import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { dictionarySlug, normalizeDictionaryText, scoreDictionaryTerm } from "../lib/dictionary/shared.js";
import { isAutomationDue } from "../lib/editorial/automation-schedule.js";

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

test("automatizarea acceptă fallback-ul după ora locală, dar rulează o singură dată pe interval", () => {
  const settings = { enabled: true, scheduled_hour: 10, frequency_days: 1, last_scheduled_for: null };
  assert.equal(isAutomationDue(settings, new Date("2026-07-19T06:30:00Z")), false);
  assert.equal(isAutomationDue(settings, new Date("2026-07-19T07:00:00Z")), true);
  assert.equal(isAutomationDue(settings, new Date("2026-07-19T08:00:00Z")), true);
  assert.equal(isAutomationDue({ ...settings, last_scheduled_for: "2026-07-19" }, new Date("2026-07-19T08:00:00Z")), false);
});

test("schedulerul și Admin folosesc livrare observabilă, căutare globală și data creării", async () => {
  const [migration, timeoutMigration, securityMigration, preflight, cronRoute, searchRoute, adminUi] = await Promise.all([
    readFile(new URL("../supabase/migrations/20260719093254_fix_dictionary_scheduler_delivery.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260719095200_increase_dictionary_scheduler_timeout.sql", import.meta.url), "utf8"),
    readFile(new URL("../supabase/migrations/20260719094037_restrict_editorial_scheduler_token.sql", import.meta.url), "utf8"),
    readFile(new URL("../scripts/vercel-preflight.mjs", import.meta.url), "utf8"),
    readFile(new URL("../app/api/cron/dictionary/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/admin/dictionary/terms/search/route.js", import.meta.url), "utf8"),
    readFile(new URL("../components/admin-dictionary-panel.js", import.meta.url), "utf8")
  ]);
  assert.match(migration, /net\.http_get/);
  assert.match(migration, /raise exception 'editorial_scheduler_token is not configured'/);
  assert.match(timeoutMigration, /timeout_milliseconds := 300000/);
  assert.match(securityMigration, /from anon/);
  assert.match(securityMigration, /from authenticated/);
  assert.match(securityMigration, /to service_role/);
  assert.match(preflight, /configure_editorial_scheduler_token/);
  assert.match(cronRoute, /dictionary_cron_completed/);
  assert.match(searchRoute, /searchDictionaryAdminTerms/);
  assert.match(adminUi, /Caută după termen/);
  assert.match(adminUi, /displayed\.created_at/);
  assert.match(adminUi, /Nicio rulare înregistrată astăzi/);
});
