import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import {
  listDirectMessagesForUser,
  resolvePrimaryMentorUserId,
  sendDirectMessage
} from "@/lib/services/mentor-dm-service";

const postSchema = z.object({
  body: z.string().min(1),
  session_id: z.string().optional().nullable()
});

export async function GET() {
  try {
    const user = await requireApiUser();
    const messages = await listDirectMessagesForUser(user.user_id);
    return NextResponse.json({ messages });
  } catch (error) {
    return authJsonError(error, "Unable to load messages.");
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = postSchema.parse(await request.json());
    const mentorId = await resolvePrimaryMentorUserId();
    if (!mentorId) {
      return NextResponse.json(
        { error: "No mentor is configured for this deployment." },
        { status: 503 }
      );
    }

    const dm = await sendDirectMessage({
      from_user_id: user.user_id,
      to_user_id: mentorId,
      body: body.body,
      session_id: body.session_id ?? null
    });

    return NextResponse.json({ success: true, dm });
  } catch (error) {
    return authJsonError(error, "Unable to send message.");
  }
}
