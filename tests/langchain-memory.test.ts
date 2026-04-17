import { buildLangChainShortTermContext } from "@/lib/memory/langchain-short-term";

describe("LangChain short-term memory adapter", () => {
  it("summarizes recent transcript turns into a buffer-memory context item", async () => {
    const context = await buildLangChainShortTermContext([
      {
        memory_tier: "short_term",
        content: {
          speaker_type: "interviewer",
          content: "Walk me through how you would debug a slow API."
        },
        relevance_reason: "Most recent live-session transcript context"
      },
      {
        memory_tier: "short_term",
        content: {
          speaker_type: "student",
          content: "I would start by checking latency, traffic shape, and recent deployments."
        },
        relevance_reason: "Most recent live-session transcript context"
      },
      {
        memory_tier: "short_term",
        content: {
          current_phase: "interview_round",
          turn_type: "standard"
        },
        relevance_reason: "Persisted live agent runtime state"
      }
    ]);

    expect(context[0]?.content).toEqual(
      expect.objectContaining({
        conversation_history: expect.stringContaining("Human:")
      })
    );
    expect(JSON.stringify(context[0]?.content)).toContain("latency");
    expect(context[1]?.relevance_reason).toBe("Persisted live agent runtime state");
  });
});
