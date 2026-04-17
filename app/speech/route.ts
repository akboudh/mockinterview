import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { INTERVIEW_TTS_DEFAULT_INSTRUCTIONS } from "@/lib/constants";
import { synthesizeSpeechToBuffer } from "@/lib/openai-tts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const allowedVoices = [
  "alloy",
  "echo",
  "fable",
  "onyx",
  "nova",
  "shimmer",
  "coral",
  "sage",
  "ash",
  "ballad",
  "verse",
  "marin",
  "cedar"
] as const;

const bodySchema = z.object({
  text: z.string().min(1).max(4096),
  voice: z.enum(allowedVoices).optional(),
  /** If omitted, server applies a default upbeat interviewer style. */
  instructions: z.string().max(4096).optional()
});

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const json = bodySchema.parse(await request.json());
    const buffer = await synthesizeSpeechToBuffer(json.text, {
      voice: json.voice,
      instructions: json.instructions ?? INTERVIEW_TTS_DEFAULT_INSTRUCTIONS
    });

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": "audio/mpeg",
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    return authJsonError(error, "Unable to synthesize speech.");
  }
}
