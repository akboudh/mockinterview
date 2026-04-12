import { saveStudentAnswer, startSession } from "@/lib/services/session-service";
import { recallContext } from "@/lib/services/memory-service";

import { resetDb } from "@/tests/test-utils";

import { askQuestion } from "@/lib/services/orchestrator-service";

describe("orchestrator", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("creates an opening question for a new session", async () => {
    const session = await startSession({
      user_id: "demo-student",
      target_role: "Software Engineer Intern",
      mode: "technical",
      focus_area: "system design",
      confidence_self_rating: 3,
      personalization_enabled: true,
      self_critique_enabled: false,
      notes: null
    });

    expect(session.current_phase).toBe("interview_setup");

    const nextQuestion = await askQuestion({
      session_id: session.session_id,
      user_id: "demo-student",
      latest_answer: null
    });

    expect(nextQuestion.question_text).toContain("Software Engineer Intern");
    expect(nextQuestion.mode).toBe("technical");
    expect(nextQuestion.current_phase).toBe("opening");
    expect(nextQuestion.turn_type).toBe("first_turn");
  });

  it("accepts explicit orchestrator context at the API boundary", async () => {
    const session = await startSession({
      user_id: "demo-student",
      target_role: "Software Engineer Intern",
      mode: "technical",
      focus_area: "system design",
      confidence_self_rating: 3,
      personalization_enabled: true,
      self_critique_enabled: false,
      notes: null,
      resume_text: "Built internal APIs and owned service observability."
    });
    const recall = await recallContext({
      session_id: session.session_id,
      user_id: "demo-student",
      query_type: "mixed",
      query_text: "Software Engineer Intern system design"
    });

    const nextQuestion = await askQuestion({
      session_id: session.session_id,
      user_id: "demo-student",
      latest_answer: null,
      context: {
        mode: "technical",
        target_role: "Software Engineer Intern",
        focus_area: "system design",
        personalization_enabled: true,
        self_critique_enabled: false,
        resume_text: "Built internal APIs and owned service observability.",
        recalled_context_summary: session.recalled_context_summary ?? null,
        session_status: "initialized",
        transcript: [],
        current_phase: session.current_phase,
        turn_count: 0,
        redirect_count: 0,
        turn_type: "first_turn",
        conversation_summary: session.recalled_context_summary ?? null,
        weak_skills: recall.weak_skills,
        recalled_context_items: recall.context_items,
        flagged: false,
        mentor_takeover_active: false
      }
    });

    expect(nextQuestion.question_text).toContain("Software Engineer Intern");
    expect(nextQuestion.current_phase).toBe("opening");
  });

  it("moves behavioral interviews to a fresh question after a solid answer", async () => {
    const session = await startSession({
      user_id: "demo-student",
      target_role: "Product Manager Intern",
      mode: "behavioral",
      focus_area: "leadership",
      confidence_self_rating: 4,
      personalization_enabled: true,
      self_critique_enabled: false,
      notes: "Behavioral progression test",
      resume_text:
        "Led product launch planning for a campus marketplace.\nBuilt analytics dashboards for growth experiments."
    });

    await askQuestion({
      session_id: session.session_id,
      user_id: "demo-student",
      latest_answer: null
    });

    const answer = await saveStudentAnswer({
      session_id: session.session_id,
      content:
        "Situation: our marketplace launch was slipping after partners changed the scope. Task: I needed to realign design, engineering, and operations quickly. Action: I reset the milestone plan, clarified tradeoffs, and drove daily decisions with clear owners. Result: we launched on time and increased student signups by 18%."
    });

    const nextQuestion = await askQuestion({
      session_id: session.session_id,
      user_id: "demo-student",
      latest_answer: answer.content
    });

    expect(nextQuestion.question_type).not.toBe("clarifying");
    expect(nextQuestion.question_text).not.toContain("Go deeper on");
    expect(["primary", "situational"]).toContain(nextQuestion.question_type);
  });
});
