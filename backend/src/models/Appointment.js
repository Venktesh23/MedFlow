import mongoose from "mongoose";

const appointmentSchema = new mongoose.Schema(
  {
    patientId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    doctorName: { type: String, required: true, trim: true },
    date: { type: String, required: true, trim: true },
    time: { type: String, required: true, trim: true },
    type: {
      type: String,
      enum: [
        "follow-up",
        "new-visit",
        "lab-review",
        "annual-physical",
        "consultation",
      ],
      default: "follow-up",
    },
    duration: { type: Number, default: 30, min: 5 },
    status: {
      type: String,
      enum: ["upcoming", "in-progress", "completed"],
      default: "upcoming",
    },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } },
);

appointmentSchema.index({ date: 1, time: 1 });
appointmentSchema.index({ patientId: 1, date: -1 });

export const Appointment =
  mongoose.models.Appointment ||
  mongoose.model("Appointment", appointmentSchema);
