/** Builds the canonical MedFlow phrase for the calendar agent from structured fields. */
export function buildCalendarScheduleCommand(params: {
  patientName: string;
  date: string;
  time: string;
  type: string;
}): string {
  const name = params.patientName.trim();
  const date = params.date.trim();
  const time = params.time.trim();
  const type = params.type.trim();
  return `Schedule ${name} for a ${type} on ${date} at ${time}.`;
}
