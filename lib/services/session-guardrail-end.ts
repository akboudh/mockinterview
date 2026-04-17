import { incrementalAppendTranscriptMessage, incrementalEndSession } from "@/lib/db-incremental";
import { readDb } from "@/lib/db";
import { publishRealtimeEvent } from "@/lib/realtime/event-bus";
import type { AgentSessionState, Message } from "@/lib/types";

const SYSTEM_COPY =
  "This session was ended automatically due to a policy concern. A mentor will review your transcript and may reach out to you soon.";

export function shouldAutoEndSessionForGuardrails(
  findings: Array<{ severity: string; flag_category: string }>
): boolean {
  return findings.some(
    (f) =>
      f.severity === "high" ||
      f.flag_category === "toxicity" ||
      f.flag_category === "safety"
  );
}

export async function finalizeSessionAfterSevereGuardrail(sessionId: string) {
  const db = await readDb();
  const session = db.sessions.find((s) => s.session_id === sessionId);
  const state = db.agentSessionStates.find((s) => s.session_id === sessionId);
  if (!session || !state || session.status === "completed") {
    return;
  }

  const ordered = db.messages
    .filter((m) => m.session_id === sessionId)
    .sort((a, b) => a.message_order - b.message_order);

  const systemMessage: Message = {
    message_id: crypto.randomUUID(),
    session_id: sessionId,
    speaker_type: "system",
    content: SYSTEM_COPY,
    message_order: ordered.length ? Math.max(...ordered.map((m) => m.message_order)) + 1 : 1,
    created_at: new Date().toISOString(),
    meta: { guardrail_session_end: true }
  };

  const combined = [...ordered, systemMessage];
  const nextAfterSystem: AgentSessionState = {
    ...state,
    recent_messages: combined.slice(-4).map((m) => ({
      speaker_type: m.speaker_type,
      content: m.content
    })),
    updated_at: new Date().toISOString()
  };

  await incrementalAppendTranscriptMessage({
    message: systemMessage,
    nextAgentState: nextAfterSystem
  });

  const db2 = await readDb();
  const session2 = db2.sessions.find((s) => s.session_id === sessionId);
  const state2 = db2.agentSessionStates.find((s) => s.session_id === sessionId);
  if (!session2 || !state2) {
    return;
  }

  const endedAt = new Date().toISOString();
  const nextEnd: AgentSessionState = {
    ...state2,
    previous_phase: state2.current_phase,
    current_phase: "session_feedback",
    turn_type: "termination",
    updated_at: endedAt,
    state_json: {
      ...state2.state_json,
      current_phase: "session_feedback",
      summary_ready: true,
      session_end_reason: "guardrail_auto_end"
    }
  };

  await incrementalEndSession(sessionId, endedAt, nextEnd);

  const userId = session2.user_id;
  const now = new Date().toISOString();

  publishRealtimeEvent({
    event_id: crypto.randomUUID(),
    type: "session.ended",
    session_id: sessionId,
    user_id: userId,
    audience: "session",
    created_at: now,
    payload: {
      reason: "guardrail_auto_end",
      message: SYSTEM_COPY
    }
  });

  publishRealtimeEvent({
    event_id: crypto.randomUUID(),
    type: "session.ended",
    session_id: sessionId,
    user_id: userId,
    audience: "mentor",
    created_at: now,
    payload: {
      reason: "guardrail_auto_end",
      session_id: sessionId,
      user_id: userId
    }
  });
}
