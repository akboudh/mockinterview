import { NextResponse } from "next/server";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { getSessionSummary } from "@/lib/services/session-service";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { sessionId } = await params;
    const summary = await getSessionSummary(sessionId, user.user_id);
    return NextResponse.json(summary);
  } catch (error) {
    return authJsonError(error, "Unable to load session summary.");
  }
}
