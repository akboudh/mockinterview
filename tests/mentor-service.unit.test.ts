import {
  addMentorFeedback,
  markFlagReviewed
} from "@/lib/services/mentor-service";
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
        target_roles: ["Backend Engineer Intern"],
        preferred_modes: ["technical"],
        known_weak_skills: [],
        created_at: "2026-04-06T09:00:00.000Z",
        updated_at: "2026-04-06T09:00:00.000Z"
      }
    ],
    authSessions: [],
    sessions: [
      {
        session_id: "sess-mentor",
        user_id: "student-1",
        mode: "technical",
        target_role: "Backend Engineer Intern",
        focus_area: "systems",
        confidence_self_rating: 4,
        status: "active",
        started_at: "2026-04-06T09:00:00.000Z",
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
    flags: [
      {
        flag_id: "flag-1",
        session_id: "sess-mentor",
        message_id: "msg-1",
        flag_reason: "Potential bias language.",
        flag_category: "bias",
        status: "open",
        mentor_notes: null,
        created_at: "2026-04-06T09:05:00.000Z",
        resolved_at: null
      }
    ],
    mentorInterventions: [],
    mentorDirectMessages: [],
    agentSessionStates: [
      {
        session_id: "sess-mentor",
        user_id: "student-1",
        current_phase: "interview_round",
        previous_phase: "opening",
        turn_count: 2,
        redirect_count: 0,
        turn_type: "standard",
        current_question_id: "q-1",
        current_question_text: "Explain a caching tradeoff.",
        current_question_type: "primary",
        latest_answer_text: null,
        analyzer_output: null,
        missing_signals: [],
        follow_up_targets: [],
        suggested_phase: "interview_round",
        conversation_summary: null,
        recent_messages: [],
        guardrail_findings: [],
        flagged: true,
        mentor_takeover_active: false,
        state_json: {},
        created_at: "2026-04-06T09:00:00.000Z",
        updated_at: "2026-04-06T09:00:00.000Z"
      }
    ],
    conversationSummaries: []
  };
}

describe("mentor service unit", () => {
  it("records supplemental mentor feedback and emits realtime updates", async () => {
    let currentDb = makeDb();
    const publishRealtimeEventMock = vi.fn();
    const saveEventMock = vi.fn(async (params) => ({
      event_id: "mem-feedback",
      session_id: params.session_id,
      user_id: params.user_id,
      memory_tier: params.memory_tier,
      event_type: params.event_type,
      content: params.content,
      embedding_ref: null,
      created_at: "2026-04-06T09:10:00.000Z",
      updated_at: "2026-04-06T09:10:00.000Z"
    }));
    const ids = ["intervention-1", "event-1", "event-2"];

    const intervention = await addMentorFeedback(
      {
        session_id: "sess-mentor",
        mentor_message: "Coach the student to anchor the answer in one concrete system metric."
      },
      {
        readDb: async () => currentDb,
        updateDb: async (updater) => {
          currentDb = await updater(currentDb);
          return currentDb;
        },
        saveEvent: saveEventMock,
        publishRealtimeEvent: publishRealtimeEventMock,
        now: () => "2026-04-06T09:10:00.000Z",
        randomUUID: () => ids.shift() ?? "fallback-id"
      }
    );

    expect(intervention.intervention_type).toBe("supplemental_feedback");
    expect(currentDb.mentorInterventions).toHaveLength(1);
    expect(currentDb.agentSessionStates[0]?.state_json.mentor_feedback_count).toBe(1);
    expect(saveEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "mentor_feedback"
      })
    );
    expect(publishRealtimeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session.mentor.feedback",
        audience: "session"
      })
    );
    expect(publishRealtimeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session.mentor.feedback",
        audience: "mentor"
      })
    );
  });

  it("marks flags reviewed and emits mentor queue updates", async () => {
    let currentDb = makeDb();
    const publishRealtimeEventMock = vi.fn();

    await markFlagReviewed(
      {
        flag_id: "flag-1",
        mentor_notes: "Reviewed. The flag was correct and the session is now stable."
      },
      {
        readDb: async () => currentDb,
        updateDb: async (updater) => {
          currentDb = await updater(currentDb);
          return currentDb;
        },
        saveEvent: async () => {
          throw new Error("saveEvent should not be called for markFlagReviewed.");
        },
        publishRealtimeEvent: publishRealtimeEventMock,
        now: () => "2026-04-06T09:12:00.000Z",
        randomUUID: () => "event-reviewed"
      }
    );

    expect(currentDb.flags[0]?.status).toBe("reviewed");
    expect(currentDb.flags[0]?.mentor_notes).toContain("Reviewed.");
    expect(currentDb.agentSessionStates[0]?.state_json.latest_flag_review_note).toContain(
      "Reviewed."
    );
    expect(publishRealtimeEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "session.flag.reviewed",
        audience: "mentor"
      })
    );
  });
});
