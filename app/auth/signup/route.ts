import { NextResponse } from "next/server";
import { z } from "zod";

import {
  applySessionCookie,
  authJsonError,
  createAuthSession,
  createUserAccount,
  getUserRoles
} from "@/lib/auth";
import { logEvent } from "@/lib/logging";

const signupSchema = z.object({
  display_name: z.string().nullable().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  account_type: z.enum(["student", "mentor"]).optional(),
  mentor_access_code: z.string().nullable().optional()
});

export async function POST(request: Request) {
  try {
    const body = signupSchema.parse(await request.json());
    const user = await createUserAccount({
      email: body.email,
      password: body.password,
      displayName: body.display_name ?? null,
      requestedRole: body.account_type ?? "student",
      mentorAccessCode: body.mentor_access_code ?? null
    });
    const session = await createAuthSession(user.user_id);
    const response = NextResponse.json({
      success: true,
      user: {
        user_id: user.user_id,
        display_name: user.display_name,
        email: user.email,
        roles: getUserRoles(user)
      }
    });

    return applySessionCookie(response, session, request.url);
  } catch (error) {
    logEvent(
      "auth.signup.failed",
      {
        reason: error instanceof Error ? error.message : "unknown"
      },
      "warn"
    );
    return authJsonError(error, "Unable to create account.");
  }
}
