import { Activity, LineChart, Target } from "lucide-react";

import { Reveal } from "@/components/motion/reveal";
import { TrendChartCard } from "@/components/insights/trend-chart-card";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { SectionShell } from "@/components/ui/section-shell";
import { requireCurrentUser } from "@/lib/auth";
import { getProgressInsights } from "@/lib/services/session-service";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await requireCurrentUser();
  const insights = await getProgressInsights(user.user_id);

  const sessionCount = insights.sessions.length;
  const numericScores = insights.sessions
    .map((s) => Number((s as { summary_score?: number | null }).summary_score))
    .filter((n) => typeof n === "number" && !Number.isNaN(n) && n > 0);
  const avgScore =
    numericScores.length > 0
      ? (numericScores.reduce((a, b) => a + b, 0) / numericScores.length).toFixed(1)
      : null;
  const focusCount = insights.recommendedFocusAreas.length;

  return (
    <main className="page-shell py-8 pb-14 md:py-10">
      <SectionShell
        eyebrow="Progress insights"
        title="See what repeats—and what to drill next."
        description="Strengths, weak skills, and mode averages come from saved evaluations and long-term signals."
      >
        {insights.sessions.length ? (
          <div className="grid gap-8">
            <Reveal y={18}>
              <div className="grid gap-4 sm:grid-cols-3">
                {[
                  {
                    icon: Activity,
                    label: "Sessions",
                    value: String(sessionCount),
                    hint: "Completed runs in your history"
                  },
                  {
                    icon: LineChart,
                    label: "Avg. rubric",
                    value: avgScore ?? "—",
                    hint: "Mean score across sessions"
                  },
                  {
                    icon: Target,
                    label: "Focus areas",
                    value: String(focusCount),
                    hint: "Top weaknesses to prioritize"
                  }
                ].map((stat) => (
                  <Card
                    key={stat.label}
                    className="rounded-[30px] border border-sky-200/15 bg-[linear-gradient(145deg,rgba(121,199,255,0.1),rgba(15,28,42,0.5))] p-5 transition duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:border-sky-200/25"
                  >
                    <stat.icon className="h-5 w-5 text-mist" aria-hidden />
                    <p className="mt-3 text-xs uppercase tracking-[0.2em] text-white/46">{stat.label}</p>
                    <p className="mt-1 font-display text-4xl font-semibold tracking-[-0.05em] text-white">
                      {stat.value}
                    </p>
                    <p className="mt-2 text-sm text-white/55">{stat.hint}</p>
                  </Card>
                ))}
              </div>
            </Reveal>

            <div className="grid gap-6">
              <Reveal delay={0.06} y={20}>
                <div className="grid gap-4 lg:grid-cols-2">
                  <TrendChartCard
                    className="border border-white/12 bg-white/[0.03]"
                    title="Recurring strengths"
                    items={insights.recurringStrengths.map(([label, value]) => ({
                      label,
                      value,
                      subtitle: "Seen often in your evaluations."
                    }))}
                  />
                  <TrendChartCard
                    className="border border-white/12 bg-white/[0.03]"
                    title="Recurring weak skills"
                    items={insights.recurringWeaknesses.map(([label, value]) => ({
                      label,
                      value,
                      subtitle: "Feeds personalization and practice focus."
                    }))}
                  />
                </div>
              </Reveal>

              <Reveal delay={0.1} y={20}>
                <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                  <TrendChartCard
                    className="border border-white/12 bg-white/[0.03]"
                    title="Scores by mode"
                    items={insights.modeTrends.map((item) => ({
                      label: item.mode.charAt(0).toUpperCase() + item.mode.slice(1),
                      value: item.averageScore,
                      subtitle: `${item.count} session(s)`
                    }))}
                  />
                  <Card className="rounded-[30px] border border-coral/20 bg-[linear-gradient(180deg,rgba(255,132,97,0.08),rgba(10,20,34,0.4))] p-6">
                    <h3 className="font-display text-xl font-semibold tracking-[-0.04em] text-white">
                      Recommended focus
                    </h3>
                    <ul className="mt-5 grid list-none gap-3">
                      {insights.recommendedFocusAreas.map((item, i) => (
                        <li
                          key={item}
                          className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black/15 px-4 py-3 text-sm text-white/75"
                        >
                          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/10 text-xs font-medium text-mist">
                            {i + 1}
                          </span>
                          <span>{item}</span>
                        </li>
                      ))}
                    </ul>
                  </Card>
                </div>
              </Reveal>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No insights yet"
            description="Finish a session to unlock trends, recurring skills, and suggested focus areas."
            href="/setup"
            actionLabel="Start a session"
          />
        )}
      </SectionShell>
    </main>
  );
}
