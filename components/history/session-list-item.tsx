import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { formatDateTime } from "@/lib/utils";

export function SessionListItem({
  session
}: {
  session: {
    session_id: string;
    started_at: string;
    mode: string;
    target_role: string;
    status: string;
    summary_score?: number | null;
    question_count: number;
    mentor_feedback_count?: number;
  };
}) {
  return (
    <Card className="grid gap-4 rounded-[30px] border border-white/12 bg-white/[0.03] p-5 transition duration-300 motion-safe:hover:-translate-y-1 motion-safe:hover:border-white/18 md:grid-cols-[1.2fr_0.55fr_0.45fr] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>
            {session.mode}
          </Badge>
          <Badge>
            {session.status}
          </Badge>
          {(session.mentor_feedback_count ?? 0) > 0 ? (
            <Badge className="border-amber-300/35 bg-amber-500/12 text-amber-50">
              Mentor feedback ({session.mentor_feedback_count})
            </Badge>
          ) : null}
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-white">
          {session.target_role}
        </h3>
        <p className="mt-2 text-sm text-white/58">
          {formatDateTime(session.started_at)} · {session.question_count} answers captured
        </p>
      </div>
      <div>
        <p className="text-[11px] uppercase tracking-[0.18em] text-white/42">Summary score</p>
        <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.06em] text-white">
          {session.summary_score ?? "—"}
        </p>
      </div>
      <div className="flex flex-wrap justify-end gap-2 md:justify-self-end">
        <Button asChild variant="secondary">
          <Link href={`/results/${session.session_id}`}>Open result</Link>
        </Button>
        <Button asChild variant="secondary">
          <Link href={`/student/mentor?session_id=${encodeURIComponent(session.session_id)}`}>
            Ask mentor
          </Link>
        </Button>
      </div>
    </Card>
  );
}
