import assert from "node:assert/strict";
import test from "node:test";

import { isAutomationDue } from "../lib/editorial/automation-schedule.js";

test("automatizarea săptămânală rulează numai în ziua selectată", () => {
  const settings = { enabled: true, scheduled_hour: 10, frequency_days: 7, weekly_day: 1, last_scheduled_for: null };
  assert.equal(isAutomationDue(settings, new Date("2026-07-20T07:00:00Z")), true);
  assert.equal(isAutomationDue(settings, new Date("2026-07-21T07:00:00Z")), false);
  assert.equal(isAutomationDue({ ...settings, last_scheduled_for: "2026-07-20" }, new Date("2026-07-20T08:00:00Z")), false);
  assert.equal(isAutomationDue({ ...settings, last_scheduled_for: "2026-07-14" }, new Date("2026-07-20T08:00:00Z")), true);
});

test("frecvențele nesăptămânale păstrează regula intervalului", () => {
  const settings = { enabled: true, scheduled_hour: 10, frequency_days: 2, weekly_day: null, last_scheduled_for: "2026-07-18" };
  assert.equal(isAutomationDue(settings, new Date("2026-07-20T07:00:00Z")), true);
  assert.equal(isAutomationDue({ ...settings, last_scheduled_for: "2026-07-19" }, new Date("2026-07-20T07:00:00Z")), false);
});
