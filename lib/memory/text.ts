import type { InterviewMode, InterviewSession, MemoryEvent } from "@/lib/types";

function flattenValue(value: unknown, parts: string[], prefix?: string) {
  if (value == null) {
    return;
  }

  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
    parts.push(prefix ? `${prefix}: ${String(value)}` : String(value));
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => flattenValue(entry, parts, prefix));
    return;
  }

  if (typeof value === "object") {
    for (const [key, nested] of Object.entries(value)) {
      flattenValue(nested, parts, prefix ? `${prefix}.${key}` : key);
    }
  }
}

function modeFromContent(content: Record<string, unknown>) {
  return typeof content.mode === "string" ? (content.mode as InterviewMode) : null;
}

export function deriveSessionMetadata(params: {
  event: MemoryEvent;
  session?: InterviewSession | null;
}) {
  return {
    mode: params.session?.mode ?? modeFromContent(params.event.content),
    target_role:
      params.session?.target_role ??
      (typeof params.event.content.target_role === "string" ? params.event.content.target_role : null),
    focus_area:
      params.session?.focus_area ??
      (typeof params.event.content.focus_area === "string" ? params.event.content.focus_area : null)
  };
}

export function buildMemoryEmbeddingText(params: {
  event: MemoryEvent;
  session?: InterviewSession | null;
}) {
  const metadata = deriveSessionMetadata(params);
  const parts: string[] = [
    `tier: ${params.event.memory_tier}`,
    `event_type: ${params.event.event_type}`
  ];

  if (metadata.mode) {
    parts.push(`mode: ${metadata.mode}`);
  }

  if (metadata.target_role) {
    parts.push(`target_role: ${metadata.target_role}`);
  }

  if (metadata.focus_area) {
    parts.push(`focus_area: ${metadata.focus_area}`);
  }

  flattenValue(params.event.content, parts);

  return parts.join("\n");
}
