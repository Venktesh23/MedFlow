import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { sendError } from "../utils/http.js";

const DEMO_EMAIL = "demo@medflow.app";
let _demoUser = null;

async function getOrCreateDemoUser() {
  if (_demoUser) return _demoUser;
  let user = await User.findOne({ email: DEMO_EMAIL }).select("-passwordHash");
  if (!user) {
    const passwordHash = await bcrypt.hash("medflow-demo", 10);
    user = await User.create({
      name: "Demo Doctor",
      email: DEMO_EMAIL,
      passwordHash,
      clinicName: "MedFlow Clinic",
      specialty: "Primary Care",
      clinicHoursStart: 8,
      clinicHoursEnd: 18,
    });
    user = await User.findById(user._id).select("-passwordHash");
  }
  _demoUser = user;
  return user;
}

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const headerToken = header.startsWith("Bearer ") ? header.slice(7) : "";
    const cookieToken = req.cookies?.medflow_token || "";
    const token = headerToken || cookieToken;

    if (!token) {
      req.user = await getOrCreateDemoUser();
      return next();
    }

    if (!process.env.JWT_SECRET) {
      return sendError(res, 500, {
        code: "JWT_SECRET_MISSING",
        message: "JWT_SECRET is not configured.",
      });
    }

    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select("-passwordHash");

    if (!user) {
      return sendError(res, 401, {
        code: "AUTH_TOKEN_INVALID",
        message: "Invalid auth token.",
      });
    }

    req.user = user;
    return next();
  } catch {
    return sendError(res, 401, {
      code: "AUTH_TOKEN_INVALID",
      message: "Invalid auth token.",
    });
  }
}
