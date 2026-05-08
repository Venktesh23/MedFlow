import { useCallback, useEffect, useRef, useState } from "react";

type SpeechRecognitionCtor = new () => SpeechRecognition;

type SpeechRecognition = EventTarget & {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEvent) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

type SpeechRecognitionEvent = {
  resultIndex: number;
  results: {
    length: number;
    [index: number]: {
      isFinal: boolean;
      [index: number]: { transcript: string };
    };
  };
};

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

async function primeMicrophone(): Promise<void> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    stream.getTracks().forEach((t) => t.stop());
  } catch {
    /* Web Speech may still work; browser will prompt again if needed */
  }
}

export function useSpeechRecognition() {
  const [transcript, setTranscript] = useState("");
  const [interimTranscript, setInterimTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const listeningRef = useRef(false);

  const supported =
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);

  useEffect(() => {
    if (!supported) return undefined;

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new Recognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      let finalText = "";
      let interimText = "";

      // Rebuild from all results so interim/live text always matches what the engine has
      // (using only resultIndex often drops earlier interim chunks in the box).
      for (let i = 0; i < event.results.length; i += 1) {
        const text = event.results[i][0]?.transcript || "";
        if (event.results[i].isFinal) {
          finalText += text;
        } else {
          interimText += text;
        }
      }

      setTranscript(finalText.trim());
      setInterimTranscript(interimText.trim());
    };
    recognition.onend = () => {
      listeningRef.current = false;
      setIsListening(false);
    };
    recognition.onerror = () => {
      listeningRef.current = false;
      setIsListening(false);
    };
    recognitionRef.current = recognition;

    return () => recognition.abort();
  }, [supported]);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec || !supported) return;

    void (async () => {
      await primeMicrophone();

      const tryStart = () => {
        try {
          rec.start();
          listeningRef.current = true;
          setIsListening(true);
          return true;
        } catch (err: unknown) {
          const name = err instanceof DOMException ? err.name : (err as Error)?.name;
          if (name === "InvalidStateError") {
            try {
              rec.abort();
            } catch {
              /* already idle */
            }
            window.setTimeout(() => {
              try {
                rec.start();
                listeningRef.current = true;
                setIsListening(true);
              } catch {
                listeningRef.current = false;
                setIsListening(false);
              }
            }, 120);
            return true;
          }
          listeningRef.current = false;
          setIsListening(false);
          return false;
        }
      };

      tryStart();
    })();
  }, [supported]);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    listeningRef.current = false;
    setIsListening(false);
    setInterimTranscript("");
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setInterimTranscript("");
  }, []);

  const setTranscriptAndClearInterim = useCallback((value: string) => {
    setTranscript(value);
    setInterimTranscript("");
  }, []);

  return {
    supported,
    transcript,
    interimTranscript,
    fullTranscript: [transcript, interimTranscript].filter(Boolean).join(" ").trim(),
    isListening,
    setTranscript: setTranscriptAndClearInterim,
    start,
    stop,
    reset,
  };
}
