import { Document } from "@langchain/core/documents";
import { BaseRetriever } from "@langchain/core/retrievers";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

import { cosineSimilarity } from "@/lib/memory/embeddings";
import { MemoryRepository } from "@/lib/memory/repository";
import type { InterviewMode, MemoryTier } from "@/lib/types";

export interface MemoryDocumentMetadata {
  event_id: string;
  session_id: string;
  memory_tier: MemoryTier;
  event_type: string;
  similarity_score: number;
  relevance_reason: string;
}

export class MemoryEventRetriever extends BaseRetriever<MemoryDocumentMetadata> {
  lc_namespace = ["mockinterview", "memory", "retriever"];

  private repository: MemoryRepository;
  private embeddings: EmbeddingsInterface;
  private userId: string;
  private sessionId?: string | null;
  private memoryTier?: MemoryTier | null;
  private mode?: InterviewMode | null;
  private topK: number;

  constructor(params: {
    repository: MemoryRepository;
    embeddings: EmbeddingsInterface;
    userId: string;
    sessionId?: string | null;
    memoryTier?: MemoryTier | null;
    mode?: InterviewMode | null;
    topK?: number;
  }) {
    super({});
    this.repository = params.repository;
    this.embeddings = params.embeddings;
    this.userId = params.userId;
    this.sessionId = params.sessionId ?? null;
    this.memoryTier = params.memoryTier ?? null;
    this.mode = params.mode ?? null;
    this.topK = params.topK ?? 5;
  }

  async _getRelevantDocuments(query: string) {
    const candidates = await this.repository.listVectors({
      user_id: this.userId,
      session_id: this.sessionId ?? undefined,
      memory_tier: this.memoryTier ?? undefined,
      mode: this.mode ?? undefined,
      limit: 250
    });

    if (!candidates.length) {
      return [];
    }

    if (!query.trim()) {
      return candidates.slice(0, this.topK).map(
        (candidate) =>
          new Document<MemoryDocumentMetadata>({
            id: candidate.event_id,
            pageContent: candidate.embedding_text,
            metadata: {
              event_id: candidate.event_id,
              session_id: candidate.session_id,
              memory_tier: candidate.memory_tier,
              event_type: candidate.event_type,
              similarity_score: 0,
              relevance_reason: `Recent ${candidate.memory_tier.replace("_", " ")} memory`
            }
          })
      );
    }

    const queryVector = await this.embeddings.embedQuery(query);

    return candidates
      .map((candidate) => {
        const similarity = cosineSimilarity(queryVector, candidate.vector);
        return {
          candidate,
          similarity
        };
      })
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, this.topK)
      .map(
        ({ candidate, similarity }) =>
          new Document<MemoryDocumentMetadata>({
            id: candidate.event_id,
            pageContent: candidate.embedding_text,
            metadata: {
              event_id: candidate.event_id,
              session_id: candidate.session_id,
              memory_tier: candidate.memory_tier,
              event_type: candidate.event_type,
              similarity_score: similarity,
              relevance_reason: `Semantic similarity ${similarity.toFixed(3)} via ${candidate.embedding_model}`
            }
          })
      );
  }
}
