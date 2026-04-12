import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { listMemoryEvents } from "@/lib/services/memory-service";

const listMemorySchema = z.object({
  session_id: z.string().nullable().optional(),
  memory_tier: z.enum(["short_term", "episodic", "long_term"]).nullable().optional(),
  event_type: z.string().nullable().optional(),
  mode: z.enum(["behavioral", "technical", "case"]).nullable().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional()
});

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const url = new URL(request.url);
    const query = listMemorySchema.parse({
      session_id: url.searchParams.get("session_id"),
      memory_tier: url.searchParams.get("memory_tier"),
      event_type: url.searchParams.get("event_type"),
      mode: url.searchParams.get("mode"),
      limit: url.searchParams.get("limit") ?? undefined
    });
    const memories = await listMemoryEvents({
      user_id: user.user_id,
      ...query
    });

    return NextResponse.json({
      items: memories
    });
  } catch (error) {
    return authJsonError(error, "Unable to list memories.");
  }
}
