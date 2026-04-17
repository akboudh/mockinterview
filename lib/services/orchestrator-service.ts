import { DEFAULT_QUESTIONS_PER_SESSION } from "@/lib/constants";
import { incrementalPersistAskQuestion } from "@/lib/db-incremental";
import { readDb, updateDb } from "@/lib/db";
import {
  createConversationSummaryRecord,
  hydrateRuntimeState,
  persistRuntimeState,
  runInterviewGraph
} from "@/lib/agent/runtime";
import { logEvent } from "@/lib/logging";
import { inspectForGuardrails, recordGuardrailFlags } from "@/lib/services/guardrail-service";
import { getWeakSkills, recallContext, saveEvent } from "@/lib/services/memory-service";
import { endSession } from "@/lib/services/session-service";
import type {
  AgentSessionState,
  AskQuestionContext,
  ConversationSummaryRecord,
  FlagCategory,
  InterviewSession,
  MemoryTier,
  Message,
  MockInterviewDB,
  RecalledContextItem
} from "@/lib/types";

export interface ComputedAskQuestionResult {
  payload: {
    session_id: string;
    question_id: string;
    question_text: string;
    mode: InterviewSession["mode"];
    question_type: AgentSessionState["current_question_type"];
    context_notes: string;
    current_phase: AgentSessionState["current_phase"];
    turn_type: AgentSessionState["turn_type"];
    phase_transitioned: boolean;
  };
  session: InterviewSession;
  message: Message;
  nextRuntimeState: AgentSessionState;
  summaryRecord: ConversationSummaryRecord | null;
  findings: Array<{
    policy_id: string;
    flag_reason: string;
    flag_category: FlagCategory;
    severity: "low" | "medium" | "high";
    labels: string[];
  }>;
}

export interface AskQuestionDeps {
  readDb: typeof readDb;
  updateDb: typeof updateDb;
  /** Defaults to row-level SQLite writes; tests override with in-memory snapshot updates. */
  persistAskQuestionWrite?: (result: ComputedAskQuestionResult) => Promise<void>;
  recallContext: typeof recallContext;
  getWeakSkills: typeof getWeakSkills;
  saveEvent: typeof saveEvent;
  recordGuardrailFlags: typeof recordGuardrailFlags;
  endSession: typeof endSession;
  hydrateRuntimeState: typeof hydrateRuntimeState;
  runInterviewGraph: typeof runInterviewGraph;
  persistRuntimeState: typeof persistRuntimeState;
  createConversationSummaryRecord: typeof createConversationSummaryRecord;
  inspectForGuardrails: typeof inspectForGuardrails;
}

async function defaultPersistAskQuestionWrite(result: ComputedAskQuestionResult) {
  const sessionFeedbackReason = describeSessionFeedbackReason({
    previousPhase: result.nextRuntimeState.previous_phase,
    nextPhase: result.nextRuntimeState.current_phase,
    analyzerSuggestedPhase: result.nextRuntimeState.suggested_phase
  });
  const mergedState: AgentSessionState = {
    ...result.nextRuntimeState,
    state_json: {
      ...result.nextRuntimeState.state_json,
      session_end_reason: sessionFeedbackReason
    }
  };
  await incrementalPersistAskQuestion({
    message: result.message,
    session: result.session,
    nextRuntimeState: mergedState,
    summaryRecord: result.summaryRecord,
    findingsLength: result.findings.length
  });
}

const defaultAskQuestionDeps: AskQuestionDeps = {
  readDb,
  updateDb,
  persistAskQuestionWrite: defaultPersistAskQuestionWrite,
  recallContext,
  getWeakSkills,
  saveEvent,
  recordGuardrailFlags,
  endSession,
  hydrateRuntimeState,
  runInterviewGraph,
  persistRuntimeState,
  createConversationSummaryRecord,
  inspectForGuardrails
};

export interface PreparedAskQuestionInput {
  session: InterviewSession;
  messages: Message[];
  persistedState?: AgentSessionState | null;
  weakSkills: string[];
  recalledContextItems: RecalledContextItem[];
  latestAnswer: string | null;
  mentorTakeoverActive: boolean;
  flagged: boolean;
  persistedMessageCount: number;
}

function describeSessionFeedbackReason(params: {
  previousPhase: AgentSessionState["current_phase"] | null | undefined;
  nextPhase: AgentSessionState["current_phase"];
  analyzerSuggestedPhase: AgentSessionState["suggested_phase"] | null | undefined;
}) {
  if (params.nextPhase !== "session_feedback") {
    return null;
  }

  if (params.analyzerSuggestedPhase === "session_feedback") {
    return "analyzer_requested_feedback";
  }

  if (params.previousPhase === "session_feedback") {
    return "existing_feedback_phase";
  }

  return "phase_transition_to_feedback";
}

function transcriptToMessages(
  sessionId: string,
  transcript: AskQuestionContext["transcript"]
): Message[] {
  return transcript.map((item, index) => ({
    message_id: `ctx-${sessionId}-${index + 1}`,
    session_id: sessionId,
    speaker_type: item.speaker_type,
    content: item.content,
    message_order: index + 1,
    created_at: new Date(0).toISOString(),
    meta:
      item.question_type && item.speaker_type === "interviewer"
        ? {
            question_type: item.question_type
          }
        : undefined
  }));
}

function buildSessionFromContext(params: {
  session_id: string;
  user_id: string;
  context: AskQuestionContext;
  persistedQuestionLimit: number | null;
}): InterviewSession {
  return {
    session_id: params.session_id,
    user_id: params.user_id,
    mode: params.context.mode,
    target_role: params.context.target_role,
    focus_area: params.context.focus_area ?? null,
    confidence_self_rating: null,
    question_limit: params.context.question_limit ?? params.persistedQuestionLimit,
    status: params.context.session_status,
    started_at: new Date(0).toISOString(),
    ended_at: null,
    personalization_enabled: params.context.personalization_enabled,
    self_critique_enabled: params.context.self_critique_enabled,
    notes: null,
    resume_text: params.context.resume_text ?? null,
    recalled_context_summary: params.context.recalled_context_summary ?? null
  };
}

function buildPersistedStateFromContext(params: {
  session_id: string;
  user_id: string;
  context: AskQuestionContext;
  messages: Message[];
  latest_answer: string | null;
}): AgentSessionState {
  const lastInterviewerMessage = [...params.messages]
    .reverse()
    .find((message) => message.speaker_type === "interviewer");
  const now = new Date().toISOString();

  return {
    session_id: params.session_id,
    user_id: params.user_id,
    current_phase: params.context.current_phase,
    previous_phase: params.context.previous_phase ?? null,
    turn_count: params.context.turn_count,
    redirect_count: params.context.redirect_count ?? 0,
    turn_type:
      params.context.turn_type ??
      (params.context.turn_count > 0 ? "standard" : "first_turn"),
    current_question_id: null,
    current_question_text: lastInterviewerMessage?.content ?? null,
    current_question_type:
      (lastInterviewerMessage?.meta?.question_type as AgentSessionState["current_question_type"]) ??
      null,
    latest_answer_text: params.latest_answer,
    analyzer_output: null,
    missing_signals: [],
    follow_up_targets: [],
    suggested_phase: params.context.current_phase,
    conversation_summary: params.context.conversation_summary ?? null,
    recent_messages: params.messages.slice(-4).map((message) => ({
      speaker_type: message.speaker_type,
      content: message.content
    })),
    guardrail_findings: [],
    flagged: Boolean(params.context.flagged || params.context.session_status === "flagged"),
    mentor_takeover_active: Boolean(params.context.mentor_takeover_active),
    state_json: {
      stateless_api_boundary: true,
      current_phase: params.context.current_phase
    },
    created_at: now,
    updated_at: now
  };
}

async function resolveAskQuestionInput(
  params: {
    session_id: string;
    user_id: string;
    latest_answer?: string | null;
    context?: AskQuestionContext;
  },
  deps: AskQuestionDeps
) {
  const db = await deps.readDb();
  const persistedSession = db.sessions.find((entry) => entry.session_id === params.session_id);

  if (!persistedSession) {
    throw new Error("Session not found.");
  }

  const latestAnswer = params.latest_answer ?? null;
  const session = params.context
    ? buildSessionFromContext({
        session_id: params.session_id,
        user_id: params.user_id,
        context: params.context,
        persistedQuestionLimit: persistedSession.question_limit ?? null
      })
    : persistedSession;
  const questionLimit = session.question_limit ?? DEFAULT_QUESTIONS_PER_SESSION;

  const persistedMessages = db.messages
    .filter((entry) => entry.session_id === session.session_id)
    .sort((left, right) => left.message_order - right.message_order);
  const messages = params.context
    ? transcriptToMessages(params.session_id, params.context.transcript)
    : persistedMessages;
  const answeredCount = messages.filter((entry) => entry.speaker_type === "student").length;

  if (answeredCount >= questionLimit) {
    logEvent("orchestrator.question_limit_reached", {
      session_id: session.session_id,
      answered_count: answeredCount,
      max_questions: questionLimit
    });
    await deps.endSession(session.session_id, "question_limit_reached");
    throw new Error("Session has reached the configured question limit.");
  }

  const weakSkills =
    params.context?.weak_skills ??
    (session.personalization_enabled ? await deps.getWeakSkills(session.user_id) : []);
  const recalledContext =
    params.context
      ? {
          context_items: params.context.recalled_context_items
        }
      : await deps.recallContext({
          session_id: session.session_id,
          user_id: session.user_id,
          query_type: session.personalization_enabled ? "mixed" : "short_term",
          query_text: [latestAnswer, session.target_role, session.focus_area]
            .filter(Boolean)
            .join(" ")
        });
  const persistedState = params.context
    ? buildPersistedStateFromContext({
        session_id: params.session_id,
        user_id: params.user_id,
        context: params.context,
        messages,
        latest_answer: latestAnswer
      })
    : db.agentSessionStates.find((entry) => entry.session_id === session.session_id);

  return {
    db,
    prepared: {
      session,
      messages,
      persistedState,
      weakSkills,
      recalledContextItems: recalledContext.context_items,
      latestAnswer,
      mentorTakeoverActive:
        params.context?.mentor_takeover_active ?? false,
      flagged:
        params.context?.flagged ??
        (session.status === "flagged" ||
          db.flags.some(
            (entry) => entry.session_id === session.session_id && entry.status === "open"
          )),
      persistedMessageCount: persistedMessages.length
    } satisfies PreparedAskQuestionInput
  };
}

export async function computeNextQuestion(
  input: PreparedAskQuestionInput,
  deps: Pick<
    AskQuestionDeps,
    | "hydrateRuntimeState"
    | "runInterviewGraph"
    | "persistRuntimeState"
    | "createConversationSummaryRecord"
    | "inspectForGuardrails"
  > = defaultAskQuestionDeps
) : Promise<ComputedAskQuestionResult> {
  if (input.session.status === "paused") {
    throw new Error("Session is paused for mentor intervention.");
  }

  logEvent("orchestrator.question.compute_started", {
    session_id: input.session.session_id,
    current_phase: input.persistedState?.current_phase ?? null,
    answered_count: input.messages.filter((message) => message.speaker_type === "student").length,
    latest_answer_present: Boolean(input.latestAnswer),
    mentor_takeover_active: input.mentorTakeoverActive,
    flagged: input.flagged
  });

  const runtimeState = deps.hydrateRuntimeState({
    session: input.session,
    messages: input.messages,
    persistedState: input.persistedState,
    weakSkills: input.weakSkills,
    contextItems: input.recalledContextItems,
    latestAnswer: input.latestAnswer,
    mentorTakeoverActive: input.mentorTakeoverActive,
    flagged: input.flagged
  });

  const runtimeResult = await deps.runInterviewGraph(runtimeState);
  const questionText = runtimeResult.currentQuestionText;

  if (!questionText) {
    throw new Error("Question generation completed without a new interviewer prompt.");
  }

  const message: Message = {
    message_id: crypto.randomUUID(),
    session_id: input.session.session_id,
    speaker_type: "interviewer",
    content: questionText,
    message_order: Math.max(input.messages.length, input.persistedMessageCount) + 1,
    created_at: new Date().toISOString(),
    meta: {
      question_type: runtimeResult.currentQuestionType,
      current_phase: runtimeResult.currentPhase,
      turn_type: runtimeResult.turnType,
      question_source: runtimeResult.questionSource ?? "unknown",
      memory_context: input.recalledContextItems,
      phase_transitioned: runtimeResult.phaseTransitioned
    }
  };

  const findings = await deps.inspectForGuardrails({
    text: questionText,
    source: "interviewer",
    session_id: input.session.session_id
  });
  const finalizedRuntime = {
    ...runtimeResult,
    currentQuestionId: message.message_id,
    currentQuestionText: questionText,
    currentQuestionType: runtimeResult.currentQuestionType,
    recentMessages: [
      ...runtimeResult.recentMessages,
      {
        speaker_type: "interviewer" as const,
        content: questionText
      }
    ].slice(-4),
    flagged: runtimeResult.flagged || findings.length > 0,
    guardrailFindings: [
      ...runtimeResult.guardrailFindings,
      ...findings.map((finding) => ({
        flag_reason: finding.flag_reason,
        flag_category: finding.flag_category
      }))
    ]
  };
  const nextRuntimeState = deps.persistRuntimeState(finalizedRuntime, input.persistedState);
  const summaryRecord = deps.createConversationSummaryRecord(finalizedRuntime);
  const sessionFeedbackReason = describeSessionFeedbackReason({
    previousPhase: input.persistedState?.current_phase,
    nextPhase: nextRuntimeState.current_phase,
    analyzerSuggestedPhase: nextRuntimeState.suggested_phase
  });

  logEvent("orchestrator.question.generated", {
    session_id: input.session.session_id,
    previous_phase: input.persistedState?.current_phase ?? null,
    current_phase: nextRuntimeState.current_phase,
    analyzer_suggested_phase: nextRuntimeState.suggested_phase ?? null,
    turn_type: nextRuntimeState.turn_type,
    question_type: nextRuntimeState.current_question_type ?? null,
    question_source: runtimeResult.questionSource ?? "unknown",
    phase_transitioned: runtimeResult.phaseTransitioned,
    session_feedback_reason: sessionFeedbackReason
  });

  return {
    payload: {
      session_id: input.session.session_id,
      question_id: message.message_id,
      question_text: questionText,
      mode: input.session.mode,
      question_type: runtimeResult.currentQuestionType,
      context_notes: `${runtimeResult.analyzerOutput?.summary ?? "Adaptive interviewer state updated."} ${
        input.recalledContextItems[0]?.relevance_reason
          ? `Context: ${input.recalledContextItems[0].relevance_reason}.`
          : ""
      }`.trim(),
      current_phase: runtimeResult.currentPhase,
      turn_type: runtimeResult.turnType,
      phase_transitioned: runtimeResult.phaseTransitioned
    },
    session: input.session,
    message,
    nextRuntimeState,
    summaryRecord,
    findings
  };
}

/** In-memory snapshot merge for tests and tooling (production uses incremental SQLite writes). */
export function mergePersistAskQuestionIntoDb(
  currentDb: MockInterviewDB,
  result: ComputedAskQuestionResult
): MockInterviewDB {
  const sessionFeedbackReason = describeSessionFeedbackReason({
    previousPhase: result.nextRuntimeState.previous_phase,
    nextPhase: result.nextRuntimeState.current_phase,
    analyzerSuggestedPhase: result.nextRuntimeState.suggested_phase
  });

  return {
    ...currentDb,
    sessions: currentDb.sessions.map((entry) =>
      entry.session_id === result.session.session_id
        ? {
            ...entry,
            status:
              result.nextRuntimeState.current_phase === "session_feedback"
                ? "completed"
                : result.findings.length
                  ? "flagged"
                  : "active",
            ended_at:
              result.nextRuntimeState.current_phase === "session_feedback"
                ? entry.ended_at ?? new Date().toISOString()
                : entry.ended_at
          }
        : entry
    ),
    messages: [...currentDb.messages, result.message],
    agentSessionStates: currentDb.agentSessionStates.some(
      (entry) => entry.session_id === result.session.session_id
    )
      ? currentDb.agentSessionStates.map((entry) =>
          entry.session_id === result.session.session_id
            ? {
                ...result.nextRuntimeState,
                state_json: {
                  ...result.nextRuntimeState.state_json,
                  session_end_reason: sessionFeedbackReason
                }
              }
            : entry
        )
      : [
          ...currentDb.agentSessionStates,
          {
            ...result.nextRuntimeState,
            state_json: {
              ...result.nextRuntimeState.state_json,
              session_end_reason: sessionFeedbackReason
            }
          }
        ],
    conversationSummaries: result.summaryRecord
      ? [...currentDb.conversationSummaries, result.summaryRecord]
      : currentDb.conversationSummaries
  };
}

async function persistAskQuestionResult(params: {
  db: MockInterviewDB;
  result: ComputedAskQuestionResult;
  deps: AskQuestionDeps;
}) {
  const { db, result, deps } = params;
  const sessionFeedbackReason = describeSessionFeedbackReason({
    previousPhase: result.nextRuntimeState.previous_phase,
    nextPhase: result.nextRuntimeState.current_phase,
    analyzerSuggestedPhase: result.nextRuntimeState.suggested_phase
  });

  const writer = deps.persistAskQuestionWrite ?? defaultPersistAskQuestionWrite;
  await writer(result);

  await deps.saveEvent({
    session_id: result.session.session_id,
    user_id: result.session.user_id,
    memory_tier: "short_term" as MemoryTier,
    event_type: "question_generated",
    content: {
      question_id: result.message.message_id,
      question_text: result.message.content,
      question_type: result.message.meta?.question_type as AgentSessionState["current_question_type"],
      current_phase: result.message.meta?.current_phase as AgentSessionState["current_phase"]
    }
  });

  if (result.summaryRecord) {
    await deps.saveEvent({
      session_id: result.session.session_id,
      user_id: result.session.user_id,
      memory_tier: "episodic" as MemoryTier,
      event_type: "conversation_summary_updated",
      content: {
        summary_id: result.summaryRecord.summary_id,
        summary_text: result.summaryRecord.summary_text,
        turn_count: result.summaryRecord.turn_count
      }
    });
  }

  await deps.recordGuardrailFlags({
    session_id: result.session.session_id,
    message_id: result.message.message_id,
    findings: result.findings
  });

  if (result.nextRuntimeState.current_phase === "session_feedback") {
    logEvent("orchestrator.session.completed", {
      session_id: result.session.session_id,
      reason: sessionFeedbackReason,
      question_source:
        typeof result.nextRuntimeState.state_json?.question_source === "string"
          ? (result.nextRuntimeState.state_json.question_source as string)
          : "unknown"
    });
  }

  return db;
}

export async function askQuestion(
  params: {
  session_id: string;
  user_id: string;
  latest_answer?: string | null;
  context?: AskQuestionContext;
  },
  deps: AskQuestionDeps = defaultAskQuestionDeps
) {
  const { db, prepared } = await resolveAskQuestionInput(params, deps);
  const result = await computeNextQuestion(prepared, deps);
  await persistAskQuestionResult({
    db,
    result,
    deps
  });
  return result.payload;
}
