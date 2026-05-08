/** Canonical phrase doctors use with the calendar assistant (dashboard). */
export const MEDFLOW_BOOKING_PHRASE =
  "Schedule [patient full name] for a [visit type] on [date] at [time][ for N minutes].";

export const MEDFLOW_BOOKING_VISIT_TYPES =
  "follow-up · new-visit · lab-review · annual-physical · consultation";

/** How to dictate the visit so the note matches the MedFlow SOAP template. */
export const MEDFLOW_TRANSCRIPT_FORMAT = [
  'Start each turn with "Patient:" or "Doctor:" (or Physician / Clinician / MD / RN).',
  "After you stop recording, the visit is converted to: CC & HPI, Vitals & exam, Impression, and a bulleted plan.",
] as const;
