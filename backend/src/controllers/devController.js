import { Patient } from "../models/Patient.js";
import { Appointment } from "../models/Appointment.js";
import { Note } from "../models/Note.js";
import { checkConflict } from "../agents/utils/conflictDetection.js";
import { sendError, sendSuccess } from "../utils/http.js";

const SAMPLE_PATIENTS = [
  "Eleanor Vance",
  "Marcus Sterling",
  "Sarah Jenkins",
  "David Chen",
  "Olivia Hart",
  "Noah Mitchell",
  "Sophia Rodriguez",
  "Liam Patel",
];

const APPOINTMENT_TYPES = [
  "consultation",
  "follow-up",
  "annual-physical",
  "lab-review",
  "new-visit",
];

function typeToTagSeed(appointmentType) {
  switch (appointmentType) {
    case "consultation":
      return ["ENT", "Sinusitis"];
    case "follow-up":
      return ["Ortho", "Post-Op"];
    case "annual-physical":
      return ["General", "Wellness"];
    case "lab-review":
      return ["MSK", "Lab Review"];
    case "new-visit":
      return ["Cardiology", "Wellness"];
    default:
      return ["wellness"];
  }
}

function typeToSOAPImpression(appointmentType) {
  switch (appointmentType) {
    case "consultation":
      return "Impression: Initial presentation consistent with ENT pathology; correlate with exam and response to therapy.";
    case "follow-up":
      return "Impression: Follow-up visit consistent with post-intervention progress; no red flags reported.";
    case "annual-physical":
      return "Impression: Routine assessment; preventive care priorities reviewed and documented.";
    case "lab-review":
      return "Impression: Lab review visit; results reviewed and plan adjusted accordingly.";
    case "new-visit":
      return "Impression: New visit; symptoms and exam reviewed; plan formulated.";
    default:
      return "Impression: Clinical impression documented based on this visit transcript.";
  }
}

function typeToCardLabel(appointmentType) {
  switch (appointmentType) {
    case "consultation":
      return "Initial Consult";
    case "follow-up":
      return "Follow-up";
    case "annual-physical":
      return "Routine Exam";
    case "lab-review":
      return "Post-Op";
    case "new-visit":
      return "Urgent Care";
    default:
      return "Clinical note";
  }
}

function typeToAISummaryDetail(appointmentType, idx) {
  const pick = idx % 3;
  switch (appointmentType) {
    case "consultation":
      return pick === 0
        ? "Patient presented with chronic sinus discomfort and throat irritation. Endoscopic evaluation reviewed; supportive care and targeted therapy discussed."
        : pick === 1
          ? "Patient presented with persistent congestion and intermittent sore throat. Exam findings reviewed and plan for symptom control plus follow-up precautions documented."
          : "Patient presented with upper respiratory symptoms. Assessment and treatment plan reviewed, including expected course and return-to-care guidance.";
    case "follow-up":
      return pick === 0
        ? "Follow-up visit: patient reports improvement after recent intervention. Progress reviewed and the management plan updated with clear next steps."
        : pick === 1
          ? "Recheck performed. Symptoms are improving and no new concerning features were reported. Updated follow-up timeframe and medication plan documented."
          : "Follow-up assessment shows steady progress. Exam and interim history reviewed; continued care plan and safety net discussed.";
    case "annual-physical":
      return pick === 0
        ? "Annual wellness check completed. Preventive counseling reviewed and screening priorities documented with lifestyle recommendations."
        : pick === 1
          ? "Routine exam performed. Health maintenance plan reviewed; recommendations documented for continued wellness and follow-up."
          : "Annual physical: overall status reviewed with preventive care discussion and documentation of screening plan.";
    case "lab-review":
      return pick === 0
        ? "Post-op / lab review: results reviewed with patient. Management adjusted based on trends; monitoring and follow-up guidance provided."
        : pick === 1
          ? "Post-procedure check with lab review. Findings reviewed; updated plan includes symptom monitoring and return precautions."
          : "Lab trends reviewed in post-intervention follow-up. Next-step plan documented along with expected timeline and safety guidance.";
    case "new-visit":
      return pick === 0
        ? "Urgent care visit for acute symptoms. History and exam reviewed; diagnostic considerations discussed and a follow-up plan established."
        : pick === 1
          ? "Acute presentation evaluated. Assessment documented and treatment plan reviewed; patient advised on return precautions."
          : "New urgent evaluation performed. Management discussed with clear instructions for follow-up and symptom monitoring.";
    default:
      return "Clinical summary detail generated for demo data.";
  }
}

function buildTranscript({ patientName, appointmentType, idx }) {
  const patientLead =
    appointmentType === "consultation"
      ? "I have had throat discomfort and nasal congestion for a couple of days."
      : appointmentType === "follow-up"
        ? "I’m feeling better since the last visit, but I still have some lingering discomfort."
        : appointmentType === "annual-physical"
          ? "I’m here for a routine check and to review general health maintenance."
          : appointmentType === "lab-review"
            ? "I’m here to review lab results and understand the next steps."
            : "I’m here for a new complaint and want to discuss the plan.";

  const doctorPlan =
    appointmentType === "consultation"
      ? "Exam reviewed. Discussed supportive care, hydration, and a targeted treatment plan. Follow up if symptoms worsen."
      : appointmentType === "follow-up"
        ? "Reassessment performed. Reviewed progress and updated the plan. Advised return precautions."
        : appointmentType === "annual-physical"
          ? "Preventive counseling completed. Discussed screening priorities and lifestyle recommendations."
          : appointmentType === "lab-review"
            ? "Lab trends reviewed. Adjusted management based on results and recommended monitoring."
            : "History and exam performed. Discussed diagnosis considerations and a follow-up plan.";

  return [
    `Doctor: Thanks for coming in today. How can I help?`,
    `Patient: ${patientLead}`,
    `Doctor: Understood. ${appointmentType} visit notes for sample generation (#${idx}).`,
    `Patient: That sounds right. I have questions about the next steps.`,
    `Doctor: ${doctorPlan}`,
  ].join("\n");
}

function buildSOAPNote({ patientName, appointmentType, idx }) {
  const tags = typeToTagSeed(appointmentType);
  const impression = typeToSOAPImpression(appointmentType);
  const typeLabel = typeToCardLabel(appointmentType);
  const summary = `AI Summary: ${patientName} - ${typeLabel}. ${typeToAISummaryDetail(appointmentType, idx)}`;

  const subjective = `CC:\n${patientName} describes current symptoms and course.\n\nHPI:\n${appointmentType} visit dialogue captured for demo data generation.\n`;
  const objective = `Vitals:\nDocumented in transcript for demo.\n\nPhysical exam:\nRelevant findings summarized for demo visit.\n`;
  const planBullets = [
    `- Reviewed diagnosis considerations and interim history.`,
    `- Discussed management steps and expected course.`,
    `- Provided follow-up timeframe and return precautions.`,
  ].join("\n");
  const plan = planBullets;

  return {
    tags,
    summary,
    subjective,
    objective,
    assessment: impression,
    plan,
    followUpRequired: /follow/i.test(plan),
    followUpTimeframe: null,
    flagged: false,
    flagReason: null,
  };
}

export async function seedSampleData(req, res) {
  const patients = Number(req.body?.patients || 8);
  const appointmentsPerPatient = Number(req.body?.appointmentsPerPatient || 3);
  const notesPerAppointment = Number(req.body?.notesPerAppointment || 1);

  if (!Number.isFinite(patients) || patients <= 0) {
    return sendError(res, 400, { code: "INVALID_PATIENT_COUNT", message: "patients must be > 0" });
  }

  const now = Date.now();
  const samplePatients = SAMPLE_PATIENTS.slice(0, Math.min(patients, SAMPLE_PATIENTS.length));

  try {
    let createdPatients = 0;
    let createdAppointments = 0;
    let createdNotes = 0;

    for (let p = 0; p < samplePatients.length; p += 1) {
      const patientName = samplePatients[p];
      let patient = await Patient.findOne({ name: patientName });
      if (!patient) {
        patient = await Patient.create({
          name: patientName,
          dob: "",
          contact: "",
          insurance: "",
        });
        createdPatients += 1;
      }

      for (let a = 0; a < appointmentsPerPatient; a += 1) {
        const appointmentType =
          APPOINTMENT_TYPES[(p * appointmentsPerPatient + a) % APPOINTMENT_TYPES.length];

        // Spread across the last ~30 days.
        const daysAgo = p * appointmentsPerPatient + a;
        const date = new Date(now - daysAgo * 86400_000).toISOString().slice(0, 10);
        const time = `${String(9 + (a % 6)).padStart(2, "0")}:${String(15 * (a % 3)).padStart(
          2,
          "0",
        )}`;

        let appointment = await Appointment.findOne({
          patientId: patient._id,
          date,
          time,
          type: appointmentType,
        });
        if (!appointment) {
          const sameDay = await Appointment.find({ date });
          const duration = 30;
          const conflict = checkConflict(sameDay, date, time, duration);
          if (conflict.hasConflict) {
            continue;
          }
          appointment = await Appointment.create({
            patientId: patient._id,
            doctorName: req.user?.name || "Doctor",
            date,
            time,
            type: appointmentType,
            status: "completed",
          });
          createdAppointments += 1;
        }

        for (let n = 0; n < notesPerAppointment; n += 1) {
          const noteKey = `MedFlow Demo - ${appointment._id} - ${n}`;
          const soap = buildSOAPNote({ patientName, appointmentType, idx: a + 1 });

          const existing = await Note.findOne({
            patientId: patient._id,
            appointmentId: appointment._id,
            summary: soap.summary,
          });

          if (existing) continue;

          const transcript = buildTranscript({
            patientName,
            appointmentType,
            idx: a + 1,
          });

          // Set createdAt to match the appointment date/time so UI ordering feels realistic.
          const createdAt = new Date(`${date}T${time}:00`);

          await Note.create({
            patientId: patient._id,
            appointmentId: appointment._id,
            transcript,
            rawTranscript: transcript,
            soapNote: {
              subjective: soap.subjective,
              objective: soap.objective,
              assessment: soap.assessment,
              plan: soap.plan,
            },
            tags: soap.tags,
            summary: soap.summary,
            followUpRequired: soap.followUpRequired,
            followUpTimeframe: soap.followUpTimeframe,
            flagged: soap.flagged,
            flagReason: soap.flagReason,
            incomplete: false,
            createdAt,
            updatedAt: createdAt,
          });

          createdNotes += 1;
        }
      }
    }

    return sendSuccess(res, {
      createdPatients,
      createdAppointments,
      createdNotes,
      seededPatients: samplePatients.length,
      appointmentsPerPatient,
      notesPerAppointment,
      noteKey: "MedFlow Demo seed",
    });
  } catch (err) {
    return sendError(res, 500, {
      code: "SEED_SAMPLE_DATA_FAILED",
      message: "Failed to seed demo data.",
      details: err?.message,
    });
  }
}

