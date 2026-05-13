import { useEffect, useRef, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { RecordingButton } from "@/components/RecordingButton";
import { ClinicalNotePanel, type ClinicalNote } from "@/components/ClinicalNotePanel";
import { StateMessage } from "@/components/StateMessage";
import { AppShell } from "@/components/layout/AppShell";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { api, responseData } from "@/services/api";
import { MEDFLOW_TRANSCRIPT_FORMAT } from "@/constants/medflowFormats";

const emptyNote: ClinicalNote = {
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
};

function formatRecordingDuration(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export default function Session() {
  const { appointmentId } = useParams();
  const speech = useSpeechRecognition();
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaChunksRef = useRef<BlobPart[]>([]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const [appointment, setAppointment] = useState<any>(null);
  const [note, setNote] = useState<ClinicalNote>(emptyNote);
  const [noteId, setNoteId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const [noteSaved, setNoteSaved] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [deepgramConfigured, setDeepgramConfigured] = useState(false);
  const [anthropicConfigured, setAnthropicConfigured] = useState(false);
  const [recordingCloud, setRecordingCloud] = useState(false);
  const [jobStatus, setJobStatus] = useState<
    "queued" | "processing" | "completed" | "failed" | null
  >(null);

  const isRecording = speech.isListening || recordingCloud;
  const noteSavedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await api.get("/settings/status");
        const data = responseData<{
          deepgramConfigured?: boolean;
          anthropicConfigured?: boolean;
        }>(response);
        if (!cancelled) {
          setDeepgramConfigured(Boolean(data.deepgramConfigured));
          setAnthropicConfigured(Boolean(data.anthropicConfigured));
        }
      } catch {
        if (!cancelled) setDeepgramConfigured(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isRecording) {
      setRecordingSeconds(0);
      return undefined;
    }
    const startedAt = Date.now();
    setRecordingSeconds(0);
    const id = window.setInterval(() => {
      setRecordingSeconds(Math.floor((Date.now() - startedAt) / 1000));
    }, 250);
    return () => window.clearInterval(id);
  }, [isRecording]);

  async function loadAppointment() {
    setLoading(true);
    setError("");
    try {
      const response = await api.get(`/appointments/${appointmentId}`);
      const data = responseData<{ appointment: any }>(response);
      setAppointment(data.appointment);
    } catch {
      setError("Unable to load appointment details.");
    } finally {
      setLoading(false);
    }
    api.put(`/appointments/${appointmentId}`, { status: "in-progress" }).catch(() => {});
  }

  useEffect(() => {
    noteSavedRef.current = noteSaved;
  }, [noteSaved]);

  useEffect(() => {
    if (appointmentId) void loadAppointment();
    return () => {
      if (!noteSavedRef.current && appointmentId) {
        api.put(`/appointments/${appointmentId}`, { status: "upcoming" }).catch(() => {});
      }
    };
  }, [appointmentId]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  type AgentJob = {
    jobId: string;
    status: "queued" | "processing" | "completed" | "failed";
    resultSnapshot?: {
      soapNote?: ClinicalNote;
      soap_note?: ClinicalNote;
      note?: { _id?: string };
      transcript?: string;
      transcriptCleaned?: boolean;
    };
    errorSnapshot?: { message?: string };
  };

  function applyAgentResult(data?: AgentJob["resultSnapshot"]) {
    if (!data) return;
    const soap = data.soapNote || data.soap_note || emptyNote;
    setNote(soap);
    setNoteId(data.note?._id || null);
    if (data.transcript?.trim()) {
      speech.setTranscript(data.transcript);
    }
    setMessage(
      data.transcriptCleaned
        ? "Clinical note saved. The transcript below was cleaned from live capture for a clearer chart."
        : "Clinical note saved to your notes.",
    );
    setNoteSaved(true);
  }

  async function pollJob(jobId: string) {
    try {
      const response = await api.get(`/agent/jobs/${jobId}`);
      const job = responseData<AgentJob>(response);
      setJobStatus(job.status);
      if (job.status === "completed") {
        if (pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        applyAgentResult(job.resultSnapshot);
        setSaving(false);
        setUploading(false);
        return true;
      }

      if (job.status === "failed") {
        if (pollTimerRef.current) {
          window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = null;
        }
        setSaving(false);
        setUploading(false);
        setMessage(job.errorSnapshot?.message || "Unable to generate or save the clinical note.");
        return true;
      }
      return false;
    } catch {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      setSaving(false);
      setUploading(false);
      setJobStatus(null);
      setMessage("Unable to fetch job status.");
      return true;
    }
  }

  async function startJobPolling(jobId: string) {
    if (pollTimerRef.current) {
      window.clearInterval(pollTimerRef.current);
    }
    setJobStatus("queued");
    const done = await pollJob(jobId);
    if (done) return;
    pollTimerRef.current = window.setInterval(() => {
      void pollJob(jobId);
    }, 1500);
  }

  async function saveTranscript() {
    if (!anthropicConfigured) {
      setMessage(
        "Clinical AI is not configured: add ANTHROPIC_API_KEY to the MedFlow backend environment and restart the API.",
      );
      return;
    }
    if (!speech.fullTranscript.trim()) {
      setMessage("Record or paste a transcript before generating notes.");
      return;
    }

    if (!appointment?.patientId?._id) {
      setMessage("Patient information not yet loaded. Please wait and try again.");
      return;
    }

    setSaving(true);
    setMessage("");
    setNoteSaved(false);
    setJobStatus("queued");
    try {
      const response = await api.post("/agent/transcript-session-async", {
        appointmentId,
        patientId: appointment.patientId._id,
        transcript: speech.fullTranscript,
      });
      const data = responseData<{ jobId: string }>(response);
      setMessage("Generating clinical note... this may take a moment.");
      await startJobPolling(data.jobId);
    } catch {
      setSaving(false);
      setMessage("Unable to generate or save the clinical note.");
    }
  }

  function finalizeMediaRecording(): Promise<Blob | null> {
    return new Promise((resolve) => {
      const rec = mediaRecorderRef.current;
      const stream = mediaStreamRef.current;
      mediaRecorderRef.current = null;

      if (!rec || rec.state === "inactive") {
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        resolve(null);
        return;
      }

      rec.onstop = () => {
        stream?.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        const blob = new Blob(mediaChunksRef.current, {
          type: rec.mimeType || "audio/webm",
        });
        mediaChunksRef.current = [];
        resolve(blob.size > 400 ? blob : null);
      };
      rec.stop();
    });
  }

  async function processAudioUpload(blob: Blob) {
    if (!anthropicConfigured) {
      setMessage(
        "Clinical AI is not configured: add ANTHROPIC_API_KEY to the MedFlow backend environment and restart the API.",
      );
      return;
    }
    if (!appointment?.patientId?._id) {
      setMessage("Patient information not yet loaded. Please wait and try again.");
      return;
    }
    setUploading(true);
    setMessage("");
    setJobStatus("queued");
    try {
      const body = new FormData();
      const name =
        blob.type.includes("mpeg") || blob.type.includes("mp3")
          ? "visit.mp3"
          : blob.type.includes("wav")
            ? "visit.wav"
            : blob.type.includes("mp4") || blob.type.includes("m4a")
              ? "visit.m4a"
              : "visit.webm";
      body.append("audio", blob, name);
      body.append("appointmentId", String(appointmentId || ""));
      body.append("patientId", String(appointment?.patientId?._id || ""));

      const response = await api.post("/agent/audio-session-async", body, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = responseData<{ jobId: string }>(response);
      setMessage("Uploading audio for transcription... this may take a moment.");
      await startJobPolling(data.jobId);
    } catch {
      setUploading(false);
      setMessage("Audio upload failed. Try again or paste a transcript and use Regenerate.");
    }
  }

  async function stopRecordingSession() {
    if (recordingCloud) {
      const blob = await finalizeMediaRecording();
      setRecordingCloud(false);
      speech.stop();

      if (blob && deepgramConfigured) {
        await processAudioUpload(blob);
        return;
      }

      if (!blob) {
        setMessage(
          "Recording was too short or the microphone did not capture audio. Try again or use live browser captions if available.",
        );
      }
      return;
    }

    speech.stop();
    window.setTimeout(() => {
      void saveTranscript();
    }, 1000);
  }

  async function toggleRecording() {
    if (isRecording) {
      await stopRecordingSession();
      return;
    }

    setNoteSaved(false);
    setJobStatus(null);

    if (deepgramConfigured) {
      try {
        speech.reset();
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaStreamRef.current = stream;
        const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : "";
        const recorder = mimeType
          ? new MediaRecorder(stream, { mimeType })
          : new MediaRecorder(stream);
        mediaChunksRef.current = [];
        recorder.ondataavailable = (event) => {
          if (event.data.size) mediaChunksRef.current.push(event.data);
        };
        mediaRecorderRef.current = recorder;
        recorder.start(400);
        setRecordingCloud(true);
        return;
      } catch {
        setMessage(
          "Could not access the microphone for server transcription. Falling back to browser speech if supported.",
        );
      }
    }

    speech.start();
  }

  async function saveEditedNote() {
    if (!noteId) {
      setMessage("Generate notes first before saving edits.");
      return;
    }

    setSaving(true);
    setMessage("");
    setJobStatus(null);
    try {
      await api.put(`/session/notes/${noteId}`, { soapNote: note });
      setMessage("Edited clinical note saved.");
    } catch {
      setMessage("Unable to save edited note.");
    } finally {
      setSaving(false);
    }
  }

  async function uploadAudioFile(file?: File | null) {
    if (!file) return;
    await processAudioUpload(file);
  }

  return (
    <AppShell>
      <div className="px-6 pt-1 pb-12 md:px-8 md:pt-2 md:pb-14 flex flex-col gap-6 medflow-page-bg min-h-full">
        <div>
          <h1 className="text-[#1A1A2E] text-2xl md:text-[30px] font-bold">
            Active Session
          </h1>
          <p className="text-[#6B7280] mt-1">
            {appointment?.patientId?.name || "Patient"} • {appointment?.type || "Visit"}
          </p>
        </div>

        {loading && (
          <StateMessage
            tone="loading"
            title="Loading session"
            message="Fetching appointment and patient context."
          />
        )}
        {error && !loading && (
          <StateMessage
            tone="error"
            title="Session unavailable"
            message={error}
            actionLabel="Retry"
            onAction={() => void loadAppointment()}
          />
        )}

        {!loading && !error && !anthropicConfigured && (
          <StateMessage
            tone="neutral"
            title="Clinical AI offline"
            message="SOAP notes and the agent pipeline require Anthropic Claude on the server. Set ANTHROPIC_API_KEY (and optionally ANTHROPIC_MODEL) in backend/.env, restart the API, and refresh this page. Without it, MedFlow cannot run LLM cleanup, retrieval context, or note generation — the UI alone cannot chart visits."
          />
        )}

        {!loading && !error && (
        <div className="grid grid-cols-1 xl:grid-cols-[1fr_420px] gap-6">
          <section className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-6 flex flex-col gap-6">
            <div className="flex flex-col items-center gap-4 py-4">
              <p className="text-sm text-[#6B7280] text-center max-w-md">
                {deepgramConfigured ? (
                  <>
                    Server transcription is enabled: visit audio is recorded and sent to MedFlow for Deepgram
                    transcription (no live captions during capture). Tap{" "}
                    <strong className="text-[#1A1A2E]">Stop &amp; save note</strong> when the visit ends — the SOAP
                    note is built from the server transcript.
                  </>
                ) : (
                  <>
                    Use the microphone to capture the visit. Everything is transcribed live in the browser. When the
                    conversation is over, tap <strong className="text-[#1A1A2E]">Stop &amp; save note</strong> —
                    MedFlow turns the transcript into a fixed SOAP layout (CC/HPI, vitals &amp; exam, impression,
                    bulleted plan) and saves it to the Notes tab.
                  </>
                )}
              </p>
              <ul className="text-xs text-[#6B7280] text-left max-w-md list-disc pl-5 space-y-1">
                {MEDFLOW_TRANSCRIPT_FORMAT.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
              <div className="flex flex-col items-center gap-2">
                <RecordingButton
                  isRecording={isRecording}
                  onClick={() => void toggleRecording()}
                  idleLabel="Start recording"
                  recordingLabel="Stop & save note"
                  disabled={!anthropicConfigured || loading}
                />
                <div
                  className={`tabular-nums text-sm font-semibold tracking-wide ${
                    isRecording ? "text-[#1E2A38]" : "text-[#9CA3AF]"
                  }`}
                  aria-live="polite"
                >
                  {isRecording ? (
                    <>
                      Recording{" "}
                      <span className="text-[#1A1A2E]">{formatRecordingDuration(recordingSeconds)}</span>
                    </>
                  ) : (
                    <>Duration {formatRecordingDuration(recordingSeconds)}</>
                  )}
                </div>
                {jobStatus && (
                  <div
                    className={`text-xs font-semibold uppercase tracking-wider px-3 py-1 rounded-full border ${
                      jobStatus === "failed"
                        ? "border-[#FCA5A5] text-[#B91C1C] bg-[rgba(248,113,113,0.12)]"
                        : jobStatus === "completed"
                          ? "border-[#a8b8cc] text-[#1E2A38] bg-[rgba(30,42,56,0.12)]"
                          : "border-[#93C5FD] text-[#1D4ED8] bg-[rgba(59,130,246,0.12)]"
                    }`}
                  >
                    Agent status: {jobStatus}
                  </div>
                )}
              </div>
              <div className="flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() => void saveTranscript()}
                  disabled={saving || !anthropicConfigured || loading}
                  className="px-4 py-2 rounded-lg border border-[#1E2A38] text-[#1E2A38] font-medium hover:bg-[rgba(30,42,56,0.10)] transition-colors disabled:opacity-60"
                >
                  {saving ? "Saving…" : "Regenerate from transcript"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing((value) => !value)}
                  className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-[#1A1A2E] hover:bg-[#FAFAFA] transition-colors"
                >
                  {editing ? "Preview Notes" : "Edit Notes"}
                </button>
              </div>
              {!speech.supported && !deepgramConfigured && (
                <p className="text-sm text-[#6B7280]">
                  Browser speech recognition is not available in this browser.
                </p>
              )}
              {message && <p className="text-sm text-[#6B7280]">{message}</p>}
              {noteSaved && (
                <Link
                  to="/notes"
                  className="text-sm font-medium text-[#1E2A38] hover:underline"
                >
                  Open Notes tab
                </Link>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
                <h2 className="text-[#1A1A2E] font-semibold">Live transcript</h2>
                {isRecording && (
                  <span className="text-xs font-semibold uppercase tracking-wider text-[#1E2A38]">
                    {recordingCloud ? "Capturing audio" : "Live"}
                  </span>
                )}
              </div>
              <textarea
                value={recordingCloud ? "" : speech.fullTranscript}
                onChange={(event) => speech.setTranscript(event.target.value)}
                readOnly={speech.isListening || recordingCloud}
                className={`w-full min-h-[280px] rounded-xl border border-[#E5E7EB] p-4 text-[#1A1A2E] outline-none focus:border-[#1E2A38] ${
                  isRecording ? "bg-[#FAFAFA] cursor-default" : ""
                }`}
                placeholder={
                  recordingCloud
                    ? "Visit audio is being captured for server transcription. The transcript will appear here after you stop recording."
                    : `Example:\nPatient: I have had a sore throat for two days.\nDoctor: Any fever? Patient: No.\nDoctor: Throat exam shows mild erythema. Viral pharyngitis. Salt water gargles and fluids.`
                }
                spellCheck={false}
              />
              {speech.isListening && !recordingCloud && (
                <p className="text-xs text-[#6B7280] mt-2">
                  Text updates as you speak. Editing is available after you stop recording.
                </p>
              )}
              {recordingCloud && (
                <p className="text-xs text-[#6B7280] mt-2">
                  Microphone audio streams to MedFlow after you stop — configure Deepgram on the server for this path.
                </p>
              )}
            </div>
          </section>

          <aside className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[#1A1A2E] text-xl font-semibold">Clinical note</h2>
                <button
                type="button"
                  onClick={saveEditedNote}
                disabled={saving}
                className="medflow-primary-button px-4 py-2 rounded-lg font-medium disabled:opacity-60"
              >
                Save Notes
              </button>
            </div>
            <ClinicalNotePanel note={note} editable={editing} onChange={setNote} />
            {(!speech.supported || deepgramConfigured) && (
              <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm p-4">
                <p className="text-sm text-[#6B7280] mb-3">
                  {!speech.supported
                    ? "Web Speech API is unavailable. Upload an audio file to transcribe on the server."
                    : "Optional: upload a visit recording file — transcription runs on the server (same path as session capture)."}
                </p>
                <input
                  type="file"
                  accept="audio/*"
                  onChange={(event) => void uploadAudioFile(event.target.files?.[0])}
                  disabled={uploading || !anthropicConfigured || loading}
                  className="w-full rounded-lg border border-[#E5E7EB] px-3 py-2 text-sm"
                />
                {uploading && <p className="text-xs text-[#6B7280] mt-2">Uploading audio...</p>}
              </div>
            )}
          </aside>
        </div>
        )}
      </div>
    </AppShell>
  );
}
