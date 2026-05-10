import { Router } from "express";
import { getSettingsStatus, updateProfile } from "../controllers/settingsController.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/status", asyncHandler(getSettingsStatus));
router.put("/profile", asyncHandler(updateProfile));

export default router;
