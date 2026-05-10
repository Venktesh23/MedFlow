import { Router } from "express";
import {
  createPatient,
  deletePatient,
  getPatientById,
  listPatients,
  updatePatient,
} from "../controllers/patientController.js";
import { requireFields, validateIdParam } from "../middleware/validate.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/", asyncHandler(listPatients));
router.get("/:id", validateIdParam("id"), asyncHandler(getPatientById));
router.post("/", requireFields(["name"]), asyncHandler(createPatient));
router.put(
  "/:id",
  validateIdParam("id"),
  requireFields(["name"]),
  asyncHandler(updatePatient),
);
router.delete("/:id", validateIdParam("id"), asyncHandler(deletePatient));

export default router;
