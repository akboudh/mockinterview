import { NextResponse } from "next/server";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { logEvent } from "@/lib/logging";
import { assertSessionOwnership, endSession } from "@/lib/services/session-service";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { sessionId } = await params;
    await assertSessionOwnership(sessionId, user.user_id);
    await endSession(sessionId, "manual_end");
    return NextResponse.json({
      success: true,
      session_id: sessionId,
      status: "completed"
    });
  } catch (error) {
    logEvent(
      "session.end.failed",
      {
        reason: error instanceof Error ? error.message : "unknown"
      },
      "warn"
    );
    return authJsonError(error, "Unable to end the session.");
  }
}
