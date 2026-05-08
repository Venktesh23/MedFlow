import { Router } from "express";
import {
  listNotes,
  listNotesByPatient,
  submitTranscript,
  updateNote,
  uploadAudio,
  validateAudioUpload,
  validateNoteUpdate,
  validatePatientId,
  validateTranscript,
} from "../controllers/sessionController.js";
import { validateIdParam } from "../middleware/validate.js";
import { upload } from "../middleware/upload.js";
import { asyncHandler } from "../utils/http.js";

// Session routes for audio uploads, direct transcript submissions, and note retrieval.
const router = Router();

router.post(
  "/upload-audio",
  upload.single("audio"),
  validateAudioUpload,
  asyncHandler(uploadAudio),
);

router.post("/transcript", validateTranscript, asyncHandler(submitTranscript));
router.put(
  "/notes/:id",
  validateIdParam("id"),
  validateNoteUpdate,
  asyncHandler(updateNote),
);

router.get("/notes", asyncHandler(listNotes));
router.get("/notes/:patientId", validatePatientId, asyncHandler(listNotesByPatient));

export default router;
