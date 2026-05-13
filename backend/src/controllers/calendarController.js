import { runCalendarAgent } from "../agents/calendarAgent.js";
import { sendError, sendSuccess } from "../utils/http.js";

function normalizeConversationHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x) => x && (x.role === "user" || x.role === "assistant"))
    .map((x) => ({
      role: x.role,
      content: String(x.content ?? "").slice(0, 8000),
    }))
    .slice(-14);
}

export async function handleCalendarCommand(req, res) {
  const interactionMode =
    req.body.interactionMode === "voice_calendar" ? "voice_calendar" : "chat_assistant";

  const result = await runCalendarAgent(req.body.command, {
    doctorName: req.user?.name || "Doctor",
    userId: req.user?._id,
    conversationHistory: normalizeConversationHistory(req.body.history),
    interactionMode,
  });

  if (!result.ok) {
    return sendError(res, 400, result.error);
  }

  return sendSuccess(res, result.data, 200);
}
