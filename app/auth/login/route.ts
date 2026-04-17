import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthError,
  accountKindFromUser,
  applySessionCookie,
  authJsonError,
  authenticateUser,
  createAuthSession,
  getUserRoles,
  userHasRole
} from "@/lib/auth";
import { logEvent, requestIdFromRequest } from "@/lib/logging";
import { assertWithinRateLimit, clientIpFromRequest } from "@/lib/rate-limit";
import type { UserProfile } from "@/lib/types";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  required_role: z.enum(["student", "mentor"]).optional()
});

function assertLoginMatchesPortal(
  user: UserProfile,
  requiredRole: "student" | "mentor" | undefined
) {
  if (requiredRole === "mentor") {
    if (!userHasRole(user, ["mentor", "admin"])) {
      throw new AuthError("This account does not have mentor access.", 403);
    }
    return;
  }

  if (requiredRole === "student") {
    if (userHasRole(user, "mentor") && !userHasRole(user, "student")) {
      throw new AuthError("This is a mentor account. Sign in from the mentor page.", 403);
    }
    if (!userHasRole(user, ["student", "admin"])) {
      throw new AuthError("This account is not a student account.", 403);
    }
  }
}

export async function POST(request: Request) {
  try {
    assertWithinRateLimit(`auth:login:${clientIpFromRequest(request)}`, 30, 60_000);
    const body = loginSchema.parse(await request.json());
    const user = await authenticateUser(body);
    assertLoginMatchesPortal(user, body.required_role);

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
      "auth.login.route_failed",
      {
        request_id: requestIdFromRequest(request),
        reason: error instanceof Error ? error.message : "unknown"
      },
      "warn"
    );
    return authJsonError(error, "Unable to sign in.");
  }
}
