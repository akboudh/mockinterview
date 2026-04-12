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
  };
}) {
  return (
    <Card className="grid gap-4 rounded-[28px] p-5 md:grid-cols-[1.2fr_0.6fr_0.4fr] md:items-center">
      <div>
        <div className="flex flex-wrap items-center gap-3">
          <Badge>
            {session.mode}
          </Badge>
          <Badge>
            {session.status}
          </Badge>
        </div>
        <h3 className="mt-3 text-xl font-semibold tracking-[-0.04em] text-white">
          {session.target_role}
        </h3>
        <p className="mt-2 text-sm text-white/58">
          {formatDateTime(session.started_at)} · {session.question_count} answers captured
        </p>
      </div>
      <div>
        <p className="text-sm text-white/58">Summary score</p>
        <p className="mt-2 text-3xl font-semibold tracking-[-0.05em] text-white">
          {session.summary_score ?? "—"}
        </p>
      </div>
      <div className="md:justify-self-end">
        <Button asChild variant="secondary">
          <Link href={`/results/${session.session_id}`}>Open result</Link>
        </Button>
      </div>
    </Card>
  );
}
