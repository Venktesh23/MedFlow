import Anthropic from "@anthropic-ai/sdk";
import { SOAP_SYSTEM_PROMPT } from "../prompts/soapPrompt.js";
import { buildCalendarSystemPrompt } from "../prompts/calendarPrompt.js";
import { TRANSCRIPT_CLEANUP_SYSTEM_PROMPT } from "../prompts/transcriptCleanupPrompt.js";

let anthropicClient;

function getAnthropicClient() {
  if (!process.env.ANTHROPIC_API_KEY) {
    return null;
  }
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY,
    });
  }
  return anthropicClient;
}

/** Whether Anthropic client can run (calendar parse + SOAP generation use this). */
export function isAnthropicConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY?.trim?.());
}

function anthropicModel() {
  return process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6";
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function stripMarkdownFences(raw) {
  return String(raw || "").replace(/```json|```/g, "").trim();
}

function extractMessageText(message) {
  if (!message?.content) return "";
  return message.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("")
    .trim();
}

/** Collapse noisy whitespace before LLM cleanup (lossless for words). */
export function normalizeTranscriptWhitespace(text) {
  return String(text || "")
    .replace(/\r\n/g, "\n")
    .replace(/[\t\f\v]+/g, " ")
    .replace(/ +\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \u00a0]{2,}/g, " ")
    .trim();
}

function tryParseJsonFromCleaned(clean) {
  try {
    return JSON.parse(clean);
  } catch {
    const match = clean.match(/\{[\s\S]*\}/);
    if (!match) return null;
    try {
      return JSON.parse(match[0]);
    } catch {
      return null;
    }
  }
}

/**
 * Up to two API calls (second after 1s) when JSON parsing fails.
 * On total failure: logs and returns null. Never throws.
 */
async function completeJsonFromClaude({ system, userContent, maxTokens }) {
  const client = getAnthropicClient();
  if (!client) {
    return { parsed: null, lastRaw: "" };
  }

  const cap = Number(maxTokens);
  if (!Number.isFinite(cap) || cap < 1) {
    console.error(
      "[MedFlow][ClaudeService][Error] maxTokens must be a positive number",
    );
    return { parsed: null, lastRaw: "" };
  }

  let lastRaw = "";

  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt === 1) {
      await sleep(1000);
    }

    try {
      const response = await client.messages.create({
        model: anthropicModel(),
        max_tokens: cap,
        system,
        messages: [{ role: "user", content: userContent }],
      });

      const raw = extractMessageText(response);
      lastRaw = raw;
      const clean = stripMarkdownFences(raw);
      const parsed = tryParseJsonFromCleaned(clean);
      if (parsed !== null) {
        return { parsed, lastRaw: raw };
      }
    } catch (err) {
      lastRaw = String(err?.message || err);
    }
  }

  console.error(
    `[MedFlow][ClaudeService][Error] Failed to parse response: ${lastRaw}`,
  );
  return { parsed: null, lastRaw };
}

/**
 * Plain-text completion with one retry after 1s if the model returns empty text.
 * Returns null on failure (caller should fall back to raw transcript). Never throws.
 */
async function completePlainTextFromClaude({ system, userContent, maxTokens }) {
  const client = getAnthropicClient();
  if (!client) return null;

  const cap = Number(maxTokens);
  if (!Number.isFinite(cap) || cap < 1) return null;

  let lastErr = "";
  for (let attempt = 0; attempt < 2; attempt += 1) {
    if (attempt === 1) await sleep(1000);
    try {
      const response = await client.messages.create({
        model: anthropicModel(),
        max_tokens: cap,
        system,
        messages: [{ role: "user", content: userContent }],
      });
      const text = extractMessageText(response).trim();
      if (text.length) return text;
    } catch (err) {
      lastErr = String(err?.message || err);
    }
  }

  if (lastErr) {
    console.error(
      `[MedFlow][ClaudeService][Error] Transcript cleanup failed: ${lastErr}`,
    );
  }
  return null;
}

function cleanupMaxTokensForLength(charLength) {
  const n = Number(charLength) || 0;
  return Math.min(8192, Math.max(2048, Math.ceil(n / 2.5) + 400));
}

/**
 * Denoise and normalize a live-ASR transcript before SOAP generation.
 * @param {string} rawTranscript
 * @returns {Promise<string|null>} cleaned text, or null to signal "use raw"
 */
export async function cleanVisitTranscript(rawTranscript) {
  const raw = normalizeTranscriptWhitespace(rawTranscript);
  if (!raw) return null;

  const userContent = `Raw speech-recognition transcript (may be noisy):\n\n${raw}`;

  const cleaned = await completePlainTextFromClaude({
    system: TRANSCRIPT_CLEANUP_SYSTEM_PROMPT,
    userContent,
    maxTokens: cleanupMaxTokensForLength(raw.length),
  });

  const out = cleaned ? normalizeTranscriptWhitespace(cleaned) : "";
  if (!out) return null;
  if (raw.length > 40 && out.length < Math.max(12, raw.length * 0.08)) {
    console.warn(
      "[MedFlow][ClaudeService] Transcript cleanup suspiciously short; using raw.",
    );
    return null;
  }

  return out;
}

function buildSoapUserContent(transcript, patientContext = "") {
  const t = String(transcript || "").trim();
  const ctx = String(patientContext || "").trim();
  if (!ctx) return t;
  return `${t}\n\nRelevant patient context:\n${ctx}`;
}

/**
 * @param {string} transcript
 * @param {string} [patientContext]
 * @returns {Promise<object|null>}
 */
export async function generateSOAPNote(transcript, patientContext = "") {
  const { parsed } = await completeJsonFromClaude({
    system: SOAP_SYSTEM_PROMPT,
    userContent: buildSoapUserContent(transcript, patientContext),
    maxTokens: 1024,
  });
  return parsed;
}

/**
 * @param {string} command
 * @param {{ scheduleSnapshot?: string, conversationHistory?: { role: string, content: string }[], interactionMode?: "voice_calendar" | "chat_assistant", notesSnapshot?: string }} [options]
 * @returns {Promise<object|null>}
 */
export async function parseCalendarCommand(command, options = {}) {
  const scheduleSnapshot = options.scheduleSnapshot || "";
  const system = buildCalendarSystemPrompt(new Date(), scheduleSnapshot, {
    interactionMode: options.interactionMode || "chat_assistant",
    notesSnapshot: options.notesSnapshot,
  });

  let userContent = String(command || "").trim();
  const hist = options.conversationHistory;
  if (Array.isArray(hist) && hist.length > 0) {
    const formatted = hist
      .slice(-14)
      .map((t) => {
        const role = t.role === "assistant" ? "Assistant" : "Doctor";
        const c = String(t.content || "").trim().slice(0, 4000);
        return `${role}: ${c}`;
      })
      .join("\n");
    userContent = `Recent conversation:\n${formatted}\n\nDoctor's latest message:\n${userContent}`;
  }

  const { parsed } = await completeJsonFromClaude({
    system,
    userContent,
    maxTokens: 1536,
  });
  return parsed;
}
