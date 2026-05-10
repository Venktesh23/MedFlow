import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { useAuth } from "@/context/AuthContext";

function hourLabel(h: number) {
  const x = h % 12 || 12;
  const suffix = h >= 12 ? "PM" : "AM";
  return `${x} ${suffix}`;
}

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${String(h).padStart(2, "0")}:00 (${hourLabel(h)})`,
}));

export default function Settings() {
  const { user, updateProfile } = useAuth();
  const [profile, setProfile] = useState({
    name: user?.name || "Dr. Jenkins",
    clinicName: user?.clinicName || "MedFlow Clinic",
    specialty: user?.specialty || "Primary Care",
    clinicHoursStart: user?.clinicHoursStart ?? 6,
    clinicHoursEnd: user?.clinicHoursEnd ?? 21,
  });
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    if (!user) return;
    setProfile({
      name: user.name || "",
      clinicName: user.clinicName || "",
      specialty: user.specialty || "",
      clinicHoursStart: user.clinicHoursStart ?? 6,
      clinicHoursEnd: user.clinicHoursEnd ?? 21,
    });
  }, [user]);

  return (
    <AppShell>
      <div className="px-6 pt-1 pb-12 md:px-8 md:pt-2 md:pb-14 flex flex-col gap-6 medflow-page-bg min-h-full">
        <div>
          <h1 className="text-[#1A1A2E] text-2xl md:text-[30px] font-bold">Settings</h1>
          <p className="text-[#6B7280] mt-1">Doctor profile and clinic hours for your calendar.</p>
        </div>

        <section className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5">
          <h2 className="text-[#1A1A2E] font-semibold mb-4">Doctor profile</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="text-sm text-[#6B7280]">
              Doctor name
              <input
                value={profile.name}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, name: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-[#1A1A2E] outline-none focus:border-[#047857]"
              />
            </label>
            <label className="text-sm text-[#6B7280]">
              Specialty
              <input
                value={profile.specialty}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, specialty: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-[#1A1A2E] outline-none focus:border-[#047857]"
              />
            </label>
          </div>
        </section>

        <section className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5">
          <h2 className="text-[#1A1A2E] font-semibold mb-1">Clinic</h2>
          <p className="text-sm text-[#6B7280] mb-4">
            The Appointments week view only shows hours from opening through closing (inclusive). Example:
            10:00–17:00 for 10 AM–5 PM.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label className="text-sm text-[#6B7280] md:col-span-3">
              Clinic name
              <input
                value={profile.clinicName}
                onChange={(event) =>
                  setProfile((current) => ({ ...current, clinicName: event.target.value }))
                }
                className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-[#1A1A2E] outline-none focus:border-[#047857]"
              />
            </label>
            <label className="text-sm text-[#6B7280]">
              Opens (first hour shown)
              <select
                value={profile.clinicHoursStart}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    clinicHoursStart: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-[#1A1A2E] outline-none focus:border-[#047857] bg-white"
              >
                {HOUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm text-[#6B7280]">
              Closes (last hour shown)
              <select
                value={profile.clinicHoursEnd}
                onChange={(event) =>
                  setProfile((current) => ({
                    ...current,
                    clinicHoursEnd: Number(event.target.value),
                  }))
                }
                className="mt-2 w-full rounded-lg border border-[#E5E7EB] px-4 py-2 text-[#1A1A2E] outline-none focus:border-[#047857] bg-white"
              >
                {HOUR_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              setSaving(true);
              setSaveMessage("");
              try {
                await updateProfile({
                  name: profile.name,
                  clinicName: profile.clinicName,
                  specialty: profile.specialty,
                  clinicHoursStart: profile.clinicHoursStart,
                  clinicHoursEnd: profile.clinicHoursEnd,
                });
                setSaveMessage("Settings saved.");
              } catch {
                setSaveMessage("Unable to save. Please try again.");
              } finally {
                setSaving(false);
              }
            }}
            className="medflow-primary-button px-4 py-2 rounded-lg font-medium disabled:opacity-60"
          >
            {saving ? "Saving..." : "Save settings"}
          </button>
          {saveMessage && <p className="text-sm text-[#6B7280]">{saveMessage}</p>}
        </div>
      </div>
    </AppShell>
  );
}
