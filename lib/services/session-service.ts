import { MAX_QUESTIONS_PER_SESSION } from "@/lib/constants";
import { readDb, updateDb } from "@/lib/db";
import { logEvent } from "@/lib/logging";
import { buildPersonalizationSummary, extractResumeHighlights, normalizeResumeText } from "@/lib/personalization";
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

  await updateDb((db) => ({
    ...db,
    users: db.users.some((user) => user.user_id === params.user_id)
      ? db.users.map((user) =>
          user.user_id === params.user_id
            ? {
                ...user,
                resume_text: (normalizedResumeText || user.resume_text) ?? null,
                target_roles: Array.from(new Set([...(user.target_roles ?? []), params.target_role])),
                preferred_modes: Array.from(new Set([...(user.preferred_modes ?? []), params.mode])),
                updated_at: new Date().toISOString()
              }
            : user
        )
      : [
          ...db.users,
        {
          user_id: params.user_id,
          display_name: "Career-Ready Student",
          resume_text: normalizedResumeText || null,
          resume_file_name: null,
          target_roles: [params.target_role],
          preferred_modes: [params.mode],
          known_weak_skills: [],
          created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          }
        ],
    sessions: [...db.sessions, session],
    agentSessionStates: [...db.agentSessionStates, runtimeState]
  }));

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
  const findings = inspectForGuardrails(params.content);

  await updateDb((currentDb) => ({
    ...currentDb,
    messages: [...currentDb.messages, message],
    sessions: currentDb.sessions.map((entry) =>
      entry.session_id === session.session_id
        ? {
            ...entry,
            status: findings.length ? "flagged" : "active"
          }
        : entry
    ),
    agentSessionStates: currentDb.agentSessionStates.map((state) =>
      state.session_id === session.session_id
        ? {
            ...state,
            latest_answer_text: params.content,
            recent_messages: [...orderedMessages, message].slice(-4).map((entry) => ({
              speaker_type: entry.speaker_type,
              content: entry.content
            })),
            flagged: findings.length ? true : state.flagged,
            updated_at: new Date().toISOString()
          }
        : state
    )
  }));

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
    findings
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
  await updateDb((db) => ({
    ...db,
    sessions: db.sessions.map((session) =>
      session.session_id === sessionId ? { ...session, status } : session
    )
  }));
}

export async function endSession(
  sessionId: string,
  reason: "manual_end" | "question_limit_reached" | "session_feedback_completed" = "manual_end"
) {
  await updateDb((db) => ({
    ...db,
    sessions: db.sessions.map((session) =>
      session.session_id === sessionId
        ? {
            ...session,
            status: "completed",
            ended_at: session.ended_at ?? new Date().toISOString()
          }
        : session
    ),
    agentSessionStates: db.agentSessionStates.map((state) =>
      state.session_id === sessionId
        ? {
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
          }
        : state
    )
  }));

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

  return {
    session,
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
      mentor_takeover_active:
        runtime.mentor_takeover_active ||
        mentorInterventions.some(
          (intervention) => intervention.intervention_type === "takeover"
        ),
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
    questionLimit: MAX_QUESTIONS_PER_SESSION
  };
}
