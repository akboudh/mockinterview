import { authJsonError, requireApiUser, requireMentorApiUser } from "@/lib/auth";
import { formatSseEvent, subscribeRealtimeEvents } from "@/lib/realtime/event-bus";
import { assertSessionOwnership } from "@/lib/services/session-service";
import type { RealtimeEventEnvelope } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const encoder = new TextEncoder();

function keepAliveFrame() {
  return encoder.encode(": keepalive\n\n");
}

function eventFrame(event: RealtimeEventEnvelope) {
  return encoder.encode(formatSseEvent(event));
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const scope = url.searchParams.get("scope")?.trim() || "session";
    const sessionId = url.searchParams.get("session_id")?.trim() || null;

    let userScopeUserId: string | null = null;

    if (scope === "mentor") {
      await requireMentorApiUser();
    } else if (scope === "user") {
      const user = await requireApiUser();
      userScopeUserId = user.user_id;
    } else {
      const user = await requireApiUser();
      if (!sessionId) {
        throw new Error("session_id is required for session event streams.");
      }
      await assertSessionOwnership(sessionId, user.user_id);
    }

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const connectedEvent: RealtimeEventEnvelope = {
          event_id: crypto.randomUUID(),
          type: "stream.connected",
          session_id: sessionId,
          user_id: userScopeUserId,
          audience:
            scope === "mentor" ? "mentor" : scope === "user" ? "user" : "session",
          created_at: new Date().toISOString(),
          payload: {
            scope,
            session_id: sessionId
          }
        };

        controller.enqueue(eventFrame(connectedEvent));

        const unsubscribe = subscribeRealtimeEvents({
          filter: (event) => {
            if (scope === "mentor") {
              return event.audience === "mentor";
            }

            if (scope === "user" && userScopeUserId) {
              return event.audience === "user" && event.user_id === userScopeUserId;
            }

            return event.audience === "session" && event.session_id === sessionId;
          },
          notify: (event) => {
            controller.enqueue(eventFrame(event));
          }
        });

        const keepAlive = setInterval(() => {
          controller.enqueue(keepAliveFrame());
        }, 15000);

        const cleanup = () => {
          clearInterval(keepAlive);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // no-op: the stream may already be closed during client disconnect.
          }
        };

        request.signal.addEventListener("abort", cleanup, { once: true });
      }
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive"
      }
    });
  } catch (error) {
    return authJsonError(error, "Unable to open the realtime event stream.");
  }
}
