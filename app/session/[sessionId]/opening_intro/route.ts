import { NextResponse } from "next/server";

import { requireApiUser } from "@/lib/auth";
import { prependOpeningIntroMessage } from "@/lib/services/session-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(
  _request: Request,
  context: { params: Promise<{ sessionId: string }> }
) {
  try {
    const user = await requireApiUser();
    const { sessionId } = await context.params;
    const result = await prependOpeningIntroMessage(sessionId, user.user_id);
    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save opening line.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
