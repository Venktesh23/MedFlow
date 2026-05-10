import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { Note } from "../models/Note.js";
import { Patient } from "../models/Patient.js";
import { checkConflict } from "../agents/utils/conflictDetection.js";
import { upsertPatient } from "../services/mongoService.js";
import { sendError, sendSuccess } from "../utils/http.js";

const SAMPLE_PATIENT_NAME = "MedFlow Sample Patient";

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

/**
 * Ensures a demo patient and today's sample appointment exist (idempotent).
 */
export async function ensureSampleAppointment(req, res) {
  let patient = await Patient.findOne({ name: SAMPLE_PATIENT_NAME });
  if (!patient) {
    patient = await Patient.create({
      name: SAMPLE_PATIENT_NAME,
      dob: "",
      contact: "",
      insurance: "",
    });
  }

  const date = todayString();
  let appointment = await Appointment.findOne({
    patientId: patient._id,
    date,
    time: "10:00",
    type: "consultation",
  });

  if (!appointment) {
    const sameDay = await Appointment.find({ date });
    const demoConflict = checkConflict(sameDay, date, "10:00", 30);
    if (demoConflict.hasConflict) {
      await demoConflict.conflictingAppointment.populate("patientId");
      return sendSuccess(res, {
        appointment: demoConflict.conflictingAppointment,
        note: "Demo slot already occupied; returning existing visit at that time.",
      });
    }

    appointment = await Appointment.create({
      patientId: patient._id,
      doctorName: req.user?.name || "Doctor",
      date,
      time: "10:00",
      type: "consultation",
      status: "upcoming",
    });
  }

  await appointment.populate("patientId");

  return sendSuccess(res, { appointment });
}

function normalizedDateParam(date) {
  if (!date || date === "today") return todayString();
  return date;
}

export async function listAppointments(req, res) {
  const filter = {};
  if (req.query.date) filter.date = normalizedDateParam(req.query.date);

  const appointments = await Appointment.find(filter)
    .populate("patientId")
    .sort({ date: 1, time: 1 });

  return sendSuccess(res, { appointments });
}

export async function getAppointmentById(req, res) {
  const appointment = await Appointment.findById(req.params.id).populate("patientId");

  if (!appointment) {
    return sendError(res, 404, {
      code: "APPOINTMENT_NOT_FOUND",
      message: "Appointment not found.",
    });
  }

  return sendSuccess(res, { appointment });
}

export async function createAppointment(req, res) {
  let patient = null;
  const pid = req.body.patientId?.toString().trim();

  if (pid && mongoose.isValidObjectId(pid)) {
    patient = await Patient.findById(pid);
  }

  if (!patient && req.body.patientName?.toString().trim()) {
    const name = req.body.patientName.toString().trim();
    const upsert = await upsertPatient({
      name,
      dob: req.body.patientDob ?? "",
      contact: req.body.patientContact ?? "",
      insurance: req.body.patientInsurance ?? "",
    });
    if (!upsert.ok) {
      return sendError(res, 400, upsert.error);
    }
    patient = await Patient.findById(upsert.data._id);
  }

  if (!patient) {
    return sendError(res, 404, {
      code: "PATIENT_NOT_FOUND",
      message:
        "Patient not found. Send a valid patientId, or patientName (and optional patientDob, patientContact, patientInsurance) to create or match a profile.",
    });
  }

  const duration =
    Number(req.body.duration) > 0 ? Number(req.body.duration) : 30;
  const sameDay = await Appointment.find({ date: req.body.date });
  const conflict = checkConflict(sameDay, req.body.date, req.body.time, duration);
  if (conflict.hasConflict) {
    return sendError(res, 400, {
      code: "APPOINTMENT_CONFLICT",
      message:
        "That time overlaps an existing appointment. Only one visit can be scheduled in that slot.",
    });
  }

  let appointment = await Appointment.create({
    patientId: patient._id,
    doctorName: req.body.doctorName || req.user?.name || "Doctor",
    date: req.body.date,
    time: req.body.time,
    duration,
    type: req.body.type || "follow-up",
    status: req.body.status || "upcoming",
  });

  await appointment.populate("patientId");

  return sendSuccess(res, { appointment }, 201);
}

export async function updateAppointment(req, res) {
  const existing = await Appointment.findById(req.params.id);
  if (!existing) {
    return sendError(res, 404, {
      code: "APPOINTMENT_NOT_FOUND",
      message: "Appointment not found.",
    });
  }

  const updates = Object.fromEntries(
    Object.entries({
      patientId: req.body.patientId,
      doctorName: req.body.doctorName,
      date: req.body.date,
      time: req.body.time,
      duration: req.body.duration,
      type: req.body.type,
      status: req.body.status,
    }).filter(([, value]) => value !== undefined),
  );

  const mergedDate = updates.date !== undefined ? updates.date : existing.date;
  const mergedTime = updates.time !== undefined ? updates.time : existing.time;
  const mergedDurationRaw =
    updates.duration !== undefined ? updates.duration : existing.duration ?? 30;
  const mergedDuration =
    Number(mergedDurationRaw) > 0 ? Number(mergedDurationRaw) : 30;

  const schedulingChanged =
    updates.date !== undefined ||
    updates.time !== undefined ||
    updates.duration !== undefined;

  if (schedulingChanged) {
    const sameDay = await Appointment.find({ date: mergedDate });
    const others = sameDay.filter((a) => String(a._id) !== String(existing._id));
    const conflict = checkConflict(others, mergedDate, mergedTime, mergedDuration);
    if (conflict.hasConflict) {
      return sendError(res, 400, {
        code: "APPOINTMENT_CONFLICT",
        message:
          "Updated time overlaps another appointment. Only one visit can occupy that slot.",
      });
    }
  }

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true },
  ).populate("patientId");

  return sendSuccess(res, { appointment });
}

export async function deleteAppointment(req, res) {
  const id = req.params.id;
  const appointment = await Appointment.findByIdAndDelete(id);

  if (!appointment) {
    return sendError(res, 404, {
      code: "APPOINTMENT_NOT_FOUND",
      message: "Appointment not found.",
    });
  }

  await Note.updateMany({ appointmentId: id }, { $set: { appointmentId: null } });

  return sendSuccess(res, { deleted: true });
}
