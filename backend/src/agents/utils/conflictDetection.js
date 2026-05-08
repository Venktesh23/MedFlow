function minutesFromTime(time) {
  const [hours = "0", minutes = "0"] = String(time).split(":");
  return Number(hours) * 60 + Number(minutes);
}

/**
 * Checks whether a requested appointment overlaps existing appointments.
 *
 * @param {Array<object>} existingAppointments - Appointments with date, time, and optional duration fields.
 * @param {string} newDate - ISO date string, YYYY-MM-DD.
 * @param {string} newTime - 24-hour time string, HH:MM.
 * @param {number} duration - Appointment duration in minutes.
 * @returns {{ hasConflict: boolean, conflictingAppointment: object | null }}
 */
export function checkConflict(existingAppointments, newDate, newTime, duration = 30) {
  const requestedStart = minutesFromTime(newTime);
  const requestedEnd = requestedStart + Number(duration || 30);

  const conflictingAppointment =
    existingAppointments.find((appointment) => {
      if (appointment.date !== newDate) return false;

      const existingStart = minutesFromTime(appointment.time);
      const existingEnd = existingStart + Number(appointment.duration || 30);
      const overlap = Math.min(requestedEnd, existingEnd) - Math.max(requestedStart, existingStart);

      return overlap > 5;
    }) || null;

  return {
    hasConflict: Boolean(conflictingAppointment),
    conflictingAppointment,
  };
}

export function addMinutesToTime(time, minutesToAdd) {
  const start = minutesFromTime(time) + Number(minutesToAdd || 0);
  const hours = Math.floor(start / 60) % 24;
  const minutes = start % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}
