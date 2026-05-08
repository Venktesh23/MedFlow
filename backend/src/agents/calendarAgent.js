import { Appointment } from "../models/Appointment.js";
import { Patient } from "../models/Patient.js";
import {
  createCalendarEvent,
  deleteCalendarEvent,
  updateCalendarEvent,
} from "../services/googleCalendarService.js";
import { connectMongo } from "../services/mongoService.js";
import { parseCalendarCommand, isAnthropicConfigured } from "../services/claudeService.js";
import {
  addMinutesToTime,
  checkConflict,
} from "./utils/conflictDetection.js";

function log(action, message, metadata) {
  const suffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
  console.log(`[MedFlow][CalendarAgent][${action}] ${message}${suffix}`);
}

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function buildScheduleSnapshotForPrompt() {
  try {
    await connectMongo();
  } catch {
    return "(Could not connect to MedFlow to load appointments.)";
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const startIso = today.toISOString().slice(0, 10);

  const appointments = await Appointment.find({ date: { $gte: startIso } })
    .populate("patientId")
    .sort({ date: 1, time: 1 })
    .limit(250)
    .lean();

  if (!appointments.length) {
    return "No upcoming appointments from today onward in MedFlow.";
  }

  const header = "appointmentId\tdate\ttime\tpatient\ttype\tstatus";
  const rows = appointments.map((a) => {
    const name = a.patientId?.name || "Unknown";
    return `${String(a._id)}\t${a.date}\t${a.time}\t${name}\t${a.type}\t${a.status}`;
  });

  return `${header}\n${rows.join("\n")}`;
}

function formatTime(time) {
  const [hour, minute] = String(time).split(":").map(Number);
  const date = new Date();
  date.setHours(hour || 0, minute || 0, 0, 0);
  return date.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

function formatDate(date) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function normalizeParsedCommand(parsed = {}) {
  return {
    intent: parsed.intent || null,
    patientName: parsed.patientName || null,
    date: parsed.date || null,
    time: parsed.time || null,
    duration: Number(parsed.duration || 30),
    type: parsed.type || null,
    appointmentId: parsed.appointmentId || null,
    queryType: parsed.queryType || null,
    confirmationMessage: parsed.confirmationMessage || null,
  };
}

async function parseCommand(command, scheduleSnapshot, conversationHistory) {
  let parsedObj = null;
  try {
    parsedObj = await parseCalendarCommand(command, {
      scheduleSnapshot,
      conversationHistory: conversationHistory || [],
    });
  } catch (err) {
    log("Parse", "Claude calendar parse threw", { error: err?.message || String(err) });
  }

  if (parsedObj && typeof parsedObj === "object") {
    return {
      ok: true,
      data: normalizeParsedCommand(parsedObj),
      rawOutput: JSON.stringify(parsedObj),
    };
  }

  return {
    ok: false,
    error: {
      code: "CALENDAR_PARSE_FAILED",
      message: "Unable to parse calendar command.",
      details: "Claude did not return usable structured data.",
      rawOutput: "",
    },
  };
}

async function findPatientByName(patientName) {
  if (!patientName) return null;

  return Patient.findOne({
    name: new RegExp(escapeRegex(patientName), "i"),
  });
}

async function findAppointment(parsed) {
  if (parsed.appointmentId) {
    const byId = await Appointment.findById(parsed.appointmentId).populate("patientId");
    if (byId) return byId;
  }

  if (!parsed.patientName) return null;
  const patient = await findPatientByName(parsed.patientName);
  if (!patient) return null;

  const filter = { patientId: patient._id };
  if (parsed.date) filter.date = parsed.date;

  return Appointment.findOne(filter)
    .populate("patientId")
    .sort({ date: 1, time: 1 });
}

async function handleCreate(parsed, doctorName) {
  if (!parsed.patientName || !parsed.date || !parsed.time || !parsed.type) {
    return {
      ok: false,
      error: {
        code: "INCOMPLETE_CREATE_COMMAND",
        message: "Please include a patient, date, time, and appointment type.",
      },
    };
  }

  const patient = await findPatientByName(parsed.patientName);
  if (!patient) {
    return {
      ok: false,
      error: {
        code: "PATIENT_NOT_FOUND",
        message: `Patient ${parsed.patientName} not found. Please add them to MedFlow first.`,
      },
    };
  }

  const sameDayAppointments = await Appointment.find({ date: parsed.date })
    .populate("patientId")
    .sort({ time: 1 });
  const conflict = checkConflict(
    sameDayAppointments,
    parsed.date,
    parsed.time,
    parsed.duration,
  );

  if (conflict.hasConflict) {
    const nextSlot = addMinutesToTime(
      conflict.conflictingAppointment.time,
      conflict.conflictingAppointment.duration || 30,
    );
    const conflictingPatient =
      conflict.conflictingAppointment.patientId?.name || "another patient";

    return {
      ok: false,
      error: {
        code: "APPOINTMENT_CONFLICT",
        message: `You already have ${conflictingPatient} at ${formatTime(conflict.conflictingAppointment.time)}. Would you like to schedule at ${formatTime(nextSlot)} instead?`,
        conflictingAppointment: conflict.conflictingAppointment,
        nextAvailableSlot: nextSlot,
      },
    };
  }

  let appointment;
  try {
    appointment = await Appointment.create({
      patientId: patient._id,
      doctorName: doctorName || "Doctor",
      date: parsed.date,
      time: parsed.time,
      duration: parsed.duration,
      type: parsed.type,
      status: "upcoming",
    });
    await appointment.populate("patientId");
    log("MongoDB", `Appointment created. ID: ${appointment._id}`);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_CREATE_FAILED",
        message: "Could not save appointment to MongoDB.",
        details: error.message,
      },
    };
  }

  const { eventId: calendarEventId, warning: createCalendarWarning } = await createCalendarEvent(appointment);
  const warnings = [];

  if (calendarEventId) {
    appointment.googleCalendarEventId = calendarEventId;
    await appointment.save();
    log("GoogleCalendar", `Event synced. Calendar ID: ${calendarEventId}`);
  } else {
    log("GoogleCalendar", "Calendar sync failed after MongoDB save");
  }
  if (createCalendarWarning) warnings.push(createCalendarWarning);

  return {
    ok: true,
    data: {
      appointment,
      calendarEventId,
      mutatedSchedule: true,
      confirmationMessage:
        parsed.confirmationMessage ||
        `Got it. Scheduled ${patient.name} for a ${parsed.type} on ${formatDate(parsed.date)} at ${formatTime(parsed.time)}.`,
      warnings,
    },
  };
}

async function handleUpdate(parsed) {
  const appointment = await findAppointment(parsed);
  if (!appointment) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_NOT_FOUND",
        message: "I could not find the appointment to update.",
      },
    };
  }

  if (parsed.date) appointment.date = parsed.date;
  if (parsed.time) appointment.time = parsed.time;
  if (parsed.duration) appointment.duration = parsed.duration;
  if (parsed.type) appointment.type = parsed.type;

  try {
    await appointment.save();
    await appointment.populate("patientId");
    log("MongoDB", `Appointment updated. ID: ${appointment._id}`);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_UPDATE_FAILED",
        message: "Could not update appointment in MongoDB.",
        details: error.message,
      },
    };
  }

  const { eventId: syncedEventId, warning: updateCalendarWarning } = await updateCalendarEvent(appointment);
  const warnings = [];

  if (syncedEventId) {
    log("GoogleCalendar", `Event updated. Calendar ID: ${syncedEventId}`);
  } else if (appointment.googleCalendarEventId) {
    log("GoogleCalendar", "Calendar update failed after MongoDB update");
  }
  if (updateCalendarWarning) warnings.push(updateCalendarWarning);

  return {
    ok: true,
    data: {
      appointment,
      calendarEventId: syncedEventId,
      mutatedSchedule: true,
      confirmationMessage:
        parsed.confirmationMessage ||
        `Updated ${appointment.patientId?.name || "the patient"} for ${formatDate(appointment.date)} at ${formatTime(appointment.time)}.`,
      warnings,
    },
  };
}

async function handleDelete(parsed) {
  const appointment = await findAppointment(parsed);
  if (!appointment) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_NOT_FOUND",
        message: "I could not find the appointment to delete.",
      },
    };
  }

  const calendarEventId = appointment.googleCalendarEventId;
  const patientName = appointment.patientId?.name || parsed.patientName || "the patient";

  try {
    await Appointment.findByIdAndDelete(appointment._id);
    log("MongoDB", `Appointment deleted. ID: ${appointment._id}`);
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "APPOINTMENT_DELETE_FAILED",
        message: "Could not delete appointment from MongoDB.",
        details: error.message,
      },
    };
  }

  const { warning: deleteCalendarWarning } = await deleteCalendarEvent(calendarEventId);
  const warnings = [];
  if (deleteCalendarWarning) warnings.push(deleteCalendarWarning);

  return {
    ok: true,
    data: {
      appointmentId: appointment._id,
      mutatedSchedule: true,
      confirmationMessage:
        parsed.confirmationMessage ||
        `Deleted ${patientName}'s appointment from MedFlow.`,
      warnings,
    },
  };
}

function startOfWeek(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  const day = date.getDay();
  date.setDate(date.getDate() - day);
  return date;
}

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function readableAppointmentList(appointments, prefix) {
  if (!appointments.length) return `${prefix}: no appointments found.`;

  const items = appointments
    .map((appointment) => `${appointment.patientId?.name || "Patient"} at ${formatTime(appointment.time)}`)
    .join(", ");
  return `${prefix}: ${items}`;
}

async function handleQuery(parsed) {
  if (parsed.queryType === "patient") {
    const patient = await findPatientByName(parsed.patientName);
    if (!patient) {
      return {
        ok: false,
        error: {
          code: "PATIENT_NOT_FOUND",
          message: `Patient ${parsed.patientName} not found. Please add them to MedFlow first.`,
        },
      };
    }

    const appointment = await Appointment.findOne({
      patientId: patient._id,
      status: { $ne: "completed" },
    })
      .populate("patientId")
      .sort({ date: 1, time: 1 });

    return {
      ok: true,
      data: {
        appointments: appointment ? [appointment] : [],
        mutatedSchedule: false,
        confirmationMessage:
          parsed.confirmationMessage?.trim() ||
          (appointment
            ? `${patient.name}'s next appointment is ${formatDate(appointment.date)} at ${formatTime(appointment.time)}.`
            : `${patient.name} has no upcoming appointments.`),
      },
    };
  }

  const date = parsed.date || toIsoDate(new Date());
  let appointments = [];
  let messagePrefix = `You have appointments on ${formatDate(date)}`;

  if (parsed.queryType === "week") {
    const start = startOfWeek(date);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    appointments = await Appointment.find({
      date: { $gte: toIsoDate(start), $lte: toIsoDate(end) },
    })
      .populate("patientId")
      .sort({ date: 1, time: 1 });
    messagePrefix = `You have ${appointments.length} appointments this week`;
  } else {
    appointments = await Appointment.find({ date })
      .populate("patientId")
      .sort({ time: 1 });
    messagePrefix = `You have ${appointments.length} appointments on ${formatDate(date)}`;
  }

  return {
    ok: true,
    data: {
      appointments,
      mutatedSchedule: false,
      confirmationMessage:
        parsed.confirmationMessage?.trim() ||
        readableAppointmentList(appointments, messagePrefix),
    },
  };
}

function handleChat(parsed) {
  return {
    ok: true,
    data: {
      appointments: [],
      mutatedSchedule: false,
      confirmationMessage:
        parsed.confirmationMessage?.trim() ||
        "I'm here to help with scheduling — ask what's on your calendar or say who to book and when.",
      warnings: [],
    },
  };
}

/**
 * Parses and executes a natural language calendar management command.
 *
 * @param {string} command Natural language scheduling command from a doctor.
 * @param {{ doctorName?: string, conversationHistory?: { role: string, content: string }[] }} options Execution context.
 * @returns {Promise<{ok: boolean, data?: object, error?: object}>}
 */
export async function runCalendarAgent(command, options = {}) {
  if (!command?.trim()) {
    return {
      ok: false,
      error: { code: "COMMAND_REQUIRED", message: "Calendar command is required." },
    };
  }

  if (!isAnthropicConfigured()) {
    return {
      ok: false,
      error: {
        code: "ANTHROPIC_NOT_CONFIGURED",
        message:
          "The calendar AI agent requires ANTHROPIC_API_KEY in the MedFlow backend environment. Add it to backend/.env and restart the API server.",
      },
    };
  }

  log("Parse", `Command received: "${command}"`);

  try {
    await connectMongo();
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "MONGODB_CONNECTION_FAILED",
        message: "Unable to connect to MongoDB.",
        details: error.message,
      },
    };
  }

  const scheduleSnapshot = await buildScheduleSnapshotForPrompt();

  const parsedResult = await parseCommand(
    command,
    scheduleSnapshot,
    options.conversationHistory || [],
  );
  if (!parsedResult.ok) return parsedResult;

  const parsed = parsedResult.data;
  log(
    "Parse",
    `Intent: ${parsed.intent}. Patient: ${parsed.patientName}. Date: ${parsed.date}. Time: ${parsed.time}`,
  );

  switch (parsed.intent) {
    case "create":
      return handleCreate(parsed, options.doctorName);
    case "update":
      return handleUpdate(parsed);
    case "delete":
      return handleDelete(parsed);
    case "query":
      return handleQuery(parsed);
    case "chat":
      return handleChat(parsed);
    default:
      return {
        ok: false,
        error: {
          code: "UNSUPPORTED_CALENDAR_INTENT",
          message:
            "Please ask me to schedule, reschedule, cancel, look up appointments, or chat about your calendar.",
          parsed,
        },
      };
  }
}
