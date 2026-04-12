import { AuthError } from "@/lib/auth";

const {
  requireMentorApiUserMock,
  listFlagsMock,
  addMentorFeedbackMock,
  takeOverSessionMock,
  markFlagReviewedMock
} = vi.hoisted(() => ({
  requireMentorApiUserMock: vi.fn(),
  listFlagsMock: vi.fn(),
  addMentorFeedbackMock: vi.fn(),
  takeOverSessionMock: vi.fn(),
  markFlagReviewedMock: vi.fn()
}));

vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");

  return {
    ...actual,
    requireMentorApiUser: requireMentorApiUserMock
  };
});

vi.mock("@/lib/services/mentor-service", () => ({
  listFlags: listFlagsMock,
  addMentorFeedback: addMentorFeedbackMock,
  takeOverSession: takeOverSessionMock,
  markFlagReviewed: markFlagReviewedMock
}));

import { GET as listFlagsRoute } from "@/app/flags/route";
import { PATCH as reviewFlagRoute } from "@/app/flags/[flagId]/route";
import { POST as mentorFeedbackRoute } from "@/app/mentor/feedback/route";
import { POST as mentorTakeoverRoute } from "@/app/mentor/takeover/route";

describe("mentor routes", () => {
  beforeEach(() => {
    requireMentorApiUserMock.mockReset();
    listFlagsMock.mockReset();
    addMentorFeedbackMock.mockReset();
    takeOverSessionMock.mockReset();
    markFlagReviewedMock.mockReset();
  });

  it("rejects non-mentor access to the flag queue", async () => {
    requireMentorApiUserMock.mockRejectedValue(
      new AuthError("Mentor access is required for this action.", 403)
    );

    const response = await listFlagsRoute();
    const payload = await response.json();

    expect(response.status).toBe(403);
    expect(payload.error).toContain("Mentor access");
    expect(listFlagsMock).not.toHaveBeenCalled();
  });

  it("allows mentor feedback submissions when mentor auth passes", async () => {
    requireMentorApiUserMock.mockResolvedValue({
      user_id: "mentor-1",
      roles: ["mentor"]
    });
    addMentorFeedbackMock.mockResolvedValue({
      intervention_id: "int-1",
      session_id: "sess-1",
      mentor_message: "Anchor the next answer around a concrete example.",
      intervention_type: "supplemental_feedback",
      created_at: "2026-04-06T12:00:00.000Z"
    });

    const response = await mentorFeedbackRoute(
      new Request("http://localhost/mentor/feedback", {
        method: "POST",
        body: JSON.stringify({
          session_id: "sess-1",
          mentor_message: "Anchor the next answer around a concrete example."
        })
      })
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(requireMentorApiUserMock).toHaveBeenCalledTimes(1);
    expect(addMentorFeedbackMock).toHaveBeenCalledWith({
      session_id: "sess-1",
      mentor_message: "Anchor the next answer around a concrete example."
    });
    expect(payload.success).toBe(true);
  });

  it("allows mentor takeover and flag review mutations only after mentor auth", async () => {
    requireMentorApiUserMock.mockResolvedValue({
      user_id: "mentor-1",
      roles: ["mentor"]
    });
    takeOverSessionMock.mockResolvedValue({
      intervention_id: "takeover-1",
      session_id: "sess-1",
      mentor_message: "I am taking over this session now.",
      intervention_type: "takeover",
      created_at: "2026-04-06T12:05:00.000Z"
    });
    markFlagReviewedMock.mockResolvedValue(undefined);

    const takeoverResponse = await mentorTakeoverRoute(
      new Request("http://localhost/mentor/takeover", {
        method: "POST",
        body: JSON.stringify({
          session_id: "sess-1",
          mentor_message: "I am taking over this session now."
        })
      })
    );
    const reviewResponse = await reviewFlagRoute(
      new Request("http://localhost/flags/flag-1", {
        method: "PATCH",
        body: JSON.stringify({
          mentor_notes: "Reviewed and safe to continue."
        })
      }),
      {
        params: Promise.resolve({
          flagId: "flag-1"
        })
      }
    );

    expect(takeoverResponse.status).toBe(200);
    expect(reviewResponse.status).toBe(200);
    expect(takeOverSessionMock).toHaveBeenCalledWith({
      session_id: "sess-1",
      mentor_message: "I am taking over this session now."
    });
    expect(markFlagReviewedMock).toHaveBeenCalledWith({
      flag_id: "flag-1",
      mentor_notes: "Reviewed and safe to continue."
    });
  });
});
