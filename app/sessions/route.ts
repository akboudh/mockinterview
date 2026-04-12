import { NextResponse } from "next/server";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { listSessions } from "@/lib/services/session-service";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const user = await requireApiUser();
    const sessions = await listSessions(user.user_id);
    return NextResponse.json(sessions);
  } catch (error) {
    return authJsonError(error, "Unable to load sessions.");
  }
}
