"use client";

import { useCallback, useRef, useState } from "react";
import { Loader2, Mic, Square } from "lucide-react";

import { Button } from "@/components/ui/button";

function pickRecorderMimeType(): string | undefined {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];
  for (const type of candidates) {
    if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return undefined;
}

export function AnswerComposer({
  value,
  onChange,
  onSubmit,
  disabled,
  onHint,
  timerLabel,
  timerTone,
  onTranscribingChange
}: {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  onHint?: () => void;
  timerLabel?: string | null;
  timerTone?: "default" | "warning" | "danger";
  /** Fires when waiting on /transcribe (AI); parent can pause answer timers. */
  onTranscribingChange?: (transcribing: boolean) => void;
}) {
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [transcribeError, setTranscribeError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const mimeRef = useRef<string>("audio/webm");

  const timerClasses =
    timerTone === "danger"
      ? "border-rose-400/30 bg-rose-500/12 text-rose-100"
      : timerTone === "warning"
        ? "border-amber-400/30 bg-amber-500/12 text-amber-100"
        : "border-white/10 bg-white/5 text-white/68";

  const voiceBusy = isRecording || isTranscribing;

  const setTranscribing = useCallback(
    (next: boolean) => {
      setIsTranscribing(next);
      onTranscribingChange?.(next);
    },
    [onTranscribingChange]
  );

  const canUseDictation =
    typeof window !== "undefined" &&
    typeof navigator !== "undefined" &&
    Boolean(navigator.mediaDevices?.getUserMedia) &&
    typeof MediaRecorder !== "undefined" &&
    Boolean(pickRecorderMimeType());

  const startRecording = useCallback(async () => {
    setTranscribeError(null);
    const mimeType = pickRecorderMimeType();
    if (!mimeType) {
      setTranscribeError("This browser cannot record audio in a supported format.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      chunksRef.current = [];
      mimeRef.current = mimeType;

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      recorder.onerror = () => {
        setTranscribeError("Recording failed.");
        setIsRecording(false);
        stream.getTracks().forEach((track) => track.stop());
        mediaRecorderRef.current = null;
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
      };

      recorder.start(200);
      setIsRecording(true);
    } catch {
      setTranscribeError("Microphone permission is required for dictation.");
    }
  }, []);

  const finishRecordingAndTranscribe = useCallback(async () => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") {
      setIsRecording(false);
      return;
    }

    if (recorder.state === "recording") {
      try {
        recorder.requestData();
      } catch {
        /* some browsers omit requestData */
      }
    }

    await new Promise<void>((resolve) => {
      recorder.addEventListener("stop", () => resolve(), { once: true });
      recorder.stop();
    });

    setIsRecording(false);
    mediaRecorderRef.current = null;

    const blob = new Blob(chunksRef.current, { type: mimeRef.current });
    chunksRef.current = [];

    if (blob.size === 0) {
      setTranscribeError("No audio captured. Try again.");
      return;
    }

    const ext = mimeRef.current.includes("webm") ? "webm" : "m4a";
    const file = new File([blob], `answer.${ext}`, {
      type: blob.type || "audio/webm"
    });

    setTranscribing(true);
    setTranscribeError(null);

    try {
      const formData = new FormData();
      formData.append("audio", file);

      const response = await fetch("/transcribe", {
        method: "POST",
        body: formData
      });

      const payload = (await response.json()) as { error?: string; text?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Transcription failed.");
      }

      const text = typeof payload.text === "string" ? payload.text.trim() : "";
      if (!text) {
        setTranscribeError("No speech detected. Try again.");
        return;
      }

      onChange(value.trim() ? `${value.trim()}\n\n${text}` : text);
    } catch (err) {
      setTranscribeError(err instanceof Error ? err.message : "Transcription failed.");
    } finally {
      setTranscribing(false);
    }
  }, [onChange, setTranscribing, value]);

  const toggleDictation = () => {
    if (disabled) {
      return;
    }
    if (isTranscribing) {
      return;
    }
    if (isRecording) {
      void finishRecordingAndTranscribe();
      return;
    }
    void startRecording();
  };

  return (
    <div className="premium-panel rounded-[30px] p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
        <span className="text-sm text-white/68">Your answer</span>
        {timerLabel ? (
          <span
            className={`rounded-full border px-3 py-1 text-xs uppercase tracking-[0.18em] ${timerClasses}`}
          >
            {timerLabel}
          </span>
        ) : null}
      </div>
      <label className="grid gap-3">
        <textarea
          className="field min-h-36 resize-none"
          placeholder="Respond naturally. The evaluator will score clarity, structure, relevance, and soft skills."
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
        />
      </label>
      {transcribeError ? (
        <p className="mt-2 text-sm text-rose-300/90" role="alert">
          {transcribeError}
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {onHint ? (
            <Button type="button" variant="secondary" size="sm" onClick={onHint}>
              Need a hint
            </Button>
          ) : null}
          {canUseDictation ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className={
                isRecording
                  ? "border-rose-400/40 bg-rose-500/15 text-rose-50 hover:border-rose-400/55 hover:bg-rose-500/22"
                  : undefined
              }
              onClick={toggleDictation}
              disabled={disabled || isTranscribing}
            >
              {isTranscribing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Transcribing…
                </>
              ) : isRecording ? (
                <>
                  <Square className="mr-2 h-4 w-4 fill-current" aria-hidden />
                  Stop & transcribe
                </>
              ) : (
                <>
                  <Mic className="mr-2 h-4 w-4" aria-hidden />
                  Dictate
                </>
              )}
            </Button>
          ) : null}
        </div>
        <Button type="button" onClick={onSubmit} disabled={disabled || !value.trim() || voiceBusy}>
          Submit answer
        </Button>
      </div>
      {!canUseDictation ? (
        <p className="mt-3 text-xs text-white/45">
          Dictation needs a modern desktop browser with microphone access and an OpenAI API key on
          the server.
        </p>
      ) : null}
    </div>
  );
}
