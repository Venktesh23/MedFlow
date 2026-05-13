import test from "node:test";
import assert from "node:assert/strict";
import { connectMongo, closeMongoConnection, upsertPatient } from "../src/services/mongoService.js";
import { enqueueClinicalJob, getClinicalJob } from "../src/services/agentJobQueue.js";

const HAS_MONGO = Boolean(process.env.MONGODB_URI);

test(
  "agent job queue processes transcript sessions",
  { skip: !HAS_MONGO },
  async () => {
    await connectMongo();

    const patientResult = await upsertPatient({
      name: `Test Patient ${Date.now()}`,
      dob: "",
      contact: "",
      insurance: "",
    });

    assert.equal(patientResult.ok, true);
    const patientId = patientResult.data._id;

    const jobId = await enqueueClinicalJob({
      inputType: "transcript",
      patientId,
      payload: {
        transcript: "Patient: I have a sore throat. Doctor: Exam is clear. Plan rest and fluids.",
        patient_id: patientId,
        appointment_id: null,
        patient: { name: patientResult.data.name },
        appointment: {},
      },
    });

    assert.ok(jobId);

    const maxAttempts = 60;
    let finalJob = null;

    for (let i = 0; i < maxAttempts; i += 1) {
      const job = await getClinicalJob(jobId);
      if (!job) {
        await new Promise((resolve) => setTimeout(resolve, 200));
        continue;
      }

      if (job.status === "completed") {
        finalJob = job;
        break;
      }

      if (job.status === "failed") {
        assert.fail(job.errorSnapshot?.message || "Agent job failed");
      }

      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    assert.ok(finalJob, "Job did not complete within timeout");
    assert.ok(finalJob.resultSnapshot);

    await closeMongoConnection();
  },
);
