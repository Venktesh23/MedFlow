import crypto from "crypto";
import mongoose from "mongoose";
import { AgentJob } from "../models/AgentJob.js";
import { processAudioSession, processTranscriptSession } from "../agents/clinicalDocumentationAgent.js";

const jobQueue = [];
const jobPayloads = new Map();
let running = 0;
let rehydrated = false;

function maxConcurrency() {
  const raw = Number(process.env.AGENT_JOB_CONCURRENCY || 2);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

function maxAttempts() {
  const raw = Number(process.env.AGENT_JOB_MAX_ATTEMPTS || 2);
  return Number.isFinite(raw) && raw > 0 ? raw : 2;
}

function retryDelayMs(attempt) {
  const base = Number(process.env.AGENT_JOB_RETRY_BASE_MS || 1500);
  return Math.min(8000, base * attempt);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function updateJob(jobId, patch) {
  await AgentJob.findOneAndUpdate({ jobId }, patch, { new: true });
}

function serializePayload(payload, inputType) {
  if (inputType !== "audio") return payload;
  // Exclude the audio buffer from MongoDB storage — it can exceed the 16MB doc limit.
  // The buffer lives in the in-memory jobPayloads Map; if the process restarts, the job
  // will be marked failed by rehydrateQueuedJobs (payload absent).
  const { audioBuffer, audioEncoding, ...rest } = payload || {};
  return rest;
}

function deserializePayload(payload, _inputType) {
  return payload;
}

async function runJob(jobId, payload) {
  const job = await AgentJob.findOne({ jobId }).lean();
  if (!job) return;

  const max = Number(job.maxAttempts || maxAttempts());
  let attempt = Number(job.attempts || 0);

  while (attempt < max) {
    attempt += 1;
    await updateJob(jobId, { status: "processing", attempts: attempt });

    let result;
    try {
      if (payload.inputType === "audio") {
        result = await processAudioSession(payload.payload);
      } else {
        result = await processTranscriptSession(payload.payload);
      }
    } catch (err) {
      result = {
        ok: false,
        error: { code: "AGENT_THREW", message: err?.message || String(err) },
      };
    }

    if (result.ok) {
      await updateJob(jobId, {
        status: "completed",
        resultSnapshot: result.data,
        errorSnapshot: null,
      });
      return;
    }

    if (attempt < max) {
      await updateJob(jobId, {
        status: "queued",
        errorSnapshot: result.error,
      });
      await sleep(retryDelayMs(attempt));
      continue;
    }

    await updateJob(jobId, {
      status: "failed",
      resultSnapshot: null,
      errorSnapshot: result.error,
    });
    return;
  }
}

function drainQueue() {
  while (running < maxConcurrency() && jobQueue.length > 0) {
    const jobId = jobQueue.shift();
    const payload = jobPayloads.get(jobId);
    if (!payload) continue;

    running += 1;
    runJob(jobId, payload)
      .catch(async (error) => {
        await updateJob(jobId, {
          status: "failed",
          resultSnapshot: null,
          errorSnapshot: {
            code: "JOB_EXECUTION_FAILED",
            message: "Clinical agent job execution failed.",
            details: error?.message || String(error),
          },
        });
      })
      .finally(() => {
        running -= 1;
        jobPayloads.delete(jobId);
        drainQueue();
      });
  }
}

function toObjectId(value) {
  if (!value) return null;
  const stringValue = String(value);
  return mongoose.isValidObjectId(stringValue) ? stringValue : null;
}

export async function enqueueClinicalJob({ inputType, payload, patientId, appointmentId, userId }) {
  const jobId = crypto.randomUUID();
  const payloadSnapshot = serializePayload(payload, inputType);

  await AgentJob.create({
    jobId,
    userId: toObjectId(userId),
    inputType,
    status: "queued",
    payloadSnapshot,
    attempts: 0,
    maxAttempts: maxAttempts(),
    patientId: toObjectId(patientId),
    appointmentId: toObjectId(appointmentId),
    resultSnapshot: null,
    errorSnapshot: null,
  });

  jobPayloads.set(jobId, { inputType, payload });
  jobQueue.push(jobId);
  drainQueue();

  return jobId;
}

export async function getClinicalJob(jobId, userId) {
  const filter = userId ? { jobId, userId } : { jobId };
  return AgentJob.findOne(filter).lean();
}

export async function rehydrateQueuedJobs() {
  if (rehydrated) return;
  rehydrated = true;

  const jobs = await AgentJob.find({ status: { $in: ["queued", "processing"] } })
    .sort({ createdAt: 1 })
    .lean();

  for (const job of jobs) {
    if (!job.payloadSnapshot || (job.inputType === "audio")) {
      await updateJob(job.jobId, {
        status: "failed",
        errorSnapshot: {
          code: "JOB_PAYLOAD_MISSING",
          message: job.inputType === "audio"
            ? "Audio buffer not recoverable after server restart."
            : "Job payload was not available after restart.",
        },
      });
      continue;
    }

    const payload = deserializePayload(job.payloadSnapshot, job.inputType);
    jobPayloads.set(job.jobId, { inputType: job.inputType, payload });
    jobQueue.push(job.jobId);
    if (job.status === "processing") {
      await updateJob(job.jobId, { status: "queued" });
    }
  }

  drainQueue();
}
