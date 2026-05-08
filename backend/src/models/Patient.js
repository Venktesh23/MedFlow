import mongoose from "mongoose";

const patientSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    dob: { type: String, default: "", trim: true },
    contact: { type: String, default: "", trim: true },
    insurance: { type: String, default: "", trim: true },
  },
  { timestamps: { createdAt: "createdAt", updatedAt: "updatedAt" } },
);

patientSchema.index({ name: "text", contact: "text", insurance: "text" });

export const Patient =
  mongoose.models.Patient || mongoose.model("Patient", patientSchema);
