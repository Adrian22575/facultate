import assert from "node:assert/strict";
import test from "node:test";

import {
  getSubjectPaletteIndex,
  getSubjectProgressSummary,
  getSubjectResumeCandidate,
  sortSubjectLibrary
} from "../lib/subject-library.js";

test("progresul materiei foloseste cel mai avansat mod disponibil", () => {
  const progress = getSubjectProgressSummary({
    study_total_questions: 68,
    study_viewed_count: 24,
    interactive_total_questions: 20,
    interactive_answered: 16,
    test_best_score_percent: 65
  });

  assert.equal(progress.study.percent, 35);
  assert.equal(progress.interactive.percent, 80);
  assert.equal(progress.percent, 80);
});

test("paleta materiei ramane determinista si sortarea respecta activitatea", () => {
  assert.equal(getSubjectPaletteIndex("econometrie"), getSubjectPaletteIndex("econometrie"));

  const sorted = sortSubjectLibrary([
    { id: "a", title: "Algebra", lastActivityAt: "2026-07-20T10:00:00.000Z", progress: { percent: 20 } },
    { id: "b", title: "Biologie", lastActivityAt: "2026-07-22T10:00:00.000Z", progress: { percent: 10 } }
  ]);

  assert.deepEqual(sorted.map((subject) => subject.id), ["b", "a"]);
});

test("shortcut-ul prefera ultima ruta locala valida, apoi activitatea din cont", () => {
  const subjects = [
    { id: "econometrie", title: "Econometrie", lastMode: "Studiu", lastActivityAt: "2026-07-20T10:00:00.000Z" },
    { id: "management", title: "Management", lastMode: "Test", lastActivityAt: "2026-07-22T10:00:00.000Z" }
  ];

  const local = getSubjectResumeCandidate({
    lastSession: { subjectId: "econometrie", url: "/materii/econometrie/studiu", mode: "Studiu" },
    subjectLibrary: subjects
  });
  assert.equal(local.href, "/materii/econometrie/studiu");

  const fallback = getSubjectResumeCandidate({
    lastSession: { subjectId: "inaccesibila", url: "/materii/inaccesibila/test" },
    subjectLibrary: subjects
  });
  assert.equal(fallback.href, "/materii/management");
});
