import mongoose from "mongoose";

const soapNoteSchema = new mongoose.Schema(
  {
    subjective: { type: String, default: "" },
    objective: { type: String, default: "" },
    assessment: { type: String, default: "" },
    plan: { type: String, default: "" },
  },
  { _id: false },
);

const noteSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    appointmentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
      default: null,
    },
    transcript: { type: String, required: true },
    /** Original live ASR text before cleanup (when cleanup ran). */
    rawTranscript: { type: String, default: null },
    soapNote: { type: soapNoteSchema, required: true },
    tags: [{ type: String, trim: true }],
    summary: { type: String, default: "" },
    followUpRequired: { type: Boolean, default: false },
    followUpTimeframe: { type: String, default: null },
    flagged: { type: Boolean, default: false },
    flagReason: { type: String, default: null },
    incomplete: { type: Boolean, default: false },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } },
);

noteSchema.index({ patientId: 1, createdAt: -1 });
noteSchema.index({ userId: 1, createdAt: -1 });
noteSchema.index({ tags: 1 });

export const Note = mongoose.models.Note || mongoose.model("Note", noteSchema);
