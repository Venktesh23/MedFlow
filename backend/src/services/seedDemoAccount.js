import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { User } from "../models/User.js";
import { Patient } from "../models/Patient.js";
import { Appointment } from "../models/Appointment.js";
import { Note } from "../models/Note.js";

const DEMO_EMAIL = "demo@medflow.app";
const DEMO_PASSWORD = "medflow-demo";

function daysAgo(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function daysFromNow(n) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function pastDate(n) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

const PATIENTS = [
  { name: "Sarah Mitchell", dob: "1985-03-14", contact: "(555) 234-5678", insurance: "BlueCross BlueShield" },
  { name: "James Okafor",   dob: "1972-11-02", contact: "(555) 345-6789", insurance: "Aetna" },
  { name: "Linda Cheng",    dob: "1990-07-28", contact: "(555) 456-7890", insurance: "UnitedHealth" },
  { name: "Robert Navarro", dob: "1965-09-15", contact: "(555) 567-8901", insurance: "Cigna" },
];

function buildAppointments(userId, patients, doctorName) {
  const [sarah, james, linda, robert] = patients;
  return [
    { userId, patientId: sarah._id,  doctorName, date: daysAgo(7),      time: "09:00", type: "annual-physical", duration: 45, status: "completed" },
    { userId, patientId: james._id,  doctorName, date: daysAgo(5),      time: "10:30", type: "follow-up",       duration: 30, status: "completed" },
    { userId, patientId: linda._id,  doctorName, date: daysAgo(2),      time: "14:00", type: "consultation",    duration: 45, status: "completed" },
    { userId, patientId: robert._id, doctorName, date: daysAgo(1),      time: "11:00", type: "lab-review",      duration: 30, status: "completed" },
    { userId, patientId: sarah._id,  doctorName, date: daysFromNow(1),  time: "09:30", type: "follow-up",       duration: 30, status: "upcoming" },
    { userId, patientId: linda._id,  doctorName, date: daysFromNow(3),  time: "15:00", type: "follow-up",       duration: 30, status: "upcoming" },
  ];
}

function buildNotes(userId, patients, appointments) {
  const [sarah, james, linda, robert] = patients;
  const [aptSarahPhysical, aptJamesFollowup, aptLindaConsult, aptRobertLab] = appointments;

  return [
    {
      userId,
      patientId: sarah._id,
      appointmentId: aptSarahPhysical._id,
      transcript: "Doctor: Good morning Sarah, how have you been feeling since your last visit?\nPatient: Pretty good overall. Just a bit more tired than usual lately.\nDoctor: Any chest pain, shortness of breath, or palpitations?\nPatient: No, nothing like that. Just fatigue. I've been stressed at work.\nDoctor: That makes sense. Let's do a full exam. Your blood pressure today is 118 over 76, heart rate 72. Everything looks excellent.\nPatient: That's reassuring.\nDoctor: Lungs are clear, heart sounds normal. I'll order your routine labs — CBC, metabolic panel, lipids, and HbA1c. Any other concerns?\nPatient: Should I be worried about the fatigue?\nDoctor: Given the context it's very likely stress-related. If it persists after you manage your workload we'll dig deeper.",
      rawTranscript: null,
      soapNote: {
        subjective: "Patient presents for annual wellness exam. Reports feeling generally well with mild fatigue over the past month attributed to work stress. Denies chest pain, shortness of breath, or palpitations.",
        objective: "Vitals: BP 118/76, HR 72 bpm, Temp 98.6°F, SpO2 99%, BMI 23.4. Alert and oriented ×3. Cardiovascular: regular rate and rhythm, no murmurs. Lungs: clear to auscultation bilaterally. Abdomen: soft, non-tender, no organomegaly.",
        assessment: "1. Annual wellness exam — all parameters within normal limits.\n2. Mild fatigue, likely stress-related.\n3. Preventive care up to date.",
        plan: "1. Labs ordered: CBC, CMP, lipid panel, HbA1c.\n2. Recommend stress management and consistent sleep schedule.\n3. Flu vaccine administered today.\n4. Follow up in 12 months or sooner if symptoms worsen.",
      },
      tags: ["annual-physical", "fatigue", "preventive-care"],
      summary: "Annual wellness exam for Sarah Mitchell. All vitals within normal range. Mild stress-related fatigue noted. Labs ordered, flu vaccine given, follow-up in 12 months.",
      followUpRequired: false,
      flagged: false,
      createdAt: pastDate(7),
      updatedAt: pastDate(7),
    },
    {
      userId,
      patientId: james._id,
      appointmentId: aptJamesFollowup._id,
      transcript: "Doctor: Hello James, how have your blood pressure readings been at home?\nPatient: Still running a bit high. I've been checking twice a day like you said. Usually around 138 to 142 over 88 to 92.\nDoctor: Are you taking the amlodipine every day?\nPatient: Yes, every morning without fail.\nDoctor: Good. Any headaches or dizziness?\nPatient: Some mild headaches in the afternoon, but no dizziness.\nDoctor: Today's reading is 142 over 90. We need better control. I'm going to increase the amlodipine to 10 milligrams.\nPatient: Will that cause any side effects?\nDoctor: Occasionally some ankle swelling. If that happens let me know. Also really focus on reducing salt — aim for less than 2 grams per day.",
      rawTranscript: null,
      soapNote: {
        subjective: "53-year-old male presenting for hypertension follow-up. Reports compliance with amlodipine 5mg daily. Home BP readings averaging 138-142/88-92 over past 2 weeks. Occasional mild afternoon headaches, denies visual changes or dizziness.",
        objective: "Vitals: BP 142/90 mmHg (right arm), HR 78 bpm, Temp 98.4°F. Weight 198 lbs (stable). Cardiovascular: regular rate, no extra heart sounds. No peripheral edema.",
        assessment: "1. Hypertension — suboptimal control on current regimen.\n2. Tension headaches likely related to elevated BP.",
        plan: "1. Increase amlodipine from 5mg to 10mg daily.\n2. Dietary counseling: reduce sodium to <2g/day, DASH diet reinforced.\n3. Continue home BP monitoring twice daily and log readings.\n4. Return in 4 weeks for BP recheck; consider adding HCTZ 12.5mg if inadequate response.",
      },
      tags: ["hypertension", "follow-up", "medication-adjustment"],
      summary: "Hypertension follow-up for James Okafor. BP suboptimally controlled at 142/90 on amlodipine 5mg. Dose increased to 10mg. Dietary counseling provided. Recheck in 4 weeks.",
      followUpRequired: true,
      followUpTimeframe: "4 weeks",
      flagged: false,
      createdAt: pastDate(5),
      updatedAt: pastDate(5),
    },
    {
      userId,
      patientId: linda._id,
      appointmentId: aptLindaConsult._id,
      transcript: "Doctor: Hi Linda, tell me about these headaches you've been having.\nPatient: They've been happening about three or four times a month for the past six months. They're really intense, usually on the left side of my head, and they throb.\nDoctor: How long do they last?\nPatient: Anywhere from a few hours to sometimes two days.\nDoctor: Any nausea or sensitivity to light?\nPatient: Yes to both. I have to lie down in a dark room.\nDoctor: Do you get any warning signs before the headache starts — like seeing zigzag lines or flashing lights?\nPatient: No, they just come on.\nDoctor: What have you been taking for them?\nPatient: Ibuprofen 400 milligrams. It helps a little but doesn't really stop it.\nDoctor: Your neurological exam today is completely normal. Based on your description this is migraine without aura. I want to start you on a specific migraine medication.",
      rawTranscript: null,
      soapNote: {
        subjective: "35-year-old female presenting with recurrent headaches over 6 months. Pulsating, moderate-to-severe, left-sided pain lasting 4–48 hours, 3-4 episodes/month. Associated nausea and photophobia. No aura. Ibuprofen 400mg provides partial relief only.",
        objective: "Vitals: BP 112/70, HR 68 bpm, Temp 98.7°F. Neurological exam: intact cranial nerves II–XII, no focal deficits. HEENT: no sinus tenderness. Fundoscopy: no papilledema.",
        assessment: "1. Migraine without aura, episodic (3-4 episodes/month).\n2. Inadequate pain control with OTC analgesics.",
        plan: "1. Initiate sumatriptan 50mg PO for acute abortive therapy — take at headache onset.\n2. Start topiramate 25mg QHS for prophylaxis; titrate to 50mg at 4 weeks.\n3. Migraine diary to track frequency, duration, and triggers.\n4. Avoid common triggers: irregular sleep, dehydration, caffeine excess.\n5. Neurology referral if no improvement in 8 weeks.",
      },
      tags: ["migraine", "consultation", "neurology", "new-medication"],
      summary: "Initial consultation for Linda Cheng presenting with episodic migraines (3-4/month) without aura. Sumatriptan prescribed for acute treatment; topiramate initiated for prophylaxis. Migraine diary recommended.",
      followUpRequired: true,
      followUpTimeframe: "8 weeks",
      flagged: false,
      createdAt: pastDate(2),
      updatedAt: pastDate(2),
    },
    {
      userId,
      patientId: robert._id,
      appointmentId: aptRobertLab._id,
      transcript: "Doctor: Robert, I've reviewed your lab results. Your HbA1c came back at 7.8 percent.\nPatient: Is that bad?\nDoctor: It's above our target of 7 percent for you. It means your blood sugar control over the past three months has been slightly off.\nPatient: I have been eating more carbs lately, I'll be honest.\nDoctor: That explains it. Your fasting glucose was 148, LDL is 112 which is borderline given your diabetes. Kidney function and liver enzymes are normal.\nPatient: What do we do?\nDoctor: I want to increase your metformin to 1000 milligrams twice a day, you're currently on 500. And we should talk about adding a statin for the LDL.\nPatient: Ok. I'll try harder with the diet too.\nDoctor: That's the most important thing. We'll check your labs again in 3 months.",
      rawTranscript: null,
      soapNote: {
        subjective: "60-year-old male with type 2 diabetes presenting for lab review. Reports dietary non-compliance with increased carbohydrate intake. Currently on metformin 500mg twice daily.",
        objective: "Labs: HbA1c 7.8% (target <7%), fasting glucose 148 mg/dL, LDL 112 mg/dL, eGFR 74 mL/min (stable), LFTs within normal limits. Vitals: BP 128/82, HR 74 bpm, Weight 214 lbs.",
        assessment: "1. Type 2 diabetes mellitus — suboptimal glycemic control (HbA1c 7.8%).\n2. Borderline LDL elevation in context of diabetes — increased cardiovascular risk.\n3. Dietary non-compliance contributing to elevated glucose.",
        plan: "1. Increase metformin from 500mg to 1000mg twice daily with meals.\n2. Initiate atorvastatin 20mg QHS for LDL management.\n3. Diabetes education and dietary counseling: reduce refined carbohydrates, increase fiber intake.\n4. Repeat HbA1c, lipid panel, and CMP in 3 months.\n5. Refer to diabetes educator if HbA1c remains >7.5% at next visit.",
      },
      tags: ["diabetes", "lab-review", "glycemic-control", "statin"],
      summary: "Lab review for Robert Navarro with type 2 diabetes. HbA1c 7.8% — above target. Metformin dose increased to 1000mg BID. Atorvastatin 20mg initiated for borderline LDL. Labs to repeat in 3 months.",
      followUpRequired: true,
      followUpTimeframe: "3 months",
      flagged: false,
      createdAt: pastDate(1),
      updatedAt: pastDate(1),
    },
  ];
}

export async function seedDemoAccount() {
  // Get or create the demo user
  let user = await User.findOne({ email: DEMO_EMAIL });
  if (!user) {
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
    user = await User.create({
      name: "Dr. Alex Carter",
      email: DEMO_EMAIL,
      passwordHash,
      clinicName: "MedFlow Demo Clinic",
      specialty: "Internal Medicine",
      clinicHoursStart: 8,
      clinicHoursEnd: 18,
    });
  }

  // Idempotent — skip if demo account already has patients
  const existingCount = await Patient.countDocuments({ userId: user._id });
  if (existingCount > 0) return;

  // Create patients
  const createdPatients = await Patient.insertMany(
    PATIENTS.map((p) => ({ ...p, userId: user._id })),
  );

  // Create appointments
  const appointmentDocs = buildAppointments(user._id, createdPatients, user.name);
  const createdAppointments = await Appointment.insertMany(appointmentDocs);

  // Create notes with realistic past timestamps (bypass Mongoose auto-timestamp)
  const noteDocs = buildNotes(user._id, createdPatients, createdAppointments);
  await Note.collection.insertMany(
    noteDocs.map((n) => ({
      ...n,
      userId: new mongoose.Types.ObjectId(String(n.userId)),
      patientId: new mongoose.Types.ObjectId(String(n.patientId)),
      appointmentId: n.appointmentId ? new mongoose.Types.ObjectId(String(n.appointmentId)) : null,
      incomplete: false,
      flagged: n.flagged ?? false,
      followUpRequired: n.followUpRequired ?? false,
      followUpTimeframe: n.followUpTimeframe ?? null,
      flagReason: n.flagReason ?? null,
      tags: n.tags ?? [],
    })),
  );

  console.log("[MedFlow][Seed] Demo account seeded with 4 patients, 6 appointments, 4 notes.");
}
