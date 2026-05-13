import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import { Note } from "../models/Note.js";
import {
  processAudioSession,
  processTranscriptSession,
} from "../agents/clinicalDocumentationAgent.js";
import { sendError, sendSuccess } from "../utils/http.js";

function bodyIds(body) {
  return {
    patientId: body.patientId || body.patient_id || null,
    appointmentId: body.appointmentId || body.appointment_id || null,
  };
}

/**
 * Session endpoints allow patientId and/or appointmentId. The clinical agent pipeline
 * requires a Mongo patient id for context retrieval and note persistence — resolve it
 * from the appointment when only appointmentId was sent (common from visit sessions).
 */
async function resolveSessionPatientIds({ patientId, appointmentId, userId }) {
  let pid = patientId && String(patientId).trim() ? String(patientId).trim() : null;
  const aid = appointmentId && String(appointmentId).trim() ? String(appointmentId).trim() : null;

  if (!pid && aid && mongoose.isValidObjectId(aid)) {
    const filter = { _id: aid };
    if (userId) filter.userId = userId;
    const appt = await Appointment.findOne(filter).select("patientId").lean();
    if (appt?.patientId) {
      pid = String(appt.patientId);
    }
  }

  return { patientId: pid, appointmentId: aid };
}

export function validateAudioUpload(req, res, next) {
  if (!req.file?.buffer?.length) {
    return sendError(res, 400, {
      code: "AUDIO_FILE_REQUIRED",
      message: "upload-audio requires an audio file attached as the 'audio' field.",
    });
  }

  const { patientId, appointmentId } = bodyIds(req.body);
  if (!patientId && !appointmentId) {
    return sendError(res, 400, {
      code: "SESSION_CONTEXT_REQUIRED",
      message: "patientId or appointmentId is required.",
    });
  }

  return next();
}

export function validateTranscript(req, res, next) {
  const { patientId, appointmentId } = bodyIds(req.body);
  if (!req.body?.transcript?.trim?.()) {
    return sendError(res, 400, {
      code: "TRANSCRIPT_REQUIRED",
      message: "Transcript is required.",
    });
  }

  if (!patientId && !appointmentId) {
    return sendError(res, 400, {
      code: "SESSION_CONTEXT_REQUIRED",
      message: "patientId or appointmentId is required.",
    });
  }

  return next();
}

export function validatePatientId(req, res, next) {
  if (!req.params?.patientId?.trim?.()) {
    return sendError(res, 400, {
      code: "PATIENT_ID_REQUIRED",
      message: "patientId is required.",
    });
  }

  return next();
}

export function validateNoteUpdate(req, res, next) {
  const soapNote = req.body?.soapNote;
  if (!soapNote || typeof soapNote !== "object") {
    return sendError(res, 400, {
      code: "NOTE_PAYLOAD_REQUIRED",
      message: "Structured note content is required.",
    });
  }

  return next();
}

export async function uploadAudio(req, res) {
  const ids = bodyIds(req.body);
  const { patientId, appointmentId } = await resolveSessionPatientIds({ ...ids, userId: req.user._id });

  if (!patientId) {
    return sendError(res, 400, {
      code: "PATIENT_CONTEXT_UNRESOLVED",
      message:
        "Could not determine the patient for this session. Provide patientId, or an appointmentId that exists and links to a patient.",
    });
  }

  const result = await processAudioSession({
    audioBuffer: req.file.buffer,
    mimetype: req.file.mimetype,
    patient_id: patientId,
    appointment_id: appointmentId,
    userId: req.user._id,
  });

  if (!result.ok) {
    return sendError(res, 502, result.error);
  }

  return sendSuccess(res, result.data, 201);
}

export async function submitTranscript(req, res) {
  const ids = bodyIds(req.body);
  const { patientId, appointmentId } = await resolveSessionPatientIds({ ...ids, userId: req.user._id });

  if (!patientId) {
    return sendError(res, 400, {
      code: "PATIENT_CONTEXT_UNRESOLVED",
      message:
        "Could not determine the patient for this session. Provide patientId, or an appointmentId that exists and links to a patient.",
    });
  }

  const result = await processTranscriptSession({
    transcript: req.body.transcript.trim(),
    patient_id: patientId,
    appointment_id: appointmentId,
    userId: req.user._id,
  });

  if (!result.ok) {
    return sendError(res, 502, result.error);
  }

  return sendSuccess(res, result.data, 201);
}

export async function listNotesByPatient(req, res) {
  const notes = await Note.find({ patientId: req.params.patientId, userId: req.user._id })
    .populate("patientId")
    .populate("appointmentId")
    .sort({ createdAt: -1 });

  return sendSuccess(res, { notes });
}

export async function listNotes(req, res) {
  const filter = { userId: req.user._id };
  if (req.query.patientId) filter.patientId = req.query.patientId;
  if (req.query.tag) filter.tags = req.query.tag;

  const notes = await Note.find(filter)
    .populate("patientId")
    .populate("appointmentId")
    .sort({ createdAt: -1 });

  return sendSuccess(res, { notes });
}

export async function updateNote(req, res) {
  const existing = await Note.findOne({ _id: req.params.id, userId: req.user._id });

  if (!existing) {
    return sendError(res, 404, {
      code: "NOTE_NOT_FOUND",
      message: "Note not found.",
    });
  }

  existing.soapNote = {
    subjective: req.body.soapNote.subjective || "",
    objective: req.body.soapNote.objective || "",
    assessment: req.body.soapNote.assessment || "",
    plan: req.body.soapNote.plan || "",
  };
  await existing.save();
  await existing.populate("patientId");
  await existing.populate("appointmentId");

  return sendSuccess(res, { note: existing });
}

export async function deleteNote(req, res) {
  const note = await Note.findOneAndDelete({ _id: req.params.id, userId: req.user._id });

  if (!note) {
    return sendError(res, 404, {
      code: "NOTE_NOT_FOUND",
      message: "Note not found.",
    });
  }

  return sendSuccess(res, { deleted: true, noteId: String(note._id) });
}
