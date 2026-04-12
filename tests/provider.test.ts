import { analyzeInterviewTurn, describeProviderMode } from "@/lib/ai/provider";

describe("provider adapter", () => {
  it("falls back to deterministic mode without live provider keys", () => {
    const originalKey = process.env.GOOGLE_API_KEY;
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    const originalProvider = process.env.LLM_PROVIDER;
    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.LLM_PROVIDER;

    expect(describeProviderMode()).toBe("deterministic");

    process.env.GOOGLE_API_KEY = originalKey;
    process.env.OPENAI_API_KEY = originalOpenAIKey;
    process.env.LLM_PROVIDER = originalProvider;
  });

  it("prefers OpenAI when configured and available", () => {
    const originalKey = process.env.GOOGLE_API_KEY;
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    const originalProvider = process.env.LLM_PROVIDER;

    delete process.env.GOOGLE_API_KEY;
    process.env.OPENAI_API_KEY = "test-openai-key";
    process.env.LLM_PROVIDER = "openai";

    expect(describeProviderMode()).toBe("openai");

    process.env.GOOGLE_API_KEY = originalKey;
    process.env.OPENAI_API_KEY = originalOpenAIKey;
    process.env.LLM_PROVIDER = originalProvider;
  });

  it("returns schema-conformant analyzer output in fallback mode", async () => {
    const originalKey = process.env.GOOGLE_API_KEY;
    const originalOpenAIKey = process.env.OPENAI_API_KEY;
    const originalProvider = process.env.LLM_PROVIDER;

    delete process.env.GOOGLE_API_KEY;
    delete process.env.OPENAI_API_KEY;
    process.env.LLM_PROVIDER = "deterministic";

    const output = await analyzeInterviewTurn({
      prompt: "Analyze the answer",
      latestAnswer:
        "Situation: the project was delayed. Task: I needed to realign the team. Action: I reset owners and clarified tradeoffs. Result: we shipped with fewer defects.",
      mode: "behavioral",
      currentPhase: "interview_round",
      answeredCount: 1,
      weakSkills: ["story structure"]
    });

    expect(output.summary).toBeTruthy();
    expect(["limited", "solid", "strong"]).toContain(output.answer_quality);
    expect(Array.isArray(output.follow_up_targets)).toBe(true);

    process.env.GOOGLE_API_KEY = originalKey;
    process.env.OPENAI_API_KEY = originalOpenAIKey;
    process.env.LLM_PROVIDER = originalProvider;
  });
});
