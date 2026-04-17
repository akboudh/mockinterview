import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { logEvent, requestIdFromRequest } from "@/lib/logging";
import { startSession } from "@/lib/services/session-service";

const startSessionSchema = z.object({
  user_id: z.string().min(1).optional(),
  target_role: z.string().min(1),
  mode: z.enum(["behavioral", "technical", "case"]),
  focus_area: z.string().nullable().optional(),
  confidence_self_rating: z.number().min(1).max(5).nullable().optional(),
  question_limit: z.number().int().min(1).max(20).nullable().optional(),
  question_time_limit_seconds: z.number().int().min(15).max(600).nullable().optional(),
  personalization_enabled: z.boolean(),
  self_critique_enabled: z.boolean(),
  notes: z.string().nullable().optional(),
  resume_text: z.string().nullable().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = startSessionSchema.parse(await request.json());
    const payload = await startSession({
      ...body,
      user_id: user.user_id
    });
    return NextResponse.json(payload);
  } catch (error) {
    logEvent(
      "session.start.failed",
      {
        request_id: requestIdFromRequest(request),
        reason: error instanceof Error ? error.message : "unknown"
      },
      "warn"
    );
    return authJsonError(error, "Unable to start session.");
  }
}
