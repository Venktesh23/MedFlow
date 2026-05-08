import { useCallback, useEffect, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, Loader2, User } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";
import { api, responseData } from "@/services/api";

type SettingsTab = "profile" | "calendar";

type GoogleCalendarStatus = {
  envVarsPresent: boolean;
  clientReady: boolean;
  calendarIdMasked: string | null;
  timeZone: string;
  serviceAccountEmailMasked: string | null;
  keyFileReadable: boolean;
};

type SettingsStatusResponse = {
  googleCalendarConfigured?: boolean;
  googleCalendar?: GoogleCalendarStatus;
};

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const [activeTab, setActiveTab] = useState<SettingsTab>("profile");
  const [profile, setProfile] = useState({
    name: user?.name || "Dr. Jenkins",
    clinicName: user?.clinicName || "MedFlow Clinic",
    specialty: user?.specialty || "Primary Care",
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  const [statusLoading, setStatusLoading] = useState(true);
  const [calendarStatus, setCalendarStatus] = useState<GoogleCalendarStatus | null>(null);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; message?: string | null } | null>(null);

  const loadSettingsStatus = useCallback(async () => {
    setStatusLoading(true);
    setTestResult(null);
    try {
      const response = await api.get("/settings/status");
      const data = responseData<SettingsStatusResponse>(response);
      setCalendarStatus(data.googleCalendar ?? null);
    } catch {
      setCalendarStatus(null);
    } finally {
      setStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    loadSettingsStatus();
  }, [loadSettingsStatus]);

  async function runConnectionTest() {
    setTestingConnection(true);
    setTestResult(null);
    try {
      const response = await api.post("/settings/calendar/test");
      const data = responseData<{ ok: boolean; message?: string | null }>(response);
      setTestResult({ ok: data.ok, message: data.message });
    } catch {
      setTestResult({ ok: false, message: "Could not reach the server to test the connection." });
    } finally {
      setTestingConnection(false);
    }
  }

  const gc = calendarStatus;
  const fullyConnected = Boolean(gc?.envVarsPresent && gc?.clientReady);
  const needsAttention = Boolean(gc?.envVarsPresent && !gc?.clientReady);

  return (
    <AppShell>
      <div className="px-6 pt-1 pb-12 md:px-8 md:pt-2 md:pb-14 flex flex-col gap-6 medflow-page-bg min-h-full">
        <div>
          <h1 className="text-[#1A1A2E] text-2xl md:text-[30px] font-bold">Settings</h1>
          <p className="text-[#6B7280] mt-1">Profile and integrations.</p>
        </div>

        <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-1">
          {(
            [
              ["profile", User, "Doctor profile"],
              ["calendar", Calendar, "Calendar integration"],
            ] as const
          ).map(([id, Icon, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setActiveTab(id)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === id
                  ? "bg-[#047857]/10 text-[#047857]"
                  : "text-[#6B7280] hover:bg-[#F9FAFB] hover:text-[#1A1A2E]"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" aria-hidden />
              {label}
            </button>
          ))}
        </div>

        {activeTab === "profile" && (
          <section className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5">
            <h2 className="text-[#1A1A2E] font-semibold mb-4">Doctor Profile</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(
                [
                  ["name", "Doctor Name"],
                  ["clinicName", "Clinic Name"],
                  ["specialty", "Specialty"],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="text-sm text-[#6B7280]">
                  {label}
                  <input
                    value={profile[key]}
                    onChange={(event) =>
                      setProfile((current) => ({ ...current, [key]: event.target.value }))
                    }
                    className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-[#1A1A2E] outline-none focus:border-[#047857]"
                  />
                </label>
              ))}
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                type="button"
                disabled={saving}
                onClick={async () => {
                  setSaving(true);
                  setSaveMessage("");
                  try {
                    await updateProfile(profile);
                    setSaveMessage("Profile updated successfully.");
                  } catch {
                    setSaveMessage("Unable to save profile. Please try again.");
                  } finally {
                    setSaving(false);
                  }
                }}
                className="medflow-primary-button px-4 py-2 rounded-lg font-medium disabled:opacity-60"
              >
                {saving ? "Saving..." : "Save Profile"}
              </button>
              {saveMessage && <p className="text-sm text-[#6B7280]">{saveMessage}</p>}
            </div>
          </section>
        )}

        {activeTab === "calendar" && (
          <section className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5">
            <h2 className="text-[#1A1A2E] font-semibold mb-1">Google Calendar</h2>
            <p className="text-sm text-[#6B7280] mb-6">
              MedFlow syncs appointments to Google Calendar using a service account on the server. Connection
              details are configured by your administrator in the backend environment—not stored in your
              browser.
            </p>

            {statusLoading ? (
              <div className="flex items-center gap-2 text-[#6B7280] text-sm">
                <Loader2 className="h-4 w-4 animate-spin shrink-0" aria-hidden />
                Loading integration status…
              </div>
            ) : !gc ? (
              <p className="text-sm text-[#B45309]">Could not load calendar status. Try again later.</p>
            ) : fullyConnected ? (
              <div className="space-y-6">
                <div className="flex flex-wrap items-start gap-3 rounded-lg border border-emerald-200 bg-emerald-50/80 px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-700 shrink-0 mt-0.5" aria-hidden />
                  <div>
                    <p className="font-medium text-emerald-900">Calendar integration is connected</p>
                    <p className="text-sm text-emerald-800/90 mt-1">
                      Appointments can sync to Google Calendar when the API is reachable.
                    </p>
                  </div>
                </div>

                <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                  <div>
                    <dt className="text-[#6B7280]">Calendar ID</dt>
                    <dd className="mt-1 font-mono text-[#1A1A2E]">{gc.calendarIdMasked ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[#6B7280]">Event timezone</dt>
                    <dd className="mt-1 text-[#1A1A2E]">{gc.timeZone}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-[#6B7280]">Service account</dt>
                    <dd className="mt-1 font-mono text-[#1A1A2E]">
                      {gc.serviceAccountEmailMasked ?? "—"}
                    </dd>
                  </div>
                </dl>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={testingConnection}
                    onClick={() => void runConnectionTest()}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#1A1A2E] hover:bg-[#F9FAFB] disabled:opacity-60"
                  >
                    {testingConnection ? "Testing…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadSettingsStatus()}
                    className="text-sm font-medium text-[#047857] hover:underline"
                  >
                    Refresh status
                  </button>
                </div>

                {testResult && (
                  <div
                    className={`rounded-lg px-4 py-3 text-sm ${
                      testResult.ok
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border border-amber-200 bg-amber-50 text-amber-950"
                    }`}
                  >
                    {testResult.ok ? (
                      <span className="font-medium">Google Calendar API responded successfully.</span>
                    ) : (
                      <span>{testResult.message || "Connection test failed."}</span>
                    )}
                  </div>
                )}

                <div className="border-t border-[#E5E7EB] pt-6">
                  <h3 className="text-[#1A1A2E] font-medium mb-2">Edit or replace this integration</h3>
                  <p className="text-sm text-[#6B7280] mb-3">
                    To use a different calendar or service account, update the server configuration and restart
                    the MedFlow API:
                  </p>
                  <ul className="list-disc pl-5 text-sm text-[#374151] space-y-1">
                    <li>
                      Set <code className="rounded bg-[#F3F4F6] px-1">GOOGLE_CALENDAR_ID</code> and{" "}
                      <code className="rounded bg-[#F3F4F6] px-1">GOOGLE_SERVICE_ACCOUNT_KEY_PATH</code> in{" "}
                      <code className="rounded bg-[#F3F4F6] px-1">backend/.env</code>.
                    </li>
                    <li>
                      In Google Calendar, share the target calendar with the service account email (make changes
                      events).
                    </li>
                    <li>Optional: set timezone via GOOGLE_CALENDAR_TIME_ZONE.</li>
                    <li>Restart the backend so changes take effect, then use Refresh status here.</li>
                  </ul>
                </div>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] px-4 py-5">
                  <p className="font-medium text-[#1A1A2E]">
                    {gc.envVarsPresent ? "Finish configuring Google Calendar" : "Connect Google Calendar"}
                  </p>
                  <p className="text-sm text-[#6B7280] mt-2">
                    {gc.envVarsPresent
                      ? needsAttention
                        ? "Environment variables are set, but the server could not load the service account key or initialize the Google client. Check the key path, JSON file, and API enablement."
                        : "Complete the steps below so appointments can sync."
                      : "Your deployment has not set calendar credentials yet. Follow these steps to enable syncing."}
                  </p>
                  {needsAttention && (
                    <div className="mt-4 flex gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                      <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" aria-hidden />
                      <span>
                        Key file readable: {gc.keyFileReadable ? "yes" : "no"}. Service account shown when the
                        key loads correctly.
                      </span>
                    </div>
                  )}
                </div>

                <ol className="list-decimal pl-5 space-y-3 text-sm text-[#374151]">
                  <li>
                    Create or choose a Google Cloud project, enable the{" "}
                    <strong className="font-medium">Google Calendar API</strong>, and create a{" "}
                    <strong className="font-medium">service account</strong> with a JSON key file.
                  </li>
                  <li>
                    Place the JSON on the API server and set{" "}
                    <code className="rounded bg-[#F3F4F6] px-1">GOOGLE_SERVICE_ACCOUNT_KEY_PATH</code> to that
                    path.
                  </li>
                  <li>
                    Copy your calendar ID from Google Calendar settings and set{" "}
                    <code className="rounded bg-[#F3F4F6] px-1">GOOGLE_CALENDAR_ID</code>.
                  </li>
                  <li>
                    Share the calendar with the service account email from the JSON (
                    <strong className="font-normal">Make changes to events</strong>).
                  </li>
                  <li>Restart the MedFlow backend and return here to verify.</li>
                </ol>

                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    disabled={testingConnection || !gc.envVarsPresent}
                    onClick={() => void runConnectionTest()}
                    className="medflow-primary-button px-4 py-2 rounded-lg font-medium disabled:opacity-60"
                  >
                    {testingConnection ? "Testing…" : "Test connection"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadSettingsStatus()}
                    className="rounded-lg border border-[#E5E7EB] bg-white px-4 py-2 text-sm font-medium text-[#1A1A2E] hover:bg-[#F9FAFB]"
                  >
                    Refresh status
                  </button>
                </div>
                {!gc.envVarsPresent && (
                  <p className="text-xs text-[#6B7280]">
                    Test connection is available after GOOGLE_CALENDAR_ID and GOOGLE_SERVICE_ACCOUNT_KEY_PATH are
                    set on the server.
                  </p>
                )}

                {testResult && (
                  <div
                    className={`rounded-lg px-4 py-3 text-sm ${
                      testResult.ok
                        ? "border border-emerald-200 bg-emerald-50 text-emerald-900"
                        : "border border-amber-200 bg-amber-50 text-amber-950"
                    }`}
                  >
                    {testResult.ok ? (
                      <span className="font-medium">Google Calendar API responded successfully.</span>
                    ) : (
                      <span>{testResult.message || "Connection test failed."}</span>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </AppShell>
  );
}
