import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { logEvent } from "@/lib/logging";
import { askQuestion } from "@/lib/services/orchestrator-service";
import { assertSessionOwnership } from "@/lib/services/session-service";

const transcriptItemSchema = z.object({
  speaker_type: z.enum(["system", "interviewer", "student", "mentor"]),
  content: z.string().min(1),
  question_type: z
    .enum(["primary", "follow_up", "situational", "clarifying"])
    .nullable()
    .optional()
});

const recalledContextItemSchema = z.object({
  memory_tier: z.enum(["short_term", "episodic", "long_term"]),
  content: z.record(z.any()),
  relevance_reason: z.string()
});

const askQuestionContextSchema = z.object({
  mode: z.enum(["behavioral", "technical", "case"]),
  target_role: z.string().min(1),
  focus_area: z.string().nullable().optional(),
  personalization_enabled: z.boolean(),
  self_critique_enabled: z.boolean(),
  resume_text: z.string().nullable().optional(),
  recalled_context_summary: z.string().nullable().optional(),
  session_status: z.enum(["initialized", "active", "paused", "completed", "flagged"]),
  transcript: z.array(transcriptItemSchema),
  current_phase: z.enum([
    "interview_setup",
    "opening",
    "interview_round",
    "deep_dive",
    "session_feedback",
    "mentor_review"
  ]),
  previous_phase: z
    .enum([
      "interview_setup",
      "opening",
      "interview_round",
      "deep_dive",
      "session_feedback",
      "mentor_review"
    ])
    .nullable()
    .optional(),
  turn_count: z.number().int().min(0),
  redirect_count: z.number().int().min(0).optional(),
  turn_type: z
    .enum([
      "first_turn",
      "standard",
      "phase_transition",
      "clarification",
      "entity_transition",
      "termination"
    ])
    .optional(),
  conversation_summary: z.string().nullable().optional(),
  weak_skills: z.array(z.string()),
  recalled_context_items: z.array(recalledContextItemSchema),
  flagged: z.boolean().optional(),
  mentor_takeover_active: z.boolean().optional()
});

const askQuestionSchema = z.object({
  session_id: z.string().min(1),
  user_id: z.string().min(1).optional(),
  latest_answer: z.string().nullable().optional(),
  context: askQuestionContextSchema.optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = askQuestionSchema.parse(await request.json());
    await assertSessionOwnership(body.session_id, user.user_id);
    const payload = await askQuestion({
      ...body,
      user_id: user.user_id
    });
    return NextResponse.json(payload);
  } catch (error) {
    logEvent(
      "orchestrator.question.failed",
      {
        reason: error instanceof Error ? error.message : "unknown"
      },
      "warn"
    );
    return authJsonError(error, "Unable to generate the next question.");
  }
}
