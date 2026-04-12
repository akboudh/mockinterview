import { NextResponse } from "next/server";
import { z } from "zod";

import {
  AuthError,
  applySessionCookie,
  authJsonError,
  authenticateUser,
  createAuthSession,
  getUserRoles,
  userHasRole
} from "@/lib/auth";
import { logEvent } from "@/lib/logging";

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  required_role: z.enum(["student", "mentor"]).optional()
});

export async function POST(request: Request) {
  try {
    const body = loginSchema.parse(await request.json());
    const user = await authenticateUser(body);

    if (body.required_role === "mentor" && !userHasRole(user, ["mentor", "admin"])) {
      throw new AuthError("This account does not have mentor access.", 403);
    }

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
      "auth.login.route_failed",
      {
        reason: error instanceof Error ? error.message : "unknown"
      },
      "warn"
    );
    return authJsonError(error, "Unable to sign in.");
  }
}
