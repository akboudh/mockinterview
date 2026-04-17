const OPENAI_SPEECH_URL = "https://api.openai.com/v1/audio/speech";

/** TTS input max per OpenAI speech API */
export const MAX_TTS_INPUT_CHARS = 4096;

export function getTtsModel() {
  return process.env.OPENAI_TTS_MODEL?.trim() || "gpt-4o-mini-tts";
}

export function getTtsVoice() {
  return process.env.OPENAI_TTS_VOICE?.trim() || "alloy";
}

export interface SpeechSynthesisOptions {
  /** Overrides server default (`OPENAI_TTS_VOICE`). */
  voice?: string;
  /** Style hints for `gpt-4o-mini-tts` and compatible models. */
  instructions?: string;
}

export async function synthesizeSpeechToBuffer(
  text: string,
  options?: SpeechSynthesisOptions
): Promise<ArrayBuffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to enable spoken questions.");
  }

  const trimmed = text.trim().slice(0, MAX_TTS_INPUT_CHARS);
  if (!trimmed) {
    throw new Error("No text to speak.");
  }

  const voice = options?.voice?.trim() || getTtsVoice();
  const model = getTtsModel();
  const payload: Record<string, unknown> = {
    model,
    input: trimmed,
    voice,
    response_format: "mp3"
  };

  const instructions = options?.instructions?.trim();
  // `instructions` is only supported on newer TTS models (e.g. gpt-4o-mini-tts), not on tts-1 / tts-1-hd.
  if (instructions && /gpt-4o|mini-tts/i.test(model)) {
    payload.instructions = instructions;
  }

  const response = await fetch(OPENAI_SPEECH_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    let detail = response.statusText;
    try {
      const raw = await response.text();
      const err = JSON.parse(raw) as { error?: { message?: string } };
      if (err.error?.message) {
        detail = err.error.message;
      } else if (raw) {
        detail = raw.slice(0, 300);
      }
    } catch {
      /* keep detail */
    }
    throw new Error(detail || `Speech request failed (${response.status}).`);
  }

  return response.arrayBuffer();
}
