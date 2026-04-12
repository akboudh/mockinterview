import { defaultMemoryService } from "@/lib/memory/service";
import type { InterviewMode, MemoryTier } from "@/lib/types";

export async function saveEvent(params: {
  session_id: string;
  user_id: string;
  memory_tier: MemoryTier;
  event_type: string;
  content: Record<string, unknown>;
}) {
  return defaultMemoryService.saveEvent(params);
}

export async function recallContext(params: {
  session_id?: string | null;
  user_id: string;
  query_type: "short_term" | "episodic" | "long_term" | "mixed";
  query_text?: string | null;
  top_k?: number;
  mode?: InterviewMode | null;
}) {
  return defaultMemoryService.recallContext(params);
}

export async function listMemoryEvents(params: {
  user_id: string;
  session_id?: string | null;
  memory_tier?: MemoryTier | null;
  event_type?: string | null;
  mode?: InterviewMode | null;
  limit?: number;
}) {
  return defaultMemoryService.listMemories(params);
}

export async function updateMemoryEvent(params: {
  user_id: string;
  event_id: string;
  patch: {
    memory_tier?: MemoryTier;
    event_type?: string;
    content?: Record<string, unknown>;
  };
}) {
  return defaultMemoryService.updateMemoryEvent(params);
}

export async function deleteMemoryEvent(params: { user_id: string; event_id: string }) {
  return defaultMemoryService.deleteMemoryEvent(params);
}

export async function getWeakSkills(userId: string) {
  return defaultMemoryService.getWeakSkills(userId);
}

export async function recordSkillSignal(params: {
  user_id: string;
  skill_name: string;
  signal_type: "strength" | "weakness" | "trend";
  source_session_id: string;
  source_evaluation_id: string;
  notes: string;
}) {
  return defaultMemoryService.recordSkillSignal(params);
}
