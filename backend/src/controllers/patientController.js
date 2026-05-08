import { Appointment } from "../models/Appointment.js";
import { Note } from "../models/Note.js";
import { Patient } from "../models/Patient.js";
import { sendError, sendSuccess } from "../utils/http.js";

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export async function listPatients(req, res) {
  const search = req.query.search?.trim?.();
  const filter = search
    ? {
        $or: [
          { name: new RegExp(escapeRegex(search), "i") },
          { contact: new RegExp(escapeRegex(search), "i") },
        ],
      }
    : {};

  const patients = await Patient.find(filter).sort({ createdAt: -1 });
  const patientIds = patients.map((patient) => patient._id);
  const [appointments, notes] = await Promise.all([
    Appointment.find({ patientId: { $in: patientIds } }).sort({ date: -1, time: -1 }),
    Note.find({ patientId: { $in: patientIds } }).sort({ createdAt: -1 }),
  ]);

  const enriched = patients.map((patient) => {
    const upcomingAppointment = appointments.find(
      (appointment) =>
        appointment.patientId.toString() === patient._id.toString() &&
        appointment.status !== "completed",
    );
    const lastNote = notes.find(
      (note) => note.patientId.toString() === patient._id.toString(),
    );

    return {
      ...patient.toObject(),
      upcomingAppointment: upcomingAppointment || null,
      lastVisit: lastNote?.createdAt || null,
    };
  });

  return sendSuccess(res, { patients: enriched });
}

export async function getPatientById(req, res) {
  const patient = await Patient.findById(req.params.id);

  if (!patient) {
    return sendError(res, 404, {
      code: "PATIENT_NOT_FOUND",
      message: "Patient not found.",
    });
  }

  const [appointments, notes] = await Promise.all([
    Appointment.find({ patientId: patient._id }).sort({ date: -1, time: -1 }),
    Note.find({ patientId: patient._id }).sort({ createdAt: -1 }),
  ]);

  return sendSuccess(res, {
    patient,
    appointments,
    notes,
  });
}

export async function createPatient(req, res) {
  const patient = await Patient.create({
    name: req.body.name,
    dob: req.body.dob || "",
    contact: req.body.contact || "",
    insurance: req.body.insurance || "",
  });

  return sendSuccess(res, { patient }, 201);
}

export async function updatePatient(req, res) {
  const patient = await Patient.findByIdAndUpdate(
    req.params.id,
    {
      name: req.body.name,
      dob: req.body.dob,
      contact: req.body.contact,
      insurance: req.body.insurance,
    },
    { new: true, runValidators: true },
  );

  if (!patient) {
    return sendError(res, 404, {
      code: "PATIENT_NOT_FOUND",
      message: "Patient not found.",
    });
  }

  return sendSuccess(res, { patient });
}
