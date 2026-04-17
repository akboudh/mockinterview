import {
  computeEvaluationResult,
  evaluateResponse,
  persistEvaluationResult
} from "@/lib/services/evaluation-service";
import { normalizeRubricLibrary } from "@/lib/evaluation/rubric-loader";
import { selectEvaluationRubric } from "@/lib/evaluation/rubric-selector";
import type { MockInterviewDB, RawEvaluationScorecard } from "@/lib/types";

function makeDb(): MockInterviewDB {
  return {
    users: [],
    authSessions: [],
    sessions: [],
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
        session_id: "sess-eval-unit",
        user_id: "student-1",
        current_phase: "interview_round",
        previous_phase: "opening",
        turn_count: 1,
        redirect_count: 0,
        turn_type: "standard",
        current_question_id: "q-1",
        current_question_text: "Tell me about a system design tradeoff.",
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
        created_at: "2026-04-05T10:00:00.000Z",
        updated_at: "2026-04-05T10:00:00.000Z"
      }
    ],
    conversationSummaries: []
  };
}

const technicalRubricLibrary = normalizeRubricLibrary({
  version: 1,
  library: {
    technical: {
      rubric_id: "technical.custom",
      description: "Custom technical rubric",
      role_context: ["Software Engineer Intern"],
      feedback_priorities: ["relevance", "structure", "clarity", "soft_skills"],
      criteria: {
        clarity: {
          scale: "1-5",
          evaluator_prompt: "Assess technical clarity.",
          weak_skill_label: "technical communication",
          strength_skill_label: "technical clarity"
        },
        structure: {
          scale: "1-5",
          evaluator_prompt: "Assess design structure.",
          weak_skill_label: "narrative structure",
          strength_skill_label: "systematic reasoning"
        },
        relevance: {
          scale: "1-5",
          evaluator_prompt: "Assess tradeoff relevance.",
          weak_skill_label: "tradeoff articulation",
          strength_skill_label: "tradeoff communication"
        },
        soft_skills: {
          scale: "1-5",
          evaluator_prompt: "Assess collaboration.",
          weak_skill_label: "collaborative communication",
          strength_skill_label: "calm collaboration"
        }
      },
      star_fields: ["situation", "task", "action", "result"]
    }
  }
});

const mockedRawScorecard: RawEvaluationScorecard = {
  clarity_score: 4,
  structure_score: 2,
  relevance_score: 2,
  soft_skills_score: 5,
  star: {
    situation: "A production workflow was timing out under peak load.",
    task: "I needed to stabilize the API and explain the tradeoffs.",
    action: "I added backpressure and simplified the write path.",
    result: "Result needs a clearer outcome or measurable impact."
  },
  overall_summary: "The answer has solid communication but weak tradeoff coverage.",
  actionable_feedback: ["Explain the tradeoffs and quantify the outcome more clearly."],
  growth_tips: ["Use requirements, design, tradeoffs, and risks as the default technical structure."],
  self_critique_output: "Coverage missed the result evidence."
};

describe("evaluation service unit", () => {
  it("computes rubric-driven scorecards from mocked evaluator output", async () => {
    const computed = await computeEvaluationResult(
      {
        session_id: "sess-eval-unit",
        user_id: "student-1",
        question_message_id: "q-1",
        answer_message_id: "a-1",
        question_text: "Tell me about a system design tradeoff.",
        answer_text:
          "I simplified the write path, but I did not explain the outcome or the main tradeoff clearly.",
        target_role: "Software Engineer Intern",
        mode: "technical",
        self_critique_enabled: true
      },
      {
        loadRubricLibrary: async () => technicalRubricLibrary,
        selectRubric: selectEvaluationRubric,
        evaluateWithProvider: async () => mockedRawScorecard,
        randomUUID: () => "eval-unit-1",
        now: () => "2026-04-05T11:00:00.000Z"
      }
    );

    expect(computed.record.evaluation_id).toBe("eval-unit-1");
    expect(computed.scorecard.rubric_id).toBe("technical.custom");
    expect(computed.scorecard.rubric_match_type).toBe("exact_role_mode");
    expect(computed.scorecard.dimension_scores.relevance).toBe(2);
    expect(computed.scorecard.weak_skills).toEqual(
      expect.arrayContaining(["tradeoff articulation", "narrative structure"])
    );
    expect(computed.scorecard.strengths).toEqual(expect.arrayContaining(["calm collaboration"]));
    expect(computed.scorecard.rubric_coverage.missing_star_fields).toContain("result");
  });

  it("persists episodic memory and Student B skill signals with mocked dependencies", async () => {
    let currentDb = makeDb();
    const updateDbMock = vi.fn(async (updater: (db: MockInterviewDB) => MockInterviewDB) => {
      currentDb = await updater(currentDb);
      return currentDb;
    });
    const saveEventMock = vi.fn(async (params) => ({
      event_id: "mem-1",
      session_id: params.session_id,
      user_id: params.user_id,
      memory_tier: params.memory_tier,
      event_type: params.event_type,
      content: params.content,
      embedding_ref: null,
      created_at: "2026-04-05T11:00:00.000Z",
      updated_at: "2026-04-05T11:00:00.000Z"
    }));
    const recordSkillSignalMock = vi.fn(async (params) => params);

    const params = {
      session_id: "sess-eval-unit",
      user_id: "student-1",
      question_message_id: "q-1",
      answer_message_id: "a-1",
      question_text: "Tell me about a system design tradeoff.",
      answer_text:
        "I simplified the write path, but I did not explain the outcome or the main tradeoff clearly.",
      target_role: "Software Engineer Intern",
      mode: "technical" as const,
      self_critique_enabled: true
    };

    const computed = await computeEvaluationResult(params, {
      loadRubricLibrary: async () => technicalRubricLibrary,
      selectRubric: selectEvaluationRubric,
      evaluateWithProvider: async () => mockedRawScorecard,
      randomUUID: () => "eval-unit-2",
      now: () => "2026-04-05T11:00:00.000Z"
    });

    await persistEvaluationResult(params, computed, {
      updateDb: updateDbMock,
      saveEvent: saveEventMock,
      recordSkillSignal: recordSkillSignalMock,
      loadRubricLibrary: async () => technicalRubricLibrary,
      selectRubric: selectEvaluationRubric,
      evaluateWithProvider: async () => mockedRawScorecard,
      randomUUID: () => "eval-unit-2",
      now: () => "2026-04-05T11:00:00.000Z"
    });

    expect(updateDbMock).toHaveBeenCalledTimes(1);
    expect(currentDb.evaluations).toHaveLength(1);
    expect(currentDb.evaluations[0]?.rubric_id).toBe("technical.custom");
    expect(saveEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        event_type: "evaluation_record",
        content: expect.objectContaining({
          rubric_id: "technical.custom",
          weak_skills: expect.arrayContaining(["tradeoff articulation", "narrative structure"])
        })
      })
    );
    expect(recordSkillSignalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skill_name: "tradeoff articulation",
        signal_type: "weakness"
      })
    );
    expect(recordSkillSignalMock).toHaveBeenCalledWith(
      expect.objectContaining({
        skill_name: "technical clarity",
        signal_type: "strength"
      })
    );
  });

  it("keeps evaluateResponse usable with injected dependencies only", async () => {
    let currentDb = makeDb();

    const result = await evaluateResponse(
      {
        session_id: "sess-eval-unit",
        user_id: "student-1",
        question_message_id: "q-1",
        answer_message_id: "a-1",
        question_text: "Tell me about a system design tradeoff.",
        answer_text:
          "I simplified the write path, but I did not explain the outcome or the main tradeoff clearly.",
        target_role: "Software Engineer Intern",
        mode: "technical",
        self_critique_enabled: true
      },
      {
        updateDb: async (updater) => {
          currentDb = await updater(currentDb);
          return currentDb;
        },
        saveEvent: async (params) => ({
          event_id: "mem-2",
          session_id: params.session_id,
          user_id: params.user_id,
          memory_tier: params.memory_tier,
          event_type: params.event_type,
          content: params.content,
          embedding_ref: null,
          created_at: "2026-04-05T11:00:00.000Z",
          updated_at: "2026-04-05T11:00:00.000Z"
        }),
        recordSkillSignal: async (params) => ({
          ...params,
          skill_signal_id: "sig-1",
          created_at: "2026-04-05T11:00:00.000Z"
        }),
        loadRubricLibrary: async () => technicalRubricLibrary,
        selectRubric: selectEvaluationRubric,
        evaluateWithProvider: async () => mockedRawScorecard,
        randomUUID: () => "eval-unit-3",
        now: () => "2026-04-05T11:00:00.000Z"
      }
    );

    expect(result.evaluation_id).toBe("eval-unit-3");
    expect(result.scorecard.rubric_id).toBe("technical.custom");
    expect(result.scorecard.overall_score).toBeGreaterThan(0);
    expect(currentDb.evaluations).toHaveLength(1);
  });
});
