import mongoose from "mongoose";
import { sendError } from "../utils/http.js";

export function requireFields(fields) {
  return (req, res, next) => {
    const missing = fields.filter((field) => {
      const value = req.body?.[field];
      return value === undefined || value === null || String(value).trim() === "";
    });

    if (missing.length) {
      return sendError(res, 400, {
        code: "VALIDATION_ERROR",
        message: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
      });
    }

    return next();
  };
}

export function validateIdParam(paramName = "id") {
  return (req, res, next) => {
    const id = req.params?.[paramName];

    if (!id) {
      return sendError(res, 400, {
        code: "VALIDATION_ERROR",
        message: `Missing required route parameter: ${paramName}`,
      });
    }

    if (!mongoose.isValidObjectId(id)) {
      return sendError(res, 400, {
        code: "INVALID_ID",
        message: `Invalid ${paramName}.`,
      });
    }

    return next();
  };
}
