type ContextItem = {
  memory_tier: "short_term" | "episodic" | "long_term";
  content: Record<string, unknown>;
  relevance_reason: string;
};

const MAX_RESUME_LENGTH = 12000;

function compactWhitespace(value: string) {
  return value.replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function truncate(value: string, limit: number) {
  return value.length > limit ? `${value.slice(0, limit - 1).trimEnd()}…` : value;
}

export function normalizeResumeText(value: string) {
  return truncate(compactWhitespace(value), MAX_RESUME_LENGTH);
}

export function extractResumeHighlights(resumeText: string | null | undefined) {
  if (!resumeText) {
    return [];
  }

  const lines = normalizeResumeText(resumeText)
    .split(/\n+/)
    .map((line) => line.replace(/^[\s\-*•]+/, "").trim())
    .filter((line) => line.length >= 18);

  const preferred = lines.filter((line) =>
    /\b(led|built|launched|managed|shipped|designed|owned|intern|project|product|engineer|analyst|research|growth|platform|dashboard|app|feature|team|stakeholder|metrics?)\b/i.test(
      line
    )
  );

  const source = preferred.length ? preferred : lines;
  return Array.from(new Set(source.map((line) => truncate(line, 120)))).slice(0, 4);
}

function summarizeContent(content: Record<string, unknown>) {
  const resumeHighlights =
    Array.isArray(content.resume_highlights) &&
    content.resume_highlights.every((item) => typeof item === "string")
      ? (content.resume_highlights as string[])
      : [];

  if (resumeHighlights.length) {
    return `resume themes like ${resumeHighlights.slice(0, 2).join(" and ")}`;
  }

  if (typeof content.mode === "string" && typeof content.target_role === "string") {
    return `prior ${content.mode} practice for ${content.target_role}`;
  }

  if (typeof content.skill === "string" && typeof content.signal_type === "string") {
    return `${content.signal_type} signal around ${content.skill}`;
  }

  if (typeof content.skill_name === "string" && typeof content.signal_type === "string") {
    return `${content.signal_type} signal around ${content.skill_name}`;
  }

  if (typeof content.summary_text === "string") {
    return truncate(content.summary_text, 110);
  }

  if (
    typeof content.current_phase === "string" &&
    Array.isArray(content.follow_up_targets) &&
    content.follow_up_targets.length
  ) {
    const targets = (content.follow_up_targets as unknown[])
      .filter((item): item is string => typeof item === "string")
      .slice(0, 2);
    if (targets.length) {
      return `recent coaching targets like ${targets.join(" and ")}`;
    }
  }

  if (typeof content.notes === "string") {
    return truncate(content.notes, 110);
  }

  return null;
}

function uniqueSummaries(items: ContextItem[]) {
  return Array.from(
    new Set(items.map((item) => summarizeContent(item.content)).filter(Boolean) as string[])
  );
}

function joinHuman(items: string[]) {
  if (!items.length) {
    return "";
  }

  if (items.length === 1) {
    return items[0];
  }

  if (items.length === 2) {
    return `${items[0]} and ${items[1]}`;
  }

  return `${items.slice(0, -1).join(", ")}, and ${items.at(-1)}`;
}

export function buildPersonalizationSummary(params: {
  contextItems: ContextItem[];
  resumeText?: string | null;
  personalizationEnabled: boolean;
}) {
  const resumeHighlights = extractResumeHighlights(params.resumeText);
  const contextThemes = uniqueSummaries(params.contextItems).filter(
    (item) => !item.startsWith("resume themes like")
  );
  const resumeThemes = resumeHighlights
    .map((item) => `resume experience like ${item}`)
    .slice(0, 2);
  const themes = Array.from(
    new Set([...resumeThemes, ...contextThemes.slice(0, 2)])
  ).slice(0, 3);

  if (!themes.length) {
    return null;
  }

  if (params.personalizationEnabled) {
    return `Personalization is active. I’ll use ${joinHuman(themes)} to shape the interview.`;
  }

  return `Resume context is loaded. I’ll use ${joinHuman(themes)} to shape the interview.`;
}

export function formatContextItemsForPrompt(params: {
  contextItems: ContextItem[];
  resumeText?: string | null;
}) {
  const parts = uniqueSummaries(params.contextItems);
  const resumeHighlights = extractResumeHighlights(params.resumeText);

  if (resumeHighlights.length) {
    parts.unshift(`resume themes: ${resumeHighlights.join(" | ")}`);
  }

  return parts.length ? parts.slice(0, 5).join("\n") : "No prior context.";
}
