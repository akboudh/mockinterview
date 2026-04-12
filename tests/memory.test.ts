import { recallContext, saveEvent } from "@/lib/services/memory-service";
import { resetDb } from "@/tests/test-utils";

describe("memory service", () => {
  beforeEach(async () => {
    await resetDb();
  });

  it("saves events and recalls them", async () => {
    const event = await saveEvent({
      session_id: "sess-memory-test",
      user_id: "demo-student",
      memory_tier: "long_term",
      event_type: "skill_gap",
      content: {
        skill: "concise storytelling"
      }
    });

    expect(event.event_id).toBeTruthy();

    const recall = await recallContext({
      user_id: "demo-student",
      query_type: "long_term",
      query_text: "storytelling"
    });

    expect(recall.context_items.some((item) => JSON.stringify(item.content).includes("storytelling"))).toBe(true);
  });
});
