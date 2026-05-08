import { Router } from "express";
import { asyncHandler } from "../utils/http.js";
import { seedSampleData } from "../controllers/devController.js";

const router = Router();

// Dev-only utilities to quickly populate Mongo for UI testing.
// Note: this endpoint still requires auth because the API is protected globally.
router.post("/seed-sample-data", asyncHandler(seedSampleData));

export default router;

