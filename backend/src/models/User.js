import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    passwordHash: { type: String, required: true },
    clinicName: { type: String, default: "", trim: true },
    /** Inclusive 0–23; first hour row on the Appointments week grid. */
    clinicHoursStart: { type: Number, default: 6, min: 0, max: 23 },
    /** Inclusive 0–23; last hour row shown (e.g. 17 = 5:00–5:59 PM). */
    clinicHoursEnd: { type: Number, default: 21, min: 0, max: 23 },
    specialty: { type: String, default: "", trim: true },
  },
  { timestamps: true },
);

export const User = mongoose.models.User || mongoose.model("User", userSchema);
