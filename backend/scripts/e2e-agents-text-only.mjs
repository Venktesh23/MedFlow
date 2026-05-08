#!/usr/bin/env node
/**
 * MedFlow agent E2E — text only (no voice).
 *
 * Covers:
 * - Calendar agent: create, conflict, query, update, delete, edge cases
 * - Clinical pipeline: note generation, transcript cleanup + SOAP + Mongo persistence
 *
 * Requires: MONGODB_URI, JWT_SECRET (for optional HTTP), ANTHROPIC_API_KEY
 *
 * Run from backend/:  npm run test:agents:e2e
 *
 * Optional HTTP smoke (server must be running):
 *   E2E_HTTP=1 E2E_API_BASE=http://localhost:5000 E2E_LOGIN_EMAIL=... E2E_LOGIN_PASSWORD=... npm run test:agents:e2e
 */

import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo, closeMongoConnection } from "../src/services/mongoService.js";
import { Patient } from "../src/models/Patient.js";
import { Appointment } from "../src/models/Appointment.js";
import { Note } from "../src/models/Note.js";
import { runCalendarAgent } from "../src/agents/calendarAgent.js";
import { runNoteGenerationAgent } from "../src/agents/noteGenerationAgent.js";
import { processTranscriptSession } from "../src/agents/clinicalDocumentationAgent.js";

const DR_NAME = "Dr. E2E Automation";

function isoDate(d) {
  return d.toISOString().slice(0, 10);
}

function addDays(base, n) {
  const x = new Date(base);
  x.setDate(x.getDate() + n);
  return x;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function section(title) {
  console.log(`\n━━ ${title} ━━`);
}

let failures = 0;
let passes = 0;

async function test(name, fn) {
  try {
    await fn();
    passes += 1;
    console.log(`  ✓ ${name}`);
  } catch (e) {
    failures += 1;
    console.error(`  ✗ ${name}`);
    console.error(`    ${e?.message || e}`);
  }
}

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }
  if (!process.env.ANTHROPIC_API_KEY?.trim()) {
    console.error("Missing ANTHROPIC_API_KEY");
    process.exit(1);
  }

  await connectMongo();

  const suffix = `${Date.now().toString(36)}`;
  const patientName = `E2E Calendar Patient ${suffix}`;
  const patient = await Patient.create({
    name: patientName,
    dob: "",
    contact: "",
    insurance: "",
  });
  const tomorrow = isoDate(addDays(new Date(), 1));

  const cleanup = async () => {
    await Appointment.deleteMany({ patientId: patient._id });
    await Note.deleteMany({ patientId: patient._id });
    await Patient.findByIdAndDelete(patient._id);
  };

  try {
    section("Calendar agent — edges");
    await test("rejects empty command", async () => {
      const r = await runCalendarAgent("   ", { doctorName: DR_NAME });
      assert(!r.ok, "expected failure");
      assert(r.error?.code === "COMMAND_REQUIRED", `got ${r.error?.code}`);
    });

    await test("create fails for unknown patient name", async () => {
      const r = await runCalendarAgent(
        `Schedule TotallyUnknownPatientZZZ999 for a follow-up on ${tomorrow} at 09:00`,
        { doctorName: DR_NAME },
      );
      assert(!r.ok, "expected failure");
      assert(r.error?.code === "PATIENT_NOT_FOUND", `got ${r.error?.code}`);
    });

    section("Calendar agent — happy path (agentic chain: parse → Mongo → optional Google Calendar)");
    await test("CREATE appointment via natural language", async () => {
      const cmd = `Schedule ${patientName} for a consultation on ${tomorrow} at 14:30`;
      const r = await runCalendarAgent(cmd, { doctorName: DR_NAME });
      assert(r.ok, JSON.stringify(r.error));
      assert(r.data?.appointment?._id || r.data?.appointment, "missing appointment");
      const appt = await Appointment.findOne({
        patientId: patient._id,
        date: tomorrow,
      }).sort({ time: 1 });
      assert(appt, "appointment not in MongoDB");
      assert(String(appt.time) === "14:30", `time was ${appt.time}`);
    });

    await test("CONFLICT when overlapping slot same day", async () => {
      const r = await runCalendarAgent(
        `Schedule ${patientName} for a follow-up on ${tomorrow} at 14:35 for 30 minutes`,
        { doctorName: DR_NAME },
      );
      assert(!r.ok, "expected scheduling conflict");
      assert(r.error?.code === "APPOINTMENT_CONFLICT", `got ${r.error?.code}`);
    });

    await test("QUERY schedule for that day", async () => {
      const r = await runCalendarAgent(
        `What appointments do I have on ${tomorrow}?`,
        { doctorName: DR_NAME },
      );
      assert(r.ok, JSON.stringify(r.error));
      assert(
        Array.isArray(r.data?.appointments),
        "expected appointments array",
      );
      assert(r.data.appointments.length >= 1, "expected at least one appointment");
    });

    await test("UPDATE time (reschedule)", async () => {
      const r = await runCalendarAgent(
        `Move ${patientName}'s appointment on ${tomorrow} to 16:00`,
        { doctorName: DR_NAME },
      );
      assert(r.ok, JSON.stringify(r.error));
      const appt = await Appointment.findOne({ patientId: patient._id, date: tomorrow });
      assert(appt, "appointment missing after update");
      assert(String(appt.time) === "16:00", `expected 16:00, got ${appt.time}`);
    });

    await test("DELETE / cancel appointment", async () => {
      const r = await runCalendarAgent(
        `Cancel ${patientName}'s appointment on ${tomorrow}`,
        { doctorName: DR_NAME },
      );
      assert(r.ok, JSON.stringify(r.error));
      const remaining = await Appointment.countDocuments({
        patientId: patient._id,
        date: tomorrow,
      });
      assert(remaining === 0, `expected 0 appointments, got ${remaining}`);
    });

    section("Note-taking agent — generation only");
    await test("rejects empty transcript", async () => {
      const r = await runNoteGenerationAgent("", {});
      assert(!r.ok, "expected failure");
      assert(r.error?.code === "EMPTY_TRANSCRIPT", r.error?.code);
    });

    const richTranscript = `
Patient: I've had chest tightness on and off for two weeks when walking uphill.
Doctor: Any jaw or arm pain? Patient: No.
Doctor: BP today 128 over 82. Heart regular rate. Lungs clear.
Doctor: Likely stable angina — we'll order a stress test and start aspirin.
Patient: Okay.
`.trim();

    await test("SOAP generation from labeled transcript", async () => {
      const r = await runNoteGenerationAgent(richTranscript, {});
      assert(r.ok, JSON.stringify(r.error));
      assert(r.data?.subjective?.length > 10, "subjective too short");
      assert(r.data?.objective?.length > 5, "objective too short");
      assert(r.data?.assessment?.length > 5, "assessment too short");
      assert(r.data?.plan?.length > 5, "plan too short");
      assert(Array.isArray(r.data?.tags), "tags missing");
    });

    await test("minimal / noisy transcript still yields structured output", async () => {
      const r = await runNoteGenerationAgent(
        "Patient: cough. Doctor: viral URI rest fluids.",
        {},
      );
      assert(r.ok, JSON.stringify(r.error));
      assert(r.data?.summary || r.data?.subjective, "no summary-like output");
    });

    section("Clinical pipeline — full agentic path (cleanup → SOAP → Mongo Note)");
    await test("processTranscriptSession persists Note + SOAP", async () => {
      const transcript = `
Patient: sore throat two days. Doctor: Fever? Patient: Low grade.
Doctor: Pharynx mildly erythematous. Viral pharyngitis. Fluids and salt water gargle.
`.trim();

      const before = await Note.countDocuments({ patientId: patient._id });
      const r = await processTranscriptSession({
        transcript,
        patient_id: patient._id.toString(),
        appointment_id: null,
      });
      assert(r.ok, JSON.stringify(r.error));
      assert(r.data?.soapNote || r.data?.soap_note, "missing soap in response");
      const after = await Note.countDocuments({ patientId: patient._id });
      assert(after === before + 1, `note count ${before} -> ${after}`);
      const note = await Note.findOne({ patientId: patient._id }).sort({ createdAt: -1 });
      assert(note?.transcript?.length > 20, "stored transcript too short");
      assert(note?.soapNote?.subjective?.length > 5, "SOAP not persisted");
    });

    section("Optional HTTP E2E (real API + JWT)");
    if (process.env.E2E_HTTP === "1") {
      const base = (process.env.E2E_API_BASE || "http://localhost:5000").replace(/\/$/, "");
      const email = process.env.E2E_LOGIN_EMAIL;
      const password = process.env.E2E_LOGIN_PASSWORD;
      if (!email || !password) {
        console.warn("  (skip) E2E_HTTP=1 but E2E_LOGIN_EMAIL / E2E_LOGIN_PASSWORD not set");
      } else {
        await test("HTTP POST /api/auth/login + /api/calendar/command", async () => {
          const loginRes = await fetch(`${base}/api/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password }),
          });
          const loginJson = await loginRes.json();
          assert(loginRes.ok && loginJson.success && loginJson.data?.token, JSON.stringify(loginJson));
          const token = loginJson.data.token;

          const cmd = `Schedule ${patientName} for a lab-review on ${tomorrow} at 11:00`;
          const calRes = await fetch(`${base}/api/calendar/command`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ command: cmd }),
          });
          const calJson = await calRes.json();
          assert(calRes.ok && calJson.success, JSON.stringify(calJson));

          await Appointment.deleteMany({ patientId: patient._id, date: tomorrow });
        });
      }
    } else {
      console.log("\n  (HTTP tests skipped; set E2E_HTTP=1 and credentials to include.)");
    }
  } finally {
    await cleanup();
    await closeMongoConnection();
  }

  section("Summary");
  console.log(`  Passed: ${passes}  Failed: ${failures}`);
  if (failures > 0) process.exit(1);
  console.log("\nAll agent text-only E2E checks passed.\n");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
