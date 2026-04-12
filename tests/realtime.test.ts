import {
  clearRealtimeSubscribers,
  formatSseEvent,
  publishRealtimeEvent,
  subscribeRealtimeEvents
} from "@/lib/realtime/event-bus";
import type { RealtimeEventEnvelope } from "@/lib/types";

describe("realtime event bus", () => {
  beforeEach(() => {
    clearRealtimeSubscribers();
  });

  afterEach(() => {
    clearRealtimeSubscribers();
  });

  it("delivers events only to matching subscribers", () => {
    const mentorEvents: RealtimeEventEnvelope[] = [];
    const sessionEvents: RealtimeEventEnvelope[] = [];

    subscribeRealtimeEvents({
      filter: (event) => event.audience === "mentor",
      notify: (event) => {
        mentorEvents.push(event);
      }
    });
    subscribeRealtimeEvents({
      filter: (event) => event.audience === "session" && event.session_id === "sess-1",
      notify: (event) => {
        sessionEvents.push(event);
      }
    });

    publishRealtimeEvent({
      event_id: "event-session",
      type: "session.flag.created",
      session_id: "sess-1",
      user_id: "student-1",
      audience: "session",
      created_at: "2026-04-06T13:00:00.000Z",
      payload: {
        flag_id: "flag-1"
      }
    });
    publishRealtimeEvent({
      event_id: "event-mentor",
      type: "session.mentor.takeover",
      session_id: "sess-1",
      user_id: "student-1",
      audience: "mentor",
      created_at: "2026-04-06T13:00:01.000Z",
      payload: {
        intervention_id: "takeover-1"
      }
    });

    expect(sessionEvents).toHaveLength(1);
    expect(sessionEvents[0]?.type).toBe("session.flag.created");
    expect(mentorEvents).toHaveLength(1);
    expect(mentorEvents[0]?.type).toBe("session.mentor.takeover");
  });

  it("formats SSE frames with the event type and JSON payload", () => {
    const frame = formatSseEvent({
      event_id: "event-sse",
      type: "session.flag.reviewed",
      session_id: "sess-1",
      user_id: "student-1",
      audience: "mentor",
      created_at: "2026-04-06T13:05:00.000Z",
      payload: {
        flag_id: "flag-1",
        status: "reviewed"
      }
    });

    expect(frame).toContain("id: event-sse");
    expect(frame).toContain("event: session.flag.reviewed");
    expect(frame).toContain('"flag_id":"flag-1"');
  });
});
