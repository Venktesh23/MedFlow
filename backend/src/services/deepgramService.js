import { DeepgramClient } from "@deepgram/sdk";

// Service wrapper for Deepgram transcription. It accepts either a Buffer or a readable stream.
let deepgramClient;

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

function extractTranscript(deepgramResponse) {
  return (
    deepgramResponse?.results?.channels?.[0]?.alternatives?.[0]?.transcript?.trim() ||
    ""
  );
}

export async function transcribeAudio(audioInput, options = {}) {
  try {
    const audioBuffer = Buffer.isBuffer(audioInput)
      ? audioInput
      : await streamToBuffer(audioInput);

    if (!audioBuffer?.length) {
      return {
        ok: false,
        error: {
          code: "EMPTY_AUDIO",
          message: "Audio input is empty.",
        },
      };
    }

    const deepgram = getDeepgramClient();
    const model = options.model || process.env.DEEPGRAM_MODEL || "nova-2-medical";

    const result = await deepgram.listen.v1.media.transcribeFile(
      audioBuffer,
      {
        model,
        smart_format: true,
        punctuate: true,
        diarize: options.diarize ?? true,
        language: options.language || "en-US",
      },
      options.mimetype
        ? {
            headers: {
              "Content-Type": options.mimetype,
            },
          }
        : undefined,
    );

    const transcript = extractTranscript(result);

    if (!transcript) {
      return {
        ok: false,
        error: {
          code: "EMPTY_TRANSCRIPT",
          message: "Deepgram returned an empty transcript.",
        },
      };
    }

    return {
      ok: true,
      data: {
        transcript,
        raw: result,
      },
    };
  } catch (error) {
    return {
      ok: false,
      error: {
        code: "TRANSCRIPTION_SERVICE_ERROR",
        message: "Unable to transcribe audio.",
        details: error.message,
      },
    };
  }
}

export async function transcribeAudioWithDeepgram(audioInput, options = {}) {
  return transcribeAudio(audioInput, {
    model: process.env.DEEPGRAM_MODEL || "nova-2",
    ...options,
  });
}
