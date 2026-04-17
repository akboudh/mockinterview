import { inspectForGuardrails } from "@/lib/services/guardrail-service";

describe("guardrails", () => {
  it("flags biased or protected-class questions", async () => {
    const findings = await inspectForGuardrails({
      text: "How old are you and what is your religion?",
      source: "interviewer"
    });
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.flag_category).toBe("bias");
  });

  it("does not flag neutral interview prompts", async () => {
    const findings = await inspectForGuardrails({
      text: "Tell me about a time you handled a deadline conflict.",
      source: "interviewer"
    });
    expect(findings).toHaveLength(0);
  });
});
