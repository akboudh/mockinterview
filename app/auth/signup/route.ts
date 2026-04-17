import { NextResponse } from "next/server";
import { z } from "zod";

import {
  accountKindFromUser,
  applySessionCookie,
  authJsonError,
  createAuthSession,
  createUserAccount,
  getUserRoles
} from "@/lib/auth";
import { logEvent, requestIdFromRequest } from "@/lib/logging";
import { assertWithinRateLimit, clientIpFromRequest } from "@/lib/rate-limit";

const signupSchema = z.object({
  display_name: z.string().nullable().optional(),
  email: z.string().email(),
  password: z.string().min(8),
  account_type: z.enum(["student", "mentor"]).optional(),
  mentor_access_code: z.string().nullable().optional()
});

export async function POST(request: Request) {
  try {
    assertWithinRateLimit(`auth:signup:${clientIpFromRequest(request)}`, 15, 60_000);
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

    return applySessionCookie(response, session, request.url, {
      accountKind: accountKindFromUser(user)
    });
  } catch (error) {
    logEvent(
      "auth.signup.failed",
      {
        request_id: requestIdFromRequest(request),
        reason: error instanceof Error ? error.message : "unknown"
      },
      "warn"
    );
    return authJsonError(error, "Unable to create account.");
  }
}
