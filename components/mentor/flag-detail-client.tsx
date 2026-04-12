"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { ConversationBubble } from "@/components/interview/conversation-bubble";
import { MentorInterventionPanel } from "@/components/mentor/mentor-intervention-panel";
import { FlagBadge } from "@/components/mentor/flag-badge";
import { formatDateTime } from "@/lib/utils";
import type { EvaluationRecord, FlagEvent, InterviewSession, MentorIntervention, Message } from "@/lib/types";

export function FlagDetailClient({
  flag,
  session,
  transcript,
  evaluations,
  interventions
}: {
  flag: FlagEvent;
  session: InterviewSession | undefined;
  transcript: Message[];
  evaluations: EvaluationRecord[];
  interventions: MentorIntervention[];
}) {
  const router = useRouter();
  const [reviewNote, setReviewNote] = useState(flag.mentor_notes ?? "");
  const [status, setStatus] = useState<{ title: string; tone: "info" | "success" | "error" } | null>(
    null
  );

  async function markReviewed() {
    setStatus(null);
    const response = await fetch(`/flags/${flag.flag_id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        mentor_notes: reviewNote || null
      })
    });
    const payload = await response.json();
    if (!response.ok) {
      setStatus({
        title: payload.error ?? "Unable to mark the flag reviewed.",
        tone: "error"
      });
      return;
    }
    setStatus({
      title: "Flag marked reviewed.",
      tone: "success"
    });
    router.refresh();
  }

  return (
    <div className="grid gap-6">
      <div className="premium-panel grid gap-6 rounded-[34px] p-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <FlagBadge label={flag.flag_category} />
            <FlagBadge label={flag.status} />
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-[-0.04em] text-white">
            Flagged session detail
          </h1>
          <p className="mt-3 max-w-2xl text-white/64">{flag.flag_reason}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <Card className="rounded-[24px] p-4">
              <p className="text-sm text-white/52">Session</p>
              <p className="mt-1 text-white">{session?.target_role ?? "Unknown role"}</p>
            </Card>
            <Card className="rounded-[24px] p-4">
              <p className="text-sm text-white/52">Timestamp</p>
              <p className="mt-1 text-white">{formatDateTime(flag.created_at)}</p>
            </Card>
          </div>
        </div>

        <div className="rounded-[28px] border border-white/10 bg-white/5 p-5">
          <p className="text-sm text-white/52">Mentor notes</p>
          <textarea
            className="field mt-4 min-h-32 resize-none"
            value={reviewNote}
            onChange={(event) => setReviewNote(event.target.value)}
            placeholder="Document what happened and whether intervention was sufficient."
          />
          <div className="mt-4 flex items-center gap-3">
            <Button variant="secondary" onClick={markReviewed}>
              Mark reviewed
            </Button>
          </div>
          {status ? <div className="mt-4"><Toast title={status.title} tone={status.tone} /></div> : null}
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <div className="grid gap-6">
          <Card className="rounded-[34px] p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-white/48">Transcript viewer</p>
            <div className="mt-5 grid gap-4">
              {transcript.map((message) => (
                <ConversationBubble key={message.message_id} message={message} />
              ))}
            </div>
          </Card>

          <Card className="rounded-[34px] p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-white/48">Evaluation output</p>
            <div className="mt-5 grid gap-4">
              {evaluations.map((evaluation) => (
                <div key={evaluation.evaluation_id} className="rounded-[24px] border border-white/10 bg-white/5 p-5">
                  <div className="grid gap-3 md:grid-cols-4">
                    {[
                      ["Clarity", evaluation.clarity_score],
                      ["Structure", evaluation.structure_score],
                      ["Relevance", evaluation.relevance_score],
                      ["Soft skills", evaluation.soft_skills_score]
                    ].map(([label, score]) => (
                      <div key={label}>
                        <p className="text-sm text-white/52">{label}</p>
                        <p className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
                          {score}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-4 text-sm leading-7 text-white/64">
                    {evaluation.overall_summary}
                  </p>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="grid gap-6">
          <MentorInterventionPanel
            sessionId={flag.session_id}
            onSuccess={() => {
              router.refresh();
            }}
          />
          <Card className="rounded-[34px] p-6">
            <p className="text-xs uppercase tracking-[0.28em] text-white/48">Prior interventions</p>
            <div className="mt-5 grid gap-4">
              {interventions.length ? (
                interventions.map((intervention) => (
                  <div key={intervention.intervention_id} className="rounded-[24px] border border-white/10 bg-white/5 p-4">
                    <p className="text-sm font-medium text-white">
                      {intervention.intervention_type}
                    </p>
                    <p className="mt-2 text-sm leading-6 text-white/64">
                      {intervention.mentor_message}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/52">No mentor actions recorded yet.</p>
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
