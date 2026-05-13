import test from "node:test";
import assert from "node:assert/strict";
import { parseCalendarCommandFallback } from "../src/agents/utils/calendarFallback.js";

test("calendar fallback parses create command", () => {
  const parsed = parseCalendarCommandFallback(
    "Schedule Maria Lopez for a follow-up on 2026-05-12 at 14:30 for 30 minutes.",
  );

  assert.equal(parsed.intent, "create");
  assert.equal(parsed.patientName, "Maria Lopez");
  assert.equal(parsed.date, "2026-05-12");
  assert.equal(parsed.time, "14:30");
  assert.equal(parsed.duration, 30);
  assert.equal(parsed.type, "follow-up");
});

test("calendar fallback parses query intent", () => {
  const parsed = parseCalendarCommandFallback("What appointments do I have tomorrow?");
  assert.equal(parsed.intent, "query");
  assert.equal(parsed.queryType, "day");
});
