import { NextResponse } from "next/server";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { MAX_TRANSCRIBE_BYTES, transcribeAudioFile } from "@/lib/openai-transcribe";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const formData = await request.formData();
    const audio = formData.get("audio");

    if (!(audio instanceof File)) {
      throw new Error('Expected multipart field "audio" with a file.');
    }

    if (audio.size === 0) {
      throw new Error("Empty audio file.");
    }

    if (audio.size > MAX_TRANSCRIBE_BYTES) {
      throw new Error("Recording is too large. Try a shorter clip.");
    }

    const text = await transcribeAudioFile(audio);

    return NextResponse.json({ text });
  } catch (error) {
    return authJsonError(error, "Unable to transcribe audio.");
  }
}
