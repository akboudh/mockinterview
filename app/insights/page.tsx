import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { SectionShell } from "@/components/ui/section-shell";
import { TrendChartCard } from "@/components/insights/trend-chart-card";
import { requireCurrentUser } from "@/lib/auth";
import { getProgressInsights } from "@/lib/services/session-service";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const user = await requireCurrentUser();
  const insights = await getProgressInsights(user.user_id);

  return (
    <main className="page-shell py-10">
      <SectionShell
        eyebrow="Progress insights"
        title="Longitudinal growth becomes visible once transcript and rubric history accumulate."
        description="This page demonstrates the value of long-term memory by surfacing recurring strengths, recurring weak skills, mode-specific trends, and recommended focus areas."
      >
        {insights.sessions.length ? (
          <div className="grid gap-6">
            <div className="grid gap-4 lg:grid-cols-2">
              <TrendChartCard
                title="Recurring strengths"
                items={insights.recurringStrengths.map(([label, value]) => ({
                  label,
                  value,
                  subtitle: "Repeated strength signal across saved evaluations."
                }))}
              />
              <TrendChartCard
                title="Recurring weak skills"
                items={insights.recurringWeaknesses.map(([label, value]) => ({
                  label,
                  value,
                  subtitle: "Historical weakness signal informing personalization."
                }))}
              />
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
              <TrendChartCard
                title="Mode-specific trends"
                items={insights.modeTrends.map((item) => ({
                  label: item.mode,
                  value: item.averageScore,
                  subtitle: `${item.count} session(s) captured`
                }))}
              />
              <Card className="rounded-[28px] p-5">
                <h3 className="text-xl font-semibold tracking-[-0.04em] text-white">
                  Recommended focus areas
                </h3>
                <ul className="mt-5 grid gap-3 text-sm leading-7 text-white/66">
                  {insights.recommendedFocusAreas.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
                <p className="mt-5 text-sm text-white/54">
                  The current MVP question limit is {insights.questionLimit} answers per session.
                </p>
              </Card>
            </div>
          </div>
        ) : (
          <EmptyState
            title="No progress insights yet"
            description="Once the student completes a session, long-term memory will start surfacing repeated patterns here."
            href="/setup"
            actionLabel="Start a session"
          />
        )}
      </SectionShell>
    </main>
  );
}
