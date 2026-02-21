import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";

const OLD_ROUTES = ["/agents", "/departments", "/graph", "/cost", "/skills"];
const PUBLIC_ROUTES = ["/login", "/auth/callback", "/cli/", "/", "/explore"];
const PUBLIC_API_ROUTES = ["/api/register", "/api/cli/", "/api/public/", "/api/fork-organization"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip auth for public routes (exact match for "/" to avoid matching everything)
  // Also skip for /org/ and /api/organizations/ — API handlers check visibility themselves
  if (
    pathname === "/" ||
    PUBLIC_ROUTES.filter((r) => r !== "/").some((r) => pathname.startsWith(r)) ||
    PUBLIC_API_ROUTES.some((r) => pathname.startsWith(r)) ||
    pathname.startsWith("/org/") ||
    pathname.startsWith("/api/organizations/")
  ) {
    return NextResponse.next();
  }

  // Create Supabase client for session refresh
  let response = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Update request cookies (for downstream middleware/routes)
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          // Update response cookies (sent back to browser)
          response = NextResponse.next({
            request: { headers: request.headers },
          });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
        },
      },
    },
  );

  // Refresh session — MUST use getUser() for server-side validation
  const { data: { user } } = await supabase.auth.getUser();

  // Auth gate: redirect unauthenticated users to /login
  if (!user) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect old flat routes to org-scoped routes
  const matchedRoute = OLD_ROUTES.find(
    (route) => pathname === route || pathname.startsWith(`${route}/`),
  );

  if (matchedRoute) {
    const lastOrg = request.cookies.get("agent-factorio-last-org")?.value;
    if (lastOrg) {
      const newPath = `/org/${lastOrg}${pathname}`;
      return NextResponse.redirect(new URL(newPath, request.url));
    }
    return NextResponse.redirect(new URL("/", request.url));
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|assets/|.*\\.png$|.*\\.jpg$|.*\\.svg$|.*\\.ico$|.*\\.sh$).*)",
  ],
};
