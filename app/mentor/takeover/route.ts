import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireMentorApiUser } from "@/lib/auth";
import { takeOverSession } from "@/lib/services/mentor-service";

const takeoverSchema = z.object({
  session_id: z.string().min(1),
  mentor_message: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    await requireMentorApiUser();
    const body = takeoverSchema.parse(await request.json());
    const takeover = await takeOverSession(body);
    return NextResponse.json({
      success: true,
      takeover
    });
  } catch (error) {
    return authJsonError(error, "Unable to initiate mentor takeover.");
  }
}
