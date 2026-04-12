import { askQuestion } from "@/lib/services/orchestrator-service";
import { evaluateResponse } from "@/lib/services/evaluation-service";
import { readDb } from "@/lib/db";
import { saveStudentAnswer, startSession } from "@/lib/services/session-service";
import { resetDb } from "@/tests/test-utils";

describe("integration flow", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("runs start -> ask -> answer -> evaluate", async () => {
    const session = await startSession({
      user_id: "demo-student",
      target_role: "Product Manager Intern",
      mode: "behavioral",
      focus_area: "leadership",
      confidence_self_rating: 4,
      personalization_enabled: true,
      self_critique_enabled: true,
      notes: "Integration flow test",
      resume_text:
        "Led a student marketplace launch.\nBuilt dashboards to monitor retention and conversion."
    });

    const question = await askQuestion({
      session_id: session.session_id,
      user_id: "demo-student",
      latest_answer: null
    });
    const answer = await saveStudentAnswer({
      session_id: session.session_id,
      content:
        "Situation: our launch stalled. Task: I had to align design and engineering. Action: I set a decision cadence and clarified tradeoffs. Result: we shipped on time and improved student adoption."
    });
    const evaluation = await evaluateResponse({
      session_id: session.session_id,
      user_id: "demo-student",
      question_message_id: question.question_id,
      answer_message_id: answer.message_id,
      question_text: question.question_text,
      answer_text: answer.content,
      target_role: "Product Manager Intern",
      mode: "behavioral",
      self_critique_enabled: true
    });

    const db = await readDb();

    expect(evaluation.scorecard.overall_summary).toBeTruthy();
    expect(db.sessions.some((entry) => entry.session_id === session.session_id)).toBe(true);
    expect(
      db.sessions.find((entry) => entry.session_id === session.session_id)?.resume_text
    ).toContain("student marketplace launch");
    expect(db.evaluations.some((entry) => entry.session_id === session.session_id)).toBe(true);
    expect(db.agentSessionStates.some((entry) => entry.session_id === session.session_id)).toBe(true);
  });
});
