"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Toast } from "@/components/ui/toast";
import { formatDateTime } from "@/lib/utils";
import type { MentorDirectMessage } from "@/lib/types";

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

export function StudentMentorInbox({
  initialMessages,
  currentUserId,
  contextSessionId
}: {
  initialMessages: MentorDirectMessage[];
  currentUserId: string;
  contextSessionId?: string | null;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [toast, setToast] = useState<{ title: string; tone: "info" | "success" | "error" } | null>(
    null
  );
  const [sending, setSending] = useState(false);

  async function reload() {
    const response = await fetch("/student/mentor-messages");
    const payload = await readJsonResponse<{ messages?: MentorDirectMessage[]; error?: string }>(
      response
    );
    if (!response.ok) {
      throw new Error(payload.error ?? "Unable to load messages.");
    }
    setMessages(payload.messages ?? []);
  }

  useEffect(() => {
    if (typeof EventSource === "undefined") {
      return undefined;
    }
    const source = new EventSource("/events/stream?scope=user");
    const onDm = () => {
      void reload().catch(() => undefined);
      router.refresh();
    };
    source.addEventListener("mentor.dm.new", onDm);
    return () => {
      source.removeEventListener("mentor.dm.new", onDm);
      source.close();
    };
  }, [router]);

  async function send() {
    const trimmed = body.trim();
    if (!trimmed) {
      return;
    }
    setSending(true);
    setToast(null);
    try {
      const response = await fetch("/student/mentor-messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          body: trimmed,
          session_id: contextSessionId ?? null
        })
      });
      const payload = await readJsonResponse<{ success?: boolean; dm?: MentorDirectMessage; error?: string }>(
        response
      );
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to send.");
      }
      setBody("");
      setToast({ title: "Message sent to your mentor.", tone: "success" });
      await reload();
    } catch (error) {
      setToast({
        title: error instanceof Error ? error.message : "Unable to send message.",
        tone: "error"
      });
    } finally {
      setSending(false);
    }
  }

  return (
    <Card className="rounded-[34px] p-6">
      <p className="text-xs uppercase tracking-[0.28em] text-white/45">Mentor messages</p>
      <h2 className="mt-2 text-2xl font-semibold text-white">Ask your mentor</h2>
      <p className="mt-2 text-sm text-white/58">
        Questions about a past session are tagged when you start from results or history. Your mentor can reply
        when they are available.
      </p>
      {contextSessionId ? (
        <p className="mt-3 rounded-[18px] border border-sky-300/25 bg-sky-500/10 px-4 py-2 text-sm text-sky-100/90">
          Context session: <code className="text-white/90">{contextSessionId.slice(0, 8)}…</code>
        </p>
      ) : null}

      <div className="mt-6 max-h-96 space-y-3 overflow-y-auto rounded-[22px] border border-white/10 bg-black/20 p-4">
        {messages.length ? (
          messages.map((m) => (
            <div
              key={m.dm_id}
              className={`rounded-[18px] px-3 py-2 text-sm ${
                m.from_user_id === currentUserId
                  ? "ml-8 bg-sky-500/15 text-sky-50"
                  : "mr-8 bg-amber-500/12 text-amber-50"
              }`}
            >
              <p className="whitespace-pre-wrap">{m.body}</p>
              {m.session_id ? (
                <p className="mt-1 text-[10px] text-white/45">Re: session {m.session_id.slice(0, 8)}…</p>
              ) : null}
              <p className="mt-1 text-[10px] uppercase tracking-wider text-white/40">
                {formatDateTime(m.created_at)}
              </p>
            </div>
          ))
        ) : (
          <p className="text-sm text-white/55">No messages yet.</p>
        )}
      </div>

      <textarea
        className="field mt-4 min-h-28 resize-none"
        placeholder="Write a question for your mentor…"
        value={body}
        onChange={(e) => setBody(e.target.value)}
      />
      <Button className="mt-3" onClick={() => void send()} disabled={sending || !body.trim()}>
        {sending ? "Sending…" : "Send"}
      </Button>

      {toast ? <Toast title={toast.title} tone={toast.tone} /> : null}
    </Card>
  );
}
