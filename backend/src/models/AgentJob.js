import mongoose from "mongoose";

const agentJobSchema = new mongoose.Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null, index: true },
    inputType: { type: String, enum: ["audio", "transcript"], required: true },
    status: {
      type: String,
      enum: ["queued", "processing", "completed", "failed"],
      required: true,
    },
    payloadSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 2 },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      default: null,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    resultSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    errorSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } },
);

agentJobSchema.index({ status: 1, createdAt: -1 });

export const AgentJob =
  mongoose.models.AgentJob || mongoose.model("AgentJob", agentJobSchema);
