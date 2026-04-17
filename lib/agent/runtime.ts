import { randomUUID } from "crypto";

import { Annotation, Command, END, START, StateGraph } from "@langchain/langgraph";

import { DEFAULT_QUESTIONS_PER_SESSION } from "@/lib/constants";
import {
  getAllowedTargets,
  getPhaseSkill,
  loadAgentConfig,
  renderPrompt
} from "@/lib/agent/config";
import { extractResumeHighlights, formatContextItemsForPrompt } from "@/lib/personalization";
import {
  analyzeInterviewTurn,
  generateInterviewerQuestion,
  summarizeConversation
} from "@/lib/ai/provider";
import type {
  AgentPhase,
  AgentSessionState,
  AgentTurnType,
  AnalyzerOutput,
  ConversationSummaryRecord,
  FlagCategory,
  InterviewSession,
  MemoryTier,
  Message,
  QuestionCategory
} from "@/lib/types";

type ContextItem = {
  memory_tier: MemoryTier;
  content: Record<string, unknown>;
  relevance_reason: string;
};

interface RuntimeState {
  sessionId: string;
  userId: string;
  mode: InterviewSession["mode"];
  targetRole: string;
  focusArea: string | null;
  resumeText: string | null;
  resumeHighlights: string[];
  personalizationEnabled: boolean;
  selfCritiqueEnabled: boolean;
  recalledContextSummary: string | null;
  questionLimit: number;
  currentPhase: AgentPhase;
  previousPhase: AgentPhase | null;
  turnCount: number;
  redirectCount: number;
  turnType: AgentTurnType;
  currentQuestionId: string | null;
  currentQuestionText: string | null;
  currentQuestionType: QuestionCategory | null;
  latestAnswerText: string | null;
  analyzerPrompt: string | null;
  speakerPrompt: string | null;
  analyzerOutput: AnalyzerOutput | null;
  missingSignals: string[];
  followUpTargets: string[];
  suggestedPhase: AgentPhase | null;
  conversationSummary: string | null;
  recentMessages: Array<{
    speaker_type: Message["speaker_type"];
    content: string;
  }>;
  guardrailFindings: Array<{
    flag_reason: string;
    flag_category: FlagCategory;
  }>;
  flagged: boolean;
  mentorTakeoverActive: boolean;
  weakSkills: string[];
  contextItems: ContextItem[];
  answeredCount: number;
  questionTypeHint: QuestionCategory;
  phaseTransitioned: boolean;
  analysisPhase: AgentPhase;
  summaryUpdated: boolean;
  questionSource: string | null;
}

const RuntimeAnnotation = Annotation.Root({
  sessionId: Annotation<string>(),
  userId: Annotation<string>(),
  mode: Annotation<InterviewSession["mode"]>(),
  targetRole: Annotation<string>(),
  focusArea: Annotation<string | null>(),
  resumeText: Annotation<string | null>(),
  resumeHighlights: Annotation<string[]>(),
  personalizationEnabled: Annotation<boolean>(),
  selfCritiqueEnabled: Annotation<boolean>(),
  recalledContextSummary: Annotation<string | null>(),
  questionLimit: Annotation<number>(),
  currentPhase: Annotation<AgentPhase>(),
  previousPhase: Annotation<AgentPhase | null>(),
  turnCount: Annotation<number>(),
  redirectCount: Annotation<number>(),
  turnType: Annotation<AgentTurnType>(),
  currentQuestionId: Annotation<string | null>(),
  currentQuestionText: Annotation<string | null>(),
  currentQuestionType: Annotation<QuestionCategory | null>(),
  latestAnswerText: Annotation<string | null>(),
  analyzerPrompt: Annotation<string | null>(),
  speakerPrompt: Annotation<string | null>(),
  analyzerOutput: Annotation<AnalyzerOutput | null>(),
  missingSignals: Annotation<string[]>(),
  followUpTargets: Annotation<string[]>(),
  suggestedPhase: Annotation<AgentPhase | null>(),
  conversationSummary: Annotation<string | null>(),
  recentMessages: Annotation<Array<{ speaker_type: Message["speaker_type"]; content: string }>>(),
  guardrailFindings: Annotation<Array<{ flag_reason: string; flag_category: string }>>(),
  flagged: Annotation<boolean>(),
  mentorTakeoverActive: Annotation<boolean>(),
  weakSkills: Annotation<string[]>(),
  contextItems: Annotation<ContextItem[]>(),
  answeredCount: Annotation<number>(),
  questionTypeHint: Annotation<QuestionCategory>(),
  phaseTransitioned: Annotation<boolean>(),
  analysisPhase: Annotation<AgentPhase>(),
  summaryUpdated: Annotation<boolean>(),
  questionSource: Annotation<string | null>()
});

function formatRecentMessages(
  messages: Array<{ speaker_type: Message["speaker_type"]; content: string }>
) {
  if (!messages.length) {
    return "No recent messages.";
  }

  return messages
    .map((message) => `${message.speaker_type}: ${message.content}`)
    .join("\n");
}

function fallbackSummary(state: RuntimeState) {
  const quality = state.analyzerOutput?.answer_quality ?? "n/a";
  const target = state.followUpTargets[0] ?? "general confidence";
  return `${state.targetRole} ${state.mode} interview in ${state.currentPhase}. Latest answer quality: ${quality}. Next coaching emphasis: ${target}.`;
}

function initialQuestionType(state: RuntimeState): QuestionCategory {
  if (!state.latestAnswerText) {
    return "primary";
  }

  if (state.currentPhase === "deep_dive") {
    return "clarifying";
  }

  return state.questionTypeHint ?? "follow_up";
}

async function firstTurnRouter(state: RuntimeState) {
  if (!state.latestAnswerText) {
    return new Command({
      update: {
        previousPhase: state.currentPhase,
        currentPhase: "opening" as AgentPhase,
        turnType: "first_turn" as AgentTurnType,
        phaseTransitioned: state.currentPhase !== "opening",
        analysisPhase: "opening" as AgentPhase
      },
      goto: "speakerPromptCreator"
    });
  }

  return new Command({
    update: {
      turnType: "standard" as AgentTurnType,
      phaseTransitioned: false,
      analysisPhase: state.currentPhase
    },
    goto: "analyzerPromptCreator"
  });
}

async function analyzerPromptCreator(state: RuntimeState) {
  const config = loadAgentConfig();
  const analysisPhase =
    state.redirectCount > 0 && state.suggestedPhase ? state.suggestedPhase : state.currentPhase;

  return {
    analysisPhase,
    analyzerPrompt: renderPrompt(config.analyzerTemplate, {
      analysis_phase: analysisPhase,
      allowed_transitions: getAllowedTargets(analysisPhase).join(", ") || "none",
      mode: state.mode,
      target_role: state.targetRole,
      focus_area: state.focusArea ?? "balanced practice",
      context_items_summary: formatContextItemsForPrompt({
        contextItems: state.contextItems,
        resumeText: state.resumeText
      }),
      weak_skills: state.weakSkills.join(", ") || "none",
      conversation_summary: state.conversationSummary ?? state.recalledContextSummary ?? "No summary yet.",
      recent_messages: formatRecentMessages(state.recentMessages),
      phase_skill: getPhaseSkill(analysisPhase, "analyzer")
    })
  };
}

async function analyzerNode(state: RuntimeState) {
  const output = await analyzeInterviewTurn({
    prompt: state.analyzerPrompt ?? "",
    latestAnswer: state.latestAnswerText ?? "",
    mode: state.mode,
    currentPhase: state.analysisPhase,
    answeredCount: state.answeredCount,
    questionLimit: state.questionLimit,
    weakSkills: state.weakSkills
  });

  return {
    analyzerOutput: output,
    missingSignals: output.missing_signals,
    followUpTargets: output.follow_up_targets,
    suggestedPhase: output.suggested_phase,
    questionTypeHint: output.question_type_hint
  };
}

async function phaseRedirectCheck(state: RuntimeState) {
  const maxRedirects = 1;
  const needsRedirect =
    state.suggestedPhase !== null &&
    state.suggestedPhase !== state.currentPhase &&
    state.analysisPhase === state.currentPhase &&
    state.redirectCount < maxRedirects;

  if (needsRedirect) {
    return new Command({
      update: {
        redirectCount: state.redirectCount + 1,
        analysisPhase: state.suggestedPhase as AgentPhase
      },
      goto: "analyzerPromptCreator"
    });
  }

  return new Command({
    goto: "stateUpdaterNode"
  });
}

async function stateUpdaterNode(state: RuntimeState) {
  const proposedPhase = state.suggestedPhase ?? state.currentPhase;
  const allowedTargets = getAllowedTargets(state.currentPhase);
  let nextPhase = state.currentPhase;

  if (state.currentPhase === "opening" && !state.latestAnswerText) {
    nextPhase = "opening";
  } else if (
    proposedPhase === state.currentPhase ||
    allowedTargets.includes(proposedPhase) ||
    proposedPhase === "session_feedback"
  ) {
    nextPhase = proposedPhase;
  }

  if (
    state.answeredCount >= state.questionLimit ||
    state.currentPhase === "session_feedback"
  ) {
    nextPhase = "session_feedback";
  }

  const questionTypeHint =
    nextPhase === "deep_dive"
      ? "clarifying"
      : nextPhase === "interview_round" && state.mode === "behavioral"
        ? state.answeredCount % 2 === 0
          ? "primary"
          : "situational"
        : state.currentPhase === "deep_dive" && nextPhase === "interview_round"
          ? "primary"
          : state.analyzerOutput?.question_type_hint ?? initialQuestionType(state);

  let turnType: AgentTurnType = "standard";
  if (nextPhase === "session_feedback") {
    turnType = "termination";
  } else if (nextPhase !== state.currentPhase) {
    turnType = "phase_transition";
  } else if (questionTypeHint === "clarifying") {
    turnType = "clarification";
  }

  return {
    previousPhase: state.currentPhase,
    currentPhase: nextPhase,
    turnType,
    redirectCount: 0,
    phaseTransitioned: nextPhase !== state.currentPhase,
    questionTypeHint
  };
}

async function summaryNode(state: RuntimeState) {
  if (!state.latestAnswerText) {
    return {
      conversationSummary: state.recalledContextSummary ?? state.conversationSummary ?? null,
      summaryUpdated: false
    };
  }

  const shouldRefresh = state.phaseTransitioned || state.answeredCount % 2 === 0;
  const baseline = fallbackSummary(state);

  if (!shouldRefresh) {
    return {
      conversationSummary: state.conversationSummary ?? baseline,
      summaryUpdated: false
    };
  }

  const config = loadAgentConfig();
  const prompt = renderPrompt(config.summaryTemplate, {
    target_role: state.targetRole,
    mode: state.mode,
    current_phase: state.currentPhase,
    recent_messages: formatRecentMessages(state.recentMessages),
    analyzer_summary: state.analyzerOutput?.summary ?? "No analyzer summary.",
    follow_up_targets: state.followUpTargets.join(", ") || "none"
  });

  const summary = await summarizeConversation({
    prompt,
    fallbackSummary: baseline
  });

  return {
    conversationSummary: summary,
    summaryUpdated: true
  };
}

async function speakerPromptCreator(state: RuntimeState) {
  const config = loadAgentConfig();
  return {
    speakerPrompt: renderPrompt(config.speakerTemplate, {
      current_phase: state.currentPhase,
      turn_type: state.turnType,
      mode: state.mode,
      target_role: state.targetRole,
      focus_area: state.focusArea ?? "balanced practice",
      context_items_summary: formatContextItemsForPrompt({
        contextItems: state.contextItems,
        resumeText: state.resumeText
      }),
      question_type: state.questionTypeHint,
      analyzer_summary: state.analyzerOutput?.summary ?? "Start the interview confidently.",
      follow_up_targets: state.followUpTargets.join(", ") || "none",
      missing_signals: state.missingSignals.join(", ") || "none",
      conversation_summary:
        state.conversationSummary ?? state.recalledContextSummary ?? "No summary yet.",
      recent_messages: formatRecentMessages(state.recentMessages),
      phase_skill: getPhaseSkill(state.currentPhase, "speaker")
    })
  };
}

async function speakerNode(state: RuntimeState) {
  const generated = await generateInterviewerQuestion({
    prompt: state.speakerPrompt ?? "",
    mode: state.mode,
    phase: state.currentPhase,
    targetRole: state.targetRole,
    focusArea: state.focusArea,
    weakSkills: state.weakSkills,
    resumeHighlights: state.resumeHighlights,
    latestAnswer: state.latestAnswerText,
    followUpTargets: state.followUpTargets,
    questionTypeHint: state.questionTypeHint,
    answeredCount: state.answeredCount
  });

  return {
    currentQuestionText: generated.question,
    currentQuestionType: generated.questionType,
    turnCount: state.turnCount + 1,
    questionSource: generated.source ?? "deterministic"
  };
}

function buildGraph() {
  return new StateGraph(RuntimeAnnotation)
    .addNode("firstTurnRouter", firstTurnRouter, {
      ends: ["speakerPromptCreator", "analyzerPromptCreator"]
    })
    .addNode("analyzerPromptCreator", analyzerPromptCreator)
    .addNode("analyzerNode", analyzerNode)
    .addNode("phaseRedirectCheck", phaseRedirectCheck, {
      ends: ["analyzerPromptCreator", "stateUpdaterNode"]
    })
    .addNode("stateUpdaterNode", stateUpdaterNode)
    .addNode("summaryNode", summaryNode)
    .addNode("speakerPromptCreator", speakerPromptCreator)
    .addNode("speakerNode", speakerNode)
    .addEdge(START, "firstTurnRouter")
    .addEdge("analyzerPromptCreator", "analyzerNode")
    .addEdge("analyzerNode", "phaseRedirectCheck")
    .addEdge("stateUpdaterNode", "summaryNode")
    .addEdge("summaryNode", "speakerPromptCreator")
    .addEdge("speakerPromptCreator", "speakerNode")
    .addEdge("speakerNode", END)
    .compile({ name: "mock-interview-agent-runtime" });
}

let compiledGraph: ReturnType<typeof buildGraph> | null = null;

function getCompiledGraph() {
  if (compiledGraph) {
    return compiledGraph;
  }

  compiledGraph = buildGraph();

  return compiledGraph;
}

function defaultPersistedState(session: InterviewSession, messages: Message[]): AgentSessionState {
  const interviewerMessages = messages.filter((message) => message.speaker_type === "interviewer");
  const studentMessages = messages.filter((message) => message.speaker_type === "student");
  const currentPhase =
    session.status === "completed"
      ? "session_feedback"
      : interviewerMessages.length === 0
        ? "interview_setup"
        : studentMessages.length === 0
          ? "opening"
          : "interview_round";

  return {
    session_id: session.session_id,
    user_id: session.user_id,
    current_phase: currentPhase,
    previous_phase: currentPhase === "interview_setup" ? null : "interview_setup",
    turn_count: interviewerMessages.length,
    redirect_count: 0,
    turn_type: interviewerMessages.length ? "standard" : "first_turn",
    current_question_id: interviewerMessages.at(-1)?.message_id ?? null,
    current_question_text: interviewerMessages.at(-1)?.content ?? null,
    current_question_type:
      (interviewerMessages.at(-1)?.meta?.question_type as QuestionCategory | undefined) ?? null,
    latest_answer_text: studentMessages.at(-1)?.content ?? null,
    analyzer_output: null,
    missing_signals: [],
    follow_up_targets: [],
    suggested_phase: currentPhase,
    conversation_summary: null,
    recent_messages: messages.slice(-4).map((message) => ({
      speaker_type: message.speaker_type,
      content: message.content
    })),
    guardrail_findings: [],
    flagged: session.status === "flagged",
    mentor_takeover_active: false,
    state_json: {},
    created_at: session.started_at,
    updated_at: session.started_at
  };
}

export function hydrateRuntimeState(params: {
  session: InterviewSession;
  messages: Message[];
  persistedState?: AgentSessionState | null;
  weakSkills: string[];
  contextItems: ContextItem[];
  latestAnswer: string | null;
  mentorTakeoverActive: boolean;
  flagged: boolean;
}) {
  const persisted = params.persistedState ?? defaultPersistedState(params.session, params.messages);
  const recentMessages = params.messages.slice(-4).map((message) => ({
    speaker_type: message.speaker_type,
    content: message.content
  }));

  return {
    sessionId: params.session.session_id,
    userId: params.session.user_id,
    mode: params.session.mode,
    targetRole: params.session.target_role,
    focusArea: params.session.focus_area ?? null,
    resumeText: params.session.resume_text ?? null,
    resumeHighlights: extractResumeHighlights(params.session.resume_text),
    personalizationEnabled: params.session.personalization_enabled,
    selfCritiqueEnabled: params.session.self_critique_enabled,
    recalledContextSummary: params.session.recalled_context_summary ?? null,
    questionLimit: params.session.question_limit ?? DEFAULT_QUESTIONS_PER_SESSION,
    currentPhase: persisted.current_phase,
    previousPhase: persisted.previous_phase ?? null,
    turnCount: persisted.turn_count,
    redirectCount: persisted.redirect_count,
    turnType: persisted.turn_type,
    currentQuestionId: persisted.current_question_id ?? null,
    currentQuestionText: persisted.current_question_text ?? null,
    currentQuestionType: persisted.current_question_type ?? null,
    latestAnswerText: params.latestAnswer,
    analyzerPrompt: null,
    speakerPrompt: null,
    analyzerOutput: persisted.analyzer_output ?? null,
    missingSignals: persisted.missing_signals ?? [],
    followUpTargets: persisted.follow_up_targets ?? [],
    suggestedPhase: persisted.suggested_phase ?? persisted.current_phase,
    conversationSummary: persisted.conversation_summary ?? null,
    recentMessages,
    guardrailFindings:
      persisted.guardrail_findings?.map((finding) => ({
        flag_reason: finding.flag_reason,
        flag_category: finding.flag_category
      })) ?? [],
    flagged: params.flagged,
    mentorTakeoverActive: params.mentorTakeoverActive,
    weakSkills: params.weakSkills,
    contextItems: params.contextItems,
    answeredCount: params.messages.filter((message) => message.speaker_type === "student").length,
    questionTypeHint: persisted.current_question_type ?? "primary",
    phaseTransitioned: false,
    analysisPhase: persisted.current_phase,
    summaryUpdated: false,
    questionSource:
      typeof persisted.state_json?.question_source === "string"
        ? (persisted.state_json.question_source as string)
        : null
  } satisfies RuntimeState;
}

export async function runInterviewGraph(state: RuntimeState) {
  const graph = getCompiledGraph();
  const result = await graph.invoke(state, {
    tags: ["mock-interview", "interview-agent"],
    metadata: {
      sessionId: state.sessionId,
      mode: state.mode,
      currentPhase: state.currentPhase
    }
  });

  return result as RuntimeState;
}

export function persistRuntimeState(
  state: RuntimeState,
  existing?: AgentSessionState | null
): AgentSessionState {
  const createdAt = existing?.created_at ?? new Date().toISOString();

  return {
    session_id: state.sessionId,
    user_id: state.userId,
    current_phase: state.currentPhase,
    previous_phase: state.previousPhase,
    turn_count: state.turnCount,
    redirect_count: state.redirectCount,
    turn_type: state.turnType,
    current_question_id: state.currentQuestionId,
    current_question_text: state.currentQuestionText,
    current_question_type: state.currentQuestionType,
    latest_answer_text: state.latestAnswerText,
    analyzer_output: state.analyzerOutput,
    missing_signals: state.missingSignals,
    follow_up_targets: state.followUpTargets,
    suggested_phase: state.suggestedPhase,
    conversation_summary: state.conversationSummary,
    recent_messages: state.recentMessages,
    guardrail_findings: state.guardrailFindings.map((finding) => ({
      flag_reason: finding.flag_reason,
      flag_category: finding.flag_category
    })),
    flagged: state.flagged,
    mentor_takeover_active: state.mentorTakeoverActive,
    state_json: {
      current_phase: state.currentPhase,
      previous_phase: state.previousPhase,
      turn_count: state.turnCount,
      redirect_count: state.redirectCount,
      turn_type: state.turnType,
      current_question_text: state.currentQuestionText,
      current_question_type: state.currentQuestionType,
      question_source: state.questionSource,
      analyzer_output: state.analyzerOutput,
      follow_up_targets: state.followUpTargets,
      missing_signals: state.missingSignals,
      summary_updated: state.summaryUpdated
    },
    created_at: createdAt,
    updated_at: new Date().toISOString()
  };
}

export function createConversationSummaryRecord(state: RuntimeState): ConversationSummaryRecord | null {
  if (!state.summaryUpdated || !state.conversationSummary) {
    return null;
  }

  return {
    summary_id: randomUUID(),
    session_id: state.sessionId,
    summary_text: state.conversationSummary,
    turn_count: state.turnCount,
    created_at: new Date().toISOString()
  };
}
