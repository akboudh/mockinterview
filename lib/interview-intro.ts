import type { InterviewMode } from "@/lib/types";

/** Spoken + persisted opening line before the first interview question. */
export function buildOpeningIntroLine(
  displayName: string | null | undefined,
  mode: InterviewMode,
  targetRole: string
) {
  const first = displayName?.trim().split(/\s+/)[0];
  const greet = first && first.length > 0 ? first : "there";
  const modeLabel = mode === "case" ? "case study" : mode;
  return `Hey ${greet}, great to have you here today. Let's start with your ${modeLabel} interview for the ${targetRole} role.`;
}
