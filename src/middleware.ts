import { NextResponse, type NextRequest } from "next/server";

/**
 * Cheap redirect for requests that carry no session cookie at all.
 *
 * This is an optimisation, not the authorisation boundary. Middleware runs on
 * the edge runtime where a Postgres connection is not available, so it cannot
 * validate a session — it only avoids rendering a dashboard route for an
 * obviously anonymous visitor. Every protected page and server action calls
 * requireAuth()/requirePermission(), which is where access is actually decided.
 */
const SESSION_COOKIE = "hros_session";

const PUBLIC_PATHS = ["/auth/login", "/auth/setup", "/api/health"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isPublic) return NextResponse.next();

  if (!request.cookies.has(SESSION_COOKIE)) {
    // API callers get a status they can act on, not an HTML login page.
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Not signed in." }, { status: 401 });
    }

    const url = request.nextUrl.clone();
    url.pathname = "/auth/login";
    // Assign `search` as a string. Mutating `url.searchParams` after clearing
    // `search` on a NextURL silently drops the change, which lost the `next`
    // parameter and always sent people to the dashboard instead of back.
    url.search = pathname === "/" ? "" : `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *  - _next/static
     *  - _next/image
     *  - favicon.ico
     *  - public files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
