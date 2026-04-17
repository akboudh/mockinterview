import type { Document } from "@langchain/core/documents";
import type { EmbeddingsInterface } from "@langchain/core/embeddings";

import type { MemoryDocumentMetadata } from "@/lib/memory/retriever";
import { MemoryRepository } from "@/lib/memory/repository";
import type { InterviewMode, MemoryTier } from "@/lib/types";

export interface MemoryEmbeddings extends EmbeddingsInterface {
  modelName: string;
  dimensions: number;
}

export interface SemanticMemoryRetriever {
  getRelevantDocuments(query: string): Promise<Array<Document<MemoryDocumentMetadata>>>;
}

export interface SemanticMemoryRetrieverFactoryParams {
  repository: MemoryRepository;
  embeddings: MemoryEmbeddings;
  userId: string;
  sessionId?: string | null;
  memoryTier?: MemoryTier | null;
  mode?: InterviewMode | null;
  topK?: number;
}

export type SemanticMemoryRetrieverFactory = (
  params: SemanticMemoryRetrieverFactoryParams
) => SemanticMemoryRetriever;
