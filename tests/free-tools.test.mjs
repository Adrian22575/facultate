import assert from "node:assert/strict";
import test from "node:test";

import {
  calculateDailyQuestions,
  calculateExamScore,
  calculateFinishDate,
  calculateRequiredSimulationScore,
  dateInputValue,
  generateStudyPlan
} from "../lib/free-tools.js";

test("calculates daily questions and repetitions predictably", () => {
  const result = calculateDailyQuestions({
    totalQuestions: 800,
    solvedQuestions: 200,
    daysRemaining: 30,
    daysPerWeek: 5,
    repetitions: 2,
    errorRate: 20
  });

  assert.equal(result.ok, true);
  assert.equal(result.remaining, 600);
  assert.equal(result.studyDays, 22);
  assert.equal(result.newPerDay, 28);
  assert.equal(result.reviewPerDay, 11);
  assert.equal(result.totalPerDay, 39);
});

test("rejects past exam dates and zero study days", () => {
  assert.equal(calculateDailyQuestions({ totalQuestions: 100, examDate: "2020-01-01", daysPerWeek: 5 }).ok, false);
  assert.match(calculateDailyQuestions({ totalQuestions: 100, daysRemaining: 20, daysPerWeek: 0 }).error, /cel puțin o zi/);
});

test("calculates completion date and warns when it exceeds the exam", () => {
  const result = calculateFinishDate({
    total: 180,
    completed: 30,
    dailyRate: 12,
    daysPerWeek: 7,
    reviewDays: 2,
    startDate: "2026-07-17",
    examDate: "2026-07-30"
  });

  assert.equal(result.ok, true);
  assert.equal(result.studyDays, 13);
  assert.equal(dateInputValue(result.completionDate), "2026-07-29");
  assert.equal(result.exceedsExam, true);
});

test("creates a deterministic study plan with a buffer day", () => {
  const result = generateStudyPlan({
    materialType: "grile",
    total: 120,
    completed: 0,
    examDate: "2026-08-10",
    today: "2026-07-17",
    daysPerWeek: 5,
    minutesPerDay: 45,
    difficulty: "mediu",
    wantsReview: true,
    wantsSimulations: true
  });

  assert.equal(result.ok, true);
  assert.equal(dateInputValue(result.bufferDate), "2026-08-09");
  assert.ok(result.plan.some((item) => item.type === "review"));
  assert.ok(result.plan.some((item) => item.type === "simulation"));
});

test("calculates score with penalties and validates answer count", () => {
  const result = calculateExamScore({
    totalQuestions: 100,
    correct: 70,
    wrong: 20,
    skipped: 10,
    basePoints: 10,
    penalty: 0.25,
    maxGrade: 10,
    passGrade: 5
  });

  assert.equal(result.ok, true);
  assert.equal(result.rawPoints, 75);
  assert.equal(result.maximumPoints, 110);
  assert.equal(result.passed, true);
  assert.equal(calculateExamScore({ totalQuestions: 10, correct: 11, wrong: 0, skipped: 0 }).ok, false);
});

test("finds the required average for future simulations and impossible targets", () => {
  const possible = calculateRequiredSimulationScore({
    scores: [60, 65, 67],
    targetAverage: 75,
    plannedTotal: 5,
    remaining: 2
  });
  const impossible = calculateRequiredSimulationScore({
    scores: [20, 20],
    targetAverage: 90,
    plannedTotal: 3,
    remaining: 1
  });

  assert.equal(possible.ok, true);
  assert.equal(possible.requiredAverage, 91.5);
  assert.equal(possible.possible, true);
  assert.equal(impossible.possible, false);
});
