import { readDb, updateDb } from "@/lib/db";
import type {
  InterviewMode,
  InterviewSession,
  MemoryEvent,
  MemoryListItem,
  MemoryTier,
  MemoryVectorRecord,
  MockInterviewDB,
  SkillSignal
} from "@/lib/types";
import { deriveKnownWeakSkills } from "@/lib/memory/personalization-rules";

type DbReader = typeof readDb;
type DbUpdater = typeof updateDb;

export interface MemoryRepositoryDeps {
  readDb: DbReader;
  updateDb: DbUpdater;
}

export interface MemoryEventFilters {
  user_id: string;
  session_id?: string | null;
  memory_tier?: MemoryTier | null;
  event_type?: string | null;
  mode?: InterviewMode | null;
  limit?: number;
}

export interface EditableMemoryEventFields {
  memory_tier?: MemoryTier;
  event_type?: string;
  content?: Record<string, unknown>;
}

function sortNewest<T extends { updated_at?: string | null; created_at: string }>(items: T[]) {
  return [...items].sort(
    (left, right) =>
      new Date(right.updated_at ?? right.created_at).getTime() -
      new Date(left.updated_at ?? left.created_at).getTime()
  );
}

function sessionMode(session: InterviewSession | undefined, fallback: Record<string, unknown>) {
  if (session?.mode) {
    return session.mode;
  }

  return typeof fallback.mode === "string" ? (fallback.mode as InterviewMode) : null;
}

function enrichEvent(
  db: MockInterviewDB,
  event: MemoryEvent,
  vector: MemoryVectorRecord | undefined
): MemoryListItem {
  const session = db.sessions.find((entry) => entry.session_id === event.session_id);

  return {
    ...event,
    mode: vector?.mode ?? sessionMode(session, event.content),
    target_role:
      vector?.target_role ??
      session?.target_role ??
      (typeof event.content.target_role === "string" ? event.content.target_role : null),
    focus_area:
      vector?.focus_area ??
      session?.focus_area ??
      (typeof event.content.focus_area === "string" ? event.content.focus_area : null),
    has_vector: Boolean(vector)
  };
}

export class MemoryRepository {
  private deps: MemoryRepositoryDeps;

  constructor(deps: Partial<MemoryRepositoryDeps> = {}) {
    this.deps = {
      readDb,
      updateDb,
      ...deps
    };
  }

  async createEvent(event: MemoryEvent) {
    await this.deps.updateDb((db) => ({
      ...db,
      memoryEvents: [...db.memoryEvents, event]
    }));

    return event;
  }

  async listEvents(filters: MemoryEventFilters) {
    const db = await this.deps.readDb();
    const items = db.memoryEvents.filter((event) => {
      if (event.user_id !== filters.user_id) {
        return false;
      }

      if (filters.session_id && event.session_id !== filters.session_id) {
        return false;
      }

      if (filters.memory_tier && event.memory_tier !== filters.memory_tier) {
        return false;
      }

      if (filters.event_type && event.event_type !== filters.event_type) {
        return false;
      }

      if (filters.mode) {
        const session = db.sessions.find((entry) => entry.session_id === event.session_id);
        const derivedMode = sessionMode(session, event.content);
        if (derivedMode !== filters.mode) {
          return false;
        }
      }

      return true;
    });

    return sortNewest(items)
      .slice(0, filters.limit ?? 100)
      .map((event) =>
        enrichEvent(
          db,
          event,
          db.memoryVectors.find((vector) => vector.event_id === event.event_id)
        )
      );
  }

  async getEventForUser(userId: string, eventId: string) {
    const db = await this.deps.readDb();
    return (
      db.memoryEvents.find((event) => event.event_id === eventId && event.user_id === userId) ?? null
    );
  }

  async updateEvent(params: {
    user_id: string;
    event_id: string;
    patch: EditableMemoryEventFields;
  }) {
    const existing = await this.getEventForUser(params.user_id, params.event_id);

    if (!existing) {
      throw new Error("Memory event not found.");
    }

    const updated: MemoryEvent = {
      ...existing,
      memory_tier: params.patch.memory_tier ?? existing.memory_tier,
      event_type: params.patch.event_type ?? existing.event_type,
      content: params.patch.content ?? existing.content,
      updated_at: new Date().toISOString()
    };

    await this.deps.updateDb((db) => ({
      ...db,
      memoryEvents: db.memoryEvents.map((event) =>
        event.event_id === updated.event_id ? updated : event
      )
    }));

    return updated;
  }

  async deleteEvent(params: { user_id: string; event_id: string }) {
    const existing = await this.getEventForUser(params.user_id, params.event_id);

    if (!existing) {
      return false;
    }

    await this.deps.updateDb((db) => ({
      ...db,
      memoryEvents: db.memoryEvents.filter((event) => event.event_id !== params.event_id),
      memoryVectors: db.memoryVectors.filter((vector) => vector.event_id !== params.event_id)
    }));

    return true;
  }

  async upsertVector(record: MemoryVectorRecord) {
    await this.deps.updateDb((db) => ({
      ...db,
      memoryVectors: db.memoryVectors.some((entry) => entry.event_id === record.event_id)
        ? db.memoryVectors.map((entry) => (entry.event_id === record.event_id ? record : entry))
        : [...db.memoryVectors, record]
    }));

    return record;
  }

  async listVectors(filters: MemoryEventFilters) {
    const db = await this.deps.readDb();
    const items = db.memoryVectors.filter((vector) => {
      if (vector.user_id !== filters.user_id) {
        return false;
      }

      if (filters.session_id && vector.session_id !== filters.session_id) {
        return false;
      }

      if (filters.memory_tier && vector.memory_tier !== filters.memory_tier) {
        return false;
      }

      if (filters.event_type && vector.event_type !== filters.event_type) {
        return false;
      }

      if (filters.mode && vector.mode !== filters.mode) {
        return false;
      }

      return true;
    });

    return sortNewest(items).slice(0, filters.limit ?? 100);
  }

  async findEventsMissingVectors(userId: string) {
    const db = await this.deps.readDb();
    const indexedIds = new Set(db.memoryVectors.map((vector) => vector.event_id));

    return db.memoryEvents
      .filter((event) => event.user_id === userId && !indexedIds.has(event.event_id))
      .map((event) => ({
        event,
        session: db.sessions.find((entry) => entry.session_id === event.session_id) ?? null
      }));
  }

  async getShortTermContext(sessionId: string) {
    const db = await this.deps.readDb();

    return [
      ...db.messages
        .filter((message) => message.session_id === sessionId)
        .slice(-4)
        .map((message) => ({
          memory_tier: "short_term" as const,
          content: {
            speaker_type: message.speaker_type,
            content: message.content
          },
          relevance_reason: "Most recent live-session transcript context"
        })),
      ...db.agentSessionStates
        .filter((state) => state.session_id === sessionId)
        .map((state) => ({
          memory_tier: "short_term" as const,
          content: {
            current_phase: state.current_phase,
            turn_type: state.turn_type,
            follow_up_targets: state.follow_up_targets,
            conversation_summary: state.conversation_summary
          },
          relevance_reason: "Persisted live agent runtime state"
        }))
    ];
  }

  async listSkillSignals(userId: string) {
    const db = await this.deps.readDb();
    return db.skillSignals
      .filter((signal) => signal.user_id === userId)
      .sort(
        (left, right) =>
          new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
      );
  }

  async appendSkillSignal(signal: SkillSignal) {
    await this.deps.updateDb((db) => {
      const nextSignals = [...db.skillSignals, signal];
      const user = db.users.find((entry) => entry.user_id === signal.user_id) ?? null;
      const knownWeakSkills = deriveKnownWeakSkills({
        user,
        skillSignals: nextSignals.filter((entry) => entry.user_id === signal.user_id)
      });

      return {
        ...db,
        skillSignals: nextSignals,
        users: db.users.map((entry) =>
          entry.user_id === signal.user_id
            ? {
                ...entry,
                known_weak_skills: knownWeakSkills,
                updated_at: new Date().toISOString()
              }
            : entry
        )
      };
    });

    return signal;
  }

  async getKnownWeakSkills(userId: string) {
    const db = await this.deps.readDb();
    const user = db.users.find((entry) => entry.user_id === userId) ?? null;
    const userSignals = db.skillSignals.filter((signal) => signal.user_id === userId);

    return deriveKnownWeakSkills({
      user,
      skillSignals: userSignals
    });
  }

  async getSession(sessionId: string) {
    const db = await this.deps.readDb();
    return db.sessions.find((entry) => entry.session_id === sessionId) ?? null;
  }
}
