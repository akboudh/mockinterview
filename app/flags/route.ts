import { NextResponse } from "next/server";

import { authJsonError, requireMentorApiUser } from "@/lib/auth";
import { listFlags } from "@/lib/services/mentor-service";

export async function GET() {
  try {
    await requireMentorApiUser();
    const flags = await listFlags();
    return NextResponse.json(flags);
  } catch (error) {
    return authJsonError(error, "Unable to load flags.");
  }
}
