import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireMentorApiUser } from "@/lib/auth";
import { addMentorFeedback } from "@/lib/services/mentor-service";

const feedbackSchema = z.object({
  session_id: z.string().min(1),
  mentor_message: z.string().min(1)
});

export async function POST(request: Request) {
  try {
    await requireMentorApiUser();
    const body = feedbackSchema.parse(await request.json());
    const intervention = await addMentorFeedback(body);
    return NextResponse.json({
      success: true,
      intervention
    });
  } catch (error) {
    return authJsonError(error, "Unable to submit mentor feedback.");
  }
}
