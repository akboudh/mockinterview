"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { ConversationBubble } from "@/components/interview/conversation-bubble";
import { MentorInterventionPanel } from "@/components/mentor/mentor-intervention-panel";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";
import type { AgentSessionState, FlagEvent, InterviewSession, MentorIntervention, Message, UserProfile } from "@/lib/types";

export function MentorSessionDetailClient({
  detail,
  mentorUserId
}: {
  detail: {
    session: InterviewSession;
    student: UserProfile | null;
    transcript: Message[];
    flags: FlagEvent[];
    interventions: MentorIntervention[];
    runtime: AgentSessionState | null;
  };
  mentorUserId: string;
}) {
  const router = useRouter();
  const [toast, setToast] = useState<{ title: string; tone: "info" | "success" | "error" } | null>(
    null
  );

  const { session, student, transcript, flags, interventions, runtime } = detail;
  const isLive =
    session.status === "active" || session.status === "flagged" || session.status === "paused";

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return undefined;
    }

    const source = new EventSource("/events/stream?scope=mentor");
    const refresh = () => {
      router.refresh();
    };
    const types = [
      "session.mentor.feedback",
      "session.flag.created",
      "session.ended"
    ] as const;

    for (const eventType of types) {
      source.addEventListener(eventType, refresh);
    }

    return () => {
      for (const eventType of types) {
        source.removeEventListener(eventType, refresh);
      }
      source.close();
    };
  }, [router]);

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.28em] text-white/45">Session</p>
          <h1 className="mt-2 font-display text-3xl font-semibold tracking-[-0.04em] text-white">
            {session.target_role}
          </h1>
          <p className="mt-2 text-sm text-white/58">
            {student?.display_name ?? student?.email ?? "Student"} ·{" "}
            <span className="text-white/80">{session.mode}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge>{session.status}</Badge>
          <Badge>{runtime?.current_phase ?? "unknown"}</Badge>
          {isLive ? (
            <Badge className="border-emerald-300/40 bg-emerald-500/15 text-emerald-100">Live</Badge>
          ) : (
            <Badge className="border-white/20 bg-white/10">Ended</Badge>
          )}
          {flags.length ? (
            <Badge className="border-amber-300/40 bg-amber-500/15 text-amber-50">
              {flags.length} flag{flags.length === 1 ? "" : "s"}
            </Badge>
          ) : null}
        </div>
      </div>

      {student ? (
        <Link
          href={`/mentor/students/${student.user_id}`}
          className="text-sm text-sky-300/90 underline-offset-4 hover:underline"
        >
          ← Back to {student.display_name ?? "student"}
        </Link>
      ) : null}

      <MentorInterventionPanel sessionId={session.session_id} onSuccess={() => router.refresh()} />

      <Card className="rounded-[34px] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-white/45">Transcript</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Full conversation</h2>
          </div>
          <span className="text-xs text-white/45">Mentor ID {mentorUserId.slice(0, 8)}…</span>
        </div>
        <div className="grid max-h-[640px] gap-4 overflow-y-auto pr-1">
          {transcript.length ? (
            transcript.map((message) => <ConversationBubble key={message.message_id} message={message} />)
          ) : (
            <p className="text-sm text-white/55">No messages yet.</p>
          )}
        </div>
      </Card>

      <Card className="rounded-[34px] p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Flags</p>
        {flags.length ? (
          <ul className="mt-4 grid gap-3">
            {flags.map((flag) => (
              <li
                key={flag.flag_id}
                className="rounded-[22px] border border-white/12 bg-white/[0.04] px-4 py-3 text-sm"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium text-white">{flag.flag_category}</span>
                  <Badge>{flag.status}</Badge>
                </div>
                <p className="mt-2 text-white/70">{flag.flag_reason}</p>
                <p className="mt-2 text-xs text-white/45">{formatDateTime(flag.created_at)}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-white/55">No flags on this session.</p>
        )}
      </Card>

      <Card className="rounded-[34px] p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Interventions</p>
        {interventions.length ? (
          <ul className="mt-4 grid gap-3">
            {interventions.map((i) => (
              <li key={i.intervention_id} className="rounded-[22px] border border-white/12 bg-white/[0.04] px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <Badge>{i.intervention_type}</Badge>
                  <span className="text-xs text-white/45">{formatDateTime(i.created_at)}</span>
                </div>
                <p className="mt-2 text-sm text-white/78">{i.mentor_message}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-sm text-white/55">No mentor interventions yet.</p>
        )}
      </Card>

      {toast ? <Toast title={toast.title} tone={toast.tone} /> : null}
    </div>
  );
}
