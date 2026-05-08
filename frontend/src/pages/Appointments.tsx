import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { Link } from "react-router-dom";
import { IconMic } from "@/dashboard/DashboardIcons";
import { buildCalendarScheduleCommand } from "@/dashboard/calendarCommand";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { AppShell } from "@/components/layout/AppShell";
import { StateMessage } from "@/components/StateMessage";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { api, responseData } from "@/services/api";
import {
  AppointmentWeekGrid,
  addDays,
  startOfWeekSunday,
  type WeekGridAppointment,
} from "@/components/appointments/AppointmentWeekGrid";

const FileIcon = () => (
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path d="M8.75 1.16666H3.5C3.19058 1.16666 2.89384 1.28957 2.67504 1.50837C2.45625 1.72716 2.33334 2.0239 2.33334 2.33332V11.6667C2.33334 11.9761 2.45625 12.2728 2.67504 12.4916C2.89384 12.7104 3.19058 12.8333 3.5 12.8333H10.5C10.8094 12.8333 11.1062 12.7104 11.325 12.4916C11.5438 12.2728 11.6667 11.9761 11.6667 11.6667V4.08332L8.75 1.16666Z" stroke="#6A7282" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M8.16666 1.16666V3.49999C8.16666 3.80941 8.28958 4.10616 8.50837 4.32495C8.72717 4.54374 9.02391 4.66666 9.33333 4.66666H11.6667" stroke="#6A7282" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M5.83333 5.25H4.66666" stroke="#6A7282" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.33333 7.58334H4.66666" stroke="#6A7282" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M9.33333 9.91666H4.66666" stroke="#6A7282" strokeWidth="1.16667" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PlusIcon = () => (
  <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
    <path d="M4.16669 10H15.8334" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 4.16666V15.8333" stroke="white" strokeWidth="1.66667" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const CalendarIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M8 2V6" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M16 2V6" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M19 4H5C3.89543 4 3 4.89543 3 6V20C3 21.1046 3.89543 22 5 22H19C20.1046 22 21 21.1046 21 20V6C21 4.89543 20.1046 4 19 4Z" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M3 10H21" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const PersonIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M19 21V19C19 17.9391 18.5786 16.9217 17.8284 16.1716C17.0783 15.4214 16.0609 15 15 15H9C7.93913 15 6.92172 15.4214 6.17157 16.1716C5.42143 16.9217 5 17.9391 5 19V21" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 11C14.2091 11 16 9.20914 16 7C16 4.79086 14.2091 3 12 3C9.79086 3 8 4.79086 8 7C8 9.20914 9.79086 11 12 11Z" stroke="#047857" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
    <path d="M12 22C17.5228 22 22 17.5228 22 12C22 6.47715 17.5228 2 12 2C6.47715 2 2 6.47715 2 12C2 17.5228 6.47715 22 12 22Z" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M12 6V12L16 14" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

type AppointmentSummary = {
  label: string;
  value: string | number;
  icon: JSX.Element;
  iconBg: string;
};

type ScheduleAppointment = {
  id: string;
  time: string;
  period: string;
  /** Original HH:mm from API for layout calculations */
  timeRaw: string;
  durationMinutes: number;
  initials: string;
  name: string;
  type: string;
  status: "upcoming" | "in-progress" | "completed";
  avatarBg: string;
  avatarColor: string;
  date: string;
};

function initials(name = "") {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

function splitTime(time = "") {
  const [hourValue, minute = "00"] = time.split(":");
  const hour = Number(hourValue);
  const period = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return { time: `${String(hour12).padStart(2, "0")}:${minute}`, period };
}

function statusClass(status: ScheduleAppointment["status"]) {
  if (status === "in-progress") return "bg-[#047857] text-white border-[#047857]";
  if (status === "completed") return "bg-white text-[#047857] border-[#047857]";
  return "bg-[#F3F4F6] text-[#6B7280] border-[#E5E7EB]";
}

const SAMPLE_PATIENT_NAME = "MedFlow Sample Patient";

export default function Appointments() {
  const [appointments, setAppointments] = useState<ScheduleAppointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [scheduleView, setScheduleView] = useState<"week" | "list">("week");
  const [weekStart, setWeekStart] = useState(() => startOfWeekSunday(new Date()));
  const [showCreate, setShowCreate] = useState(false);
  const [createFlow, setCreateFlow] = useState<"pick" | "write">("pick");
  const [speakDialogOpen, setSpeakDialogOpen] = useState(false);
  const [speakSubmitting, setSpeakSubmitting] = useState(false);
  const [speakError, setSpeakError] = useState("");
  const speech = useSpeechRecognition();
  const [creating, setCreating] = useState(false);
  const [createMessage, setCreateMessage] = useState("");
  const [seeding, setSeeding] = useState(false);
  const [newAppointment, setNewAppointment] = useState({
    patientName: "",
    date: new Date().toISOString().slice(0, 10),
    time: "09:00",
    type: "follow-up",
  });

  async function loadAppointments() {
    setLoading(true);
    setError("");
    try {
      try {
        await api.post("/appointments/sample");
      } catch {
        /* Demo appointment is optional if the request fails */
      }
      const appointmentsResponse = await api.get("/appointments");
      const appointmentData = responseData<{ appointments: any[] }>(appointmentsResponse);
      setAppointments(
        (appointmentData.appointments || []).map((appointment) => {
          const rawTime = String(appointment.time || "09:00");
          const timeParts = splitTime(rawTime);
          return {
            id: appointment._id,
            timeRaw: rawTime,
            durationMinutes: Number(appointment.duration) > 0 ? Number(appointment.duration) : 30,
            ...timeParts,
            initials: initials(appointment.patientId?.name),
            name: appointment.patientId?.name || "Unknown Patient",
            type: appointment.type,
            status: appointment.status,
            avatarBg: "#cfe9dc",
            avatarColor: "#065f46",
            date: appointment.date,
          };
        }),
      );
    } catch {
      setAppointments([]);
      setError("Unable to load appointments. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAppointments();
  }, []);

  useEffect(() => {
    if (!speakDialogOpen) return;
    speech.reset();
    setSpeakError("");
  }, [speakDialogOpen]);

  function handleSpeakDialogOpenChange(open: boolean) {
    setSpeakDialogOpen(open);
    if (!open) {
      speech.stop();
      speech.reset();
      setSpeakError("");
    }
  }

  function toggleSpeakMic() {
    setSpeakError("");
    if (speech.isListening) {
      speech.stop();
      return;
    }
    speech.reset();
    speech.start();
  }

  async function submitVoiceAppointment() {
    const command = speech.fullTranscript.trim();
    if (!command || speakSubmitting) return;
    setSpeakSubmitting(true);
    setSpeakError("");
    try {
      await api.post("/calendar/command", { command });
      await loadAppointments();
      handleSpeakDialogOpenChange(false);
    } catch (err) {
      let msg = "Unable to create appointment from voice.";
      if (axios.isAxiosError(err)) {
        const apiMsg = (err.response?.data as { error?: { message?: string } })?.error?.message;
        if (apiMsg) msg = apiMsg;
      }
      setSpeakError(msg);
    } finally {
      setSpeakSubmitting(false);
    }
  }

  async function seedDemoData() {
    setSeeding(true);
    setError("");
    try {
      await api.post("/dev/seed-sample-data", {
        patients: 8,
        appointmentsPerPatient: 3,
        notesPerAppointment: 1,
      });
      await loadAppointments();
    } catch (e: any) {
      setError(
        e?.response?.data?.error?.message || "Unable to generate demo data. Check server logs.",
      );
    } finally {
      setSeeding(false);
    }
  }

  const appointmentSummaries: AppointmentSummary[] = useMemo(
    () => [
      {
        label: "Today's Appointments",
        value: appointments.length,
        icon: <CalendarIcon />,
        iconBg: "bg-[rgba(4,120,87,0.10)]",
      },
      {
        label: "New Patients",
        value: new Set(appointments.map((appointment) => appointment.name)).size,
        icon: <PersonIcon />,
        iconBg: "bg-[rgba(4,120,87,0.10)]",
      },
      {
        label: "Pending Notes",
        value: appointments.filter((appointment) => appointment.status !== "completed").length,
        icon: <ClockIcon />,
        iconBg: "bg-[#F9FAFB]",
      },
    ],
    [appointments],
  );

  const weekGridAppointments: WeekGridAppointment[] = useMemo(
    () =>
      appointments.map((a) => ({
        id: a.id,
        date: a.date,
        timeRaw: a.timeRaw,
        durationMinutes: a.durationMinutes,
        name: a.name,
        type: a.type,
        status: a.status,
        initials: a.initials,
        avatarBg: a.avatarBg,
        avatarColor: a.avatarColor,
        labelTime: a.time,
        period: a.period,
      })),
    [appointments],
  );

  const groupedAppointments = useMemo(
    () =>
      Object.entries(
        appointments.reduce<Record<string, ScheduleAppointment[]>>((groups, appointment) => {
          groups[appointment.date] = groups[appointment.date] || [];
          groups[appointment.date].push(appointment);
          return groups;
        }, {}),
      ),
    [appointments],
  );

  return (
    <AppShell>
      <div className="flex flex-col gap-8 px-6 pt-1 pb-24 md:px-8 md:pt-2 md:pb-32 flex-1 min-h-full medflow-page-bg">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-[#1E2939] font-bold text-2xl md:text-[30px] leading-tight tracking-[0.4px]">
              Appointments
            </h1>
            <p className="text-[#6A7282] text-base leading-6 tracking-[-0.3px] mt-1">
              Manage your upcoming patient visits and schedules. A{" "}
              <span className="text-[#065f46] font-medium">sample visit</span> is added automatically so you can try
              recording and note generation.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void seedDemoData()}
              disabled={seeding}
              className="inline-flex items-center gap-2 border border-[#E5E7EB] bg-white text-[#1A1A2E] font-medium text-base px-5 py-2.5 rounded-[10px] shadow-sm transition-colors whitespace-nowrap self-start sm:self-auto disabled:opacity-60 hover:bg-[#FAFAFA]"
            >
              {seeding ? "Generating…" : "Generate demo data"}
            </button>
            <button
              type="button"
              onClick={() => {
                setShowCreate(true);
                setCreateFlow("pick");
                setCreateMessage("");
              }}
              className="inline-flex items-center gap-2 medflow-primary-button font-medium text-base px-5 py-2.5 rounded-[10px] shadow-sm transition-colors whitespace-nowrap self-start sm:self-auto"
            >
              <PlusIcon />
              New Appointment
            </button>
          </div>
        </div>

        {showCreate && (
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-[#1A1A2E] text-lg font-semibold">New appointment</h2>
              <button
                type="button"
                onClick={() => {
                  setShowCreate(false);
                  setCreateFlow("pick");
                  setCreateMessage("");
                }}
                className="px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm hover:bg-[#FAFAFA]"
              >
                Close
              </button>
            </div>

            {createFlow === "pick" && (
              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  type="button"
                  onClick={() => setCreateFlow("write")}
                  className="flex-1 rounded-xl border-2 border-[#047857] bg-[rgba(4,120,87,0.08)] px-5 py-4 text-left hover:bg-[rgba(4,120,87,0.14)] transition-colors"
                >
                  <span className="block text-[#1A1A2E] font-semibold">Type details</span>
                  <span className="block text-sm text-[#6B7280] mt-1">
                    Enter patient name, date, time, and visit type. The scheduling agent adds it to your calendar.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSpeakDialogOpenChange(true)}
                  className="flex-1 rounded-xl border-2 border-[#E5E7EB] bg-[#FAFAFA] px-5 py-4 text-left hover:border-[#047857] transition-colors"
                >
                  <span className="block text-[#1A1A2E] font-semibold">Speak naturally</span>
                  <span className="block text-sm text-[#6B7280] mt-1">
                    Use your voice. Say the patient&apos;s full name clearly, plus date, time, and visit type.
                  </span>
                </button>
              </div>
            )}

            {createFlow === "write" && (
              <>
                <p className="text-sm text-[#6B7280] mb-3">
                  The patient must already exist in MedFlow (same name as in Patients). The agent matches by name and
                  syncs Google Calendar when configured.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                  <label className="text-sm text-[#6B7280] md:col-span-2">
                    Patient full name *
                    <input
                      type="text"
                      value={newAppointment.patientName}
                      onChange={(event) =>
                        setNewAppointment((current) => ({
                          ...current,
                          patientName: event.target.value,
                        }))
                      }
                      placeholder="e.g. Maria Lopez"
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#1A1A2E]"
                    />
                  </label>
                  <label className="text-sm text-[#6B7280]">
                    Date *
                    <input
                      type="date"
                      value={newAppointment.date}
                      onChange={(event) =>
                        setNewAppointment((current) => ({ ...current, date: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[#6B7280]">
                    Time *
                    <input
                      type="time"
                      value={newAppointment.time}
                      onChange={(event) =>
                        setNewAppointment((current) => ({ ...current, time: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2"
                    />
                  </label>
                  <label className="text-sm text-[#6B7280] lg:col-span-2">
                    Visit type *
                    <select
                      value={newAppointment.type}
                      onChange={(event) =>
                        setNewAppointment((current) => ({ ...current, type: event.target.value }))
                      }
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2"
                    >
                      <option value="follow-up">follow-up</option>
                      <option value="new-visit">new-visit</option>
                      <option value="lab-review">lab-review</option>
                      <option value="annual-physical">annual-physical</option>
                      <option value="consultation">consultation</option>
                    </select>
                  </label>
                </div>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-sm hover:bg-[#FAFAFA]"
                    onClick={() => setCreateFlow("pick")}
                  >
                    Back
                  </button>
                  <button
                    type="button"
                    disabled={creating}
                    onClick={async () => {
                      if (!newAppointment.patientName.trim()) {
                        setCreateMessage("Enter the patient’s full name.");
                        return;
                      }
                      setCreating(true);
                      setCreateMessage("");
                      try {
                        const command = buildCalendarScheduleCommand({
                          patientName: newAppointment.patientName,
                          date: newAppointment.date,
                          time: newAppointment.time,
                          type: newAppointment.type,
                        });
                        await api.post("/calendar/command", { command });
                        setCreateMessage("Appointment added via the scheduling agent.");
                        setShowCreate(false);
                        setCreateFlow("pick");
                        await loadAppointments();
                      } catch (err) {
                        let msg = "Unable to add appointment.";
                        if (axios.isAxiosError(err)) {
                          const apiMsg = (err.response?.data as { error?: { message?: string } })?.error?.message;
                          if (apiMsg) msg = apiMsg;
                        }
                        setCreateMessage(msg);
                      } finally {
                        setCreating(false);
                      }
                    }}
                    className="medflow-primary-button px-4 py-2 rounded-lg font-medium disabled:opacity-60"
                  >
                    {creating ? "Adding…" : "Add to calendar"}
                  </button>
                  {createMessage && <p className="text-sm text-[#6B7280]">{createMessage}</p>}
                </div>
              </>
            )}

          </div>
        )}

        <Dialog open={speakDialogOpen} onOpenChange={handleSpeakDialogOpenChange}>
          <DialogContent className="max-w-lg w-[calc(100vw-2rem)] gap-0 border-[#E5E7EB] bg-white p-0 overflow-hidden sm:rounded-xl">
            <DialogHeader className="px-6 pt-6 pb-3 text-left">
              <DialogTitle className="text-[#1A1A2E] text-lg font-semibold">Schedule by voice</DialogTitle>
            </DialogHeader>

            <div className="flex flex-col items-center px-6 pb-4 border-t border-[#F3F4F6] bg-[#FAFAFA]">
              <button
                type="button"
                onClick={toggleSpeakMic}
                disabled={!speech.supported}
                aria-pressed={speech.isListening}
                aria-label={speech.isListening ? "Stop recording" : "Start recording"}
                className={`flex h-20 w-20 items-center justify-center rounded-full shadow-md transition-all ${
                  speech.isListening
                    ? "bg-[#047857] text-white ring-4 ring-[#047857]/25 scale-[1.02]"
                    : "bg-white border-2 border-[#047857] text-[#047857] hover:bg-[rgba(4,120,87,0.08)]"
                } disabled:opacity-45 disabled:cursor-not-allowed`}
              >
                <span className="scale-150">
                  <IconMic />
                </span>
              </button>
              <p className="mt-3 text-xs font-medium text-[#047857]" aria-live="polite">
                {speech.isListening ? "Listening… tap again when finished" : "Tap the microphone to speak"}
              </p>
              {!speech.supported && (
                <p className="mt-2 text-xs text-center text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 max-w-sm">
                  Voice input isn&apos;t available in this browser. Use &quot;Type details&quot; instead, or try Chrome
                  or Edge.
                </p>
              )}
            </div>

            <DialogDescription asChild>
              <div className="px-6 pb-4 text-[#6B7280] text-sm leading-relaxed space-y-3 border-t border-[#F3F4F6] bg-white">
                <p className="text-[#1A1A2E] font-medium text-[13px] pt-1">
                  While speaking, include everything the agent needs:
                </p>
                <ul className="list-disc pl-5 space-y-1.5 text-[13px]">
                  <li>
                    <span className="font-medium text-[#374151]">Patient full name</span> — must match a patient already
                    in MedFlow (Patients tab).
                  </li>
                  <li>
                    <span className="font-medium text-[#374151]">Visit type</span> — say it in plain words, for example
                    follow-up, new patient visit, lab review, annual physical, or consultation.
                  </li>
                  <li>
                    <span className="font-medium text-[#374151]">Date</span> — e.g. &quot;tomorrow&quot;, &quot;March
                    15&quot;, &quot;next Tuesday&quot;.
                  </li>
                  <li>
                    <span className="font-medium text-[#374151]">Time</span> — e.g. &quot;2 PM&quot;, &quot;9:30 AM&quot;.
                  </li>
                  <li>
                    <span className="font-medium text-[#374151]">Optional:</span> duration, e.g. &quot;for 30
                    minutes&quot;.
                  </li>
                </ul>
                <div className="pt-3 border-t border-[#E5E7EB]">
                  <p className="text-[13px] font-medium text-[#374151] mb-1.5">Try saying something like:</p>
                  <p className="text-sm text-[#1A1A2E] leading-relaxed rounded-lg bg-[rgba(4,120,87,0.06)] border border-[rgba(4,120,87,0.15)] px-3 py-2.5">
                    &ldquo;Schedule Maria Lopez for a follow-up tomorrow at two PM.&rdquo;
                  </p>
                  <p className="text-xs text-[#6B7280] mt-2">
                    Swap in your patient&apos;s name, the visit type, and the date and time you want — you don&apos;t need
                    special wording or brackets.
                  </p>
                </div>
              </div>
            </DialogDescription>

            <div className="px-6 pb-4 space-y-3 border-t border-[#F3F4F6] bg-[#FAFAFA]">
              {speech.fullTranscript ? (
                <p className="text-sm text-[#374151] bg-white border border-[#E5E7EB] rounded-lg px-3 py-2.5 text-left leading-relaxed">
                  {speech.fullTranscript}
                </p>
              ) : (
                !speech.isListening && (
                  <p className="text-xs text-[#9CA3AF] text-center py-1">Your words will appear here.</p>
                )
              )}
              {speakError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg px-3 py-2">
                  {speakError}
                </p>
              )}
            </div>

            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-6 py-4 border-t border-[#E5E7EB] bg-white">
              <button
                type="button"
                onClick={() => handleSpeakDialogOpenChange(false)}
                className="px-4 py-2.5 rounded-lg border border-[#E5E7EB] text-sm font-medium text-[#374151] hover:bg-[#FAFAFA]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={
                  speakSubmitting || !speech.fullTranscript.trim() || !speech.supported
                }
                onClick={() => void submitVoiceAppointment()}
                className="medflow-primary-button px-5 py-2.5 rounded-lg text-sm font-medium disabled:opacity-60"
              >
                {speakSubmitting ? "Creating…" : "Create appointment"}
              </button>
            </div>
          </DialogContent>
        </Dialog>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {appointmentSummaries.map((summary) => (
            <div
              key={summary.label}
              className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm p-6 flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-full ${summary.iconBg} flex items-center justify-center flex-shrink-0`}>
                {summary.icon}
              </div>
              <div>
                <p className="text-[#6A7282] text-sm font-medium leading-5 tracking-[-0.15px]">
                  {summary.label}
                </p>
                <p className="text-[#1E2939] text-2xl font-bold leading-8 tracking-[0.07px]">
                  {summary.value}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm flex flex-col">
          <div className="flex flex-col gap-3 border-b border-[#F3F4F6] px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6 sm:py-5">
            <h2 className="text-[#1E2939] font-bold text-lg leading-7 tracking-[-0.44px]">
              Schedule
            </h2>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setScheduleView("week")}
                className={`rounded-lg px-4 py-2 text-sm font-medium leading-5 tracking-[-0.15px] transition-colors ${
                  scheduleView === "week"
                    ? "border border-[#047857] bg-[#047857] text-white hover:bg-[#065f46]"
                    : "border border-[#E5E7EB] bg-white text-[#4A5565] hover:bg-gray-50"
                }`}
              >
                Week
              </button>
              <button
                type="button"
                onClick={() => setScheduleView("list")}
                className={`rounded-lg px-4 py-2 text-sm font-medium leading-5 tracking-[-0.15px] transition-colors ${
                  scheduleView === "list"
                    ? "border border-[#047857] bg-[#047857] text-white hover:bg-[#065f46]"
                    : "border border-[#E5E7EB] bg-white text-[#4A5565] hover:bg-gray-50"
                }`}
              >
                List
              </button>
            </div>
          </div>

          {loading && (
            <div className="p-6">
              <StateMessage
                tone="loading"
                title="Loading appointments"
                message="Fetching your current schedule."
              />
            </div>
          )}
          {error && !loading && (
            <div className="p-6">
              <StateMessage
                tone="error"
                title="Appointments unavailable"
                message={error}
                actionLabel="Retry"
                onAction={() => void loadAppointments()}
              />
            </div>
          )}

          {!loading && !error && scheduleView === "week" && (
            <div className="p-4 sm:p-6">
              <AppointmentWeekGrid
                weekStart={weekStart}
                appointments={weekGridAppointments}
                onPrevWeek={() => setWeekStart((d) => addDays(d, -7))}
                onNextWeek={() => setWeekStart((d) => addDays(d, 7))}
                onThisWeek={() => setWeekStart(startOfWeekSunday(new Date()))}
              />
            </div>
          )}

          {!loading && !error && scheduleView === "list" && (
          <div className="flex flex-col divide-y divide-[#F3F4F6] pb-2">
            {groupedAppointments.map(([date, dayAppointments]) => (
              <div key={date} className="flex flex-col">
                <div className="px-6 pt-5 pb-1 bg-[#FAFAFA]">
                  <p className="text-xs font-semibold uppercase tracking-[0.6px] text-[#6B7280]">
                    {new Date(`${date}T00:00:00`).toLocaleDateString("en-US", {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    })}
                  </p>
                </div>
                {dayAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-6 py-6"
                  >
                    <div className="flex items-center gap-6">
                      <div className="flex flex-col items-center w-14 flex-shrink-0">
                        <span className="text-[#047857] font-bold text-sm leading-5 tracking-[-0.15px]">
                          {appointment.time}
                        </span>
                        <span className="text-[#6A7282] text-xs leading-4">
                          {appointment.period}
                        </span>
                      </div>

                      <div
                        className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-lg leading-7 tracking-[-0.44px]"
                        style={{
                          backgroundColor: appointment.avatarBg,
                          color: appointment.avatarColor,
                        }}
                      >
                        {appointment.initials}
                      </div>

                      <div className="flex flex-col gap-0.5">
                        <span className="text-[#1E2939] font-bold text-lg leading-7 tracking-[-0.44px] flex flex-wrap items-center gap-2">
                          {appointment.name}
                          {appointment.name === SAMPLE_PATIENT_NAME && (
                            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">
                              Sample
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-1">
                          <FileIcon />
                          <span className="text-[#6A7282] text-sm leading-5 tracking-[-0.15px]">
                            {appointment.type}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1 sm:gap-2 ml-20 sm:ml-0">
                      {appointment.status !== "in-progress" && (
                        <span
                          className={`px-3 py-1 rounded-full border text-xs font-medium ${statusClass(appointment.status)}`}
                        >
                          {appointment.status}
                        </span>
                      )}
                      <Link
                        to={`/session/${appointment.id}`}
                        className="px-4 py-2 rounded-[10px] medflow-primary-button text-sm font-medium leading-5 tracking-[-0.15px] whitespace-nowrap"
                      >
                        Record visit
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            ))}
            {!appointments.length && (
              <div className="px-6 py-10 text-center text-[#6B7280]">
                <StateMessage
                  title="No appointments yet"
                  message="New visits scheduled through MedFlow will appear here."
                />
              </div>
            )}
          </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}
