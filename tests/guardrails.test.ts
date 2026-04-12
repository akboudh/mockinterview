import { inspectForGuardrails } from "@/lib/services/guardrail-service";

describe("guardrails", () => {
  it("flags biased or protected-class questions", () => {
    const findings = inspectForGuardrails(
      "How old are you and what is your religion?"
    );
    expect(findings.length).toBeGreaterThan(0);
    expect(findings[0]?.flag_category).toBe("bias");
  });

  it("does not flag neutral interview prompts", () => {
    const findings = inspectForGuardrails(
      "Tell me about a time you handled a deadline conflict."
    );
    expect(findings).toHaveLength(0);
  });
});
