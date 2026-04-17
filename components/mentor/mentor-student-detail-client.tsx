"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";
import type { InterviewSession, MentorDirectMessage } from "@/lib/types";

async function readJsonResponse<T>(response: Response): Promise<T> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return (await response.json()) as T;
  }
  const text = await response.text();
  const preview = text.slice(0, 200).replace(/\s+/g, " ").trim();
  throw new Error(
    `Expected JSON but received ${response.status} ${response.statusText} (${contentType || "no content-type"}): ${preview}`
  );
}

type SessionRow = {
  session: InterviewSession;
  current_phase: string;
  has_open_flags: boolean;
  flag_count: number;
};

export function MentorStudentDetailClient({
  studentId,
  displayName,
  email,
  sessions,
  mentorUserId
}: {
  studentId: string;
  displayName: string;
  email: string | null;
  sessions: SessionRow[];
  mentorUserId: string;
}) {
  const router = useRouter();
  const [dmText, setDmText] = useState("");
  const [messages, setMessages] = useState<MentorDirectMessage[]>([]);
  const [toast, setToast] = useState<{ title: string; tone: "info" | "success" | "error" } | null>(
    null
  );
  const [loadingDm, setLoadingDm] = useState(false);

  const loadDm = useCallback(async () => {
    const response = await fetch(
      `/mentor/direct-messages?with_user_id=${encodeURIComponent(studentId)}`
    );
    const payload = await readJsonResponse<{ messages?: MentorDirectMessage[]; error?: string }>(
      response
    );
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load DMs.");
    }
    setMessages(payload.messages ?? []);
  }, [studentId]);

  useEffect(() => {
    void loadDm().catch(() => {
      setToast({ title: "Could not load direct messages.", tone: "error" });
    });
  }, [loadDm]);

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return undefined;
    }
    const source = new EventSource("/events/stream?scope=mentor");
    const refresh = () => {
      router.refresh();
      void loadDm().catch(() => undefined);
    };
    source.addEventListener("mentor.dm.new", refresh);
    return () => {
      source.removeEventListener("mentor.dm.new", refresh);
      source.close();
    };
  }, [router, loadDm]);

  async function sendDm() {
    const trimmed = dmText.trim();
    if (!trimmed) {
      return;
    }
    setLoadingDm(true);
    setToast(null);
    try {
      const response = await fetch("/mentor/direct-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to_user_id: studentId,
          body: trimmed
        })
      });
      const payload = await readJsonResponse<{ success?: boolean; dm?: MentorDirectMessage; error?: string }>(
        response
      );
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send.");
      }
      setDmText("");
      setToast({ title: "Message sent.", tone: "success" });
      await loadDm();
    } catch (error) {
      setToast({
        title: error instanceof Error ? error.message : "Unable to send message.",
        tone: "error"
      });
    } finally {
      setLoadingDm(false);
    }
  }

  return (
    <div className="grid gap-6">
      <div>
        <Link href="/mentor" className="text-sm text-sky-300/90 underline-offset-4 hover:underline">
          ← All students
        </Link>
        <h1 className="mt-4 font-display text-3xl font-semibold tracking-[-0.04em] text-white">
          {displayName}
        </h1>
        <p className="mt-2 text-sm text-white/58">{email ?? "No email"}</p>
      </div>

      <Card className="rounded-[34px] p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Sessions</p>
        <div className="mt-4 grid gap-3">
          {sessions.length ? (
            sessions.map((row) => (
              <Link
                key={row.session.session_id}
                href={`/mentor/sessions/${row.session.session_id}`}
                className="flex flex-wrap items-center justify-between gap-3 rounded-[22px] border border-white/12 bg-white/[0.04] px-4 py-3 transition hover:border-white/22"
              >
                <div>
                  <p className="font-medium text-white">{row.session.target_role}</p>
                  <p className="text-xs text-white/45">{formatDateTime(row.session.started_at)}</p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Badge>{row.session.status}</Badge>
                  <Badge>{row.current_phase}</Badge>
                  {row.session.status === "active" ||
                  row.session.status === "flagged" ||
                  row.session.status === "paused" ? (
                    <Badge className="border-emerald-300/35 bg-emerald-500/12 text-emerald-100">Live</Badge>
                  ) : null}
                  {row.has_open_flags ? (
                    <Badge className="border-rose-300/35 bg-rose-500/12 text-rose-100">
                      Flagged ({row.flag_count})
                    </Badge>
                  ) : null}
                </div>
              </Link>
            ))
          ) : (
            <p className="text-sm text-white/55">No sessions yet.</p>
          )}
        </div>
      </Card>

      <Card className="rounded-[34px] p-6">
        <p className="text-xs uppercase tracking-[0.28em] text-white/45">Direct messages</p>
        <p className="mt-2 text-sm text-white/58">
          Async thread with this student (outside the live interview). Your mentor ID:{" "}
          <code className="text-white/80">{mentorUserId.slice(0, 8)}…</code>
        </p>
        <div className="mt-4 max-h-80 space-y-3 overflow-y-auto rounded-[22px] border border-white/10 bg-black/20 p-4">
          {messages.map((m) => (
            <div
              key={m.dm_id}
              className={`rounded-[18px] px-3 py-2 text-sm ${
                m.from_user_id === mentorUserId ? "ml-8 bg-amber-500/15 text-amber-50" : "mr-8 bg-white/10 text-white"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.body}</p>
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">
                {formatDateTime(m.created_at)}
              </p>
            </div>
          ))}
        </div>
        <textarea
          className="field mt-4 min-h-24 resize-none"
          placeholder="Write a message to this student…"
          value={dmText}
          onChange={(e) => setDmText(e.target.value)}
        />
        <Button className="mt-3" onClick={() => void sendDm()} disabled={loadingDm || !dmText.trim()}>
          {loadingDm ? "Sending…" : "Send"}
        </Button>
      </Card>

      {toast ? <Toast title={toast.title} tone={toast.tone} /> : null}
    </div>
  );
}
