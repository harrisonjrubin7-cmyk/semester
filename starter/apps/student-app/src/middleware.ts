import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// First gate only: checks that a session cookie exists. Every data access
// re-checks the session and policy in the DAL.
const PUBLIC_PATHS = ["/", "/signup"];

function isPublicPath(pathname: string): boolean {
  return PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (isPublicPath(pathname) || pathname.startsWith("/_next") || pathname === "/favicon.ico") {
    return NextResponse.next();
  }

  if (!request.cookies.get("semester_session")) {
    const loginUrl = new URL("/signup", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api/public).*)"],
};
