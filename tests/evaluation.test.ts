import { evaluateResponse } from "@/lib/services/evaluation-service";
import { resetDb } from "@/tests/test-utils";

describe("evaluation service", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("returns a structured scorecard payload", async () => {
    const result = await evaluateResponse({
      session_id: "sess-eval-test",
      user_id: "demo-student",
      question_message_id: "q-1",
      answer_message_id: "a-1",
      question_text: "Tell me about a leadership moment.",
      answer_text:
        "Situation: our team slipped a deadline. Task: I had to re-align the team. Action: I reset priorities, clarified owners, and communicated tradeoffs. Result: we shipped one week later with higher quality and less confusion.",
      target_role: "Product Manager Intern",
      mode: "behavioral",
      self_critique_enabled: true
    });

    expect(result.scorecard.clarity_score).toBeGreaterThan(0);
    expect(result.scorecard.rubric_id).toBe("behavioral.default");
    expect(result.scorecard.overall_score).toBeGreaterThan(0);
    expect(result.scorecard.dimension_scores.structure).toBe(result.scorecard.structure_score);
    expect(result.scorecard.actionable_feedback.length).toBeGreaterThan(0);
    expect(result.scorecard.star.result).toContain("shipped one week later");
    expect(result.scorecard.rubric_coverage.required_dimensions_checked).toContain("clarity");
    expect(result.scorecard.self_critique_output).toBeTruthy();
  });

  it("preserves explicit STAR labels in fallback evaluation", async () => {
    const result = await evaluateResponse({
      session_id: "sess-eval-star-test",
      user_id: "demo-student",
      question_message_id: "q-2",
      answer_message_id: "a-2",
      question_text: "Tell me about a leadership moment.",
      answer_text:
        "Situation: our team slipped a deadline. Task: I had to re-align the team. Action: I reset priorities, clarified owners, and communicated tradeoffs. Result: we shipped one week later with higher quality and less confusion.",
      target_role: "Product Manager Intern",
      mode: "behavioral",
      self_critique_enabled: false
    });

    expect(result.scorecard.star.situation).toContain("our team slipped a deadline");
    expect(result.scorecard.star.task).toContain("re-align the team");
    expect(result.scorecard.star.action).toContain("reset priorities");
    expect(result.scorecard.star.result).toContain("shipped one week later");
  });
});
