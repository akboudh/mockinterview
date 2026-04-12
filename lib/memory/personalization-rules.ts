import type { SkillSignal, UserProfile } from "@/lib/types";

function uniqueLatest(values: string[], limit: number) {
  return Array.from(new Set(values)).slice(0, limit);
}

export function deriveKnownWeakSkills(params: {
  user: UserProfile | null | undefined;
  skillSignals: SkillSignal[];
  limit?: number;
}) {
  const limit = params.limit ?? 5;
  const signalWeaknesses = params.skillSignals
    .filter((signal) => signal.signal_type === "weakness")
    .sort(
      (left, right) =>
        new Date(right.created_at).getTime() - new Date(left.created_at).getTime()
    )
    .map((signal) => signal.skill_name);

  const persistedWeaknesses = params.user?.known_weak_skills ?? [];

  return uniqueLatest([...signalWeaknesses, ...persistedWeaknesses], limit);
}
