import { DEFAULT_QUESTIONS_PER_SESSION } from "@/lib/constants";
import {
  incrementalEndSession,
  incrementalPrependOpeningMessage,
  incrementalSaveStudentAnswer,
  incrementalSetSessionStatus,
  incrementalStartSession
} from "@/lib/db-incremental";
import { readDb } from "@/lib/db";
import { logEvent } from "@/lib/logging";
import { buildPersonalizationSummary, extractResumeHighlights, normalizeResumeText } from "@/lib/personalization";
import { buildOpeningIntroLine } from "@/lib/interview-intro";
import { average } from "@/lib/utils";
import { recallContext, saveEvent } from "@/lib/services/memory-service";
import { inspectForGuardrails, recordGuardrailFlags } from "@/lib/services/guardrail-service";
import type {
  AgentSessionState,
  InterviewMode,
  InterviewSession,
  Message,
  SessionSummary,
  SessionStatus
} from "@/lib/types";

function createInitialAgentState(session: InterviewSession): AgentSessionState {
  const now = new Date().toISOString();

  return {
    session_id: session.session_id,
    user_id: session.user_id,
    current_phase: "interview_setup",
    previous_phase: null,
    turn_count: 0,
    redirect_count: 0,
    turn_type: "first_turn",
    current_question_id: null,
    current_question_text: null,
    current_question_type: null,
    latest_answer_text: null,
    analyzer_output: null,
    missing_signals: [],
    follow_up_targets: [],
    suggested_phase: "opening",
    conversation_summary: session.recalled_context_summary ?? null,
    recent_messages: [],
    guardrail_findings: [],
    flagged: false,
    mentor_takeover_active: false,
    state_json: {
      current_phase: "interview_setup",
      bootstrapped_from_form: true
    },
    created_at: now,
    updated_at: now
  };
}

export async function startSession(params: {
  user_id: string;
  target_role: string;
  mode: InterviewMode;
  focus_area?: string | null;
  confidence_self_rating?: number | null;
  question_limit?: number | null;
  question_time_limit_seconds?: number | null;
  personalization_enabled: boolean;
  self_critique_enabled: boolean;
  notes?: string | null;
  resume_text?: string | null;
}) {
  const normalizedResumeText = normalizeResumeText(params.resume_text ?? "");
  const resumeHighlights = extractResumeHighlights(normalizedResumeText);
  const recalledContext = params.personalization_enabled
    ? await recallContext({
        user_id: params.user_id,
        query_type: "mixed",
        query_text: `${params.target_role} ${params.focus_area ?? ""} ${resumeHighlights.join(" ")}`.trim()
      })
    : { context_items: [], weak_skills: [] };
  const summary = buildPersonalizationSummary({
    contextItems: recalledContext.context_items,
    resumeText: normalizedResumeText || null,
    personalizationEnabled: params.personalization_enabled
  });

  const session: InterviewSession = {
    session_id: crypto.randomUUID(),
    user_id: params.user_id,
    mode: params.mode,
    target_role: params.target_role,
    focus_area: params.focus_area ?? null,
    confidence_self_rating: params.confidence_self_rating ?? null,
    question_limit: params.question_limit ?? DEFAULT_QUESTIONS_PER_SESSION,
    question_time_limit_seconds: params.question_time_limit_seconds ?? null,
    status: "initialized",
    started_at: new Date().toISOString(),
    ended_at: null,
    personalization_enabled: params.personalization_enabled,
    self_critique_enabled: params.self_critique_enabled,
    notes: params.notes ?? null,
    resume_text: normalizedResumeText || null,
    recalled_context_summary: summary
  };
  const runtimeState = createInitialAgentState(session);

  await incrementalStartSession({
    session,
    runtimeState,
    userId: params.user_id,
    normalizedResumeText,
    targetRole: params.target_role,
    mode: params.mode
  });

  await saveEvent({
    session_id: session.session_id,
    user_id: session.user_id,
    memory_tier: "episodic",
    event_type: "session_started",
    content: {
      mode: session.mode,
      target_role: session.target_role,
      personalization_enabled: session.personalization_enabled
    }
  });

  if (session.resume_text) {
    await saveEvent({
      session_id: session.session_id,
      user_id: session.user_id,
      memory_tier: "long_term",
      event_type: "resume_profile",
      content: {
        resume_highlights: resumeHighlights,
        resume_excerpt: session.resume_text.slice(0, 1600)
      }
    });
  }

  logEvent("session.started", {
    session_id: session.session_id,
    user_id: session.user_id,
    mode: session.mode,
    target_role: session.target_role,
    personalization_enabled: session.personalization_enabled,
    self_critique_enabled: session.self_critique_enabled,
    question_limit: session.question_limit,
    question_time_limit_seconds: session.question_time_limit_seconds,
    resume_loaded: Boolean(session.resume_text)
  });

  return {
    session_id: session.session_id,
    status: "initialized" as const,
    recalled_context_summary: session.recalled_context_summary,
    current_phase: runtimeState.current_phase
  };
}

export async function saveStudentAnswer(params: {
  session_id: string;
  content: string;
}) {
  const db = await readDb();
  const session = db.sessions.find((entry) => entry.session_id === params.session_id);

  if (!session) {
    throw new Error("Session not found.");
  }

  const orderedMessages = db.messages
    .filter((entry) => entry.session_id === session.session_id)
    .sort((left, right) => left.message_order - right.message_order);
  const message: Message = {
    message_id: crypto.randomUUID(),
    session_id: session.session_id,
    speaker_type: "student",
    content: params.content,
    message_order: orderedMessages.length + 1,
    created_at: new Date().toISOString()
  };
  const findings = await inspectForGuardrails({
    text: params.content,
    source: "student",
    session_id: session.session_id,
    message_id: message.message_id
  });

  const currentState = db.agentSessionStates.find((s) => s.session_id === params.session_id);
  if (!currentState) {
    throw new Error("Agent state not found.");
  }
  const nextAgentState: AgentSessionState = {
    ...currentState,
    latest_answer_text: params.content,
    recent_messages: [...orderedMessages, message].slice(-4).map((entry) => ({
      speaker_type: entry.speaker_type,
      content: entry.content
    })),
    flagged: findings.length ? true : currentState.flagged,
    updated_at: new Date().toISOString()
  };

  await incrementalSaveStudentAnswer({
    message,
    sessionId: params.session_id,
    sessionStatus: findings.length ? "flagged" : "active",
    nextAgentState
  });

  await saveEvent({
    session_id: session.session_id,
    user_id: session.user_id,
    memory_tier: "short_term",
    event_type: "student_answer",
    content: {
      answer_message_id: message.message_id,
      content: params.content
    }
  });

  await recordGuardrailFlags({
    session_id: session.session_id,
    message_id: message.message_id,
    findings,
    allowSessionTermination: true
  });

  logEvent("session.answer.saved", {
    session_id: session.session_id,
    answer_message_id: message.message_id,
    answer_length: params.content.trim().length,
    guardrail_findings: findings.length
  });

  return message;
}

export async function setSessionStatus(sessionId: string, status: SessionStatus) {
  await incrementalSetSessionStatus(sessionId, status);
}

export async function endSession(
  sessionId: string,
  reason:
    | "manual_end"
    | "question_limit_reached"
    | "session_feedback_completed"
    | "guardrail_auto_end" = "manual_end"
) {
  const db = await readDb();
  const session = db.sessions.find((entry) => entry.session_id === sessionId);
  const state = db.agentSessionStates.find((entry) => entry.session_id === sessionId);
  if (!session || !state) {
    throw new Error("Session not found.");
  }
  const nextAgent: AgentSessionState = {
    ...state,
    previous_phase: state.current_phase,
    current_phase: "session_feedback",
    turn_type: "termination",
    updated_at: new Date().toISOString(),
    state_json: {
      ...state.state_json,
      current_phase: "session_feedback",
      summary_ready: true,
      session_end_reason: reason
    }
  };
  await incrementalEndSession(sessionId, session.ended_at ?? new Date().toISOString(), nextAgent);

  logEvent("session.completed", {
    session_id: sessionId,
    reason
  });
}

export async function listSessions(userId: string) {
  const db = await readDb();
  return db.sessions
    .filter((session) => session.user_id === userId)
    .sort(
      (left, right) =>
        new Date(right.started_at).getTime() - new Date(left.started_at).getTime()
    )
    .map((session) => {
      const evaluations = db.evaluations.filter(
        (evaluation) => evaluation.session_id === session.session_id
      );
      const runtime = db.agentSessionStates.find(
        (state) => state.session_id === session.session_id
      );
      const averageScore = evaluations.length
        ? average(
            evaluations.flatMap((evaluation) => [
              evaluation.clarity_score,
              evaluation.structure_score,
              evaluation.relevance_score,
              evaluation.soft_skills_score
            ])
          )
        : null;

      return {
        ...session,
        current_phase: runtime?.current_phase ?? "interview_setup",
        question_count: db.messages.filter(
          (message) =>
            message.session_id === session.session_id && message.speaker_type === "student"
        ).length,
        mentor_feedback_count: db.mentorInterventions.filter(
          (i) => i.session_id === session.session_id && i.intervention_type === "supplemental_feedback"
        ).length,
        summary_score: averageScore
      };
    });
}

export async function getSessionById(sessionId: string) {
  const db = await readDb();
  return db.sessions.find((entry) => entry.session_id === sessionId) ?? null;
}

export async function assertSessionOwnership(sessionId: string, userId: string) {
  const session = await getSessionById(sessionId);

  if (!session || session.user_id !== userId) {
    throw new Error("Session not found.");
  }

  return session;
}

export async function prependOpeningIntroMessage(sessionId: string, userId: string) {
  const db = await readDb();
  const session = db.sessions.find((entry) => entry.session_id === sessionId);

  if (!session || session.user_id !== userId) {
    throw new Error("Session not found.");
  }

  const sessionMessages = db.messages
    .filter((entry) => entry.session_id === sessionId)
    .sort((left, right) => left.message_order - right.message_order);

  if (sessionMessages.some((m) => m.meta && (m.meta as { opening_intro?: boolean }).opening_intro)) {
    return { skipped: true as const };
  }

  const interviewerCount = sessionMessages.filter((m) => m.speaker_type === "interviewer").length;
  const studentCount = sessionMessages.filter((m) => m.speaker_type === "student").length;

  if (interviewerCount !== 1 || studentCount !== 0) {
    return { skipped: true as const };
  }

  const user = db.users.find((entry) => entry.user_id === userId);
  const content = buildOpeningIntroLine(user?.display_name, session.mode, session.target_role);
  const now = new Date().toISOString();
  const message: Message = {
    message_id: crypto.randomUUID(),
    session_id: sessionId,
    speaker_type: "interviewer",
    content,
    message_order: 1,
    created_at: now,
    meta: {
      question_type: "primary",
      opening_intro: true
    }
  };

  await incrementalPrependOpeningMessage({ sessionId, message });
  return { skipped: false as const, message };
}

export async function getSessionSummary(
  sessionId: string,
  userId?: string
): Promise<SessionSummary> {
  const db = await readDb();
  const session = db.sessions.find((entry) => entry.session_id === sessionId);

  if (!session || (userId && session.user_id !== userId)) {
    throw new Error("Session not found.");
  }

  const messages = db.messages
    .filter((entry) => entry.session_id === sessionId)
    .sort((left, right) => left.message_order - right.message_order);
  const evaluations = db.evaluations
    .filter((entry) => entry.session_id === sessionId)
    .sort(
      (left, right) =>
        new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    );
  const flags = db.flags.filter((entry) => entry.session_id === sessionId);
  const mentorInterventions = db.mentorInterventions.filter(
    (entry) => entry.session_id === sessionId
  );
  const runtime =
    db.agentSessionStates.find((entry) => entry.session_id === sessionId) ??
    createInitialAgentState(session);
  const scoreSummary = {
    clarity: average(evaluations.map((evaluation) => evaluation.clarity_score)),
    structure: average(evaluations.map((evaluation) => evaluation.structure_score)),
    relevance: average(evaluations.map((evaluation) => evaluation.relevance_score)),
    softSkills: average(evaluations.map((evaluation) => evaluation.soft_skills_score)),
    overallAverage: average(
      evaluations.flatMap((evaluation) => [
        evaluation.clarity_score,
        evaluation.structure_score,
        evaluation.relevance_score,
        evaluation.soft_skills_score
      ])
    )
  };

  const strengths = db.skillSignals
    .filter(
      (signal) =>
        signal.source_session_id === sessionId && signal.signal_type === "strength"
    )
    .map((signal) => signal.skill_name);
  const weaknesses = db.skillSignals
    .filter(
      (signal) =>
        signal.source_session_id === sessionId && signal.signal_type === "weakness"
    )
    .map((signal) => signal.skill_name);

  const latestEvaluation = evaluations[evaluations.length - 1];
  const nextSessionRecommendation = latestEvaluation
    ? latestEvaluation.growth_tips[0]
    : `Plan a ${session.mode} session focused on ${session.focus_area ?? "structured confidence"}.`;

  const studentUser = db.users.find((entry) => entry.user_id === session.user_id);

  return {
    session,
    student_display_name: studentUser?.display_name?.trim() || null,
    messages,
    evaluations,
    flags,
    mentorInterventions,
    scoreSummary,
    strengths,
    weaknesses,
    nextSessionRecommendation,
    agent_runtime: {
      current_phase: runtime.current_phase,
      turn_count: runtime.turn_count,
      turn_type: runtime.turn_type,
      flagged: runtime.flagged || flags.length > 0,
      conversation_summary: runtime.conversation_summary ?? null
    }
  };
}

export async function getProgressInsights(userId: string) {
  const db = await readDb();
  const sessions = await listSessions(userId);
  const userSignals = db.skillSignals.filter((signal) => signal.user_id === userId);
  const recurringStrengths = userSignals
    .filter((signal) => signal.signal_type === "strength")
    .reduce<Record<string, number>>((accumulator, signal) => {
      accumulator[signal.skill_name] = (accumulator[signal.skill_name] ?? 0) + 1;
      return accumulator;
    }, {});
  const recurringWeaknesses = userSignals
    .filter((signal) => signal.signal_type === "weakness")
    .reduce<Record<string, number>>((accumulator, signal) => {
      accumulator[signal.skill_name] = (accumulator[signal.skill_name] ?? 0) + 1;
      return accumulator;
    }, {});

  return {
    sessions,
    recurringStrengths: Object.entries(recurringStrengths)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4),
    recurringWeaknesses: Object.entries(recurringWeaknesses)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 4),
    modeTrends: ["behavioral", "technical", "case"].map((mode) => {
      const modeSessions = sessions.filter((session) => session.mode === mode);
      return {
        mode,
        count: modeSessions.length,
        averageScore: average(
          modeSessions.map((session) => Number(session.summary_score ?? 0)).filter(Boolean)
        )
      };
    }),
    recommendedFocusAreas: Object.entries(recurringWeaknesses)
      .sort((left, right) => right[1] - left[1])
      .slice(0, 3)
      .map(([skill]) => skill),
    questionLimit: DEFAULT_QUESTIONS_PER_SESSION
  };
}
