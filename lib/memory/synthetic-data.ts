import { LocalSemanticEmbeddings } from "@/lib/memory/embeddings";
import { buildMemoryEmbeddingText } from "@/lib/memory/text";
import type {
  AgentSessionState,
  EvaluationRecord,
  InterviewMode,
  InterviewSession,
  MemoryEvent,
  MemoryVectorRecord,
  Message,
  MockInterviewDB,
  SkillSignal,
  UserProfile
} from "@/lib/types";

const profiles = [
  {
    user_id: "seed-student-1",
    display_name: "Avery Student",
    email: "avery.student@example.com",
    mode: "behavioral" as InterviewMode,
    target_role: "Product Manager Intern",
    focus_area: "leadership",
    weakness: "story structure",
    strength: "stakeholder communication",
    summary:
      "Avery gives thoughtful examples but still needs tighter STAR framing when describing leadership moments."
  },
  {
    user_id: "seed-student-2",
    display_name: "Jordan Student",
    email: "jordan.student@example.com",
    mode: "technical" as InterviewMode,
    target_role: "Backend Engineer Intern",
    focus_area: "performance",
    weakness: "tradeoff articulation",
    strength: "incident debugging",
    summary:
      "Jordan reasons well about latency and debugging, but the tradeoff explanation needs clearer constraints and metrics."
  },
  {
    user_id: "seed-student-3",
    display_name: "Riley Student",
    email: "riley.student@example.com",
    mode: "case" as InterviewMode,
    target_role: "Strategy Intern",
    focus_area: "prioritization",
    weakness: "quantification",
    strength: "structured recommendation",
    summary:
      "Riley keeps a strong hypothesis-driven flow, but the final recommendation would be stronger with quantified impact."
  }
];

function isoOffset(base: Date, offsetDays: number) {
  return new Date(base.getTime() - offsetDays * 86400000).toISOString();
}

function createUser(now: string, profile: (typeof profiles)[number]): UserProfile {
  return {
    user_id: profile.user_id,
    display_name: profile.display_name,
    email: profile.email,
    password_hash: null,
    resume_text:
      profile.mode === "behavioral"
        ? "Led a campus product launch and coordinated stakeholders across design and engineering."
        : profile.mode === "technical"
          ? "Built caching, observability, and incident response tooling for backend services."
          : "Built market-sizing cases and executive recommendation briefs for student consulting teams.",
    resume_file_name: `${profile.user_id}.txt`,
    target_roles: [profile.target_role],
    preferred_modes: [profile.mode],
    known_weak_skills: [profile.weakness],
    created_at: now,
    updated_at: now
  };
}

function createSession(params: {
  session_id: string;
  user_id: string;
  mode: InterviewMode;
  target_role: string;
  focus_area: string;
  summary: string;
  started_at: string;
}): InterviewSession {
  return {
    session_id: params.session_id,
    user_id: params.user_id,
    mode: params.mode,
    target_role: params.target_role,
    focus_area: params.focus_area,
    confidence_self_rating: 3,
    status: "completed",
    started_at: params.started_at,
    ended_at: params.started_at,
    personalization_enabled: true,
    self_critique_enabled: true,
    notes: "Synthetic memory harness session",
    resume_text: null,
    recalled_context_summary: params.summary
  };
}

function createMessages(session: InterviewSession, index: number): Message[] {
  const question =
    session.mode === "behavioral"
      ? "Tell me about a time you had to align stakeholders under pressure."
      : session.mode === "technical"
        ? "Walk me through how you reduced latency in a backend service."
        : "How would you prioritize one intervention after adoption stalled?";
  const answer =
    session.mode === "behavioral"
      ? "I clarified owners, tightened the meeting cadence, and aligned engineering and design on the launch decision."
      : session.mode === "technical"
        ? "I profiled the slow API path, added caching, and used tracing to verify the latency improvement."
        : "I would segment the funnel, test the biggest bottleneck first, and recommend the intervention with the clearest student impact.";

  return [
    {
      message_id: `${session.session_id}-q1`,
      session_id: session.session_id,
      speaker_type: "interviewer",
      content: question,
      message_order: 1,
      created_at: session.started_at,
      meta: {
        question_type: "primary"
      }
    },
    {
      message_id: `${session.session_id}-a1`,
      session_id: session.session_id,
      speaker_type: "student",
      content: answer,
      message_order: 2,
      created_at: session.started_at
    },
    {
      message_id: `${session.session_id}-q2`,
      session_id: session.session_id,
      speaker_type: "interviewer",
      content:
        index % 2 === 0
          ? "Go deeper on the measurable result and tradeoff."
          : "Clarify the structure of your recommendation.",
      message_order: 3,
      created_at: session.started_at,
      meta: {
        question_type: "clarifying"
      }
    }
  ];
}

function createEvaluation(
  session: InterviewSession,
  weakness: string,
  strength: string
): EvaluationRecord {
  return {
    evaluation_id: `${session.session_id}-eval-1`,
    session_id: session.session_id,
    question_message_id: `${session.session_id}-q1`,
    answer_message_id: `${session.session_id}-a1`,
    target_role: session.target_role,
    mode: session.mode,
    clarity_score: 4,
    structure_score: weakness === "story structure" ? 3 : 4,
    relevance_score: weakness === "tradeoff articulation" ? 3 : 4,
    soft_skills_score: strength === "stakeholder communication" ? 5 : 4,
    star_situation: "The context was established.",
    star_task: "The responsibility was moderately clear.",
    star_action: "The action was specific enough to coach from.",
    star_result: "The outcome needs clearer quantification.",
    overall_summary: session.recalled_context_summary ?? "Synthetic summary",
    actionable_feedback: [`Sharpen ${weakness} in the next answer.`],
    growth_tips: [`Keep leaning into ${strength}.`],
    self_critique_output: "Synthetic evaluator reflection",
    created_at: session.started_at
  };
}

function createRuntime(session: InterviewSession): AgentSessionState {
  return {
    session_id: session.session_id,
    user_id: session.user_id,
    current_phase: "session_feedback",
    previous_phase: "interview_round",
    turn_count: 2,
    redirect_count: 0,
    turn_type: "termination",
    current_question_id: `${session.session_id}-q2`,
    current_question_text: "Synthetic final follow-up.",
    current_question_type: "clarifying",
    latest_answer_text: "Synthetic student answer.",
    analyzer_output: null,
    missing_signals: [],
    follow_up_targets: [],
    suggested_phase: "session_feedback",
    conversation_summary: session.recalled_context_summary ?? "Synthetic summary",
    recent_messages: [],
    guardrail_findings: [],
    flagged: false,
    mentor_takeover_active: false,
    state_json: {
      synthetic: true,
      mode: session.mode
    },
    created_at: session.started_at,
    updated_at: session.started_at
  };
}

function createMemoryEvents(params: {
  session: InterviewSession;
  weakness: string;
  strength: string;
  summary: string;
}): MemoryEvent[] {
  const now = params.session.started_at;

  return [
    {
      event_id: `${params.session.session_id}-mem-summary`,
      session_id: params.session.session_id,
      user_id: params.session.user_id,
      memory_tier: "episodic",
      event_type: "session_summary",
      content: {
        mode: params.session.mode,
        target_role: params.session.target_role,
        focus_area: params.session.focus_area,
        summary_text: params.summary
      },
      embedding_ref: `vec-${params.session.session_id}-summary`,
      created_at: now,
      updated_at: now
    },
    {
      event_id: `${params.session.session_id}-mem-weakness`,
      session_id: params.session.session_id,
      user_id: params.session.user_id,
      memory_tier: "long_term",
      event_type: "skill_gap",
      content: {
        skill: params.weakness,
        notes: `Needs more explicit ${params.weakness} in future answers.`,
        mode: params.session.mode
      },
      embedding_ref: `vec-${params.session.session_id}-weakness`,
      created_at: now,
      updated_at: now
    },
    {
      event_id: `${params.session.session_id}-mem-strength`,
      session_id: params.session.session_id,
      user_id: params.session.user_id,
      memory_tier: "long_term",
      event_type: "strength_signal",
      content: {
        skill: params.strength,
        notes: `Demonstrated strong ${params.strength}.`,
        mode: params.session.mode
      },
      embedding_ref: `vec-${params.session.session_id}-strength`,
      created_at: now,
      updated_at: now
    }
  ];
}

function createSkillSignals(params: {
  session: InterviewSession;
  evaluation: EvaluationRecord;
  weakness: string;
  strength: string;
}): SkillSignal[] {
  return [
    {
      skill_signal_id: `${params.session.session_id}-sig-weak`,
      user_id: params.session.user_id,
      skill_name: params.weakness,
      signal_type: "weakness",
      source_session_id: params.session.session_id,
      source_evaluation_id: params.evaluation.evaluation_id,
      notes: `Synthetic weakness around ${params.weakness}.`,
      created_at: params.session.started_at
    },
    {
      skill_signal_id: `${params.session.session_id}-sig-strength`,
      user_id: params.session.user_id,
      skill_name: params.strength,
      signal_type: "strength",
      source_session_id: params.session.session_id,
      source_evaluation_id: params.evaluation.evaluation_id,
      notes: `Synthetic strength around ${params.strength}.`,
      created_at: params.session.started_at
    }
  ];
}

async function createVectors(events: MemoryEvent[], sessions: InterviewSession[]) {
  const embeddings = new LocalSemanticEmbeddings();
  const texts = events.map((event) =>
    buildMemoryEmbeddingText({
      event,
      session: sessions.find((entry) => entry.session_id === event.session_id) ?? null
    })
  );
  const vectors = await embeddings.embedDocuments(texts);

  return events.map((event, index) => {
    const session = sessions.find((entry) => entry.session_id === event.session_id)!;
    return {
      event_id: event.event_id,
      user_id: event.user_id,
      session_id: event.session_id,
      memory_tier: event.memory_tier,
      event_type: event.event_type,
      mode: session.mode,
      target_role: session.target_role,
      focus_area: session.focus_area ?? null,
      embedding_model: embeddings.modelName,
      embedding_dimensions: embeddings.dimensions,
      embedding_text: texts[index]!,
      vector: vectors[index]!,
      created_at: event.created_at,
      updated_at: event.updated_at ?? event.created_at
    } satisfies MemoryVectorRecord;
  });
}

export async function generateSyntheticMemoryDataset(now = new Date()) {
  const users: UserProfile[] = [];
  const sessions: InterviewSession[] = [];
  const messages: Message[] = [];
  const evaluations: EvaluationRecord[] = [];
  const agentSessionStates: AgentSessionState[] = [];
  const memoryEvents: MemoryEvent[] = [];
  const skillSignals: SkillSignal[] = [];

  profiles.forEach((profile, index) => {
    const createdAt = isoOffset(now, index + 2);
    const user = createUser(createdAt, profile);
    users.push(user);

    const session = createSession({
      session_id: `${profile.user_id}-sess-1`,
      user_id: profile.user_id,
      mode: profile.mode,
      target_role: profile.target_role,
      focus_area: profile.focus_area,
      summary: profile.summary,
      started_at: createdAt
    });
    sessions.push(session);
    messages.push(...createMessages(session, index));

    const evaluation = createEvaluation(session, profile.weakness, profile.strength);
    evaluations.push(evaluation);
    agentSessionStates.push(createRuntime(session));

    const sessionEvents = createMemoryEvents({
      session,
      weakness: profile.weakness,
      strength: profile.strength,
      summary: profile.summary
    });
    memoryEvents.push(...sessionEvents);
    skillSignals.push(
      ...createSkillSignals({
        session,
        evaluation,
        weakness: profile.weakness,
        strength: profile.strength
      })
    );
  });

  const memoryVectors = await createVectors(memoryEvents, sessions);

  return {
    users,
    authSessions: [],
    sessions,
    messages,
    evaluations,
    memoryEvents,
    memoryVectors,
    skillSignals,
    flags: [],
    mentorInterventions: [],
    agentSessionStates,
    conversationSummaries: sessions.map((session) => ({
      summary_id: `${session.session_id}-summary`,
      session_id: session.session_id,
      summary_text: session.recalled_context_summary ?? "Synthetic summary",
      turn_count: 2,
      created_at: session.started_at
    }))
  } satisfies MockInterviewDB;
}
