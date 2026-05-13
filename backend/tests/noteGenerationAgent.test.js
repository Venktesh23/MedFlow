import test from "node:test";
import assert from "node:assert/strict";
import {
  deriveNoteFromTranscript,
  normalizeClinicalNote,
} from "../src/agents/noteGenerationAgent.js";

test("deriveNoteFromTranscript returns SOAP sections", () => {
  const transcript = "Patient: I have had a cough for three days. Doctor: Exam is clear. Plan return in one week.";
  const note = deriveNoteFromTranscript(transcript);

  assert.ok(note.subjective.includes("CC:"));
  assert.ok(note.objective.includes("Vitals:"));
  assert.ok(note.assessment.includes("Impression:"));
  assert.ok(note.plan.startsWith("- "));
});

test("normalizeClinicalNote coerces fields", () => {
  const normalized = normalizeClinicalNote({
    subjective: "text",
    objective: "text",
    assessment: "text",
    plan: "text",
    tags: "respiratory, acute",
    summary: "summary",
    followUpRequired: "true",
    followUpTimeframe: "2 weeks",
    flagged: "false",
    flagReason: null,
  });

  assert.equal(normalized.followUpRequired, true);
  assert.equal(normalized.flagged, false);
  assert.deepEqual(normalized.tags, ["respiratory", "acute"]);
});
