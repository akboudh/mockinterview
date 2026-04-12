import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { evaluateResponse } from "@/lib/services/evaluation-service";
import { assertSessionOwnership, saveStudentAnswer } from "@/lib/services/session-service";

const evaluateSchema = z.object({
  session_id: z.string().min(1),
  user_id: z.string().min(1).optional(),
  question_text: z.string().min(1),
  answer_text: z.string().min(1),
  target_role: z.string().min(1),
  mode: z.enum(["behavioral", "technical", "case"]),
  self_critique_enabled: z.boolean()
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = evaluateSchema.parse(await request.json());
    await assertSessionOwnership(body.session_id, user.user_id);
    const db = await readDb();
    const session = db.sessions.find((entry) => entry.session_id === body.session_id);
    if (!session) {
      throw new Error("Session not found.");
    }
    const questionMessage = db.messages
      .filter(
        (message) =>
          message.session_id === body.session_id &&
          message.speaker_type === "interviewer" &&
          message.content === body.question_text
      )
      .sort((left, right) => right.message_order - left.message_order)[0];

    if (!questionMessage) {
      throw new Error("Question message not found for evaluation.");
    }

    const answerMessage = await saveStudentAnswer({
      session_id: body.session_id,
      content: body.answer_text
    });

    const payload = await evaluateResponse({
      session_id: body.session_id,
      user_id: user.user_id,
      question_message_id: questionMessage.message_id,
      answer_message_id: answerMessage.message_id,
      question_text: body.question_text,
      answer_text: body.answer_text,
      target_role: body.target_role,
      mode: body.mode,
      self_critique_enabled: body.self_critique_enabled
    });

    return NextResponse.json(payload);
  } catch (error) {
    return authJsonError(error, "Unable to evaluate the response.");
  }
}
