import { NextResponse } from "next/server";

import { clearSessionCookie, invalidateCurrentSession } from "@/lib/auth";

export async function POST(request: Request) {
  await invalidateCurrentSession();
  const response = NextResponse.redirect(new URL("/login", request.url));

  return clearSessionCookie(response, request.url);
}
