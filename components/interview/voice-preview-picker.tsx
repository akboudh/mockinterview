"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import {
  INTERVIEW_TTS_VOICE_OPTIONS,
  TTS_VOICE_STORAGE_KEY
} from "@/lib/constants";
import { cn } from "@/lib/utils";

const PREVIEW_LINE = "Hi, I'll be your interviewer today.";

export function VoicePreviewPicker({ className }: { className?: string }) {
  const [selectedVoice, setSelectedVoice] = useState("alloy");
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(TTS_VOICE_STORAGE_KEY);
      if (stored && INTERVIEW_TTS_VOICE_OPTIONS.some((o) => o.value === stored)) {
        setSelectedVoice(stored);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const stopPreview = useCallback(() => {
    previewAudioRef.current?.pause();
    previewAudioRef.current = null;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  useEffect(() => () => stopPreview(), [stopPreview]);

  const playPreview = useCallback(
    async (voice: string) => {
      stopPreview();
      try {
        const response = await fetch("/speech", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: PREVIEW_LINE, voice })
        });
        if (!response.ok) {
          return;
        }
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        previewUrlRef.current = url;
        const audio = new Audio(url);
        previewAudioRef.current = audio;
        audio.onended = () => {
          if (previewUrlRef.current === url) {
            URL.revokeObjectURL(url);
            previewUrlRef.current = null;
            previewAudioRef.current = null;
          }
        };
        await audio.play();
      } catch {
        stopPreview();
      }
    },
    [stopPreview]
  );

  const selectVoice = useCallback(
    (voice: string) => {
      setSelectedVoice(voice);
      try {
        localStorage.setItem(TTS_VOICE_STORAGE_KEY, voice);
      } catch {
        /* ignore */
      }
      void playPreview(voice);
    },
    [playPreview]
  );

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-sm text-white/74">Interviewer voice</p>
      <p className="text-xs text-white/45">
        Tap a voice to hear a short preview. Your choice is used when question audio is on during the interview.
      </p>
      <div className="flex flex-wrap gap-2">
        {INTERVIEW_TTS_VOICE_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            className={cn(
              "rounded-full border px-3 py-1.5 text-sm transition",
              selectedVoice === option.value
                ? "border-sky-300/50 bg-sky-400/15 text-white"
                : "border-white/15 bg-white/5 text-white/80 hover:border-white/25"
            )}
            onClick={() => selectVoice(option.value)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}
