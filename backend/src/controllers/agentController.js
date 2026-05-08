import {
  processAudioSession,
  processTranscriptSession,
} from "../agents/clinicalDocumentationAgent.js";
import { getNotesByPatientId, getPatientContext } from "../services/mongoService.js";
import { sendError, sendSuccess } from "../utils/http.js";

// HTTP controller for the Claude + MongoDB MedFlow clinical documentation agent.

function patientIdFromBody(body) {
  return body.patient_id || body.patientId || body.patient?.patient_id || body.patient?.patientId;
}

function appointmentIdFromBody(body) {
  return (
    body.appointment_id ||
    body.appointmentId ||
    body.appointment?.appointment_id ||
    body.appointment?.appointmentId ||
    null
  );
}

export function validateAgentAudioUpload(req, res, next) {
  if (!req.file?.buffer?.length) {
    return sendError(res, 400, {
      code: "AUDIO_FILE_REQUIRED",
      message: "Audio sessions require a file attached as the 'audio' field.",
    });
  }

  if (!patientIdFromBody(req.body)?.trim?.()) {
    return sendError(res, 400, {
      code: "PATIENT_ID_REQUIRED",
      message: "patient_id is required.",
    });
  }

  return next();
}

export function validateAgentTranscript(req, res, next) {
  if (!req.body?.transcript?.trim?.()) {
    return sendError(res, 400, {
      code: "TRANSCRIPT_REQUIRED",
      message: "A non-empty transcript string is required.",
    });
  }

  if (!patientIdFromBody(req.body)?.trim?.()) {
    return sendError(res, 400, {
      code: "PATIENT_ID_REQUIRED",
      message: "patient_id is required.",
    });
  }

  return next();
}

export function validatePatientIdParam(req, res, next) {
  if (!req.params?.patientId?.trim?.()) {
    return sendError(res, 400, {
      code: "PATIENT_ID_PARAM_REQUIRED",
      message: "A non-empty patientId parameter is required.",
    });
  }

  return next();
}

function parseJsonField(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;

  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export async function runAudioAgent(req, res) {
  const result = await processAudioSession({
    audioBuffer: req.file.buffer,
    mimetype: req.file.mimetype,
    patient_id: patientIdFromBody(req.body),
    appointment_id: appointmentIdFromBody(req.body),
    patient: parseJsonField(req.body.patient),
    appointment: parseJsonField(req.body.appointment),
  });

  if (!result.ok) {
    return sendError(res, 502, result.error);
  }

  return sendSuccess(res, result.data, 201);
}

export async function runTranscriptAgent(req, res) {
  const result = await processTranscriptSession({
    transcript: req.body.transcript.trim(),
    patient_id: patientIdFromBody(req.body),
    appointment_id: appointmentIdFromBody(req.body),
    patient: req.body.patient || {},
    appointment: req.body.appointment || {},
  });

  if (!result.ok) {
    return sendError(res, 502, result.error);
  }

  return sendSuccess(res, result.data, 201);
}

export async function getPatientMemory(req, res) {
  const result = await getPatientContext(req.params.patientId.trim());

  if (!result.ok) {
    return sendError(res, 502, result.error);
  }

  return sendSuccess(res, result.data, 200);
}

export async function getPatientNotes(req, res) {
  const result = await getNotesByPatientId(req.params.patientId.trim());

  if (!result.ok) {
    return sendError(res, 502, result.error);
  }

  return sendSuccess(
    res,
    {
      notes: result.data,
    },
    200,
  );
}
