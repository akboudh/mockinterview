import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { deleteMemoryEvent, updateMemoryEvent } from "@/lib/services/memory-service";

const updateMemorySchema = z
  .object({
    memory_tier: z.enum(["short_term", "episodic", "long_term"]).optional(),
    event_type: z.string().min(1).optional(),
    content: z.record(z.any()).optional()
  })
  .refine(
    (payload) =>
      payload.memory_tier !== undefined ||
      payload.event_type !== undefined ||
      payload.content !== undefined,
    {
      message: "At least one editable memory field must be provided."
    }
  );

export async function PATCH(
  request: Request,
  context: {
    params: Promise<{
      eventId: string;
    }>;
  }
) {
  try {
    const user = await requireApiUser();
    const body = updateMemorySchema.parse(await request.json());
    const { eventId } = await context.params;
    const memory = await updateMemoryEvent({
      user_id: user.user_id,
      event_id: eventId,
      patch: body
    });

    return NextResponse.json({
      success: true,
      memory
    });
  } catch (error) {
    return authJsonError(error, "Unable to update memory.");
  }
}

export async function DELETE(
  _request: Request,
  context: {
    params: Promise<{
      eventId: string;
    }>;
  }
) {
  try {
    const user = await requireApiUser();
    const { eventId } = await context.params;
    const deleted = await deleteMemoryEvent({
      user_id: user.user_id,
      event_id: eventId
    });

    if (!deleted) {
      return NextResponse.json(
        {
          error: "Memory event not found."
        },
        {
          status: 404
        }
      );
    }

    return NextResponse.json({
      success: true
    });
  } catch (error) {
    return authJsonError(error, "Unable to delete memory.");
  }
}
