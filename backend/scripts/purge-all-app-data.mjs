#!/usr/bin/env node
/**
 * Deletes all patients, appointments, notes, and agent runs.
 * User accounts (login) are not touched.
 *
 * Requires MONGODB_URI in backend/.env
 *
 * Usage:
 *   cd backend && node scripts/purge-all-app-data.mjs DELETE_ALL_APP_DATA
 */

import "dotenv/config";
import { AgentRun } from "../src/models/AgentRun.js";
import { Appointment } from "../src/models/Appointment.js";
import { Note } from "../src/models/Note.js";
import { Patient } from "../src/models/Patient.js";
import { User } from "../src/models/User.js";
import { connectMongo, closeMongoConnection } from "../src/services/mongoService.js";

const PHRASE = "DELETE_ALL_APP_DATA";

async function main() {
  if (process.argv[2] !== PHRASE) {
    console.error(`Usage: node scripts/purge-all-app-data.mjs ${PHRASE}`);
    process.exit(1);
  }

  if (!process.env.MONGODB_URI?.trim()) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  await connectMongo();

  const [runs, notes, appts, patients] = await Promise.all([
    AgentRun.deleteMany({}),
    Note.deleteMany({}),
    Appointment.deleteMany({}),
    Patient.deleteMany({}),
  ]);

  const users = await User.countDocuments({});

  console.log("Deleted:", {
    agentRuns: runs.deletedCount ?? 0,
    notes: notes.deletedCount ?? 0,
    appointments: appts.deletedCount ?? 0,
    patients: patients.deletedCount ?? 0,
  });
  console.log("Users preserved:", users);

  await closeMongoConnection();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
