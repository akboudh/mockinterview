import { LocalSemanticEmbeddings } from "@/lib/memory/embeddings";
import { MemoryRepository, type EditableMemoryEventFields } from "@/lib/memory/repository";
import { MemoryEventRetriever } from "@/lib/memory/retriever";
import { buildMemoryEmbeddingText, deriveSessionMetadata } from "@/lib/memory/text";
import type {
  InterviewMode,
  MemoryEvent,
  MemoryListItem,
  MemoryTier,
  MemoryVectorRecord,
  RecalledContextItem,
  SkillSignal
} from "@/lib/types";

export interface RecallContextParams {
  session_id?: string | null;
  user_id: string;
  query_type: "short_term" | "episodic" | "long_term" | "mixed";
  query_text?: string | null;
  top_k?: number;
  mode?: InterviewMode | null;
}

export interface ListMemoryParams {
  user_id: string;
  session_id?: string | null;
  memory_tier?: MemoryTier | null;
  event_type?: string | null;
  mode?: InterviewMode | null;
  limit?: number;
}

function uniqueContextItems(items: RecalledContextItem[], limit: number) {
  const seen = new Set<string>();
  const output: RecalledContextItem[] = [];

  for (const item of items) {
    const key = JSON.stringify({
      memory_tier: item.memory_tier,
      content: item.content
    });

    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    output.push(item);

    if (output.length >= limit) {
      break;
    }
  }

  return output;
}

function signalToContext(signal: SkillSignal): RecalledContextItem {
  return {
    memory_tier: "long_term",
    content: {
      skill: signal.skill_name,
      notes: signal.notes,
      signal_type: signal.signal_type
    },
    relevance_reason: `Skill signal from historical evaluation: ${signal.signal_type}`
  };
}

export class MemoryService {
  readonly repository: MemoryRepository;
  readonly embeddings: LocalSemanticEmbeddings;

  constructor(params: {
    repository?: MemoryRepository;
    embeddings?: LocalSemanticEmbeddings;
  } = {}) {
    this.repository = params.repository ?? new MemoryRepository();
    this.embeddings = params.embeddings ?? new LocalSemanticEmbeddings();
  }

  private async buildVectorRecord(event: MemoryEvent) {
    const session = await this.repository.getSession(event.session_id);
    const embeddingText = buildMemoryEmbeddingText({
      event,
      session
    });
    const vector = await this.embeddings.embedQuery(embeddingText);
    const metadata = deriveSessionMetadata({
      event,
      session
    });
    const now = new Date().toISOString();

    return {
      event_id: event.event_id,
      user_id: event.user_id,
      session_id: event.session_id,
      memory_tier: event.memory_tier,
      event_type: event.event_type,
      mode: metadata.mode,
      target_role: metadata.target_role,
      focus_area: metadata.focus_area,
      embedding_model: this.embeddings.modelName,
      embedding_dimensions: this.embeddings.dimensions,
      embedding_text: embeddingText,
      vector,
      created_at: event.created_at,
      updated_at: event.updated_at ?? now
    } satisfies MemoryVectorRecord;
  }

  private async ensureIndexedMemories(userId: string) {
    const missing = await this.repository.findEventsMissingVectors(userId);

    for (const { event } of missing) {
      await this.repository.upsertVector(await this.buildVectorRecord(event));
    }
  }

  async saveEvent(params: {
    session_id: string;
    user_id: string;
    memory_tier: MemoryTier;
    event_type: string;
    content: Record<string, unknown>;
  }) {
    const now = new Date().toISOString();
    const event: MemoryEvent = {
      event_id: crypto.randomUUID(),
      session_id: params.session_id,
      user_id: params.user_id,
      memory_tier: params.memory_tier,
      event_type: params.event_type,
      content: params.content,
      embedding_ref: `vec-${crypto.randomUUID()}`,
      created_at: now,
      updated_at: now
    };

    await this.repository.createEvent(event);
    await this.repository.upsertVector(await this.buildVectorRecord(event));

    return event;
  }

  async listMemories(params: ListMemoryParams) {
    await this.ensureIndexedMemories(params.user_id);
    return this.repository.listEvents(params);
  }

  async updateMemoryEvent(params: {
    user_id: string;
    event_id: string;
    patch: EditableMemoryEventFields;
  }) {
    const updated = await this.repository.updateEvent(params);
    await this.repository.upsertVector(await this.buildVectorRecord(updated));
    return updated;
  }

  async deleteMemoryEvent(params: { user_id: string; event_id: string }) {
    return this.repository.deleteEvent(params);
  }

  async recallContext(params: RecallContextParams) {
    await this.ensureIndexedMemories(params.user_id);

    const queryText = params.query_text ?? "";
    const shortTermItems =
      params.session_id && (params.query_type === "short_term" || params.query_type === "mixed")
        ? await this.repository.getShortTermContext(params.session_id)
        : [];

    const retriever = new MemoryEventRetriever({
      repository: this.repository,
      embeddings: this.embeddings,
      userId: params.user_id,
      sessionId:
        params.query_type === "short_term" ? params.session_id ?? undefined : undefined,
      memoryTier: params.query_type === "mixed" ? undefined : params.query_type,
      mode: params.mode ?? undefined,
      topK: params.top_k ?? 5
    });

    const semanticDocs = queryText.trim()
      ? await retriever.getRelevantDocuments(queryText)
      : await retriever.getRelevantDocuments("");
    const eventItems = (await this.listMemories({
      user_id: params.user_id,
      limit: 250
    })).reduce<Record<string, MemoryListItem>>((accumulator, item) => {
      accumulator[item.event_id] = item;
      return accumulator;
    }, {});
    const semanticItems = semanticDocs
      .map((document) => {
        const item = eventItems[document.metadata.event_id];

        if (!item) {
          return null;
        }

        return {
          memory_tier: item.memory_tier,
          content: item.content,
          relevance_reason: document.metadata.relevance_reason
        } satisfies RecalledContextItem;
      })
      .filter(Boolean) as RecalledContextItem[];

    const signals = await this.repository.listSkillSignals(params.user_id);
    const signalItems =
      params.query_type === "mixed" || params.query_type === "long_term"
        ? signals.slice(0, 3).map(signalToContext)
        : [];

    return {
      context_items: uniqueContextItems(
        [...shortTermItems, ...semanticItems, ...signalItems],
        params.top_k ?? 8
      ),
      weak_skills: await this.getWeakSkills(params.user_id)
    };
  }

  async getWeakSkills(userId: string) {
    return this.repository.getKnownWeakSkills(userId);
  }

  async recordSkillSignal(params: {
    user_id: string;
    skill_name: string;
    signal_type: "strength" | "weakness" | "trend";
    source_session_id: string;
    source_evaluation_id: string;
    notes: string;
  }) {
    const signal: SkillSignal = {
      skill_signal_id: crypto.randomUUID(),
      user_id: params.user_id,
      skill_name: params.skill_name,
      signal_type: params.signal_type,
      source_session_id: params.source_session_id,
      source_evaluation_id: params.source_evaluation_id,
      notes: params.notes,
      created_at: new Date().toISOString()
    };

    await this.repository.appendSkillSignal(signal);
    return signal;
  }
}

export const defaultMemoryService = new MemoryService();
