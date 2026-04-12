"use client";

import { useMemo, useState } from "react";

import { EmptyState } from "@/components/ui/empty-state";
import { SessionListItem } from "@/components/history/session-list-item";

type SessionListEntry = {
  session_id: string;
  started_at: string;
  mode: string;
  target_role: string;
  status: string;
  summary_score?: number | null;
  question_count: number;
};

export function HistoryClient({ sessions }: { sessions: SessionListEntry[] }) {
  const [modeFilter, setModeFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [sortOrder, setSortOrder] = useState("desc");

  const roles = Array.from(new Set(sessions.map((session) => session.target_role)));

  const filteredSessions = useMemo(() => {
    return [...sessions]
      .filter((session) => modeFilter === "all" || session.mode === modeFilter)
      .filter((session) => roleFilter === "all" || session.target_role === roleFilter)
      .sort((left, right) => {
        const delta =
          new Date(left.started_at).getTime() - new Date(right.started_at).getTime();
        return sortOrder === "desc" ? -delta : delta;
      });
  }, [modeFilter, roleFilter, sessions, sortOrder]);

  if (!sessions.length) {
    return (
      <EmptyState
        title="No interview sessions yet"
        description="Start the first mock interview to populate history, results, and longitudinal insights."
        href="/setup"
        actionLabel="Start now"
      />
    );
  }

  return (
    <div className="grid gap-6">
      <div className="premium-panel grid gap-4 rounded-[30px] p-6 md:grid-cols-3">
        <label className="grid gap-2">
          <span className="text-sm text-white/60">Filter by mode</span>
          <select className="field" value={modeFilter} onChange={(event) => setModeFilter(event.target.value)}>
            <option value="all">All modes</option>
            <option value="behavioral">Behavioral</option>
            <option value="technical">Technical</option>
            <option value="case">Case</option>
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-white/60">Filter by target role</span>
          <select className="field" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
            <option value="all">All roles</option>
            {roles.map((role) => (
              <option key={role} value={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label className="grid gap-2">
          <span className="text-sm text-white/60">Sort by date</span>
          <select className="field" value={sortOrder} onChange={(event) => setSortOrder(event.target.value)}>
            <option value="desc">Newest first</option>
            <option value="asc">Oldest first</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4">
        {filteredSessions.map((session) => (
          <SessionListItem key={session.session_id} session={session} />
        ))}
      </div>
    </div>
  );
}
