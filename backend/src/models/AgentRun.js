import mongoose from "mongoose";

/**
 * Persists each clinical agent pipeline attempt (transcript/audio → SOAP),
 * including failures, for audit and debugging. Distinct from {@link Note} (saved clinical record).
 */
const agentRunSchema = new mongoose.Schema(
  {
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
    inputType: {
      type: String,
      enum: ["audio", "transcript"],
      required: true,
    },
    /** Transcript text used for generation; null if failed before text existed (e.g. audio path). */
    transcript: { type: String, default: null },
    /** Successful pipeline payload (note, soap, metadata) or partial SOAP on some failures. */
    outputSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    status: {
      type: String,
      enum: ["completed", "failed"],
      required: true,
    },
    /** Structured error from the pipeline when status is failed. */
    errorSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } },
);

agentRunSchema.index({ patientId: 1, createdAt: -1 });
agentRunSchema.index({ status: 1, createdAt: -1 });
agentRunSchema.index({ appointmentId: 1, createdAt: -1 });

export const AgentRun =
  mongoose.models.AgentRun || mongoose.model("AgentRun", agentRunSchema);
