import { Router } from "express";
import {
  getSettingsStatus,
  postCalendarConnectionTest,
  updateProfile,
} from "../controllers/settingsController.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/status", asyncHandler(getSettingsStatus));
router.post("/calendar/test", asyncHandler(postCalendarConnectionTest));
router.put("/profile", asyncHandler(updateProfile));

export default router;
