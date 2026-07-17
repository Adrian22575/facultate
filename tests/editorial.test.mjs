import assert from "node:assert/strict";
import test from "node:test";

import { getEditorialWeek, hashText, scoreEditorialQuality, validateResearch } from "../lib/editorial/shared.js";

const source = (id, overrides = {}) => ({ id, url: `https://example.org/${id}`, title: `Sursă oficială ${id}`, publisher: "Instituție", author: null, publishedAt: "2026-07-15", eventDate: "2026-07-14", sourceType: "primary", region: "România", supports: ["O afirmație concretă, verificabilă și relevantă."], relevance: 22, importance: 18, recency: 18, credibility: 20, usefulness: 13, primarySourceUrl: null, risks: [], ...overrides });
const topic = (sourceId, overrides = {}) => ({ title: `Subiect relevant ${sourceId}`, summary: "Un subiect actual cu efect direct asupra învățării și evaluării.", sourceIds: [sourceId], category: "Evaluare și examene", relevance: 22, importance: 18, recency: 18, credibility: 20, usefulness: 13, riskNote: null, ...overrides });

test("calculează săptămâna editorială începând de luni", () => {
  assert.deepEqual(getEditorialWeek(new Date("2026-07-19T08:00:00Z")), { start: "2026-07-13", end: "2026-07-19", key: "2026-07-13:2026-07-19" });
});

test("elimină URL-urile duplicate și selectează subiecte distincte", () => {
  const sources = [source("a"), source("b"), source("c"), source("d"), source("e"), source("f"), source("copy", { url: "https://example.org/a/" })];
  const result = validateResearch({ sources, candidateTopics: [topic("a"), topic("b", { category: "Învățare și cercetare" }), topic("c", { category: "Tehnologie educațională" }), topic("d", { category: "Politici educaționale" }), topic("e", { category: "Acces și bunăstare" })] }, { start: "2026-07-13", end: "2026-07-19" });
  assert.equal(result.valid, true);
  assert.equal(result.sources.length, 6);
  assert.equal(result.topics.length, 5);
});

test("blochează publicarea dacă fact check-ul găsește afirmații fără sursă", () => {
  const assessment = scoreEditorialQuality({ draft: { title: "Noutăți din educație: 13–19 iulie 2026" }, factCheck: { passed: false, sourceCoverage: 98, factualAccuracy: 98, clarity: 95, duplicationRisk: 2, issues: [], unsupportedClaimCount: 1 }, existingArticles: [] });
  assert.equal(assessment.valid, false);
  assert.match(assessment.reasons.join(" "), /fără sursă/i);
});

test("hash-ul de conținut este stabil și diferă pentru conținut diferit", () => {
  assert.equal(hashText("același text"), hashText("același text"));
  assert.notEqual(hashText("același text"), hashText("alt text"));
});
