import { Appointment } from "../models/Appointment.js";
import { Patient } from "../models/Patient.js";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "../services/googleCalendarService.js";
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
  const patient = await Patient.findById(req.body.patientId);
  if (!patient) {
    return sendError(res, 404, {
      code: "PATIENT_NOT_FOUND",
      message: "Patient not found.",
    });
  }

  let appointment = await Appointment.create({
    patientId: patient._id,
    doctorName: req.body.doctorName || req.user?.name || "Doctor",
    date: req.body.date,
    time: req.body.time,
    type: req.body.type || "follow-up",
    status: req.body.status || "upcoming",
  });

  await appointment.populate("patientId");
  const { eventId: calendarEventId, warning: calendarSyncWarning } = await createCalendarEvent(appointment);

  if (calendarEventId) {
    appointment.googleCalendarEventId = calendarEventId;
    await appointment.save();
    await appointment.populate("patientId");
  }

  return sendSuccess(res, { appointment, calendarEventId, calendarSyncWarning }, 201);
}

export async function updateAppointment(req, res) {
  const updates = Object.fromEntries(
    Object.entries({
      patientId: req.body.patientId,
      doctorName: req.body.doctorName,
      date: req.body.date,
      time: req.body.time,
      type: req.body.type,
      status: req.body.status,
    }).filter(([, value]) => value !== undefined),
  );

  const appointment = await Appointment.findByIdAndUpdate(
    req.params.id,
    updates,
    { new: true, runValidators: true },
  ).populate("patientId");

  if (!appointment) {
    return sendError(res, 404, {
      code: "APPOINTMENT_NOT_FOUND",
      message: "Appointment not found.",
    });
  }

  const { warning: calendarSyncWarning } = await updateCalendarEvent(appointment);

  return sendSuccess(res, { appointment, calendarSyncWarning });
}

export async function deleteAppointment(req, res) {
  const appointment = await Appointment.findByIdAndDelete(req.params.id);

  if (!appointment) {
    return sendError(res, 404, {
      code: "APPOINTMENT_NOT_FOUND",
      message: "Appointment not found.",
    });
  }

  const { warning: calendarSyncWarning } = await deleteCalendarEvent(appointment.googleCalendarEventId);

  return sendSuccess(res, { deleted: true, calendarSyncWarning });
}
