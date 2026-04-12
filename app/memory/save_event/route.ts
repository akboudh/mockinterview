import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { saveEvent } from "@/lib/services/memory-service";
import { assertSessionOwnership } from "@/lib/services/session-service";

const saveEventSchema = z.object({
  session_id: z.string().min(1),
  user_id: z.string().min(1).optional(),
  memory_tier: z.enum(["short_term", "episodic", "long_term"]),
  event_type: z.string().min(1),
  content: z.record(z.any())
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = saveEventSchema.parse(await request.json());
    await assertSessionOwnership(body.session_id, user.user_id);
    const event = await saveEvent({
      ...body,
      user_id: user.user_id
    });
    return NextResponse.json({
      success: true,
      event_id: event.event_id
    });
  } catch (error) {
    return authJsonError(error, "Unable to save memory.");
  }
}
