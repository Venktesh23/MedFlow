import test from "node:test";
import assert from "node:assert/strict";
import { checkConflict } from "../src/agents/utils/conflictDetection.js";

test("checkConflict detects overlap", () => {
  const existing = [
    { date: "2026-05-12", time: "10:00", duration: 30 },
    { date: "2026-05-12", time: "11:00", duration: 30 },
  ];
  const result = checkConflict(existing, "2026-05-12", "10:15", 30);
  assert.equal(result.hasConflict, true);
});

test("checkConflict allows back-to-back", () => {
  const existing = [{ date: "2026-05-12", time: "10:00", duration: 30 }];
  const result = checkConflict(existing, "2026-05-12", "10:30", 30);
  assert.equal(result.hasConflict, false);
});
