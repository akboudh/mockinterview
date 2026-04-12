import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackScoreCard } from "@/components/results/feedback-score-card";
import { StarBreakdownCard } from "@/components/results/star-breakdown-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import { formatDateTime } from "@/lib/utils";
import { getSessionSummary } from "@/lib/services/session-service";

export default async function ResultsPage({
  params
}: {
  params: Promise<{ sessionId: string }>;
}) {
  try {
    const user = await requireCurrentUser();
    const { sessionId } = await params;
    const summary = await getSessionSummary(sessionId, user.user_id);
    const latestEvaluation = summary.evaluations[summary.evaluations.length - 1];

    return (
      <main className="page-shell py-10">
        <div className="grid gap-6">
          <section className="premium-panel rounded-[36px] p-8">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-white/48">Session results</p>
                <h1 className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">
                  {summary.session.target_role}
                </h1>
                <p className="mt-3 max-w-3xl text-white/64">
                  {latestEvaluation?.overall_summary ??
                    "Structured feedback becomes available once at least one answer is evaluated."}
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Badge>
                  {summary.session.mode}
                </Badge>
                <Badge>
                  {summary.agent_runtime.current_phase}
                </Badge>
                <Badge>
                  {summary.session.status}
                </Badge>
              </div>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-6">
              {[
                ["Mode", summary.session.mode],
                ["Current phase", summary.agent_runtime.current_phase],
                ["Session time", formatDateTime(summary.session.started_at)],
                ["Questions answered", String(summary.messages.filter((message) => message.speaker_type === "student").length)],
                ["Turn count", String(summary.agent_runtime.turn_count)],
                ["Session ID", summary.session.session_id.slice(0, 8)],
                ["Overall average", `${summary.scoreSummary.overallAverage} / 5`]
              ].map(([label, value]) => (
                <Card key={label} className="rounded-[24px] p-4">
                  <p className="text-sm text-white/52">{label}</p>
                  <p className="mt-2 break-all text-white">{value}</p>
                </Card>
              ))}
            </div>
          </section>

          <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
            <div className="grid gap-6">
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                <FeedbackScoreCard
                  label="Clarity"
                  score={summary.scoreSummary.clarity}
                  description="How understandable and concise the answer sounded."
                />
                <FeedbackScoreCard
                  label="Structure"
                  score={summary.scoreSummary.structure}
                  description="How well the response followed a coherent logic or STAR shape."
                />
                <FeedbackScoreCard
                  label="Relevance"
                  score={summary.scoreSummary.relevance}
                  description="How tightly the response answered the prompt and role context."
                />
                <FeedbackScoreCard
                  label="Soft skills"
                  score={summary.scoreSummary.softSkills}
                  description="How strongly communication, empathy, leadership, and poise showed up."
                />
              </div>

              {latestEvaluation ? (
                <Card className="rounded-[34px] p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/48">STAR breakdown</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <StarBreakdownCard title="Situation" content={latestEvaluation.star_situation} />
                    <StarBreakdownCard title="Task" content={latestEvaluation.star_task} />
                    <StarBreakdownCard title="Action" content={latestEvaluation.star_action} />
                    <StarBreakdownCard title="Result" content={latestEvaluation.star_result} />
                  </div>
                </Card>
              ) : null}

              <Card className="rounded-[34px] p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-white/48">Strengths and improvement areas</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">Strengths</h2>
                    <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/64">
                      {(summary.strengths.length ? summary.strengths : ["Structured communication and steady answer pacing"]).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">Improvement areas</h2>
                    <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/64">
                      {(summary.weaknesses.length ? summary.weaknesses : ["Quantify impact more explicitly", "Tighten the opening structure"]).map((item) => (
                        <li key={item}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </Card>

              {latestEvaluation ? (
                <Card className="rounded-[34px] p-6">
                  <p className="text-xs uppercase tracking-[0.28em] text-white/48">Actionable growth tips</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                      <h3 className="text-lg font-semibold text-white">Actionable feedback</h3>
                      <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/64">
                        {latestEvaluation.actionable_feedback.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[26px] border border-white/10 bg-white/5 p-5">
                      <h3 className="text-lg font-semibold text-white">Growth tips</h3>
                      <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/64">
                        {latestEvaluation.growth_tips.map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {latestEvaluation.self_critique_output ? (
                    <div className="mt-4 rounded-[26px] border border-white/10 bg-white/5 p-5">
                      <h3 className="text-lg font-semibold text-white">Evaluator self-critique</h3>
                      <p className="mt-3 text-sm leading-7 text-white/64">
                        {latestEvaluation.self_critique_output}
                      </p>
                    </div>
                  ) : null}
                </Card>
              ) : null}
            </div>

            <div className="grid gap-6">
              <Card className="rounded-[34px] p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-white/48">Transcript preview</p>
                <div className="mt-5 grid gap-3">
                  {summary.messages.slice(0, 6).map((message) => (
                    <div key={message.message_id} className="rounded-[22px] border border-white/10 bg-white/5 p-4">
                      <p className="text-xs uppercase tracking-[0.2em] text-white/36">
                        {message.speaker_type}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/68">{message.content}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-[34px] p-6">
                <p className="text-xs uppercase tracking-[0.28em] text-white/48">Next-session recommendation</p>
                <p className="mt-4 text-sm leading-7 text-white/64">
                  {summary.nextSessionRecommendation}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Button asChild variant="secondary">
                    <Link href="/setup">Run another session</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/insights">Open progress insights</Link>
                  </Button>
                </div>
              </Card>
            </div>
          </section>
        </div>
      </main>
    );
  } catch {
    notFound();
  }
}
