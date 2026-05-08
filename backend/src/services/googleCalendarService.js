import fs from "node:fs/promises";
import { google } from "googleapis";

let calendarClient;

function maskCalendarId(id) {
  const trimmed = String(id || "").trim();
  if (!trimmed) return null;
  if (trimmed.length <= 10) return "••••••••";
  return `${trimmed.slice(0, 4)}…${trimmed.slice(-4)}`;
}

function maskEmail(email) {
  const raw = String(email || "").trim();
  const at = raw.indexOf("@");
  if (at <= 0) return null;
  const local = raw.slice(0, at);
  const domain = raw.slice(at + 1);
  if (!domain) return null;
  const prefix = local.length <= 2 ? local[0] || "•" : `${local.slice(0, 2)}•••`;
  return `${prefix}@${domain}`;
}

async function getCalendarClient() {
  if (calendarClient) return calendarClient;

  const calendarId = process.env.GOOGLE_CALENDAR_ID;
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH;

  if (!calendarId || !keyPath) {
    return null;
  }

  try {
    const keyFile = JSON.parse(await fs.readFile(keyPath, "utf8"));
    const auth = new google.auth.JWT({
      email: keyFile.client_email,
      key: keyFile.private_key,
      scopes: ["https://www.googleapis.com/auth/calendar"],
    });

    calendarClient = google.calendar({ version: "v3", auth });
    return calendarClient;
  } catch (err) {
    console.warn("[MedFlow][GoogleCalendar] Failed to initialize client:", err?.message || err);
    return null;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function notConfiguredWarning() {
  if (!process.env.GOOGLE_CALENDAR_ID || !process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH) {
    return "Google Calendar is not configured (set GOOGLE_CALENDAR_ID and GOOGLE_SERVICE_ACCOUNT_KEY_PATH). MedFlow saved your appointment locally.";
  }
  return "Google Calendar client failed to initialize (check service account JSON path and file permissions). MedFlow saved your appointment locally.";
}

function isRetryableGoogleError(err) {
  const status = err?.response?.status ?? err?.code;
  if (status === 429) return true;
  if (typeof status === "number" && status >= 500 && status <= 599) return true;
  return false;
}

async function runWithRetry(fn, label) {
  try {
    return await fn();
  } catch (err) {
    if (!isRetryableGoogleError(err)) throw err;
    console.warn(`[MedFlow][GoogleCalendar] ${label} retry after transient error:`, err?.message || err);
    await sleep(900);
    return await fn();
  }
}

function eventDateTime(appointment) {
  const start = new Date(`${appointment.date}T${appointment.time}:00`);
  const duration = Number(appointment.duration || 30);
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const localEnd = `${end.getFullYear()}-${String(end.getMonth() + 1).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}T${String(end.getHours()).padStart(2, "0")}:${String(end.getMinutes()).padStart(2, "0")}:00`;

  return {
    start: { dateTime: `${appointment.date}T${appointment.time}:00` },
    end: { dateTime: localEnd },
  };
}

function eventBody(appointment) {
  const patientName = appointment.patientId?.name || appointment.patientName || "Patient";
  const { start, end } = eventDateTime(appointment);

  return {
    summary: `${appointment.type} - ${patientName}`,
    description: `MedFlow appointment. Patient: ${patientName}. Type: ${appointment.type}.`,
    start: { ...start, timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || "America/New_York" },
    end: { ...end, timeZone: process.env.GOOGLE_CALENDAR_TIME_ZONE || "America/New_York" },
  };
}

/**
 * @returns {Promise<{ eventId: string | null, warning: string | null }>}
 */
export async function createCalendarEvent(appointment) {
  const calendar = await getCalendarClient();
  if (!calendar) {
    return { eventId: null, warning: notConfiguredWarning() };
  }

  try {
    const response = await runWithRetry(
      () =>
        calendar.events.insert({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          requestBody: eventBody(appointment),
        }),
      "events.insert",
    );

    const eventId = response.data.id || null;
    return { eventId, warning: eventId ? null : "Google Calendar returned no event id." };
  } catch (err) {
    const detail = err?.response?.data?.error?.message || err?.message || String(err);
    console.warn("[MedFlow][GoogleCalendar] createCalendarEvent:", detail);
    return {
      eventId: null,
      warning: `Google Calendar could not create the event (${detail}). Your appointment is saved in MedFlow.`,
    };
  }
}

/**
 * @returns {Promise<{ eventId: string | null, warning: string | null }>}
 */
export async function updateCalendarEvent(appointment) {
  const calendar = await getCalendarClient();
  if (!calendar) {
    return { eventId: null, warning: notConfiguredWarning() };
  }

  if (!appointment.googleCalendarEventId) {
    return { eventId: null, warning: null };
  }

  try {
    const response = await runWithRetry(
      () =>
        calendar.events.patch({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          eventId: appointment.googleCalendarEventId,
          requestBody: eventBody(appointment),
        }),
      "events.patch",
    );

    const eventId = response.data.id || appointment.googleCalendarEventId;
    return { eventId, warning: null };
  } catch (err) {
    const detail = err?.response?.data?.error?.message || err?.message || String(err);
    console.warn("[MedFlow][GoogleCalendar] updateCalendarEvent:", detail);
    return {
      eventId: null,
      warning: `Google Calendar could not update the event (${detail}). Your changes are saved in MedFlow.`,
    };
  }
}

/**
 * Safe summary for Settings UI (no secrets or filesystem paths).
 */
export async function getCalendarIntegrationSummary() {
  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  const keyPath = process.env.GOOGLE_SERVICE_ACCOUNT_KEY_PATH?.trim();
  const timeZone = process.env.GOOGLE_CALENDAR_TIME_ZONE || "America/New_York";

  let serviceAccountEmailMasked = null;
  let keyFileReadable = false;
  if (keyPath) {
    try {
      const keyFile = JSON.parse(await fs.readFile(keyPath, "utf8"));
      keyFileReadable = Boolean(keyFile?.client_email);
      if (keyFile?.client_email) {
        serviceAccountEmailMasked = maskEmail(keyFile.client_email);
      }
    } catch {
      keyFileReadable = false;
    }
  }

  const envVarsPresent = Boolean(calendarId && keyPath);
  const client = await getCalendarClient();

  return {
    envVarsPresent,
    clientReady: Boolean(client),
    calendarIdMasked: calendarId ? maskCalendarId(calendarId) : null,
    timeZone,
    serviceAccountEmailMasked,
    keyFileReadable,
  };
}

/**
 * Verifies the service account can access the configured calendar (Google API round-trip).
 * @returns {Promise<{ ok: boolean, message: string | null }>}
 */
export async function verifyCalendarAccess() {
  const calendar = await getCalendarClient();
  if (!calendar) {
    return {
      ok: false,
      message:
        "Google Calendar is not configured, or the service account key could not be loaded. Check GOOGLE_CALENDAR_ID and GOOGLE_SERVICE_ACCOUNT_KEY_PATH.",
    };
  }

  const calendarId = process.env.GOOGLE_CALENDAR_ID?.trim();
  if (!calendarId) {
    return { ok: false, message: "GOOGLE_CALENDAR_ID is not set." };
  }

  try {
    await runWithRetry(() => calendar.calendars.get({ calendarId }), "calendars.get");
    return { ok: true, message: null };
  } catch (err) {
    const detail = err?.response?.data?.error?.message || err?.message || String(err);
    return {
      ok: false,
      message: `Google Calendar API error: ${detail}`,
    };
  }
}

export async function deleteCalendarEvent(eventId) {
  if (!eventId) {
    return { ok: true, warning: null };
  }

  const calendar = await getCalendarClient();
  if (!calendar) {
    return { ok: false, warning: notConfiguredWarning() };
  }

  try {
    await runWithRetry(
      () =>
        calendar.events.delete({
          calendarId: process.env.GOOGLE_CALENDAR_ID,
          eventId,
        }),
      "events.delete",
    );
    return { ok: true, warning: null };
  } catch (err) {
    const detail = err?.response?.data?.error?.message || err?.message || String(err);
    console.warn("[MedFlow][GoogleCalendar] deleteCalendarEvent:", detail);
    return {
      ok: false,
      warning: `Google Calendar could not delete the event (${detail}). The appointment was removed from MedFlow.`,
    };
  }
}
