import { Router } from "express";
import { getMe, login, logout, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireFields } from "../middleware/validate.js";
import { asyncHandler } from "../utils/http.js";

const router = Router();

router.post("/register", requireFields(["name", "email", "password"]), asyncHandler(register));
router.post("/login", requireFields(["email", "password"]), asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(getMe));
router.post("/logout", requireAuth, asyncHandler(logout));

export default router;
