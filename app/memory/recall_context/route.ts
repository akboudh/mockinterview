import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { recallContext } from "@/lib/services/memory-service";
import { assertSessionOwnership } from "@/lib/services/session-service";

const recallSchema = z.object({
  session_id: z.string().nullable().optional(),
  user_id: z.string().min(1).optional(),
  query_type: z.enum(["short_term", "episodic", "long_term", "mixed"]),
  query_text: z.string().nullable().optional(),
  top_k: z.number().int().min(1).max(20).optional(),
  mode: z.enum(["behavioral", "technical", "case"]).nullable().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = recallSchema.parse(await request.json());
    if (body.session_id) {
      await assertSessionOwnership(body.session_id, user.user_id);
    }
    const payload = await recallContext({
      ...body,
      user_id: user.user_id
    });
    return NextResponse.json(payload);
  } catch (error) {
    return authJsonError(error, "Unable to recall context.");
  }
}
