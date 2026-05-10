#!/usr/bin/env node
/**
 * One-time (or periodic) cleanup: remove overlapping appointments from MongoDB,
 * keeping the earliest-created record in each overlap cluster.
 *
 * Requires MONGODB_URI in backend/.env
 *
 * Usage: cd backend && npm run cleanup:overlaps
 */

import "dotenv/config";
import { connectMongo, closeMongoConnection } from "../src/services/mongoService.js";
import { dedupeOverlappingAppointments } from "../src/services/appointmentOverlapCleanup.js";

async function main() {
  if (!process.env.MONGODB_URI?.trim()) {
    console.error("Missing MONGODB_URI");
    process.exit(1);
  }

  await connectMongo();
  const { deletedCount } = await dedupeOverlappingAppointments();
  console.log(`Removed ${deletedCount} overlapping appointment(s); kept oldest in each cluster.`);
  await closeMongoConnection();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
