const OPENAI_TRANSCRIPTIONS_URL = "https://api.openai.com/v1/audio/transcriptions";

/** Max upload size forwarded to OpenAI (bytes). */
export const MAX_TRANSCRIBE_BYTES = 15 * 1024 * 1024;

export function getTranscribeModel() {
  return process.env.OPENAI_TRANSCRIBE_MODEL?.trim() || "gpt-4o-mini-transcribe";
}

export async function transcribeAudioFile(file: File): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not set. Add it to enable dictation.");
  }

  if (file.size > MAX_TRANSCRIBE_BYTES) {
    throw new Error("Recording is too large. Try a shorter answer.");
  }

  const body = new FormData();
  body.append("file", file);
  body.append("model", getTranscribeModel());
  body.append("response_format", "json");

  const response = await fetch(OPENAI_TRANSCRIPTIONS_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`
    },
    body
  });

  if (!response.ok) {
    const raw = await response.text();
    let detail = raw || response.statusText;
    try {
      const err = JSON.parse(raw) as { error?: { message?: string } };
      if (err.error?.message) {
        detail = err.error.message;
      }
    } catch {
      /* use raw */
    }
    throw new Error(
      (detail || `Transcription failed (${response.status}).`).slice(0, 400)
    );
  }

  const data = (await response.json()) as { text?: string };
  if (typeof data.text !== "string") {
    throw new Error("Transcription response did not include text.");
  }

  return data.text.trim();
}
