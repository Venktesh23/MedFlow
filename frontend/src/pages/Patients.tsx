import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil } from "lucide-react";
import { StateMessage } from "@/components/StateMessage";
import { AppShell } from "@/components/layout/AppShell";
import { api, responseData } from "@/services/api";

function formatDate(date?: string) {
  if (!date) return "No visits yet";
  return new Date(date).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function Patients() {
  const [patients, setPatients] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadPatients() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/patients");
      const data = responseData<{ patients: any[] }>(response);
      setPatients(data.patients || []);
    } catch {
      setPatients([]);
      setError("Unable to load patients right now.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadPatients();
  }, []);

  const filteredPatients = useMemo(
    () =>
      patients.filter((patient) => {
        const patientName = String(patient.name || "");
        const matchesSearch = patientName.toLowerCase().includes(search.toLowerCase());
        const matchesFilter =
          filter === "all" ||
          (filter === "upcoming" && patient.upcomingAppointment) ||
          (filter === "recent" && patient.lastVisit);
        return matchesSearch && matchesFilter;
      }),
    [filter, patients, search],
  );

  return (
    <AppShell>
      <div className="px-6 pt-1 pb-12 md:px-8 md:pt-2 md:pb-14 flex flex-col gap-6 medflow-page-bg min-h-full">
        <div>
          <h1 className="text-[#1A1A2E] text-2xl md:text-[30px] font-bold">Patients</h1>
          <p className="text-[#6B7280] mt-1">Search patient records and visit history.</p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-4 flex flex-col md:flex-row gap-3">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by patient name"
            className="flex-1 rounded-lg border border-[#E5E7EB] px-4 py-2 outline-none focus:border-[#047857]"
          />
          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            className="rounded-lg border border-[#E5E7EB] px-4 py-2 outline-none focus:border-[#047857]"
          >
            <option value="all">All patients</option>
            <option value="upcoming">Upcoming appointment</option>
            <option value="recent">Recent visit</option>
          </select>
        </div>

        {loading && (
          <StateMessage tone="loading" title="Loading patients" message="Fetching patient records." />
        )}
        {error && !loading && (
          <StateMessage
            tone="error"
            title="Patients unavailable"
            message={error}
            actionLabel="Retry"
            onAction={() => void loadPatients()}
          />
        )}

        {!loading && !error && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-5 items-stretch">
          {filteredPatients.map((patient) => (
            <div
              key={patient._id}
              className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm flex flex-col h-full min-h-[200px] hover:border-[#047857] transition-colors"
            >
              <div className="flex shrink-0 items-center justify-end px-4 pt-3 pb-1">
                <Link
                  to={`/patients/${patient._id}?edit=1`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] hover:bg-[rgba(4,120,87,0.08)] hover:text-[#047857] transition-colors"
                  aria-label={`Edit ${patient.name}`}
                  title="Edit patient details"
                  onClick={(event) => event.stopPropagation()}
                >
                  <Pencil className="h-[18px] w-[18px]" strokeWidth={2} aria-hidden />
                </Link>
              </div>
              <Link
                to={`/patients/${patient._id}`}
                className="flex flex-1 flex-col justify-center px-5 pb-5 pt-1 outline-none focus-visible:ring-2 focus-visible:ring-[#047857]/35 rounded-b-xl"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 shrink-0 rounded-lg bg-[rgba(4, 120, 87,0.12)] text-[#065f46] flex items-center justify-center font-bold">
                    {patient.name
                      .split(" ")
                      .slice(0, 2)
                      .map((part) => part[0])
                      .join("")}
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[#1A1A2E] font-semibold">{patient.name}</h2>
                    <p className="text-sm text-[#6B7280]">{patient.contact || "No contact"}</p>
                  </div>
                </div>
                <p className="text-sm text-[#6B7280]">Last visit: {formatDate(patient.lastVisit)}</p>
                <p className="text-sm text-[#6B7280] mt-1">
                  Upcoming:{" "}
                  {patient.upcomingAppointment
                    ? `${patient.upcomingAppointment.date} at ${patient.upcomingAppointment.time}`
                    : "None"}
                </p>
              </Link>
            </div>
          ))}
          {!filteredPatients.length && (
            <div className="lg:col-span-2 xl:col-span-3">
              <StateMessage
                title="No patients found"
                message="Create or schedule a patient to start building the clinic record."
              />
            </div>
          )}
        </div>
        )}
      </div>
    </AppShell>
  );
}
