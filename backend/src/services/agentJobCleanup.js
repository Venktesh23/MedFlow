import { AgentJob } from "../models/AgentJob.js";

function retentionDays() {
  const raw = Number(process.env.AGENT_JOB_RETENTION_DAYS || 7);
  return Number.isFinite(raw) ? raw : 7;
}

export async function purgeOldAgentJobs() {
  const days = retentionDays();
  if (days <= 0) {
    return { deletedCount: 0 };
  }

  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const result = await AgentJob.deleteMany({
    status: { $in: ["completed", "failed"] },
    createdAt: { $lt: cutoff },
  });

  return { deletedCount: result.deletedCount || 0 };
}
