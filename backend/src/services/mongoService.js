import mongoose from "mongoose";
import { AgentRun } from "../models/AgentRun.js";
import { Appointment } from "../models/Appointment.js";
import { Note } from "../models/Note.js";
import { Patient } from "../models/Patient.js";

let connectionPromise;

export async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    throw new Error("MONGODB_URI is not configured");
  }

  if (mongoose.connection.readyState === 1) {
    return mongoose.connection;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        dbName: process.env.MONGODB_DATABASE || "medflow",
        family: 4,
        retryWrites: true,
        serverSelectionTimeoutMS: 15000,
      })
      .catch((err) => {
        connectionPromise = null;
        throw err;
      });
  }

  await connectionPromise;
  return mongoose.connection;
}

export function serializeDocument(document) {
  if (!document) return null;
  const raw = typeof document.toObject === "function" ? document.toObject() : document;
  return JSON.parse(JSON.stringify(raw));
}

export function serializeDocuments(documents = []) {
  return documents.map(serializeDocument);
}

export function toMongoError(error, message) {
  return {
    code: "MONGODB_ERROR",
    message,
    details: error.message,
  };
}

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function upsertPatient(patient = {}, userId = null) {
  try {
    await connectMongo();
    const patientId = patient.patientId || patient.patient_id || patient.id;

    if (patientId && mongoose.isValidObjectId(patientId)) {
      const filter = { _id: patientId };
      if (userId) filter.userId = userId;
      const updated = await Patient.findOneAndUpdate(
        filter,
        {
          name: patient.name,
          dob: patient.dob,
          contact: patient.contact,
          insurance: patient.insurance,
        },
        { new: true, upsert: false },
      );
      if (!updated) {
        return { ok: false, error: { code: "PATIENT_NOT_FOUND", message: "Patient not found." } };
      }
      return { ok: true, data: serializeDocument(updated) };
    }

    if (!patient.name?.trim?.()) {
      return {
        ok: false,
        error: {
          code: "PATIENT_NAME_REQUIRED",
          message: "Patient name is required.",
        },
      };
    }

    const nameFilter = { name: new RegExp(`^${escapeRegex(patient.name.trim())}$`, "i") };
    if (userId) nameFilter.userId = userId;

    const setOnInsert = userId ? { userId } : {};

    const updated = await Patient.findOneAndUpdate(
      nameFilter,
      {
        $set: {
          name: patient.name.trim(),
          dob: patient.dob || "",
          contact: patient.contact || "",
          insurance: patient.insurance || "",
        },
        $setOnInsert: setOnInsert,
      },
      { new: true, upsert: true, setDefaultsOnInsert: true, runValidators: true },
    );

    return { ok: true, data: serializeDocument(updated) };
  } catch (error) {
    return { ok: false, error: toMongoError(error, "Unable to upsert patient.") };
  }
}

export async function getPatient(patientId) {
  try {
    await connectMongo();
    const patient = await Patient.findById(patientId);
    return { ok: true, data: serializeDocument(patient) };
  } catch (error) {
    return { ok: false, error: toMongoError(error, "Unable to fetch patient.") };
  }
}

export async function upsertAppointment(appointment = {}) {
  try {
    await connectMongo();
    const appointmentId =
      appointment.appointmentId || appointment.appointment_id || appointment.id;

    if (!appointmentId || !mongoose.isValidObjectId(appointmentId)) {
      return { ok: true, data: null };
    }

    const updated = await Appointment.findByIdAndUpdate(
      appointmentId,
      {
        patientId: appointment.patientId || appointment.patient_id,
        doctorName: appointment.doctorName,
        date: appointment.date,
        time: appointment.time,
        type: appointment.type,
        status: appointment.status,
      },
      { new: true, setDefaultsOnInsert: true },
    ).populate("patientId");

    return { ok: true, data: serializeDocument(updated) };
  } catch (error) {
    return {
      ok: false,
      error: toMongoError(error, "Unable to upsert appointment."),
    };
  }
}

export async function saveClinicalNote({
  patient_id,
  patientId,
  appointment_id = null,
  appointmentId = null,
  userId = null,
  transcript,
  rawTranscript = null,
  soap_note,
  soapNote,
  tags = [],
  summary = "",
  followUpRequired = false,
  followUpTimeframe = null,
  flagged = false,
  flagReason = null,
  incomplete = false,
}) {
  try {
    await connectMongo();
    const note = await Note.create({
      patientId: patientId || patient_id,
      appointmentId: appointmentId || appointment_id || null,
      userId: userId || null,
      transcript,
      rawTranscript: rawTranscript || null,
      soapNote: soapNote || soap_note,
      tags,
      summary,
      followUpRequired,
      followUpTimeframe,
      flagged,
      flagReason,
      incomplete,
    });

    await note.populate(["patientId", "appointmentId"]);
    return { ok: true, data: serializeDocument(note) };
  } catch (error) {
    return {
      ok: false,
      error: toMongoError(error, "Unable to save clinical note."),
    };
  }
}

export async function getNotesByPatientId(patientId, limit = 20) {
  try {
    await connectMongo();
    const documents = await Note.find({ patientId })
      .populate("patientId")
      .populate("appointmentId")
      .sort({ createdAt: -1 })
      .limit(Number(limit));

    return { ok: true, data: serializeDocuments(documents) };
  } catch (error) {
    return {
      ok: false,
      error: toMongoError(error, "Unable to fetch patient notes."),
    };
  }
}

export async function getPatientContext(patientId) {
  try {
    const [patientResult, notesResult] = await Promise.all([
      getPatient(patientId),
      getNotesByPatientId(patientId, 5),
    ]);

    if (!patientResult.ok) return patientResult;
    if (!notesResult.ok) return notesResult;

    return {
      ok: true,
      data: {
        patient: patientResult.data,
        recent_notes: notesResult.data,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: toMongoError(error, "Unable to build patient context."),
    };
  }
}

export async function saveAgentRun({
  patient_id,
  appointment_id,
  input_type,
  transcript = null,
  output = null,
  status,
  error = null,
}) {
  try {
    await connectMongo();

    const patientId =
      patient_id && mongoose.isValidObjectId(String(patient_id))
        ? String(patient_id)
        : null;
    const appointmentId =
      appointment_id && mongoose.isValidObjectId(String(appointment_id))
        ? String(appointment_id)
        : null;

    const doc = await AgentRun.create({
      patientId,
      appointmentId,
      inputType: input_type,
      transcript: transcript ?? null,
      outputSnapshot: output ?? null,
      status,
      errorSnapshot: error ?? null,
    });

    return { ok: true, data: serializeDocument(doc) };
  } catch (err) {
    return {
      ok: false,
      error: toMongoError(err, "Unable to save agent run."),
    };
  }
}

export async function closeMongoConnection() {
  await mongoose.connection.close();
  connectionPromise = null;
}
