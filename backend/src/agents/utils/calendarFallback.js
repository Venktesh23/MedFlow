const WEEKDAYS = [
  "sunday",
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
];

const CANONICAL_VISIT_TYPES = new Set([
  "follow-up",
  "new-visit",
  "lab-review",
  "annual-physical",
  "consultation",
]);

function toIsoDate(date) {
  return date.toISOString().slice(0, 10);
}

function nextWeekdayDate(today, weekdayIndex, preferNextWeek) {
  const date = new Date(today);
  const day = date.getDay();
  let delta = (weekdayIndex - day + 7) % 7;
  if (delta === 0 && preferNextWeek) delta = 7;
  date.setDate(date.getDate() + delta);
  return toIsoDate(date);
}

function mapLooseVisitType(raw) {
  if (!raw || typeof raw !== "string") return null;
  const t = raw.trim().toLowerCase();
  if (CANONICAL_VISIT_TYPES.has(t)) return t;
  const s = raw.trim();
  if (/follow[\s-]?up/i.test(s)) return "follow-up";
  if (/new\s*patient|initial|first\s*visit/i.test(s)) return "new-visit";
  if (/lab\b/i.test(s)) return "lab-review";
  if (/annual|physical|wellness|checkup/i.test(s)) return "annual-physical";
  if (/consult|visit|appointment|check[\s-]?in/i.test(s)) return "consultation";
  return null;
}

function parseIntent(command) {
  const text = command.toLowerCase();
  if (/\b(thanks|thank you|hello|hi|hey)\b/.test(text)) return "chat";
  if (/\b(cancel|delete|remove)\b/.test(text)) return "delete";
  if (/\b(move|reschedule|change|update)\b/.test(text)) return "update";
  if (/\b(schedule|book|create|add)\b/.test(text)) return "create";
  if (/\b(what|who|free|available|calendar)\b/.test(text)) return "query";
  return "create";
}

function parsePatientName(command) {
  const cleaned = command.replace(/\s+/g, " ").trim();
  const possessive = cleaned.match(/([A-Za-z][A-Za-z' -]{1,60})'s\s+(appointment|visit)/i);
  if (possessive) return possessive[1].trim();

  const keywordMatch = cleaned.match(/\b(for|with|patient|schedule|book|create|add)\s+([A-Za-z][A-Za-z' -]{1,60})/i);
  if (!keywordMatch) return null;

  let name = keywordMatch[2];
  name = name.split(/\b(on|at|for|tomorrow|today|next|this|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i)[0];
  return name.trim() || null;
}

function parseDate(command, today) {
  const text = command.toLowerCase();
  const iso = command.match(/\b(\d{4}-\d{2}-\d{2})\b/);
  if (iso) return iso[1];
  if (/\btoday\b/.test(text)) return toIsoDate(today);
  if (/\btomorrow\b/.test(text)) {
    const d = new Date(today);
    d.setDate(d.getDate() + 1);
    return toIsoDate(d);
  }

  const weekdayMatch = text.match(/\b(next\s+)?(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
  if (weekdayMatch) {
    const preferNext = Boolean(weekdayMatch[1]);
    const weekday = WEEKDAYS.indexOf(weekdayMatch[2]);
    if (weekday >= 0) {
      return nextWeekdayDate(today, weekday, preferNext);
    }
  }

  return null;
}

function parseTime(command) {
  const text = command.toLowerCase();
  if (/\bnoon\b/.test(text)) return "12:00";
  if (/\bmidnight\b/.test(text)) return "00:00";
  if (/\bmorning\b/.test(text)) return "09:00";
  if (/\bafternoon\b/.test(text)) return "14:00";
  if (/\bevening\b/.test(text)) return "17:00";

  const colonMatch = command.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (colonMatch) {
    return `${String(colonMatch[1]).padStart(2, "0")}:${colonMatch[2]}`;
  }

  const ampmMatch = command.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  if (ampmMatch) {
    let hours = Number(ampmMatch[1]);
    const meridiem = ampmMatch[2].toLowerCase();
    if (meridiem === "pm" && hours < 12) hours += 12;
    if (meridiem === "am" && hours === 12) hours = 0;
    if (hours < 0 || hours > 23) return null;
    return `${String(hours).padStart(2, "0")}:00`;
  }

  const match = command.match(/\b(\d{1,2})\b/);
  if (!match) return null;
  const index = match.index ?? -1;
  if (index > 0 && command[index - 1] === "-") return null;

  let hours = Number(match[1]);
  const minutes = 0;

  if (Number.isNaN(hours) || Number.isNaN(minutes)) return null;
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;

  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

function parseDuration(command) {
  const minutesMatch = command.match(/\bfor\s+(\d{1,3})\s*(minutes|min)\b/i);
  if (minutesMatch) return Number(minutesMatch[1]);

  const hoursMatch = command.match(/\bfor\s+(\d{1,2})\s*hour(s)?\b/i);
  if (hoursMatch) return Number(hoursMatch[1]) * 60;

  if (/\bfor\s+an\s+hour\b/i.test(command)) return 60;
  return 30;
}

function parseVisitType(command) {
  return mapLooseVisitType(command);
}

function parseAppointmentId(command) {
  const match = command.match(/\b([a-f0-9]{24})\b/i);
  return match ? match[1] : null;
}

function queryTypeFromCommand(command, patientName) {
  const text = command.toLowerCase();
  if (patientName) return "patient";
  if (/\bweek\b/.test(text)) return "week";
  return "day";
}

export function parseCalendarCommandFallback(command, today = new Date()) {
  const intent = parseIntent(command);
  const patientName = parsePatientName(command);
  const date = parseDate(command, today);
  const time = parseTime(command);
  const duration = parseDuration(command);
  const type = parseVisitType(command);
  const appointmentId = parseAppointmentId(command);
  const queryType = intent === "query" ? queryTypeFromCommand(command, patientName) : null;

  return {
    intent,
    patientName,
    date,
    time,
    duration,
    type,
    appointmentId,
    queryType,
    confirmationMessage: null,
  };
}
