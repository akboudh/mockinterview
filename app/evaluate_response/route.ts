import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { readDb } from "@/lib/db";
import { logEvent, requestIdFromRequest } from "@/lib/logging";
import { evaluateResponse } from "@/lib/services/evaluation-service";
import { assertSessionOwnership, saveStudentAnswer } from "@/lib/services/session-service";

const evaluateSchema = z
  .object({
    session_id: z.string().min(1),
    user_id: z.string().min(1).optional(),
    question_message_id: z.string().min(1).optional(),
    question_text: z.string().min(1).optional(),
    answer_text: z.string().min(1),
    target_role: z.string().min(1),
    mode: z.enum(["behavioral", "technical", "case"]),
    self_critique_enabled: z.boolean()
  })
  .superRefine((data, ctx) => {
    if (!data.question_message_id && !data.question_text) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Provide question_message_id or question_text",
        path: ["question_message_id"]
      });
    }
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

    const questionMessage = body.question_message_id
      ? db.messages.find(
          (message) =>
            message.message_id === body.question_message_id &&
            message.session_id === body.session_id &&
            message.speaker_type === "interviewer"
        )
      : db.messages
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

    const questionTextForEvaluation = questionMessage.content;

    const answerMessage = await saveStudentAnswer({
      session_id: body.session_id,
      content: body.answer_text
    });

    const payload = await evaluateResponse({
      session_id: body.session_id,
      user_id: user.user_id,
      question_message_id: questionMessage.message_id,
      answer_message_id: answerMessage.message_id,
      question_text: questionTextForEvaluation,
      answer_text: body.answer_text,
      target_role: body.target_role,
      mode: body.mode,
      self_critique_enabled: body.self_critique_enabled
    });

    return NextResponse.json(payload);
  } catch (error) {
    logEvent(
      "evaluate_response.failed",
      {
        request_id: requestIdFromRequest(request),
        reason: error instanceof Error ? error.message : "unknown"
      },
      "warn"
    );
    return authJsonError(error, "Unable to evaluate the response.");
  }
}
