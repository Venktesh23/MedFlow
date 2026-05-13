import { Appointment } from "../models/Appointment.js";
import { Note } from "../models/Note.js";
import { sendSuccess } from "../utils/http.js";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Aggregates today’s appointments and recent clinical notes for the dashboard UI.
 */
export async function getDashboardSummary(req, res) {
  const date = todayString();
  const userId = req.user._id;
  const [appointments, notes] = await Promise.all([
    Appointment.find({ date, userId }).populate("patientId").sort({ date: 1, time: 1 }).lean(),
    Note.find({ userId })
      .populate("patientId")
      .populate("appointmentId")
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
  ]);

  return sendSuccess(res, {
    appointments,
    notes,
  });
}
