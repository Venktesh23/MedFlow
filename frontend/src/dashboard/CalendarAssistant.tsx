import { useState } from "react";
import axios from "axios";
import { IconBot, IconMic, IconSend } from "./DashboardIcons";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { api, responseData } from "@/services/api";
import {
  MEDFLOW_BOOKING_PHRASE,
  MEDFLOW_BOOKING_VISIT_TYPES,
} from "@/constants/medflowFormats";
import type { AssistantMessage } from "./types";

type CalendarAssistantProps = {
  messages?: AssistantMessage[];
  inputPlaceholder?: string;
  /** Called after a successful calendar operation (create/update/delete/query). */
  onSuccess?: () => void;
  /** `fill` expands to parent height (e.g. Dashboard); `default` uses a capped max-height. */
  layout?: "default" | "fill";
  /**
   * Dashboard: no inner scroll; messages align to bottom and overflow is clipped.
   * Other pages keep scrollable message history.
   */
  variant?: "default" | "dashboard";
};

const DEFAULT_WELCOME = `I manage your live MedFlow calendar: schedule, reschedule, or cancel visits using MongoDB and Google Calendar when connected — and I answer questions about who's booked when using your actual appointment list.

Say things like "What's tomorrow?", "Cancel Maria Tuesday", or:

${MEDFLOW_BOOKING_PHRASE}

Visit types: ${MEDFLOW_BOOKING_VISIT_TYPES}.`;

export function CalendarAssistant({
  messages = [
    {
      id: "welcome",
      role: "assistant",
      text: DEFAULT_WELCOME,
    },
  ],
  inputPlaceholder = 'e.g. Schedule Jane Doe for follow-up on Monday at 2pm',
  onSuccess,
  layout = "default",
  variant = "default",
}: CalendarAssistantProps) {
  const [msg, setMsg] = useState("");
  const [history, setHistory] = useState<AssistantMessage[]>(messages);
  const [loading, setLoading] = useState(false);
  const speech = useSpeechRecognition();

  const visibleMessages = history.slice(-24);

  async function sendCommand(command: string) {
    if (!command.trim() || loading) return;

    const trimmed = command.trim();
    const historyForApi = history.slice(-14).map((m) => ({
      role: m.role,
      content: m.text,
    }));

    const userMessage: AssistantMessage = {
      id: `user-${Date.now()}`,
      role: "user",
      text: trimmed,
    };
    setHistory((current) => [...current, userMessage]);
    setMsg("");
    setLoading(true);

    try {
      const response = await api.post("/calendar/command", {
        command: trimmed,
        history: historyForApi,
      });
      const data = responseData<{
        confirmationMessage?: string;
        warnings?: string[];
        mutatedSchedule?: boolean;
      }>(response);
      const reply =
        data.confirmationMessage ||
        "Done. Your calendar was updated—check Appointments for the latest list.";
      const warnLines = (data.warnings ?? []).filter(Boolean);
      const fullReply =
        warnLines.length > 0
          ? `${reply}\n\nWarning: ${warnLines.join(" ")}`
          : reply;
      setHistory((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: fullReply,
        },
      ]);
      if (data.mutatedSchedule === true) {
        onSuccess?.();
      }
    } catch (err) {
      let detail = `I could not complete that. Try: ${MEDFLOW_BOOKING_PHRASE}`;
      if (axios.isAxiosError(err)) {
        const msg = (err.response?.data as { error?: { message?: string } })?.error?.message;
        if (msg) detail = msg;
      }
      setHistory((current) => [
        ...current,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          text: detail,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function toggleVoice() {
    if (speech.isListening) {
      speech.stop();
      setMsg(speech.fullTranscript);
      return;
    }
    speech.reset();
    speech.start();
  }

  const shellClass =
    layout === "fill"
      ? variant === "dashboard"
        ? "flex h-full min-h-0 flex-col bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden"
        : "flex h-full min-h-[320px] flex-1 min-h-0 flex-col bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden"
      : "flex min-h-[340px] xl:min-h-[400px] max-h-[min(56vh,560px)] h-full flex-col bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden";

  const messageListClass =
    variant === "dashboard"
      ? "px-4 py-3 flex flex-1 flex-col gap-[10px] min-h-0 overflow-y-auto overscroll-contain"
      : "px-4 py-4 flex flex-1 flex-col gap-[10px] min-h-0 overflow-y-auto overscroll-contain";

  const messageBody = (
    <>
      {visibleMessages.map((message) =>
        message.role === "assistant" ? (
          <div key={message.id} className="flex w-full items-start gap-2">
            <div className="w-[26px] h-[26px] rounded-full bg-[rgba(4, 120, 87,0.12)] flex items-center justify-center flex-shrink-0 mt-1">
              <IconBot />
            </div>
            <div className="min-w-0 flex-1 bg-[#F4FBF4] border border-[rgba(187,202,191,0.50)] rounded-[0_8px_8px_8px] px-[13px] py-[9px]">
              <p className="text-[#3C4A42] text-[13px] leading-[19px] whitespace-pre-wrap break-words">
                {message.text}
              </p>
            </div>
          </div>
        ) : (
          <div key={message.id} className="flex w-full justify-end">
            <div className="min-w-0 max-w-full sm:max-w-[min(100%,42rem)] bg-[rgba(4, 120, 87,0.12)] border border-[rgba(4, 120, 87,0.22)] rounded-[8px_0_8px_8px] px-[13px] py-[9px]">
              <p className="text-[#161D19] text-[13px] leading-[19px] whitespace-pre-wrap break-words text-right">
                {message.text}
              </p>
            </div>
          </div>
        ),
      )}
      {loading && (
        <div className="flex w-full items-start gap-2">
          <div className="w-[26px] h-[26px] rounded-full bg-[rgba(4, 120, 87,0.12)] flex items-center justify-center flex-shrink-0 mt-1">
            <IconBot />
          </div>
          <div className="min-w-0 flex-1 bg-[#F4FBF4] border border-[rgba(187,202,191,0.50)] rounded-[0_8px_8px_8px] px-[13px] py-[9px]">
            <p className="text-[#3C4A42] text-[13px] leading-[19px]">
              Analyzing your schedule and responding…
            </p>
          </div>
        </div>
      )}
    </>
  );

  return (
    <div className={shellClass}>
      <div className={messageListClass}>{messageBody}</div>

      <div className="border-t border-[rgba(187,202,191,0.35)] bg-[#F9FAF9] px-[14px] pt-[10px] pb-3 sm:pb-3.5 flex items-center gap-2 shrink-0">
        <button
          type="button"
          className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-colors ${
            speech.isListening
              ? "bg-[#047857] text-white"
              : "bg-[rgba(4, 120, 87,0.08)] text-[#047857] hover:bg-[rgba(4, 120, 87,0.15)]"
          } disabled:opacity-50`}
          aria-label={speech.supported ? "Voice input" : "Voice input unavailable"}
          onClick={toggleVoice}
          disabled={!speech.supported}
        >
          <IconMic />
        </button>
        <input
          type="text"
          value={speech.isListening ? speech.fullTranscript : msg}
          onChange={(e) => setMsg(e.target.value)}
          placeholder={inputPlaceholder}
          className="flex-1 h-[34px] min-w-0 bg-white border border-[rgba(187,202,191,0.60)] rounded-md px-[10px] text-[13px] text-[#161D19] placeholder:text-[rgba(22,29,25,0.50)] outline-none focus:border-[#047857] transition-colors"
        />
        <button
          type="button"
          onClick={() => sendCommand(speech.isListening ? speech.fullTranscript : msg)}
          disabled={loading}
          className="w-8 h-8 rounded-full bg-[#047857] flex items-center justify-center flex-shrink-0 hover:bg-[#065f46] transition-colors disabled:opacity-60"
          aria-label="Send"
        >
          <IconSend />
        </button>
      </div>
    </div>
  );
}
