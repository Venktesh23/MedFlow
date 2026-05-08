import { Router } from "express";
import { getDashboardSummary } from "../dashboard/dashboardController.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.get("/summary", asyncHandler(getDashboardSummary));

export default router;
