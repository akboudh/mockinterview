import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

function shouldRedirectToLocalhost(request: NextRequest) {
  if (process.env.NODE_ENV === "production") {
    return false;
  }

  const hostname = request.headers.get("host")?.split(":")[0] ?? request.nextUrl.hostname;
  const isLoopbackHost = hostname === "127.0.0.1" || hostname === "::1";
  const accept = request.headers.get("accept") ?? "";
  const destination = request.headers.get("sec-fetch-dest") ?? "";

  return isLoopbackHost && (destination === "document" || accept.includes("text/html"));
}

export function middleware(request: NextRequest) {
  if (!shouldRedirectToLocalhost(request)) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  redirectUrl.hostname = "localhost";

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"]
};
