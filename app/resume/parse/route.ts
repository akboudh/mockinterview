import { NextResponse } from "next/server";

import { authJsonError, requireApiUser } from "@/lib/auth";
import { extractResumeHighlights } from "@/lib/personalization";
import { extractResumeTextFromFile } from "@/lib/resume-parser";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    await requireApiUser();
    const formData = await request.formData();
    const uploaded = formData.get("resume");

    if (!(uploaded instanceof File)) {
      throw new Error("Resume upload did not include a file.");
    }

    const resumeText = await extractResumeTextFromFile(uploaded);

    return NextResponse.json({
      file_name: uploaded.name,
      resume_text: resumeText,
      resume_highlights: extractResumeHighlights(resumeText)
    });
  } catch (error) {
    return authJsonError(error, "Unable to parse the uploaded resume.");
  }
}
