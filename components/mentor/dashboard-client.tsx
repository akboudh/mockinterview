"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FlagBadge } from "@/components/mentor/flag-badge";
import { formatDateTime } from "@/lib/utils";

type FlagQueueEntry = {
  flag_id: string;
  session_id: string;
  flag_reason: string;
  flag_category: string;
  status: string;
  created_at: string;
  mode: string;
  target_role: string;
  session_status: string;
};

export function MentorDashboardClient({ flags }: { flags: FlagQueueEntry[] }) {
  const router = useRouter();
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return undefined;
    }

    const source = new EventSource("/events/stream?scope=mentor");
    const refresh = () => {
      router.refresh();
    };
    const eventTypes = [
      "session.flag.created",
      "session.flag.reviewed",
      "session.mentor.feedback",
      "session.mentor.takeover"
    ] as const;

    for (const eventType of eventTypes) {
      source.addEventListener(eventType, refresh);
    }

    return () => {
      for (const eventType of eventTypes) {
        source.removeEventListener(eventType, refresh);
      }
      source.close();
    };
  }, [router]);

  const filteredFlags = useMemo(
    () =>
      flags.filter((flag) => statusFilter === "all" || flag.session_status === statusFilter),
    [flags, statusFilter]
  );

  if (!flags.length) {
    return (
      <EmptyState
        title="No flagged sessions"
        description="Guardrails have not produced any mentor-visible events yet."
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr_0.8fr]">
        {[
          ["Open flags", flags.filter((flag) => flag.status === "open").length],
          ["Reviewed flags", flags.filter((flag) => flag.status === "reviewed").length],
          ["Live flagged sessions", flags.filter((flag) => flag.session_status === "flagged").length]
        ].map(([label, value]) => (
          <Card key={String(label)} className="rounded-[28px] p-5">
            <p className="text-sm text-white/58">{label}</p>
            <p className="mt-3 text-4xl font-semibold tracking-[-0.05em] text-white">
              {value}
            </p>
          </Card>
        ))}
        <label className="premium-panel grid gap-2 rounded-[28px] p-5">
          <span className="text-sm text-white/58">Session status filter</span>
          <select
            className="field"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="all">All sessions</option>
            <option value="flagged">Flagged</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="completed">Completed</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4">
        {filteredFlags.map((flag) => (
          <Card
            key={flag.flag_id}
            className="grid gap-4 rounded-[28px] p-5 md:grid-cols-[1.2fr_0.55fr_0.45fr] md:items-center"
          >
            <div>
              <div className="flex flex-wrap items-center gap-3">
                <FlagBadge label={flag.flag_category} />
                <FlagBadge label={flag.status} />
              </div>
              <h3 className="mt-4 text-xl font-semibold tracking-[-0.04em] text-white">
                {flag.target_role} · {flag.mode}
              </h3>
              <p className="mt-2 text-sm leading-6 text-white/64">{flag.flag_reason}</p>
              <p className="mt-3 text-sm text-white/52">{formatDateTime(flag.created_at)}</p>
            </div>
            <div className="space-y-2 text-sm">
              <p className="text-white/52">Session identifier</p>
              <p className="break-all text-white">{flag.session_id}</p>
              <p className="text-white/52">Review status</p>
              <p className="text-white">{flag.session_status}</p>
            </div>
            <div className="md:justify-self-end">
              <Button asChild variant="secondary">
                <Link href={`/mentor/flags/${flag.flag_id}`}>Open session detail</Link>
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
