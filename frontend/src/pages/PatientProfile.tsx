import { useEffect, useState, type FormEvent } from "react";
import axios from "axios";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ClinicalNotePanel } from "@/components/ClinicalNotePanel";
import { StateMessage } from "@/components/StateMessage";
import { AppShell } from "@/components/layout/AppShell";
import { api, responseData } from "@/services/api";

function formatDate(date?: string) {
  if (!date) return "Unknown date";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PatientProfile() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const editMode = searchParams.get("edit") === "1";

  const [profile, setProfile] = useState<any>(null);
  const [expandedNote, setExpandedNote] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    name: "",
    dob: "",
    contact: "",
    insurance: "",
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");
  const [deleting, setDeleting] = useState(false);

  async function loadProfile(options?: { silent?: boolean }) {
    const silent = Boolean(options?.silent);
    if (!silent) {
      setLoading(true);
      setError("");
    }
    try {
      const response = await api.get(`/patients/${id}`);
      setProfile(responseData(response));
    } catch {
      setProfile(null);
      setError("Unable to load this patient profile.");
    } finally {
      if (!silent) setLoading(false);
    }
  }

  useEffect(() => {
    if (id) void loadProfile();
  }, [id]);

  const patient = profile?.patient;

  useEffect(() => {
    if (!patient) return;
    setForm({
      name: patient.name || "",
      dob: patient.dob || "",
      contact: patient.contact || "",
      insurance: patient.insurance || "",
    });
    setSaveMessage("");
  }, [patient]);

  async function savePatientDetails(event: FormEvent) {
    event.preventDefault();
    if (!id || !form.name.trim()) return;
    setSaving(true);
    setSaveMessage("");
    try {
      await api.put(`/patients/${id}`, {
        name: form.name.trim(),
        dob: form.dob.trim(),
        contact: form.contact.trim(),
        insurance: form.insurance.trim(),
      });
      const next = new URLSearchParams(searchParams);
      next.delete("edit");
      setSearchParams(next);
      await loadProfile({ silent: true });
      setSaveMessage("Patient details saved.");
    } catch {
      setSaveMessage("Could not save changes. Try again.");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    const next = new URLSearchParams(searchParams);
    next.delete("edit");
    setSearchParams(next);
    setSaveMessage("");
    if (patient) {
      setForm({
        name: patient.name || "",
        dob: patient.dob || "",
        contact: patient.contact || "",
        insurance: patient.insurance || "",
      });
    }
  }

  async function handleDeletePatient() {
    if (!id || !patient || deleting) return;
    if (
      !window.confirm(
        "Remove this patient from MedFlow? If they have clinical notes or appointments, you will be asked to confirm a full delete.",
      )
    ) {
      return;
    }
    setDeleting(true);
    setSaveMessage("");
    try {
      await api.delete(`/patients/${id}`);
      navigate("/patients");
    } catch (err) {
      if (axios.isAxiosError(err) && err.response?.status === 409) {
        const msg =
          (err.response?.data as { error?: { message?: string } })?.error?.message ||
          "This patient has related records.";
        if (
          window.confirm(
            `${msg}\n\nPermanently delete this patient and ALL related notes and appointments? This cannot be undone.`,
          )
        ) {
          try {
            await api.delete(`/patients/${id}`, { params: { force: true } });
            navigate("/patients");
          } catch (err2) {
            const msg2 = axios.isAxiosError(err2)
              ? (err2.response?.data as { error?: { message?: string } })?.error?.message
              : null;
            setSaveMessage(msg2 || "Could not delete patient. Try again.");
          }
        }
      } else {
        const msg = axios.isAxiosError(err)
          ? (err.response?.data as { error?: { message?: string } })?.error?.message
          : null;
        setSaveMessage(msg || "Could not delete patient. Try again.");
      }
    } finally {
      setDeleting(false);
    }
  }
  const appointments = profile?.appointments || [];
  const notes = profile?.notes || [];
  const upcoming = appointments.find((appointment) => appointment.status !== "completed");

  return (
    <AppShell>
      <div className="px-6 pt-1 pb-12 md:px-8 md:pt-2 md:pb-14 flex flex-col gap-6 medflow-page-bg min-h-full">
        <div>
          <h1 className="text-[#1A1A2E] text-2xl md:text-[30px] font-bold">
            {patient?.name || "Patient Profile"}
          </h1>
          <p className="text-[#6B7280] mt-1">Clinical timeline, notes, and upcoming care.</p>
        </div>

        {!loading && !error && saveMessage && !editMode && (
          <div
            className={`rounded-lg border px-4 py-3 text-sm ${
              saveMessage.includes("Could not")
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-[#1E2A38]/20 bg-[#1E2A38]/5 text-[#1E2A38]"
            }`}
          >
            {saveMessage}
          </div>
        )}

        {loading && (
          <StateMessage
            tone="loading"
            title="Loading patient profile"
            message="Fetching patient details, visits, and notes."
          />
        )}
        {error && !loading && (
          <StateMessage
            tone="error"
            title="Patient unavailable"
            message={error}
            actionLabel="Retry"
            onAction={() => void loadProfile()}
          />
        )}

        {!loading && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
          <aside className="flex flex-col gap-5">
            <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5">
              <h2 className="text-[#1A1A2E] font-semibold mb-4">Patient Info</h2>
              {editMode ? (
                <form onSubmit={(e) => void savePatientDetails(e)} className="space-y-4">
                  <label className="block text-sm text-[#6B7280]">
                    Full name
                    <input
                      required
                      value={form.name}
                      onChange={(event) => setForm((f) => ({ ...f, name: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#1A1A2E] outline-none focus:border-[#1E2A38]"
                    />
                  </label>
                  <label className="block text-sm text-[#6B7280]">
                    Date of birth
                    <input
                      value={form.dob}
                      onChange={(event) => setForm((f) => ({ ...f, dob: event.target.value }))}
                      placeholder="e.g. 1985-03-12"
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#1A1A2E] outline-none focus:border-[#1E2A38]"
                    />
                  </label>
                  <label className="block text-sm text-[#6B7280]">
                    Contact
                    <input
                      value={form.contact}
                      onChange={(event) => setForm((f) => ({ ...f, contact: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#1A1A2E] outline-none focus:border-[#1E2A38]"
                    />
                  </label>
                  <label className="block text-sm text-[#6B7280]">
                    Insurance
                    <input
                      value={form.insurance}
                      onChange={(event) => setForm((f) => ({ ...f, insurance: event.target.value }))}
                      className="mt-1 w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-[#1A1A2E] outline-none focus:border-[#1E2A38]"
                    />
                  </label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button
                      type="submit"
                      disabled={saving}
                      className="medflow-primary-button px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60"
                    >
                      {saving ? "Saving…" : "Save changes"}
                    </button>
                    <button
                      type="button"
                      disabled={saving}
                      onClick={cancelEdit}
                      className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#374151] hover:bg-[#F9FAFB] disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </div>
                  {saveMessage && saveMessage.includes("Could not") && (
                    <p className="text-sm text-red-600">{saveMessage}</p>
                  )}
                </form>
              ) : (
                <div className="space-y-3 text-sm">
                  <p><span className="text-[#6B7280]">DOB:</span> {patient?.dob || "Not provided"}</p>
                  <p><span className="text-[#6B7280]">Contact:</span> {patient?.contact || "Not provided"}</p>
                  <p><span className="text-[#6B7280]">Insurance:</span> {patient?.insurance || "Not provided"}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setSaveMessage("");
                      const next = new URLSearchParams(searchParams);
                      next.set("edit", "1");
                      setSearchParams(next);
                    }}
                    className="mt-2 text-sm font-medium text-[#1E2A38] hover:underline"
                  >
                    Edit details
                  </button>
                  <div className="mt-6 pt-4 border-t border-[#F3F4F6]">
                    <p className="text-xs font-medium text-[#6B7280] uppercase tracking-wide mb-2">
                      Danger zone
                    </p>
                    <button
                      type="button"
                      disabled={deleting}
                      onClick={() => void handleDeletePatient()}
                      className="text-sm font-medium text-red-700 hover:text-red-800 disabled:opacity-50"
                    >
                      {deleting ? "Deleting…" : "Delete patient"}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5">
              <h2 className="text-[#1A1A2E] font-semibold mb-3">Upcoming Appointment</h2>
              <p className="text-sm text-[#6B7280]">
                {upcoming ? `${upcoming.date} at ${upcoming.time} • ${upcoming.type}` : "None scheduled"}
              </p>
            </div>
          </aside>

          <main className="flex flex-col gap-5">
            <section className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5">
              <h2 className="text-[#1A1A2E] font-semibold mb-4">Visit History</h2>
              <div className="space-y-4">
                {appointments.map((appointment) => (
                  <div key={appointment._id} className="border-l-2 border-[#1E2A38] pl-4">
                    <p className="text-[#1A1A2E] font-medium">{appointment.type}</p>
                    <p className="text-sm text-[#6B7280]">
                      {appointment.date} at {appointment.time} • {appointment.status}
                    </p>
                  </div>
                ))}
                {!appointments.length && <p className="text-sm text-[#6B7280]">No visits yet.</p>}
              </div>
            </section>

            <section className="flex flex-col gap-4">
              <h2 className="text-[#1A1A2E] text-xl font-semibold">Clinical notes</h2>
              {notes.map((note) => (
                <div key={note._id} className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5">
                  <button
                    type="button"
                    onClick={() => setExpandedNote(expandedNote === note._id ? null : note._id)}
                    className="w-full text-left"
                  >
                    <p className="text-[#1A1A2E] font-semibold">{formatDate(note.createdAt)}</p>
                    <p className="text-sm text-[#6B7280] line-clamp-2">
                      {note.soapNote?.assessment || note.soapNote?.subjective || "Clinical note"}
                    </p>
                  </button>
                  {expandedNote === note._id && (
                    <div className="mt-4">
                      <ClinicalNotePanel note={note.soapNote} />
                    </div>
                  )}
                </div>
              ))}
              {!notes.length && (
                <StateMessage
                  title="No clinical notes yet"
                  message="Completed sessions for this patient will appear here."
                />
              )}
            </section>
          </main>
        </div>
        )}
      </div>
    </AppShell>
  );
}
