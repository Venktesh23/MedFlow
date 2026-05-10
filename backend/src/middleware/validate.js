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

/**
 * Create appointment: requires date, time, type, and either patientId (existing) or patientName (match or auto-create).
 */
export function validateCreateAppointment(req, res, next) {
  const body = req.body || {};
  const missing = [];
  if (!body.date?.toString().trim()) missing.push("date");
  if (!body.time?.toString().trim()) missing.push("time");
  if (!body.type?.toString().trim()) missing.push("type");
  if (missing.length) {
    return sendError(res, 400, {
      code: "VALIDATION_ERROR",
      message: `Missing required field${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`,
    });
  }

  const pid = body.patientId?.toString().trim();
  const pname = body.patientName?.toString().trim();
  if (!pid && !pname) {
    return sendError(res, 400, {
      code: "PATIENT_OR_NAME_REQUIRED",
      message: "Provide patientId for an existing patient, or patientName to match or create a patient profile.",
    });
  }

  if (pname && pname.length < 2) {
    return sendError(res, 400, {
      code: "INVALID_PATIENT_NAME",
      message: "patientName must be at least 2 characters.",
    });
  }

  if (pid && !mongoose.isValidObjectId(pid)) {
    return sendError(res, 400, {
      code: "INVALID_PATIENT_ID",
      message: "patientId is not valid. Omit patientId and send patientName to create a new patient.",
    });
  }

  return next();
}
