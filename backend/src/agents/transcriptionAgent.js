import { DeepgramClient } from "@deepgram/sdk";

let deepgramClient;

function log(action, message, metadata) {
  const suffix = metadata ? ` ${JSON.stringify(metadata)}` : "";
  console.log(`[MedFlow][TranscriptionAgent][${action}] ${message}${suffix}`);
}

function getDeepgramClient() {
  if (!process.env.DEEPGRAM_API_KEY) {
    throw new Error("DEEPGRAM_API_KEY is not configured");
  }

  if (!deepgramClient) {
    deepgramClient = new DeepgramClient({
      apiKey: process.env.DEEPGRAM_API_KEY,
    });
  }

  return deepgramClient;
}

async function streamToBuffer(stream) {
  const chunks = [];
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
}

function wordCount(text = "") {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function audioSizeMb(buffer) {
  return Number((buffer.length / 1024 / 1024).toFixed(2));
}

function isLikelyUnderFiveSeconds(buffer, options = {}) {
  if (typeof options.durationSeconds === "number") {
    return options.durationSeconds < 5;
  }

  if (typeof options.durationMs === "number") {
    return options.durationMs < 5000;
  }

  // Conservative PCM/WAV estimate: 16kHz, 16-bit, mono. Compressed formats pass through.
  const mimetype = options.mimetype || "";
  if (mimetype.includes("wav") || mimetype.includes("pcm")) {
    return buffer.length < 16000 * 2 * 5;
  }

  return false;
}

function extractDeepgramPayload(response) {
  return response?.result || response;
}

function speakerStats(utterances = []) {
  const stats = new Map();

  utterances.forEach((utterance) => {
    const speaker = String(utterance.speaker ?? "speaker_0");
    const text = utterance.transcript || "";
    const existing = stats.get(speaker) || {
      words: 0,
      firstStart: utterance.start ?? Number.POSITIVE_INFINITY,
      questionMarks: 0,
      authorityHits: 0,
    };

    existing.words += wordCount(text);
    existing.firstStart = Math.min(existing.firstStart, utterance.start ?? existing.firstStart);
    existing.questionMarks += (text.match(/\?/g) || []).length;
    existing.authorityHits += (
      text.match(/\b(recommend|prescribe|ordered|exam|diagnosis|follow up|blood pressure|medication|plan)\b/gi) ||
      []
    ).length;
    stats.set(speaker, existing);
  });

  return stats;
}

function assignSpeakerLabels(utterances = []) {
  const stats = speakerStats(utterances);
  const speakers = [...stats.keys()];

  if (speakers.length <= 1) {
    return new Map([[speakers[0] || "speaker_0", "Doctor"]]);
  }

  const ranked = speakers
    .map((speaker) => {
      const stat = stats.get(speaker);
      const score =
        stat.authorityHits * 3 +
        stat.questionMarks * 2 -
        stat.words * 0.01 -
        stat.firstStart * 0.1;
      return { speaker, score };
    })
    .sort((a, b) => b.score - a.score);

  return new Map([
    [ranked[0].speaker, "Doctor"],
    [ranked[1].speaker, "Patient"],
  ]);
}

function formatFromUtterances(utterances = []) {
  const usable = utterances.filter((utterance) => wordCount(utterance.transcript || "") >= 3);
  const labels = assignSpeakerLabels(usable);

  return usable
    .map((utterance) => {
      const speaker = String(utterance.speaker ?? "speaker_0");
      const label = labels.get(speaker) || `Speaker ${speaker}`;
      return `${label}: ${utterance.transcript.trim()}`;
    })
    .join("\n");
}

function formatFallbackTranscript(transcript = "") {
  return transcript
    .split(/(?<=[.!?])\s+/)
    .map((segment) => segment.trim())
    .filter((segment) => wordCount(segment) >= 3)
    .map((segment, index) => `${index === 0 ? "Doctor" : "Patient"}: ${segment}`)
    .join("\n");
}

async function transcribeWithDeepgram(audioBuffer, options = {}) {
  const deepgram = getDeepgramClient();
  return deepgram.listen.v1.media.transcribeFile(
    audioBuffer,
    {
      model: "nova-2",
      language: "en-US",
      punctuate: true,
      diarize: true,
      smart_format: true,
      filler_words: false,
      paragraphs: true,
      utterances: true,
    },
    options.mimetype
      ? {
          headers: {
            "Content-Type": options.mimetype,
          },
        }
      : undefined,
  );
}

/**
 * Transcribes a clinical audio session and returns a cleaned speaker-labeled transcript.
 *
 * @param {Buffer|AsyncIterable<Buffer|string>} audioInput Raw audio buffer or stream.
 * @param {{ mimetype?: string, durationSeconds?: number, durationMs?: number }} options Audio metadata.
 * @returns {Promise<{ok: boolean, data?: {transcript: string, rawTranscript: string, wordCount: number, raw: object}, error?: object}>}
 */
export async function runTranscriptionAgent(audioInput, options = {}) {
  const audioBuffer = Buffer.isBuffer(audioInput)
    ? audioInput
    : await streamToBuffer(audioInput);

  if (!audioBuffer?.length) {
    return {
      ok: false,
      error: { code: "EMPTY_AUDIO", message: "Audio input is empty." },
    };
  }

  if (isLikelyUnderFiveSeconds(audioBuffer, options)) {
    return {
      ok: false,
      error: {
        code: "AUDIO_TOO_SHORT",
        message: "Audio duration is under 5 seconds.",
      },
    };
  }

  log("Deepgram", `Transcription started. Audio size: ${audioSizeMb(audioBuffer)}MB`);

  let lastError = null;

  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const response = await transcribeWithDeepgram(audioBuffer, options);
      const payload = extractDeepgramPayload(response);
      const alternative = payload?.results?.channels?.[0]?.alternatives?.[0];
      const rawTranscript = alternative?.transcript?.trim() || "";
      const utterances = payload?.results?.utterances || [];
      const formattedTranscript =
        utterances.length > 0
          ? formatFromUtterances(utterances)
          : formatFallbackTranscript(rawTranscript);
      const count = wordCount(formattedTranscript);

      if (!formattedTranscript || count < 50) {
        lastError = {
          code: "TRANSCRIPT_TOO_SHORT",
          message: "Transcript too short to generate clinical notes",
          details: `Word count: ${count}`,
        };
        log("Deepgram", `Transcript too short on attempt ${attempt}. Word count: ${count}`);
        if (attempt === 1) continue;
        return { ok: false, error: lastError };
      }

      log("Deepgram", `Transcription complete. Word count: ${count}`);

      return {
        ok: true,
        data: {
          transcript: formattedTranscript,
          rawTranscript,
          wordCount: count,
          raw: payload,
        },
      };
    } catch (error) {
      lastError = {
        code: "TRANSCRIPTION_SERVICE_ERROR",
        message: "Unable to transcribe audio.",
        details: error.message,
      };
      log("Deepgram", `Transcription failed on attempt ${attempt}. Audio size: ${audioSizeMb(audioBuffer)}MB`, {
        error: error.message,
      });
    }
  }

  return { ok: false, error: lastError };
}
