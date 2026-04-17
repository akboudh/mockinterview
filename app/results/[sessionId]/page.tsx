import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedbackScoreCard } from "@/components/results/feedback-score-card";
import { StarBreakdownCard } from "@/components/results/star-breakdown-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireCurrentUser } from "@/lib/auth";
import { getSessionSummary } from "@/lib/services/session-service";
import { formatDateTime } from "@/lib/utils";

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
    const answeredCount = summary.messages.filter((message) => message.speaker_type === "student").length;
    const mentorFeedback = summary.mentorInterventions
      .filter((i) => i.intervention_type === "supplemental_feedback")
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const summaryRows = [
      ["Mode", summary.session.mode],
      ["Phase", summary.agent_runtime.current_phase],
      ["Started", formatDateTime(summary.session.started_at)],
      ["Answers", String(answeredCount)],
      ["Turns", String(summary.agent_runtime.turn_count)],
      ["Session ID", summary.session.session_id.slice(0, 8)],
      ["Overall average", `${summary.scoreSummary.overallAverage} / 5`]
    ];

    return (
      <main className="page-shell py-10">
        <div className="grid gap-6">
          <section className="premium-panel hero-glow rounded-[40px] px-6 py-7 md:px-8 md:py-8">
            <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
              <div>
                <p className="eyebrow-copy text-white/48">Session results</p>
                <h1 className="mt-3 font-display text-4xl font-semibold tracking-[-0.05em] text-white md:text-5xl">
                  {summary.session.target_role}
                </h1>
                <p className="mt-4 max-w-3xl text-sm leading-7 text-white/64 md:text-base">
                  {latestEvaluation?.overall_summary ??
                    "Structured feedback becomes available once at least one answer is evaluated."}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <Badge>{summary.session.mode}</Badge>
                  <Badge>{summary.agent_runtime.current_phase}</Badge>
                  <Badge>{summary.session.status}</Badge>
                </div>
                <div className="mt-6 flex flex-wrap gap-3">
                  <Button asChild>
                    <Link href="/setup">Run another session</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href="/insights">Open progress insights</Link>
                  </Button>
                  <Button asChild variant="secondary">
                    <Link href={`/student/mentor?session_id=${encodeURIComponent(summary.session.session_id)}`}>
                      Message your mentor
                    </Link>
                  </Button>
                </div>
              </div>

              <div className="rounded-[32px] border border-white/10 bg-black/15 p-5">
                <p className="eyebrow-copy text-white/42">Session snapshot</p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {summaryRows.map(([label, value]) => (
                    <div
                      key={label}
                      className="rounded-[22px] border border-white/10 bg-white/[0.04] px-4 py-3"
                    >
                      <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">{label}</p>
                      <p className="mt-1 break-all text-sm leading-6 text-white/82">{value}</p>
                    </div>
                  ))}
                </div>
              </div>
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
                  <p className="eyebrow-copy text-white/48">STAR breakdown</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <StarBreakdownCard title="Situation" content={latestEvaluation.star_situation} />
                    <StarBreakdownCard title="Task" content={latestEvaluation.star_task} />
                    <StarBreakdownCard title="Action" content={latestEvaluation.star_action} />
                    <StarBreakdownCard title="Result" content={latestEvaluation.star_result} />
                  </div>
                </Card>
              ) : null}

              <Card className="rounded-[34px] p-6">
                <p className="eyebrow-copy text-white/48">Strengths and improvement areas</p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">Strengths</h2>
                    <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/64">
                      {(summary.strengths.length
                        ? summary.strengths
                        : ["Structured communication and steady answer pacing"]).map((item, index) => (
                        <li key={`${item}-${index}`}>• {item}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                    <h2 className="text-xl font-semibold tracking-[-0.04em] text-white">Improvement areas</h2>
                    <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/64">
                      {(summary.weaknesses.length
                        ? summary.weaknesses
                        : ["Quantify impact more explicitly", "Tighten the opening structure"]).map(
                          (item, index) => <li key={`${item}-${index}`}>• {item}</li>
                        )}
                    </ul>
                  </div>
                </div>
              </Card>

              {mentorFeedback.length ? (
                <Card className="rounded-[34px] p-6">
                  <p className="eyebrow-copy text-white/48">Mentor feedback</p>
                  <div className="mt-5 grid gap-3">
                    {mentorFeedback.map((entry) => (
                      <div
                        key={entry.intervention_id}
                        className="rounded-[24px] border border-white/10 bg-white/5 p-4"
                      >
                        <p className="text-[11px] uppercase tracking-[0.2em] text-white/40">
                          {formatDateTime(entry.created_at)}
                        </p>
                        <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-white/72">
                          {entry.mentor_message}
                        </p>
                      </div>
                    ))}
                  </div>
                </Card>
              ) : null}

              {latestEvaluation ? (
                <Card className="rounded-[34px] p-6">
                  <p className="eyebrow-copy text-white/48">Actionable growth tips</p>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                      <h3 className="text-lg font-semibold text-white">Actionable feedback</h3>
                      <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/64">
                        {latestEvaluation.actionable_feedback.map((item, index) => (
                          <li key={`${item}-${index}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
                      <h3 className="text-lg font-semibold text-white">Growth tips</h3>
                      <ul className="mt-4 grid gap-3 text-sm leading-7 text-white/64">
                        {latestEvaluation.growth_tips.map((item, index) => (
                          <li key={`${item}-${index}`}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                  {latestEvaluation.self_critique_output ? (
                    <div className="mt-4 rounded-[28px] border border-white/10 bg-white/5 p-5">
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
                <p className="eyebrow-copy text-white/48">Transcript preview</p>
                <div className="mt-5 grid gap-3">
                  {summary.messages.slice(0, 6).map((message) => (
                    <div
                      key={message.message_id}
                      className="rounded-[24px] border border-white/10 bg-white/5 p-4"
                    >
                      <p className="text-xs uppercase tracking-[0.2em] text-white/36">
                        {message.speaker_type}
                      </p>
                      <p className="mt-2 text-sm leading-6 text-white/68">{message.content}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="rounded-[34px] p-6">
                <p className="eyebrow-copy text-white/48">Next-session recommendation</p>
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
