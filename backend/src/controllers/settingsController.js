import {
  getCalendarIntegrationSummary,
  verifyCalendarAccess,
} from "../services/googleCalendarService.js";
import { sendError, sendSuccess } from "../utils/http.js";

export async function getSettingsStatus(_req, res) {
  const googleCalendar = await getCalendarIntegrationSummary();
  const googleCalendarConfigured = Boolean(
    googleCalendar.envVarsPresent && googleCalendar.clientReady,
  );

  return sendSuccess(res, {
    deepgramConfigured: Boolean(process.env.DEEPGRAM_API_KEY),
    anthropicConfigured: Boolean(process.env.ANTHROPIC_API_KEY),
    googleCalendarConfigured,
    googleCalendar,
  });
}

export async function postCalendarConnectionTest(_req, res) {
  const result = await verifyCalendarAccess();
  return sendSuccess(res, {
    ok: result.ok,
    message: result.message,
  });
}

export async function updateProfile(req, res) {
  const updates = Object.fromEntries(
    Object.entries({
      name: req.body?.name?.trim?.(),
      clinicName: req.body?.clinicName?.trim?.(),
      specialty: req.body?.specialty?.trim?.(),
    }).filter(([, value]) => typeof value === "string" && value.length > 0),
  );

  if (!Object.keys(updates).length) {
    return sendError(res, 400, {
      code: "PROFILE_UPDATE_REQUIRED",
      message: "At least one profile field must be provided.",
    });
  }

  if (updates.name && updates.name.length < 2) {
    return sendError(res, 400, {
      code: "INVALID_NAME",
      message: "Doctor name must be at least 2 characters.",
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
      specialty: req.user.specialty,
    },
  });
}
