import {
  createConversationSummaryRecord,
  hydrateRuntimeState,
  persistRuntimeState,
  runInterviewGraph
} from "@/lib/agent/runtime";
import * as provider from "@/lib/ai/provider";
import {
  askQuestion,
  computeNextQuestion,
  mergePersistAskQuestionIntoDb,
  type AskQuestionDeps,
  type PreparedAskQuestionInput
} from "@/lib/services/orchestrator-service";
import type {
  AgentSessionState,
  AskQuestionContext,
  ConversationSummaryRecord,
  FlagCategory,
  InterviewSession,
  MemoryEvent,
  Message,
  MockInterviewDB,
  RecalledContextItem
} from "@/lib/types";

const originalEnv = {
  LLM_PROVIDER: process.env.LLM_PROVIDER,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  GOOGLE_API_KEY: process.env.GOOGLE_API_KEY
};

function makeSession(overrides: Partial<InterviewSession> = {}): InterviewSession {
  return {
    session_id: "sess-unit-1",
    user_id: "student-1",
    mode: "technical",
    target_role: "Software Engineer Intern",
    focus_area: "architecture",
    confidence_self_rating: 3,
    status: "active",
    started_at: "2026-04-05T10:00:00.000Z",
    ended_at: null,
    personalization_enabled: true,
    self_critique_enabled: false,
    notes: null,
    resume_text: null,
    recalled_context_summary: null,
    ...overrides
  };
}

function makeMessage(
  speaker_type: Message["speaker_type"],
  content: string,
  message_order: number,
  meta?: Record<string, unknown>
): Message {
  return {
    message_id: `msg-${message_order}`,
    session_id: "sess-unit-1",
    speaker_type,
    content,
    message_order,
    created_at: "2026-04-05T10:00:00.000Z",
    meta
  };
}

function makePersistedState(
  session: InterviewSession,
  messages: Message[],
  overrides: Partial<AgentSessionState> = {}
): AgentSessionState {
  const interviewerMessages = messages.filter((message) => message.speaker_type === "interviewer");
  const studentMessages = messages.filter((message) => message.speaker_type === "student");
  const currentPhase =
    interviewerMessages.length === 0
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
      (interviewerMessages.at(-1)?.meta?.question_type as AgentSessionState["current_question_type"]) ??
      null,
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
    flagged: false,
    mentor_takeover_active: false,
    state_json: {},
    created_at: session.started_at,
    updated_at: session.started_at,
    ...overrides
  };
}

function makePreparedInput(
  overrides: Partial<PreparedAskQuestionInput> & {
    session?: InterviewSession;
    messages?: Message[];
    persistedState?: AgentSessionState | null;
    recalledContextItems?: RecalledContextItem[];
  } = {}
): PreparedAskQuestionInput {
  const session = overrides.session ?? makeSession();
  const messages = overrides.messages ?? [];

  return {
    session,
    messages,
    persistedState:
      overrides.persistedState ?? makePersistedState(session, messages, overrides.persistedState ?? {}),
    weakSkills: overrides.weakSkills ?? [],
    recalledContextItems: overrides.recalledContextItems ?? [],
    latestAnswer: overrides.latestAnswer ?? null,
    mentorTakeoverActive: overrides.mentorTakeoverActive ?? false,
    flagged: overrides.flagged ?? false,
    persistedMessageCount: overrides.persistedMessageCount ?? messages.length
  };
}

function makeDb(params: {
  session?: InterviewSession;
  messages?: Message[];
  agentSessionStates?: AgentSessionState[];
} = {}): MockInterviewDB {
  const session = params.session ?? makeSession();
  return {
    users: [],
    authSessions: [],
    sessions: [session],
    messages: params.messages ?? [],
    evaluations: [],
    memoryEvents: [],
    memoryVectors: [],
    skillSignals: [],
    flags: [],
    mentorInterventions: [],
    mentorDirectMessages: [],
    agentSessionStates: params.agentSessionStates ?? [],
    conversationSummaries: []
  };
}

function createAskDeps(
  initialDb: MockInterviewDB,
  overrides: Partial<AskQuestionDeps> = {}
): {
  deps: AskQuestionDeps;
  getDb: () => MockInterviewDB;
} {
  let currentDb = initialDb;

  const updateDbMock = vi.fn(async (updater: (db: MockInterviewDB) => MockInterviewDB | Promise<MockInterviewDB>) => {
    currentDb = await updater(currentDb);
    return currentDb;
  });

  const deps: AskQuestionDeps = {
    readDb: vi.fn(async () => currentDb),
    updateDb: updateDbMock,
    persistAskQuestionWrite: async (result) => {
      await updateDbMock((db) => mergePersistAskQuestionIntoDb(db, result));
    },
    recallContext: vi.fn(async () => ({
      context_items: [],
      weak_skills: []
    })),
    getWeakSkills: vi.fn(async () => []),
    saveEvent: vi.fn(
      async (params): Promise<MemoryEvent> => ({
        event_id: `mem-${params.event_type}`,
        session_id: params.session_id,
        user_id: params.user_id,
        memory_tier: params.memory_tier,
        event_type: params.event_type,
        content: params.content,
        embedding_ref: null,
        created_at: "2026-04-05T10:00:00.000Z"
      })
    ),
    recordGuardrailFlags: vi.fn(async () => []),
    endSession: vi.fn(async () => undefined),
    hydrateRuntimeState,
    runInterviewGraph,
    persistRuntimeState,
    createConversationSummaryRecord,
    inspectForGuardrails: vi.fn(
      () =>
        [] as Array<{
          flag_reason: string;
          flag_category: FlagCategory;
        }>
    ),
    ...overrides
  };

  return {
    deps,
    getDb: () => currentDb
  };
}

describe("orchestrator unit", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    delete process.env.OPENAI_API_KEY;
    delete process.env.GOOGLE_API_KEY;
    process.env.LLM_PROVIDER = "deterministic";
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env.LLM_PROVIDER = originalEnv.LLM_PROVIDER;
    process.env.OPENAI_API_KEY = originalEnv.OPENAI_API_KEY;
    process.env.GOOGLE_API_KEY = originalEnv.GOOGLE_API_KEY;
  });

  it("returns a valid opening question when there is no prior answer", async () => {
    const session = makeSession({
      mode: "behavioral",
      target_role: "Product Manager Intern",
      focus_area: "leadership"
    });

    const result = await computeNextQuestion(
      makePreparedInput({
        session,
        messages: [],
        latestAnswer: null
      })
    );

    expect(result.payload.current_phase).toBe("opening");
    expect(result.payload.turn_type).toBe("first_turn");
    expect(result.payload.question_type).toBe("primary");
    expect(result.payload.question_text).toContain("Product Manager Intern");
    expect(result.nextRuntimeState.current_phase).toBe("opening");
  });

  it("moves weak answers into deep-dive follow-up behavior", async () => {
    vi.spyOn(provider, "analyzeInterviewTurn").mockResolvedValue({
      summary: "The answer is thin and missing the core tradeoff evidence.",
      answer_quality: "limited",
      question_type_hint: "clarifying",
      follow_up_targets: ["tradeoff articulation"],
      missing_signals: ["clear context", "specific action", "tradeoff articulation"],
      suggested_phase: "deep_dive",
      probe_target_skill: "tradeoff articulation",
      phase_change_reason: "A targeted probe is required before the interview can move on.",
      star_coverage: {
        situation: false,
        task: false,
        action: false,
        result: false
      }
    });

    const session = makeSession({
      mode: "technical",
      target_role: "Backend Engineer Intern",
      focus_area: "system design"
    });
    const messages = [
      makeMessage(
        "interviewer",
        "Design a small cache invalidation system and explain the key tradeoffs.",
        1,
        { question_type: "primary" }
      ),
      makeMessage("student", "I would use a cache because it is faster.", 2)
    ];

    const result = await computeNextQuestion(
      makePreparedInput({
        session,
        messages,
        latestAnswer: messages[1].content,
        weakSkills: ["tradeoff articulation"],
        persistedState: makePersistedState(session, messages, {
          current_phase: "opening",
          turn_count: 1,
          current_question_type: "primary"
        })
      })
    );

    expect(result.payload.current_phase).toBe("deep_dive");
    expect(result.payload.turn_type).toBe("phase_transition");
    expect(result.payload.question_type).toBe("clarifying");
    expect(result.payload.question_text).toContain("Go deeper on");
    expect(result.nextRuntimeState.follow_up_targets).toContain("tradeoff articulation");
  });

  it("progresses strong behavioral answers instead of endlessly probing", async () => {
    const session = makeSession({
      mode: "behavioral",
      target_role: "Product Manager Intern",
      focus_area: "leadership",
      resume_text:
        "Led marketplace launch planning across design, engineering, and operations."
    });
    const strongAnswer =
      "Situation: our campus marketplace launch slipped after a partner changed scope. Task: I needed to realign design, engineering, and operations without losing trust. Action: I reset milestones, clarified tradeoffs, and ran daily decision reviews because the team needed shared priorities. Result: we launched on time and increased student signups by 18 percent.";
    const messages = [
      makeMessage(
        "interviewer",
        "Tell me about a time you had to regain momentum on an important initiative.",
        1,
        { question_type: "primary" }
      ),
      makeMessage("student", strongAnswer, 2)
    ];

    const result = await computeNextQuestion(
      makePreparedInput({
        session,
        messages,
        latestAnswer: strongAnswer,
        persistedState: makePersistedState(session, messages, {
          current_phase: "opening",
          turn_count: 1,
          current_question_type: "primary"
        })
      })
    );

    expect(result.payload.current_phase).toBe("interview_round");
    expect(result.payload.turn_type).toBe("phase_transition");
    expect(["primary", "situational"]).toContain(result.payload.question_type);
    expect(result.payload.question_type).not.toBe("clarifying");
    expect(result.payload.question_text).not.toContain("Go deeper on");
  });

  it("validates analyzer phase suggestions instead of blindly trusting invalid transitions", async () => {
    const analyzeSpy = vi.spyOn(provider, "analyzeInterviewTurn").mockResolvedValue({
      summary: "The answer needs a sharper follow-up, but mentor review is not actually warranted.",
      answer_quality: "solid",
      question_type_hint: "follow_up",
      follow_up_targets: ["tradeoff reasoning"],
      missing_signals: ["measurable result"],
      suggested_phase: "mentor_review",
      probe_target_skill: "tradeoff reasoning",
      phase_change_reason: "Force an invalid jump for test coverage.",
      star_coverage: {
        situation: true,
        task: true,
        action: false,
        result: false
      }
    });
    vi.spyOn(provider, "generateInterviewerQuestion").mockResolvedValue({
      question: "What tradeoff mattered most in that decision?",
      questionType: "follow_up",
      source: "openai"
    });

    const session = makeSession({
      mode: "technical",
      target_role: "Platform Engineer Intern",
      focus_area: "reliability"
    });
    const answer =
      "Situation: a release introduced latency. Task: I needed to stabilize the service. Action: I rolled back a risky path first.";
    const messages = [
      makeMessage(
        "interviewer",
        "Walk me through a system incident you handled.",
        1,
        { question_type: "primary" }
      ),
      makeMessage("student", answer, 2)
    ];

    const result = await computeNextQuestion(
      makePreparedInput({
        session,
        messages,
        latestAnswer: answer,
        persistedState: makePersistedState(session, messages, {
          current_phase: "opening",
          turn_count: 1,
          current_question_type: "primary"
        })
      })
    );

    expect(analyzeSpy).toHaveBeenCalledTimes(2);
    expect(result.payload.current_phase).toBe("opening");
    expect(result.payload.phase_transitioned).toBe(false);
    expect(result.payload.question_type).toBe("follow_up");
    expect(result.nextRuntimeState.current_phase).toBe("opening");
  });

  it("uses the deterministic question-bank fallback when live generation is unavailable", async () => {
    const session = makeSession({
      mode: "technical",
      target_role: "Software Engineer Intern",
      focus_area: "architecture"
    });

    const result = await computeNextQuestion(
      makePreparedInput({
        session,
        messages: [],
        latestAnswer: null
      })
    );

    expect(result.payload.question_text).toContain("Design a small but reliable system");
    expect(result.payload.question_type).toBe("primary");
  });

  it("marks the session completed when the runtime moves into session feedback", async () => {
    vi.spyOn(provider, "analyzeInterviewTurn").mockResolvedValue({
      summary: "Two short answers are enough for a supportive wrap-up.",
      answer_quality: "limited",
      question_type_hint: "follow_up",
      follow_up_targets: ["story structure"],
      missing_signals: ["specific action", "measurable result"],
      suggested_phase: "session_feedback",
      probe_target_skill: "story structure",
      phase_change_reason: "End with coaching instead of another substantive question.",
      star_coverage: {
        situation: false,
        task: false,
        action: false,
        result: false
      }
    });

    const session = makeSession({
      mode: "behavioral",
      target_role: "Product Manager Intern",
      focus_area: "storytelling"
    });
    const latestAnswer = "nah";
    const messages = [
      makeMessage(
        "interviewer",
        "Tell me about a project that slipped and how you handled it.",
        1,
        { question_type: "primary" }
      ),
      makeMessage("student", latestAnswer, 2)
    ];
    const persistedState = makePersistedState(session, messages, {
      current_phase: "opening",
      turn_count: 1,
      current_question_type: "primary"
    });
    const { deps, getDb } = createAskDeps(
      makeDb({
        session,
        messages,
        agentSessionStates: [persistedState]
      })
    );

    const payload = await askQuestion(
      {
        session_id: session.session_id,
        user_id: session.user_id,
        latest_answer: latestAnswer
      },
      deps
    );
    const updatedSession = getDb().sessions[0];
    const updatedState = getDb().agentSessionStates[0];

    expect(payload.current_phase).toBe("session_feedback");
    expect(updatedSession.status).toBe("completed");
    expect(updatedSession.ended_at).toBeTruthy();
    expect(updatedState.state_json.session_end_reason).toBe("analyzer_requested_feedback");
  });

  it("computes the next prompt from explicit stateless context without persisted reconstruction", async () => {
    const persistedSession = makeSession({
      session_id: "sess-stateless",
      target_role: "Old Persisted Role",
      mode: "technical",
      status: "active"
    });
    const hiddenMessages = [
      makeMessage(
        "interviewer",
        "This stale persisted question should not drive the next turn.",
        1,
        { question_type: "clarifying" }
      )
    ].map((message) => ({
      ...message,
      session_id: persistedSession.session_id
    }));
    const hiddenState = makePersistedState(persistedSession, hiddenMessages, {
      current_phase: "mentor_review",
      previous_phase: "deep_dive",
      turn_count: 4,
      turn_type: "clarification",
      current_question_type: "clarifying"
    });

    const { deps, getDb } = createAskDeps(
      makeDb({
        session: persistedSession,
        messages: hiddenMessages,
        agentSessionStates: [hiddenState]
      })
    );

    const context: AskQuestionContext = {
      mode: "technical",
      target_role: "Frontend Engineer Intern",
      focus_area: "architecture",
      personalization_enabled: true,
      self_critique_enabled: false,
      resume_text: "Built internal dashboards and API integrations.",
      recalled_context_summary: "Prior sessions focused on system tradeoffs.",
      session_status: "initialized",
      transcript: [],
      current_phase: "interview_setup",
      previous_phase: null,
      turn_count: 0,
      redirect_count: 0,
      turn_type: "first_turn",
      conversation_summary: null,
      weak_skills: ["tradeoff articulation"],
      recalled_context_items: [],
      flagged: false,
      mentor_takeover_active: false
    };

    const payload = await askQuestion(
      {
        session_id: persistedSession.session_id,
        user_id: persistedSession.user_id,
        latest_answer: null,
        context
      },
      deps
    );

    expect(payload.current_phase).toBe("opening");
    expect(payload.turn_type).toBe("first_turn");
    expect(payload.question_text).toContain("Frontend Engineer Intern");
    expect(deps.recallContext).not.toHaveBeenCalled();
    expect(deps.getWeakSkills).not.toHaveBeenCalled();
    expect(deps.updateDb).toHaveBeenCalledTimes(1);
    expect(deps.saveEvent).toHaveBeenCalledTimes(1);
    expect(getDb().messages.at(-1)?.session_id).toBe(persistedSession.session_id);
  });

  it("injects recalled weak skills, summary, and recent messages into runtime prompt construction", async () => {
    const analyzerPrompts: string[] = [];
    const speakerPrompts: string[] = [];

    vi.spyOn(provider, "analyzeInterviewTurn").mockImplementation(async (params) => {
      analyzerPrompts.push(params.prompt);
      return {
        summary: "The answer needs a clearer measurable impact statement.",
        answer_quality: "solid",
        question_type_hint: "follow_up",
        follow_up_targets: ["measurable result"],
        missing_signals: ["metric framing"],
        suggested_phase: "opening",
        probe_target_skill: "metric framing",
        phase_change_reason: "Stay in the current phase and sharpen the follow-up.",
        star_coverage: {
          situation: true,
          task: true,
          action: true,
          result: false
        }
      };
    });
    vi.spyOn(provider, "generateInterviewerQuestion").mockImplementation(async (params) => {
      speakerPrompts.push(params.prompt);
      return {
        question: "How would you make the impact measurable for the next interviewer?",
        questionType: "follow_up",
        source: "gemini"
      };
    });

    const session = makeSession({
      target_role: "Backend Engineer Intern",
      focus_area: "observability",
      resume_text: "Built monitoring dashboards for API performance.\nLed incident review follow-ups.",
      recalled_context_summary:
        "Past sessions showed solid systems thinking but weak metric framing."
    });
    const latestAnswer =
      "I reduced the latency by adding caching because the service was slow for some users.";
    const messages = [
      makeMessage(
        "interviewer",
        "Walk me through a latency issue you resolved.",
        1,
        { question_type: "primary" }
      ),
      makeMessage("student", latestAnswer, 2)
    ];

    const result = await computeNextQuestion(
      makePreparedInput({
        session,
        messages,
        latestAnswer,
        weakSkills: ["metric framing", "story structure"],
        recalledContextItems: [
          {
            memory_tier: "long_term",
            content: {
              skill: "stakeholder communication",
              signal_type: "weakness"
            },
            relevance_reason: "Historical weakness from prior feedback."
          }
        ],
        persistedState: makePersistedState(session, messages, {
          current_phase: "opening",
          turn_count: 1,
          current_question_type: "primary",
          conversation_summary: null
        })
      })
    );

    expect(analyzerPrompts[0]).toContain("metric framing, story structure");
    expect(analyzerPrompts[0]).toContain(
      "Past sessions showed solid systems thinking but weak metric framing."
    );
    expect(analyzerPrompts[0]).toContain(
      "interviewer: Walk me through a latency issue you resolved."
    );
    expect(analyzerPrompts[0]).toContain("weakness signal around stakeholder communication");
    expect(speakerPrompts[0]).toContain("measurable result");
    expect(result.payload.question_text).toBe(
      "How would you make the impact measurable for the next interviewer?"
    );
  });
});
