import { sendError, sendSuccess } from "../utils/http.js";

function parseHourField(value) {
  if (value === undefined || value === null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return Math.round(n);
}

export async function getSettingsStatus(_req, res) {
  return sendSuccess(res, {
    deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
  });
}

export async function updateProfile(req, res) {
  const stringUpdates = Object.fromEntries(
    Object.entries({
      name: req.body?.name?.trim?.(),
      clinicName: req.body?.clinicName?.trim?.(),
      specialty: req.body?.specialty?.trim?.(),
    }).filter(([, value]) => typeof value === "string" && value.length > 0),
  );

  const hourStart = parseHourField(req.body?.clinicHoursStart);
  const hourEnd = parseHourField(req.body?.clinicHoursEnd);
  const numberUpdates = {};
  if (hourStart !== undefined) {
    if (hourStart < 0 || hourStart > 23) {
      return sendError(res, 400, {
        code: "INVALID_CLINIC_HOURS",
        message: "Clinic opening hour must be between 0 and 23.",
      });
    }
    numberUpdates.clinicHoursStart = hourStart;
  }
  if (hourEnd !== undefined) {
    if (hourEnd < 0 || hourEnd > 23) {
      return sendError(res, 400, {
        code: "INVALID_CLINIC_HOURS",
        message: "Clinic closing hour must be between 0 and 23.",
      });
    }
    numberUpdates.clinicHoursEnd = hourEnd;
  }

  const updates = { ...stringUpdates, ...numberUpdates };

  if (!Object.keys(updates).length) {
    return sendError(res, 400, {
      code: "PROFILE_UPDATE_REQUIRED",
      message: "At least one profile field must be provided.",
    });
  }

  if (stringUpdates.name && stringUpdates.name.length < 2) {
    return sendError(res, 400, {
      code: "INVALID_NAME",
      message: "Doctor name must be at least 2 characters.",
    });
  }

  const nextStart = numberUpdates.clinicHoursStart ?? req.user.clinicHoursStart ?? 6;
  const nextEnd = numberUpdates.clinicHoursEnd ?? req.user.clinicHoursEnd ?? 21;
  if (nextStart > nextEnd) {
    return sendError(res, 400, {
      code: "INVALID_CLINIC_RANGE",
      message: "Clinic opening hour must be the same as or before closing hour.",
    });
  }

  Object.assign(req.user, updates);
  await req.user.save();

  return sendSuccess(res, {
    user: {
      _id: req.user._id,
      name: req.user.name,
      email: req.user.email,
      clinicName: req.user.clinicName,
      clinicHoursStart: req.user.clinicHoursStart,
      clinicHoursEnd: req.user.clinicHoursEnd,
      specialty: req.user.specialty,
    },
  });
}
