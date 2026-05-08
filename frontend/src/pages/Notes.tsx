import { useEffect, useMemo, useState, type MouseEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ClinicalNotePanel, type ClinicalNote } from "@/components/ClinicalNotePanel";
import { StateMessage } from "@/components/StateMessage";
import { AppShell } from "@/components/layout/AppShell";
import { IconBot } from "@/dashboard/DashboardIcons";
import { api, responseData } from "@/services/api";

type AppointmentType =
  | "consultation"
  | "follow-up"
  | "new-visit"
  | "annual-physical"
  | "lab-review";

const TYPE_LABELS: Record<AppointmentType, string> = {
  consultation: "Initial Consult",
  "follow-up": "Follow-up",
  "new-visit": "Urgent Care",
  "annual-physical": "Routine Exam",
  "lab-review": "Post-Op",
};

const TYPE_PILLS: Array<{ id: "all" | AppointmentType; label: string }> = [
  { id: "all", label: "All Types" },
  { id: "consultation", label: "Initial Consult" },
  { id: "follow-up", label: "Follow-up" },
  { id: "lab-review", label: "Post-Op" },
];

function formatNoteDateTime(createdAt: string | Date | undefined) {
  if (!createdAt) return "";
  const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
  // Example format to match the screenshot: "Oct 24, 2023 • 09:30 AM"
  return `${d.toLocaleDateString()} • ${d.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}

function soapFromNote(note: any): ClinicalNote {
  const s = note?.soapNote || {};
  return {
    subjective: String(s.subjective ?? ""),
    objective: String(s.objective ?? ""),
    assessment: String(s.assessment ?? ""),
    plan: String(s.plan ?? ""),
  };
}

function IconPencil({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
    </svg>
  );
}

export default function Notes() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [notes, setNotes] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [selectedType, setSelectedType] = useState<"all" | AppointmentType>("all");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editDrafts, setEditDrafts] = useState<Record<string, ClinicalNote>>({});
  const [savingNoteId, setSavingNoteId] = useState<string | null>(null);

  const [visibleCount, setVisibleCount] = useState(6);
  const PAGE_SIZE = 6;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState("");

  async function loadNotes() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get("/session/notes");
      const data = responseData<{ notes: any[] }>(response);
      setNotes(data.notes || []);
    } catch {
      setNotes([]);
      setError("Unable to load AI-generated notes.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadNotes();
  }, []);

  /** Open a specific note when linked from the dashboard (?note=<mongoId>). */
  useEffect(() => {
    if (loading) return;
    const raw = searchParams.get("note")?.trim();
    if (!raw) return;

    const note = notes.find((n) => String(n._id) === raw);
    if (!note) {
      if (notes.length > 0) {
        setSearchParams({}, { replace: true });
      }
      return;
    }

    setQuery("");
    setSelectedType("all");
    setExpanded(raw);

    const pos = notes.findIndex((n) => String(n._id) === raw);
    if (pos >= 0) {
      setVisibleCount((v) => Math.max(v, pos + 1, PAGE_SIZE));
    }

    setSearchParams({}, { replace: true });

    const timer = window.setTimeout(() => {
      document.getElementById(`clinical-note-${raw}`)?.scrollIntoView({
        behavior: "smooth",
        block: "center",
      });
    }, 150);

    return () => window.clearTimeout(timer);
  }, [loading, notes, searchParams, setSearchParams]);

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notes.filter((note) => {
      const appointmentType = note.appointmentId?.type as AppointmentType | undefined;
      if (selectedType !== "all" && appointmentType !== selectedType) return false;

      if (!q) return true;

      const patientName = String(note.patientId?.name || "");
      const type = String(note.appointmentId?.type || "");
      const tags = Array.isArray(note.tags) ? note.tags.join(" ") : "";
      const summary = String(note.summary || "");
      const assessment = String(note.soapNote?.assessment || "");
      const subjective = String(note.soapNote?.subjective || "");

      return [patientName, type, tags, summary, assessment, subjective].some((value) =>
        value.toLowerCase().includes(q),
      );
    });
  }, [notes, query, selectedType]);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [query, selectedType]);

  const visibleNotes = filteredNotes.slice(0, visibleCount);
  const canLoadMore = visibleCount < filteredNotes.length;

  function toggleCardExpand(noteId: string) {
    setExpanded((current) => {
      const next = current === noteId ? null : noteId;
      if (next === null) {
        setEditingNoteId((editing) => (editing === noteId ? null : editing));
      } else if (next !== current) {
        setEditingNoteId(null);
        setEditDrafts({});
      }
      return next;
    });
  }

  function openEdit(note: any, event: MouseEvent) {
    event.stopPropagation();
    setExpanded(note._id);
    setEditingNoteId((current) => {
      if (current === note._id) {
        setEditDrafts((d) => {
          const next = { ...d };
          delete next[note._id];
          return next;
        });
        return null;
      }
      setEditDrafts((d) => ({ ...d, [note._id]: soapFromNote(note) }));
      return note._id;
    });
  }

  async function saveNoteEdits(noteId: string) {
    const draft = editDrafts[noteId];
    if (!draft) return;
    setSavingNoteId(noteId);
    try {
      const response = await api.put(`/session/notes/${noteId}`, { soapNote: draft });
      const data = responseData<{ note: any }>(response);
      const updated = data.note;
      setNotes((prev) =>
        prev.map((n) => (n._id === noteId ? { ...n, soapNote: updated?.soapNote ?? draft } : n)),
      );
      setEditingNoteId(null);
      setEditDrafts((d) => {
        const next = { ...d };
        delete next[noteId];
        return next;
      });
    } catch {
      // keep draft; user can retry
    } finally {
      setSavingNoteId(null);
    }
  }

  function cancelEdit(noteId: string, event: MouseEvent) {
    event.stopPropagation();
    setEditingNoteId(null);
    setEditDrafts((d) => {
      const next = { ...d };
      delete next[noteId];
      return next;
    });
  }

  async function seedDemoData() {
    setSeeding(true);
    setSeedMessage("");
    try {
      // Creates real Patients + Appointments + Notes in Mongo so the UI is in sync.
      await api.post("/dev/seed-sample-data", {
        patients: 8,
        appointmentsPerPatient: 3,
        notesPerAppointment: 1,
      });
      await loadNotes();
      setSeedMessage("Demo data generated. Notes are now in sync with the database.");
    } catch (e: any) {
      setSeedMessage(
        e?.response?.data?.error?.message || "Unable to generate demo data. Check server logs.",
      );
    } finally {
      setSeeding(false);
    }
  }

  return (
    <AppShell>
      <div className="px-6 pt-1 pb-12 md:px-8 md:pt-2 md:pb-14 flex flex-col gap-6 medflow-page-bg min-h-full">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-[#1A1A2E] text-2xl md:text-[30px] font-bold">Clinical Notes</h1>
            <p className="text-[#6B7280] mt-1">
              Manage and review patient encounter documentation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => void seedDemoData()}
              disabled={seeding}
              className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#1A1A2E] font-medium hover:bg-[#FAFAFA] transition-colors disabled:opacity-60"
            >
              {seeding ? "Generating…" : "Generate demo data"}
            </button>
            <button
              type="button"
              onClick={() => navigate("/appointments")}
              className="medflow-primary-button px-4 py-2 rounded-lg font-medium"
            >
              + Create New Note
            </button>
          </div>
        </div>

        {seedMessage && (
          <StateMessage tone="success" title="Demo Data" message={seedMessage} />
        )}

        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-4 flex flex-col gap-3">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search notes by patient, ID, or keywords…"
              className="flex-1 rounded-lg border border-[#E5E7EB] px-4 py-2 outline-none focus:border-[#047857]"
            />
            <div className="flex flex-wrap gap-2">
              {TYPE_PILLS.map((pill) => (
                <button
                  key={pill.id}
                  type="button"
                  onClick={() => setSelectedType(pill.id)}
                  className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                    selectedType === pill.id
                      ? "border-[#047857] text-[#047857] bg-[rgba(4, 120, 87,0.10)]"
                      : "border-[#E5E7EB] text-[#6B7280] bg-white hover:bg-[#FAFAFA]"
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loading && (
          <StateMessage tone="loading" title="Loading notes" message="Fetching generated clinical notes." />
        )}
        {error && !loading && (
          <StateMessage
            tone="error"
            title="Notes unavailable"
            message={error}
            actionLabel="Retry"
            onAction={() => void loadNotes()}
          />
        )}

        {!loading && !error && (
          <>
            {!visibleNotes.length && (
              <StateMessage
                tone="info"
                title="No notes found"
                message="Generated clinical notes will appear here after completed sessions."
              />
            )}

            {visibleNotes.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
                {visibleNotes.map((note) => {
                  const appointmentType = note.appointmentId?.type as AppointmentType | undefined;
                  const typeLabel = appointmentType ? TYPE_LABELS[appointmentType] : "Clinical note";
                  const summaryText =
                    String(note.summary || "").trim() ||
                    String(note.soapNote?.assessment || "").trim() ||
                    String(note.soapNote?.subjective || "").trim() ||
                    "No summary available.";

                  const isExpanded = expanded === note._id;
                  const isEditing = editingNoteId === note._id;
                  const soapForPanel = soapFromNote(note);

                  return (
                    <article
                      id={`clinical-note-${note._id}`}
                      key={note._id}
                      role="button"
                      tabIndex={0}
                      aria-expanded={isExpanded}
                      onClick={() => toggleCardExpand(note._id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") {
                          event.preventDefault();
                          toggleCardExpand(note._id);
                        }
                      }}
                      className={`bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-5 flex flex-col gap-3 text-left outline-none transition-[box-shadow,border-color] focus-visible:ring-2 focus-visible:ring-[#047857]/40 ${
                        isExpanded ? "ring-1 ring-[#047857]/15 shadow-md" : ""
                      } cursor-pointer hover:border-[#047857]/35`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h2 className="text-[#1A1A2E] font-semibold text-[16px] leading-[22px] truncate">
                            {note.patientId?.name || "Unknown Patient"} - {typeLabel}
                          </h2>
                          <p className="text-sm text-[#6B7280]">
                            {formatNoteDateTime(note.createdAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={(event) => openEdit(note, event)}
                          className={`shrink-0 p-2 rounded-lg transition-colors ${
                            isEditing
                              ? "bg-[rgba(4,120,87,0.12)] text-[#047857]"
                              : "text-[#6B7280] hover:text-[#047857] hover:bg-[rgba(4,120,87,0.08)]"
                          }`}
                          aria-label={isEditing ? "Done editing" : "Edit clinical note"}
                          aria-pressed={isEditing}
                          title={isEditing ? "Exit edit mode" : "Edit note"}
                        >
                          <IconPencil />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 pointer-events-none">
                        <span className="text-xs font-semibold text-[#065f46] inline-flex items-center gap-2">
                          <IconBot />
                          AI Summary
                        </span>
                      </div>

                      <p
                        className={`text-sm text-[#6B7280] ${isExpanded ? "" : "line-clamp-3 pointer-events-none"}`}
                      >
                        {summaryText}
                      </p>

                      <div className="flex flex-wrap gap-2 pointer-events-none">
                        {(note.tags?.length ? note.tags : ["Visit"]).map((tag: string) => (
                          <span
                            key={tag}
                            className="px-2 py-1 rounded bg-[rgba(4, 120, 87,0.10)] text-[#065f46] text-xs"
                          >
                            #{String(tag).replace(/^#/, "")}
                          </span>
                        ))}
                      </div>

                      {isExpanded && (
                        <div
                          className="mt-2 space-y-4 cursor-default"
                          onClick={(event) => event.stopPropagation()}
                          onKeyDown={(event) => event.stopPropagation()}
                        >
                          {isEditing && (
                            <div className="flex flex-wrap gap-2 justify-end">
                              <button
                                type="button"
                                onClick={(event) => cancelEdit(note._id, event)}
                                className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#1A1A2E] font-medium text-sm hover:bg-[#FAFAFA]"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={savingNoteId === note._id}
                                onClick={(event) => {
                                  event.stopPropagation();
                                  void saveNoteEdits(note._id);
                                }}
                                className="medflow-primary-button px-4 py-2 rounded-lg font-medium text-sm disabled:opacity-60"
                              >
                                {savingNoteId === note._id ? "Saving…" : "Save changes"}
                              </button>
                            </div>
                          )}
                          {note.rawTranscript ? (
                            <details className="text-sm border border-[#E5E7EB] rounded-lg p-3 bg-[#FAFAFA]">
                              <summary className="cursor-pointer font-medium text-[#1A1A2E]">
                                Original live capture (before cleanup)
                              </summary>
                              <pre className="mt-2 whitespace-pre-wrap text-[#6B7280] text-xs leading-relaxed">
                                {note.rawTranscript}
                              </pre>
                            </details>
                          ) : null}
                          <ClinicalNotePanel
                            note={isEditing ? editDrafts[note._id] ?? soapForPanel : soapForPanel}
                            editable={isEditing}
                            onChange={
                              isEditing
                                ? (next) =>
                                    setEditDrafts((d) => ({
                                      ...d,
                                      [note._id]: next,
                                    }))
                                : undefined
                            }
                          />
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}

            {canLoadMore && (
              <div className="flex justify-center mt-4">
                <button
                  type="button"
                  onClick={() => setVisibleCount((v) => v + PAGE_SIZE)}
                  className="px-6 py-2 rounded-lg border border-[#E5E7EB] text-[#1A1A2E] font-medium hover:bg-[#FAFAFA] transition-colors"
                >
                  Load More Notes
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </AppShell>
  );
}
