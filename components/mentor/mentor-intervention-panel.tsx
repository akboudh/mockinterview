"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Toast } from "@/components/ui/toast";

export function MentorInterventionPanel({
  sessionId,
  onSuccess
}: {
  sessionId: string;
  onSuccess?: () => Promise<void> | void;
}) {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<{ title: string; tone: "info" | "success" | "error" } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);

  async function submitFeedback() {
    setSubmitting(true);
    setStatus(null);

    try {
      const response = await fetch("/mentor/feedback", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          session_id: sessionId,
          mentor_message: message
        })
      });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Unable to submit mentor action.");
      }
      setMessage("");
      setStatus({
        title: "Supplemental feedback recorded.",
        tone: "success"
      });
      await onSuccess?.();
    } catch (error) {
      setStatus({
        title: error instanceof Error ? error.message : "Unable to submit mentor action.",
        tone: "error"
      });
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="premium-panel rounded-[30px] p-6">
      <p className="text-xs uppercase tracking-[0.28em] text-white/45">Mentor action</p>
      <h3 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-white">
        Add supplemental feedback.
      </h3>
      <textarea
        className="field mt-5 min-h-36 resize-none"
        placeholder="Write a coaching note for this session. The student will see it in their session history."
        value={message}
        onChange={(event) => setMessage(event.target.value)}
      />
      <div className="mt-4 flex flex-wrap gap-3">
        <Button
          variant="secondary"
          onClick={() => void submitFeedback()}
          disabled={!message.trim() || submitting}
        >
          {submitting ? "Saving..." : "Add supplemental feedback"}
        </Button>
      </div>
      {status ? <div className="mt-4"><Toast title={status.title} tone={status.tone} /></div> : null}
    </div>
  );
}
