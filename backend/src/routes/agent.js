import { Router } from "express";
import multer from "multer";
import {
  getPatientMemory,
  getPatientNotes,
  runAudioAgent,
  runTranscriptAgent,
  validateAgentAudioUpload,
  validateAgentTranscript,
  validatePatientIdParam,
} from "../controllers/agentController.js";
import { asyncHandler } from "../utils/http.js";

// Routes for the Claude + MongoDB MedFlow clinical documentation agent.
const router = Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: Number(process.env.MAX_AUDIO_FILE_BYTES || 25 * 1024 * 1024),
  },
});

router.post(
  "/audio-session",
  upload.single("audio"),
  validateAgentAudioUpload,
  asyncHandler(runAudioAgent),
);

router.post("/transcript-session", validateAgentTranscript, asyncHandler(runTranscriptAgent));

router.get("/patients/:patientId/memory", validatePatientIdParam, asyncHandler(getPatientMemory));

router.get("/patients/:patientId/notes", validatePatientIdParam, asyncHandler(getPatientNotes));

export default router;
