import { recordGuardrailFlags } from "@/lib/services/guardrail-service";
import type { MockInterviewDB } from "@/lib/types";

function makeDb(): MockInterviewDB {
  return {
    users: [
      {
        user_id: "student-1",
        display_name: "Student One",
        email: "student@example.com",
        roles: ["student"],
        resume_text: null,
        resume_file_name: null,
        target_roles: ["Product Manager Intern"],
        preferred_modes: ["behavioral"],
        known_weak_skills: [],
        created_at: "2026-04-06T10:00:00.000Z",
        updated_at: "2026-04-06T10:00:00.000Z"
      }
    ],
    authSessions: [],
    sessions: [
      {
        session_id: "sess-guardrail",
        user_id: "student-1",
        mode: "behavioral",
        target_role: "Product Manager Intern",
        focus_area: "communication",
        confidence_self_rating: 3,
        status: "active",
        started_at: "2026-04-06T10:00:00.000Z",
        ended_at: null,
        personalization_enabled: true,
        self_critique_enabled: true,
        notes: null,
        resume_text: null,
        recalled_context_summary: null
      }
    ],
    messages: [],
    evaluations: [],
    memoryEvents: [],
    memoryVectors: [],
    skillSignals: [],
    flags: [],
    mentorInterventions: [],
    mentorDirectMessages: [],
    agentSessionStates: [
      {
        session_id: "sess-guardrail",
        user_id: "student-1",
        current_phase: "interview_round",
        previous_phase: "opening",
        turn_count: 2,
        redirect_count: 0,
        turn_type: "standard",
        current_question_id: "q-1",
        current_question_text: "Tell me about a leadership challenge.",
        current_question_type: "primary",
        latest_answer_text: null,
        analyzer_output: null,
        missing_signals: [],
        follow_up_targets: [],
        suggested_phase: "interview_round",
        conversation_summary: null,
        recent_messages: [],
        guardrail_findings: [],
        flagged: false,
        mentor_takeover_active: false,
        state_json: {},
        created_at: "2026-04-06T10:00:00.000Z",
        updated_at: "2026-04-06T10:00:00.000Z"
      }
    ],
    conversationSummaries: []
  };
}

describe("guardrail service unit", () => {
  it("persists flags, updates session state, and emits mentor/session events", async () => {
    let currentDb = makeDb();
    const updateDbMock = vi.fn(async (updater: (db: MockInterviewDB) => MockInterviewDB) => {
      currentDb = await updater(currentDb);
      return currentDb;
    });
    const saveEventMock = vi.fn(async (params) => ({
      event_id: "memory-1",
      session_id: params.session_id,
      user_id: params.user_id,
      memory_tier: params.memory_tier,
      event_type: params.event_type,
      content: params.content,
      embedding_ref: null,
      created_at: "2026-04-06T10:05:00.000Z",
      updated_at: "2026-04-06T10:05:00.000Z"
    }));
    const publishRealtimeEventMock = vi.fn();
    const ids = ["flag-1", "event-1", "event-2"];

    const createdFlags = await recordGuardrailFlags(
      {
        session_id: "sess-guardrail",
        user_id: "student-1",
        message_id: "msg-1",
        findings: [
          {
            policy_id: "protected-class-questions",
            flag_reason: "Prevent questions or feedback about protected characteristics.",
            flag_category: "bias",
            severity: "high",
            labels: ["fairness", "hiring-compliance"]
          }
        ]
      },
      {
        readDb: async () => currentDb,
        updateDb: updateDbMock,
        saveEvent: saveEventMock,
        publishRealtimeEvent: publishRealtimeEventMock,
        now: () => "2026-04-06T10:05:00.000Z",
        randomUUID: () => ids.shift() ?? "fallback-id"
      }
    );

    expect(createdFlags).toHaveLength(1);
    expect(currentDb.flags[0]?.flag_id).toBe("flag-1");
    expect(currentDb.sessions[0]?.status).toBe("flagged");
    expect(currentDb.agentSessionStates[0]?.flagged).toBe(true);
    expect(currentDb.agentSessionStates[0]?.guardrail_findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flag_category: "bias"
        })
      ])
    );
    expect(saveEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "guardrail_flag",
        content: expect.objectContaining({
          policy_id: "protected-class-questions",
          severity: "high",
          labels: ["fairness", "hiring-compliance"]
        })
      })
    );
    expect(publishRealtimeEventMock).toHaveBeenCalledTimes(2);
    expect(publishRealtimeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session.flag.created",
        audience: "session"
      })
    );
    expect(publishRealtimeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session.flag.created",
        audience: "mentor"
      })
    );
  });
});
