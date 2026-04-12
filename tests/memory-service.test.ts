import { readDb } from "@/lib/db";
import { generateSyntheticMemoryDataset } from "@/lib/memory/synthetic-data";
import {
  deleteMemoryEvent,
  getWeakSkills,
  listMemoryEvents,
  recallContext,
  recordSkillSignal,
  saveEvent,
  updateMemoryEvent
} from "@/lib/services/memory-service";
import { startSession } from "@/lib/services/session-service";
import { resetDb } from "@/tests/test-utils";

describe("memory service facade", () => {
  beforeEach(async () => {
    await resetDb();
  });

  async function createSession(overrides: Partial<Parameters<typeof startSession>[0]> = {}) {
    return startSession({
      user_id: "demo-student",
      target_role: "Backend Engineer Intern",
      mode: "technical",
      focus_area: "performance",
      confidence_self_rating: 3,
      personalization_enabled: true,
      self_critique_enabled: false,
      notes: "Memory test session",
      ...overrides
    });
  }

  it("persists saved memory events and their vectors", async () => {
    const session = await createSession();
    const event = await saveEvent({
      session_id: session.session_id,
      user_id: "demo-student",
      memory_tier: "long_term",
      event_type: "skill_gap",
      content: {
        skill: "tradeoff articulation",
        notes: "Needs clearer explanation of technical constraints."
      }
    });

    const db = await readDb();
    const storedEvent = db.memoryEvents.find((entry) => entry.event_id === event.event_id);
    const storedVector = db.memoryVectors.find((entry) => entry.event_id === event.event_id);

    expect(storedEvent?.updated_at).toBeTruthy();
    expect(storedVector?.embedding_text).toContain("tradeoff articulation");
    expect(storedVector?.vector.length).toBeGreaterThan(50);
  });

  it("retrieves semantically relevant memories by meaning, not only literal keyword overlap", async () => {
    const session = await createSession();

    await saveEvent({
      session_id: session.session_id,
      user_id: "demo-student",
      memory_tier: "long_term",
      event_type: "system_lesson",
      content: {
        summary: "Reduced latency in a backend service by adding caching and tracing."
      }
    });
    await saveEvent({
      session_id: session.session_id,
      user_id: "demo-student",
      memory_tier: "long_term",
      event_type: "behavioral_note",
      content: {
        summary: "Needs tighter story structure in behavioral answers."
      }
    });

    const recall = await recallContext({
      user_id: "demo-student",
      query_type: "long_term",
      query_text: "How did I improve slow service performance?",
      top_k: 2
    });

    expect(JSON.stringify(recall.context_items[0]?.content)).toContain("latency");
    expect(recall.context_items[0]?.relevance_reason).toContain("Semantic similarity");
  });

  it("supports tier-aware retrieval plus update and delete CRUD flows", async () => {
    const session = await createSession({
      mode: "behavioral",
      target_role: "Product Manager Intern",
      focus_area: "leadership"
    });
    const episodic = await saveEvent({
      session_id: session.session_id,
      user_id: "demo-student",
      memory_tier: "episodic",
      event_type: "session_summary",
      content: {
        summary_text: "Leadership answer needed clearer STAR structure."
      }
    });
    const longTerm = await saveEvent({
      session_id: session.session_id,
      user_id: "demo-student",
      memory_tier: "long_term",
      event_type: "skill_gap",
      content: {
        skill: "story structure",
        notes: "Needs tighter context and result framing."
      }
    });

    const episodicRecall = await recallContext({
      user_id: "demo-student",
      query_type: "episodic",
      query_text: "leadership summary"
    });
    expect(episodicRecall.context_items.every((item) => item.memory_tier === "episodic")).toBe(true);

    await updateMemoryEvent({
      user_id: "demo-student",
      event_id: longTerm.event_id,
      patch: {
        content: {
          skill: "story structure",
          notes: "Improved structure, but measurable results are still thin."
        }
      }
    });

    const listed = await listMemoryEvents({
      user_id: "demo-student",
      memory_tier: "long_term"
    });
    expect(
      listed.some((item) => JSON.stringify(item.content).includes("measurable results"))
    ).toBe(true);

    await deleteMemoryEvent({
      user_id: "demo-student",
      event_id: episodic.event_id
    });

    const afterDelete = await listMemoryEvents({
      user_id: "demo-student"
    });
    expect(afterDelete.some((item) => item.event_id === episodic.event_id)).toBe(false);
  });

  it("updates personalization weak-skill state from recorded signals", async () => {
    const session = await createSession();

    await recordSkillSignal({
      user_id: "demo-student",
      skill_name: "tradeoff articulation",
      signal_type: "weakness",
      source_session_id: session.session_id,
      source_evaluation_id: "eval-weak-1",
      notes: "Needs stronger articulation of technical constraints."
    });

    const weakSkills = await getWeakSkills("demo-student");
    const db = await readDb();
    const user = db.users.find((entry) => entry.user_id === "demo-student");

    expect(weakSkills).toContain("tradeoff articulation");
    expect(user?.known_weak_skills).toContain("tradeoff articulation");
  });

  it("generates realistic synthetic memory data across users, modes, and vectors", async () => {
    const synthetic = await generateSyntheticMemoryDataset(new Date("2026-04-05T12:00:00.000Z"));

    expect(synthetic.users.length).toBeGreaterThanOrEqual(3);
    expect(new Set(synthetic.sessions.map((session) => session.mode))).toEqual(
      new Set(["behavioral", "technical", "case"])
    );
    expect(synthetic.memoryEvents.length).toBeGreaterThanOrEqual(9);
    expect(synthetic.memoryVectors.length).toBe(synthetic.memoryEvents.length);
    expect(synthetic.skillSignals.some((signal) => signal.signal_type === "weakness")).toBe(true);
  });
});
