import { Router } from "express";
import { handleCalendarCommand } from "../controllers/calendarController.js";
import { requireFields } from "../middleware/validate.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.post("/command", requireFields(["command"]), asyncHandler(handleCalendarCommand));

export default router;
