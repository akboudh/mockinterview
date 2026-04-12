import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireMentorApiUser } from "@/lib/auth";
import { getFlagDetail, markFlagReviewed } from "@/lib/services/mentor-service";

export const dynamic = "force-dynamic";

const patchSchema = z.object({
  mentor_notes: z.string().nullable().optional()
});

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    await requireMentorApiUser();
    const { flagId } = await params;
    const detail = await getFlagDetail(flagId);
    return NextResponse.json(detail);
  } catch (error) {
    return authJsonError(error, "Unable to load flag details.");
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ flagId: string }> }
) {
  try {
    await requireMentorApiUser();
    const { flagId } = await params;
    const body = patchSchema.parse(await request.json());
    await markFlagReviewed({
      flag_id: flagId,
      mentor_notes: body.mentor_notes ?? null
    });
    return NextResponse.json({
      success: true,
      flag_id: flagId
    });
  } catch (error) {
    return authJsonError(error, "Unable to update flag.");
  }
}
