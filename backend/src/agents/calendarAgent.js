import { Appointment } from "../models/Appointment.js";
import { Note } from "../models/Note.js";
import { Patient } from "../models/Patient.js";
import { connectMongo, upsertPatient } from "../services/mongoService.js";
import { parseCalendarCommand, isAnthropicConfigured } from "../services/claudeService.js";
import { addMinutesToTime, checkConflict } from "./utils/conflictDetection.js";

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

const CANONICAL_VISIT_TYPES = new Set([
  "follow-up",
  "new-visit",
  "lab-review",
  "annual-physical",
  "consultation",
]);

/** Map LLM or casual wording to a canonical MedFlow visit type, or null. */
function mapLooseVisitType(raw) {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (CANONICAL_VISIT_TYPES.has(t)) return t;
  const s = raw.trim();
  if (/follow[\s-]?up/i.test(s)) return "follow-up";
  if (/new\s*patient|initial|first\s*visit/i.test(s)) return "new-visit";
  if (/lab\b/i.test(s)) return "lab-review";
  if (/annual|physical|wellness|checkup/i.test(s)) return "annual-physical";
  if (/consult|visit|appointment|check[\s-]?in/i.test(s)) return "consultation";
  return null;
}

/**
 * Normalize visit type and default to consultation when patient, date, and time are present.
 */
function applyCreateIntentDefaults(parsed) {
  const out = { ...parsed };
  const rawType = out.type != null ? String(out.type).trim() : "";

  if (rawType && CANONICAL_VISIT_TYPES.has(rawType)) {
    out.type = rawType;
  } else {
    out.type = mapLooseVisitType(rawType);
  }

  const hasPatient = Boolean(out.patientName?.trim());
  const hasDate = Boolean(String(out.date || "").trim());
  const hasTime = Boolean(String(out.time || "").trim());

  if (hasPatient && hasDate && hasTime && !out.type) {
    out.type = "consultation";
    log("Parse", "Defaulted visit type to consultation (not specified in message)");
  }

  return out;
}

function missingCreateFields(parsed) {
  const missing = [];
  if (!parsed.patientName?.trim()) missing.push("patient name");
  if (!String(parsed.date || "").trim()) missing.push("date");
  if (!String(parsed.time || "").trim()) missing.push("time");
  return missing;
}

async function buildNotesSnapshotForPrompt() {
  try {
    await connectMongo();
    const notes = await Note.find({})
      .populate("patientId")
      .sort({ createdAt: -1 })
      .limit(35)
      .lean();

    if (!notes.length) {
      return "(No clinical notes stored yet.)";
    }

    const header = "patient\tdate\tassessment_excerpt";
    const rows = notes.map((n) => {
      const name = n.patientId?.name || "Unknown";
      const date =
        n.createdAt != null ? new Date(n.createdAt).toISOString().slice(0, 10) : "";
      const assess = String(n.soapNote?.assessment || n.summary || "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200);
      return `${name}\t${date}\t${assess}`;
    });

    return `${header}\n${rows.join("\n")}`;
  } catch {
    return "(Could not load notes.)";
  }
}

async function parseCommand(command, scheduleSnapshot, conversationHistory, parseOptions = {}) {
  let parsedObj = null;
  try {
    parsedObj = await parseCalendarCommand(command, {
      scheduleSnapshot,
      conversationHistory: conversationHistory || [],
      interactionMode: parseOptions.interactionMode || "chat_assistant",
      notesSnapshot: parseOptions.notesSnapshot,
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
  parsed = applyCreateIntentDefaults(parsed);

  const missing = missingCreateFields(parsed);
  if (missing.length > 0) {
    return {
      ok: false,
      error: {
        code: "INCOMPLETE_CREATE_COMMAND",
        message: `I could not understand: ${missing.join(", ")}. Please repeat your request and say ${missing.join(", ")} clearly, or type them explicitly (e.g. patient name, date, time).`,
      },
    };
  }

  if (!parsed.type) {
    parsed.type = "consultation";
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
        message: `That time overlaps an existing visit (${conflictingPatient} at ${formatTime(conflict.conflictingAppointment.time)}). Only one appointment can run at a time — try ${formatTime(nextSlot)} or another slot.`,
        conflictingAppointment: conflict.conflictingAppointment,
        nextAvailableSlot: nextSlot,
      },
    };
  }

  let patient = await findPatientByName(parsed.patientName);
  if (!patient) {
    const upsert = await upsertPatient({
      name: parsed.patientName.trim(),
      dob: "",
      contact: "",
      insurance: "",
    });
    if (!upsert.ok) {
      return { ok: false, error: upsert.error };
    }
    patient = await Patient.findById(upsert.data._id);
    if (!patient) {
      return {
        ok: false,
        error: {
          code: "PATIENT_CREATE_FAILED",
          message: "Could not create or load patient profile for this appointment.",
        },
      };
    }
    log("MongoDB", `Patient profile matched or created for appointment: ${parsed.patientName}`);
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

  let confirmationMessage =
    parsed.confirmationMessage ||
    `Got it. Scheduled ${patient.name} for a ${parsed.type} on ${formatDate(parsed.date)} at ${formatTime(parsed.time)}.`;

  return {
    ok: true,
    data: {
      appointment,
      mutatedSchedule: true,
      confirmationMessage,
      warnings: [],
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

  const proposedDate = parsed.date ?? appointment.date;
  const proposedTime = parsed.time ?? appointment.time;
  const proposedDuration = parsed.duration ?? appointment.duration;

  const sameDayForOverlap = await Appointment.find({ date: proposedDate })
    .populate("patientId")
    .sort({ time: 1 });

  const othersSameDay = sameDayForOverlap.filter(
    (a) => String(a._id) !== String(appointment._id),
  );

  const conflict = checkConflict(
    othersSameDay,
    proposedDate,
    proposedTime,
    proposedDuration,
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
        message: `That time overlaps ${conflictingPatient} at ${formatTime(conflict.conflictingAppointment.time)}. Only one appointment can run at a time — try ${formatTime(nextSlot)} or another slot.`,
        conflictingAppointment: conflict.conflictingAppointment,
        nextAvailableSlot: nextSlot,
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

  return {
    ok: true,
    data: {
      appointment,
      mutatedSchedule: true,
      confirmationMessage:
        parsed.confirmationMessage ||
        `Updated ${appointment.patientId?.name || "the patient"} for ${formatDate(appointment.date)} at ${formatTime(appointment.time)}.`,
      warnings: [],
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

  return {
    ok: true,
    data: {
      appointmentId: appointment._id,
      mutatedSchedule: true,
      confirmationMessage:
        parsed.confirmationMessage ||
        `Deleted ${patientName}'s appointment from MedFlow.`,
      warnings: [],
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
 * @param {string} command Natural language scheduling command from a doctor.
 * @param {{ doctorName?: string, conversationHistory?: { role: string, content: string }[], interactionMode?: "voice_calendar" | "chat_assistant" }} options Execution context.
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

  const interactionMode =
    options.interactionMode === "voice_calendar" ? "voice_calendar" : "chat_assistant";

  let notesSnapshot = "";
  if (interactionMode === "chat_assistant") {
    notesSnapshot = await buildNotesSnapshotForPrompt();
  }

  const scheduleSnapshot = await buildScheduleSnapshotForPrompt();

  const parsedResult = await parseCommand(
    command,
    scheduleSnapshot,
    options.conversationHistory || [],
    { interactionMode, notesSnapshot },
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
