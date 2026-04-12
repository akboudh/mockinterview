import { NextResponse } from "next/server";
import { z } from "zod";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { updateDb } from "@/lib/db";
import { extractResumeHighlights, normalizeResumeText } from "@/lib/personalization";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const saveResumeSchema = z.object({
  resume_text: z.string().min(1),
  file_name: z.string().nullable().optional()
});

export async function POST(request: Request) {
  try {
    const user = await requireApiUser();
    const body = saveResumeSchema.parse(await request.json());
    const resumeText = normalizeResumeText(body.resume_text);

    if (!resumeText) {
      throw new Error("The uploaded resume did not contain readable text.");
    }

    await updateDb((db) => ({
      ...db,
      users: db.users.map((entry) =>
        entry.user_id === user.user_id
          ? {
              ...entry,
              resume_text: resumeText,
              resume_file_name: body.file_name?.trim() || null,
              updated_at: new Date().toISOString()
            }
          : entry
      )
    }));

    return NextResponse.json({
      success: true,
      resume_text: resumeText,
      resume_file_name: body.file_name?.trim() || null,
      resume_highlights: extractResumeHighlights(resumeText)
    });
  } catch (error) {
    return authJsonError(error, "Unable to save the uploaded resume.");
  }
}

export async function DELETE() {
  try {
    const user = await requireApiUser();

    await updateDb((db) => ({
      ...db,
      users: db.users.map((entry) =>
        entry.user_id === user.user_id
          ? {
              ...entry,
              resume_text: null,
              resume_file_name: null,
              updated_at: new Date().toISOString()
            }
          : entry
      )
    }));

    return NextResponse.json({ success: true });
  } catch (error) {
    return authJsonError(error, "Unable to remove the saved resume.");
  }
}
