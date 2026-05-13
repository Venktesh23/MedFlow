import mongoose from "mongoose";
import { Appointment } from "../models/Appointment.js";
import {
  getPatientContext,
  saveAgentRun,
  saveClinicalNote,
  upsertAppointment,
  upsertPatient,
} from "../services/mongoService.js";
import { runNoteGenerationAgent } from "./noteGenerationAgent.js";
import { runTranscriptionAgent } from "./transcriptionAgent.js";
import {
  cleanVisitTranscript,
  normalizeTranscriptWhitespace,
} from "../services/claudeService.js";

// End-to-end MedFlow agent: patient memory + transcription + SOAP generation + persistence.
function stringifyPatientContext(context) {
  if (!context?.patient && !context?.recent_notes?.length) {
    return "";
  }

  return JSON.stringify(
    {
      patient: context.patient || null,
      recent_notes: context.recent_notes || [],
    },
    null,
    2,
  );
}

function normalizePatientPayload({ patient_id, patient = {} }) {
  return {
    ...patient,
    patient_id: patient_id || patient.patient_id || patient.patientId,
  };
}

async function ensureClinicalRecords({
  patient_id,
  patient,
  appointment,
  appointment_id,
  userId = null,
}) {
  const patientResult = await upsertPatient(
    normalizePatientPayload({ patient_id, patient }),
    userId,
  );

  if (!patientResult.ok) return patientResult;

  const appointmentResult = await upsertAppointment({
    ...appointment,
    appointment_id:
      appointment_id || appointment?.appointment_id || appointment?.appointmentId,
    patient_id,
  });

  if (!appointmentResult.ok) return appointmentResult;

  return {
    ok: true,
    data: {
      patient: patientResult.data,
      appointment: appointmentResult.data,
    },
  };
}

function soapNotePayload(generatedNote) {
  return {
    subjective: generatedNote.subjective,
    objective: generatedNote.objective,
    assessment: generatedNote.assessment,
    plan: generatedNote.plan,
  };
}

function transcriptWordCount(transcript = "") {
  return String(transcript).trim().split(/\s+/).filter(Boolean).length;
}

async function generateAndPersist({
  transcript,
  patient_id,
  appointment_id,
  patient,
  appointment,
  input_type,
  userId = null,
  source_metadata = {},
}) {
  const rawTranscript = normalizeTranscriptWhitespace(transcript);

  if (transcriptWordCount(rawTranscript) < 20) {
    const error = {
      code: "TRANSCRIPT_TOO_SHORT",
      message: "Transcript is too short to generate clinical documentation.",
      details: "Provide a longer, speaker-labeled transcript.",
    };

    await saveAgentRun({
      patient_id,
      appointment_id,
      input_type,
      transcript: rawTranscript,
      output: null,
      status: "failed",
      error,
    });

    return { ok: false, error };
  }

  let cleanedTranscript = rawTranscript;
  try {
    const cleaned = await cleanVisitTranscript(rawTranscript);
    if (cleaned) cleanedTranscript = cleaned;
  } catch {
    cleanedTranscript = rawTranscript;
  }

  const recordsResult = await ensureClinicalRecords({
    patient_id,
    appointment_id,
    patient,
    appointment,
    userId,
  });

  if (!recordsResult.ok) {
    await saveAgentRun({
      patient_id,
      appointment_id,
      input_type,
      transcript: rawTranscript,
      output: null,
      status: "failed",
      error: recordsResult.error,
    });
    return recordsResult;
  }

  const contextResult = await getPatientContext(patient_id);

  if (!contextResult.ok) {
    await saveAgentRun({
      patient_id,
      appointment_id,
      input_type,
      transcript: rawTranscript,
      output: null,
      status: "failed",
      error: contextResult.error,
    });
    return contextResult;
  }

  const soapResult = await runNoteGenerationAgent(cleanedTranscript, {
    patientContext: stringifyPatientContext(contextResult.data),
  });

  if (!soapResult.ok) {
    await saveAgentRun({
      patient_id,
      appointment_id,
      input_type,
      transcript: rawTranscript,
      output: null,
      status: "failed",
      error: soapResult.error,
    });
    return soapResult;
  }

  const saveResult = await saveClinicalNote({
    patient_id,
    appointment_id,
    userId,
    transcript: cleanedTranscript,
    rawTranscript:
      cleanedTranscript !== rawTranscript ? rawTranscript : null,
    soap_note: soapNotePayload(soapResult.data),
    tags: soapResult.data.tags,
    summary: soapResult.data.summary,
    followUpRequired: soapResult.data.followUpRequired,
    followUpTimeframe: soapResult.data.followUpTimeframe,
    flagged: soapResult.data.flagged,
    flagReason: soapResult.data.flagReason,
    incomplete: soapResult.data.incomplete,
  });

  if (!saveResult.ok) {
    await saveAgentRun({
      patient_id,
      appointment_id,
      input_type,
      transcript: rawTranscript,
      output: soapResult.data,
      status: "failed",
      error: saveResult.error,
    });
    return saveResult;
  }

  if (appointment_id && mongoose.isValidObjectId(String(appointment_id))) {
    try {
      await Appointment.findByIdAndUpdate(appointment_id, { status: "completed" });
    } catch {
      /* non-fatal */
    }
  }

  const output = {
    patient: recordsResult.data.patient,
    appointment: recordsResult.data.appointment,
    note: saveResult.data,
    soap_note: soapNotePayload(soapResult.data),
    soapNote: soapNotePayload(soapResult.data),
    tags: soapResult.data.tags,
    summary: soapResult.data.summary,
    followUpRequired: soapResult.data.followUpRequired,
    followUpTimeframe: soapResult.data.followUpTimeframe,
    flagged: soapResult.data.flagged,
    flagReason: soapResult.data.flagReason,
    incomplete: soapResult.data.incomplete,
    transcript: cleanedTranscript,
    rawTranscript,
    transcriptCleaned: cleanedTranscript !== rawTranscript,
    warning: soapResult.warning || null,
  };

  await saveAgentRun({
    patient_id,
    appointment_id,
    input_type,
    transcript: cleanedTranscript,
    output,
    status: "completed",
  });

  return {
    ok: true,
    data: output,
  };
}

/**
 * Processes an already captured clinical transcript into a persisted SOAP note.
 *
 * @param {object} params Session payload.
 * @param {string} params.transcript Speaker-labeled or raw clinical transcript.
 * @param {string} params.patient_id MongoDB patient identifier.
 * @param {string|null} [params.appointment_id] Optional MongoDB appointment identifier.
 * @param {object} [params.patient] Optional patient metadata.
 * @param {object} [params.appointment] Optional appointment metadata.
 * @returns {Promise<{ok: boolean, data?: object, error?: object}>}
 */
export async function processTranscriptSession({
  transcript,
  patient_id,
  appointment_id = null,
  patient = {},
  appointment = {},
  userId = null,
}) {
  return generateAndPersist({
    transcript,
    patient_id,
    appointment_id,
    patient,
    appointment,
    input_type: "transcript",
    userId,
  });
}

/**
 * Transcribes clinical audio, generates a SOAP note, and persists the full result.
 *
 * @param {object} params Audio session payload.
 * @param {Buffer} params.audioBuffer Raw uploaded audio buffer.
 * @param {string} [params.mimetype] Audio MIME type.
 * @param {string} params.patient_id MongoDB patient identifier.
 * @param {string|null} [params.appointment_id] Optional MongoDB appointment identifier.
 * @param {object} [params.patient] Optional patient metadata.
 * @param {object} [params.appointment] Optional appointment metadata.
 * @returns {Promise<{ok: boolean, data?: object, error?: object}>}
 */
export async function processAudioSession({
  audioBuffer,
  mimetype,
  patient_id,
  appointment_id = null,
  patient = {},
  appointment = {},
  userId = null,
}) {
  const transcriptionResult = await runTranscriptionAgent(audioBuffer, {
    mimetype,
  });

  if (!transcriptionResult.ok) {
    await saveAgentRun({
      patient_id,
      appointment_id,
      input_type: "audio",
      transcript: null,
      output: null,
      status: "failed",
      error: transcriptionResult.error,
    });
    return transcriptionResult;
  }

  return generateAndPersist({
    transcript: transcriptionResult.data.transcript,
    patient_id,
    appointment_id,
    patient,
    appointment,
    input_type: "audio",
    userId,
    source_metadata: {
      audio_mimetype: mimetype,
    },
  });
}
