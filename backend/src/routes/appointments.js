import { Router } from "express";
import {
  createAppointment,
  deleteAppointment,
  ensureSampleAppointment,
  getAppointmentById,
  listAppointments,
  updateAppointment,
} from "../controllers/appointmentController.js";
import { validateCreateAppointment, validateIdParam } from "../middleware/validate.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/", asyncHandler(listAppointments));
router.post("/sample", asyncHandler(ensureSampleAppointment));
router.get("/:id", validateIdParam("id"), asyncHandler(getAppointmentById));
router.post("/", validateCreateAppointment, asyncHandler(createAppointment));
router.put("/:id", validateIdParam("id"), asyncHandler(updateAppointment));
router.delete("/:id", validateIdParam("id"), asyncHandler(deleteAppointment));

export default router;
