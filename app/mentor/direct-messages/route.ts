import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireMentorApiUser } from "@/lib/auth";
import {
  listDirectMessagesBetween,
  listDirectMessagesForUser,
  markDirectMessagesRead,
  sendDirectMessage
} from "@/lib/services/mentor-dm-service";

const postSchema = z.object({
  to_user_id: z.string().min(1),
  body: z.string().min(1),
  session_id: z.string().optional().nullable()
});

export async function GET(request: Request) {
  try {
    const mentor = await requireMentorApiUser();
    const url = new URL(request.url);
    const withUserId = url.searchParams.get("with_user_id")?.trim() || null;

    const messages = withUserId
      ? await listDirectMessagesBetween(mentor.user_id, withUserId)
      : await listDirectMessagesForUser(mentor.user_id);

    if (withUserId) {
      await markDirectMessagesRead({
        reader_user_id: mentor.user_id,
        other_user_id: withUserId
      });
    }

    return NextResponse.json({ messages });
  } catch (error) {
    return authJsonError(error, "Unable to load messages.");
  }
}

export async function POST(request: Request) {
  try {
    const mentor = await requireMentorApiUser();
    const body = postSchema.parse(await request.json());
    const dm = await sendDirectMessage({
      from_user_id: mentor.user_id,
      to_user_id: body.to_user_id,
      body: body.body,
      session_id: body.session_id ?? null
    });
    return NextResponse.json({ success: true, dm });
  } catch (error) {
    return authJsonError(error, "Unable to send message.");
  }
}
