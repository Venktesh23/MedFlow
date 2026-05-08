import jwt from "jsonwebtoken";
import { User } from "../models/User.js";
import { sendError } from "../utils/http.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : "";

    if (!token) {
      return sendError(res, 401, {
        code: "AUTH_TOKEN_MISSING",
        message: "Missing auth token.",
      });
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
