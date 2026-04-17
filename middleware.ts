import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getAppSurface } from "@/lib/app-surface";
import { ACCOUNT_KIND_COOKIE } from "@/lib/auth-constants";

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

function isStaticAsset(pathname: string) {
  return (
    pathname.startsWith("/_next") || pathname === "/favicon.ico" || pathname === "/icon.svg"
  );
}

/** Routes allowed when APP_SURFACE=mentor (mentor-only deployment). */
function isMentorSurfacePath(pathname: string) {
  return (
    pathname.startsWith("/mentor") ||
    pathname.startsWith("/flags") ||
    pathname.startsWith("/auth/") ||
    pathname === "/auth/logout" ||
    pathname === "/events/stream" ||
    pathname === "/health"
  );
}

function redirectWithRequestId(
  request: NextRequest,
  target: URL | string,
  requestId: string
) {
  const url = typeof target === "string" ? new URL(target, request.url) : target;
  const response = NextResponse.redirect(url);
  response.headers.set("x-request-id", requestId);
  return response;
}

export function middleware(request: NextRequest) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-request-id", requestId);

  if (shouldRedirectToLocalhost(request)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.hostname = "localhost";
    const response = NextResponse.redirect(redirectUrl);
    response.headers.set("x-request-id", requestId);
    return response;
  }

  const pathname = request.nextUrl.pathname;
  const search = request.nextUrl.search;

  if (isStaticAsset(pathname)) {
    return NextResponse.next({
      request: { headers: requestHeaders }
    });
  }

  const surface = getAppSurface();
  const mentorAppBase =
    process.env.MENTOR_APP_URL?.trim() || process.env.NEXT_PUBLIC_MENTOR_APP_URL?.trim();

  if (surface === "mentor") {
    if (pathname === "/" || pathname === "/login") {
      return redirectWithRequestId(
        request,
        new URL(pathname === "/login" ? "/mentor/login" : "/mentor", request.url),
        requestId
      );
    }
    if (!isMentorSurfacePath(pathname)) {
      return redirectWithRequestId(request, new URL("/mentor", request.url), requestId);
    }
  }

  if (surface === "student") {
    if (pathname.startsWith("/mentor")) {
      if (mentorAppBase) {
        try {
          const base = mentorAppBase.endsWith("/") ? mentorAppBase : `${mentorAppBase}/`;
          return redirectWithRequestId(
            request,
            new URL(pathname + search, base),
            requestId
          );
        } catch {
          /* fall through */
        }
      }
      return redirectWithRequestId(request, new URL("/", request.url), requestId);
    }
  }

  const accountKind = request.cookies.get(ACCOUNT_KIND_COOKIE)?.value;

  if (surface === "all") {
    if (accountKind === "mentor") {
      const allowed =
        pathname.startsWith("/mentor") ||
        pathname.startsWith("/flags") ||
        pathname === "/auth/logout" ||
        pathname === "/events/stream" ||
        pathname.startsWith("/auth/") ||
        pathname === "/health";

      if (!allowed) {
        return redirectWithRequestId(request, new URL("/mentor", request.url), requestId);
      }
    }

    if (accountKind === "student") {
      if (pathname.startsWith("/mentor") && pathname !== "/mentor/login") {
        return redirectWithRequestId(request, new URL("/", request.url), requestId);
      }
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders }
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg).*)"]
};
