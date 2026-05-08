# MedFlow Backend

Backend API for MedFlow, an agentic clinical assistant for doctors and small clinics.

This backend implements transcription (Deepgram) and clinical note generation using **Anthropic Claude** (SOAP JSON), with **MongoDB** for patient memory, appointments, clinical notes, and agent run logs, and **Express** for API routes.

## Structure

```text
src/
├── agents/
│   ├── calendarAgent.js
│   ├── clinicalDocumentationAgent.js
│   └── noteGenerationAgent.js
├── controllers/
│   ├── agentController.js
│   └── sessionController.js
├── prompts/
│   ├── calendarPrompt.js
│   └── soapPrompt.js
├── routes/
│   ├── agent.js
│   └── session.js
├── services/
│   ├── claudeService.js
│   └── mongoService.js
└── index.js
```

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file:

```bash
cp .env.example .env
```

Fill in the required values (see `.env.example`), including:

```text
ANTHROPIC_API_KEY
ANTHROPIC_MODEL=claude-sonnet-4-6
MONGODB_URI
```

Run locally:

```bash
npm run dev
```

The server defaults to the port in `PORT` (see `.env`, often `5000`).

Health check:

```bash
curl http://localhost:5000/health
```

## Main Agent API

### Transcript Session

Generates a SOAP note from raw transcript text, stores patient memory and note data in MongoDB, and returns the completed note.

```bash
curl -X POST http://localhost:5000/api/agent/transcript-session \
  -H "Content-Type: application/json" \
  -d '{
    "patient_id": "patient-123",
    "appointment_id": "appointment-456",
    "patient": {
      "name": "Alex Johnson",
      "date_of_birth": "1984-04-12"
    },
    "appointment": {
      "scheduled_at": "2026-05-07T14:00:00.000Z",
      "reason": "Follow-up visit"
    },
    "transcript": "Patient reports cough and congestion for four days. No fever. Lungs clear on exam. Assessment is viral upper respiratory infection. Plan is fluids, rest, and follow up if symptoms worsen."
  }'
```

### Audio Session

Accepts an audio file, transcribes it (Deepgram), generates a SOAP note with Claude, stores the result in MongoDB, and returns the completed note.

```bash
curl -X POST http://localhost:5000/api/agent/audio-session \
  -F "audio=@/path/to/audio.wav" \
  -F "patient_id=patient-123" \
  -F "appointment_id=appointment-456" \
  -F "patient={\"name\":\"Alex Johnson\"}" \
  -F "appointment={\"reason\":\"Follow-up visit\"}"
```

The file must be attached as the `audio` form field.

### Patient Memory

Fetches the patient record and recent clinical notes used as agent context.

```bash
curl http://localhost:5000/api/agent/patients/patient-123/memory
```

### Patient Notes

Fetches all saved notes for a patient.

```bash
curl http://localhost:5000/api/agent/patients/patient-123/notes
```

## Compatibility Session API

These older route names use the same Claude + MongoDB agent internally:

```text
POST /api/session/upload-audio
POST /api/session/transcript
GET  /api/session/notes/:patientId
```

## MongoDB Collections

Defaults:

```text
patients
appointments
clinical_notes
agent_runs
```

You can override collection names with:

```text
MONGODB_PATIENTS_COLLECTION
MONGODB_APPOINTMENTS_COLLECTION
MONGODB_NOTES_COLLECTION
MONGODB_AGENT_RUNS_COLLECTION
```

## Error Shape

All known failures return a structured response:

```json
{
  "ok": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message"
  }
}
```
