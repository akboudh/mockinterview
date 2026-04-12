import { AuthError } from "@/lib/auth";
import { listMemoryEvents, saveEvent } from "@/lib/services/memory-service";
import { startSession } from "@/lib/services/session-service";
import { resetDb } from "@/tests/test-utils";

const { requireApiUserMock } = vi.hoisted(() => ({
  requireApiUserMock: vi.fn()
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");

  return {
    ...actual,
    requireApiUser: requireApiUserMock
  };
});

import { GET as listMemoriesRoute } from "@/app/memory/events/route";
import {
  DELETE as deleteMemoryRoute,
  PATCH as updateMemoryRoute
} from "@/app/memory/events/[eventId]/route";

describe("memory routes", () => {
  beforeEach(async () => {
    await resetDb();
    requireApiUserMock.mockReset();
  });

  it("rejects unauthenticated memory list requests", async () => {
    requireApiUserMock.mockRejectedValue(new AuthError("You must be signed in to continue.", 401));

    const response = await listMemoriesRoute(new Request("http://localhost/memory/events"));
    const payload = await response.json();

    expect(response.status).toBe(401);
    expect(payload.error).toContain("signed in");
  });

  it("supports authenticated update and delete operations for memory events", async () => {
    requireApiUserMock.mockResolvedValue({
      user_id: "demo-student"
    });

    const session = await startSession({
      user_id: "demo-student",
      target_role: "Product Manager Intern",
      mode: "behavioral",
      focus_area: "leadership",
      confidence_self_rating: 4,
      personalization_enabled: true,
      self_critique_enabled: false,
      notes: "Route memory test"
    });
    const event = await saveEvent({
      session_id: session.session_id,
      user_id: "demo-student",
      memory_tier: "long_term",
      event_type: "skill_gap",
      content: {
        skill: "story structure",
        notes: "Needs tighter structure."
      }
    });

    const patchResponse = await updateMemoryRoute(
      new Request(`http://localhost/memory/events/${event.event_id}`, {
        method: "PATCH",
        body: JSON.stringify({
          content: {
            skill: "story structure",
            notes: "Updated via route with stronger measurable results."
          }
        })
      }),
      {
        params: Promise.resolve({
          eventId: event.event_id
        })
      }
    );
    const patchPayload = await patchResponse.json();

    expect(patchResponse.status).toBe(200);
    expect(JSON.stringify(patchPayload.memory.content)).toContain("measurable results");

    const deleteResponse = await deleteMemoryRoute(
      new Request(`http://localhost/memory/events/${event.event_id}`, {
        method: "DELETE"
      }),
      {
        params: Promise.resolve({
          eventId: event.event_id
        })
      }
    );
    const listed = await listMemoryEvents({
      user_id: "demo-student"
    });

    expect(deleteResponse.status).toBe(200);
    expect(listed.some((item) => item.event_id === event.event_id)).toBe(false);
  });
});
