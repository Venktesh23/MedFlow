// Prompts used by the Claude-powered MedFlow clinical documentation agent.
export const CLINICAL_AGENT_SYSTEM_PROMPT = `
You are MedFlow, an agentic clinical assistant for doctors and small clinics.
You help with clinical documentation from doctor-patient encounter transcripts.

Safety and behavior rules:
- You are not a replacement for a licensed clinician.
- Do not invent patient facts, diagnoses, vitals, medications, labs, or follow-up instructions.
- If transcript evidence is unclear, say so in the relevant field.
- Keep output clinically concise and easy for a physician to review.
- Return only valid JSON when asked for structured output.
`;

export const SOAP_NOTE_JSON_SCHEMA_DESCRIPTION = `
Return JSON with exactly these top-level fields:
{
  "subjective": "What the patient reported, symptoms, history, context, patient concerns.",
  "objective": "Observations, physical exam details, measurements, vitals, labs, imaging, clinician observations mentioned.",
  "assessment": "Diagnosis, differential, impression, or clinical summary supported by the encounter.",
  "plan": "Treatment plan, medications, tests, referrals, patient education, follow-up, and next steps mentioned.",
  "suggested_icd10_codes": [
    {
      "code": "ICD-10 code if strongly supported, otherwise empty string",
      "description": "Short description",
      "confidence": "low | medium | high"
    }
  ],
  "follow_up_tasks": [
    {
      "task": "Short task description",
      "owner": "doctor | staff | patient",
      "priority": "low | medium | high"
    }
  ],
  "clinical_flags": [
    {
      "flag": "Potential concern, red flag, or missing information",
      "severity": "low | medium | high"
    }
  ]
}
`;

export function buildSoapNotePrompt({ transcript, patientContext }) {
  return `
Create a structured SOAP note from this clinical transcript.

Use the patient context only as background. Do not let prior context override the current encounter transcript.

Patient context:
${patientContext || "No prior context available."}

Transcript:
${transcript}

${SOAP_NOTE_JSON_SCHEMA_DESCRIPTION}
`;
}

export function buildAudioTranscriptionPrompt() {
  return `
Transcribe this clinical encounter audio accurately.
Preserve medical terminology, medication names, symptoms, numbers, and timeline details.
Return only the transcript text. Do not summarize.
`;
}
