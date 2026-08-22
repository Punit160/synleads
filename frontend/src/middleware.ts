import { NextRequest, NextResponse } from "next/server";
import {
  PLATFORM_ADMIN_BASE,
  PLATFORM_LOGIN_PATH,
  isPlatformPath,
} from "@/lib/platform-config";
import {
  isReservedTenantSlug,
  isSubdomainTenancyEnabled,
  parseTenantSlugFromHost,
  tenantLoginUrl,
  tenantOrigin,
} from "@/lib/tenant-config";
import { PORTAL_SIGNIN_COOKIE } from "@/lib/portal-login-handoff";

/** Public paths — apex portal lookup and company subdomain login both use /login */
const publicPaths = ["/", "/login", "/register", "/health", PLATFORM_LOGIN_PATH];

function matchTenantPath(pathname: string) {
  const match = pathname.match(/^\/([^/]+)(\/.*)?$/);
  if (!match) return null;
  const slug = match[1];
  if (isReservedTenantSlug(slug)) return null;
  return { slug, rest: match[2] || "" };
}

function wantsExplicitSignIn(request: NextRequest): boolean {
  if (request.cookies.get(PORTAL_SIGNIN_COOKIE)?.value === "1") return true;
  const params = request.nextUrl.searchParams;
  return params.has("email") || params.get("signin") === "1";
}

function handleTenantSubdomain(
  request: NextRequest,
  hostSlug: string,
  pathname: string,
  token: string | undefined,
  tenantSlugCookie: string | undefined
) {
  if (pathname === "/" || pathname === "") {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (pathname === "/login") {
    if (token && tenantSlugCookie === hostSlug && !wantsExplicitSignIn(request)) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/dashboard")) {
    if (!token) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    if (tenantSlugCookie && tenantSlugCookie !== hostSlug) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.next();
  }

  return NextResponse.redirect(new URL("/dashboard", request.url));
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const host = request.headers.get("host") || "";
  const hostSlug = parseTenantSlugFromHost(host);
  const token = request.cookies.get("session")?.value;
  const tenantSlugCookie = request.cookies.get("tenant_slug")?.value;

  if (pathname.startsWith("/api/platform/")) {
    return NextResponse.next();
  }

  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/public/") ||
    pathname.startsWith("/_next") ||
    pathname.includes(".")
  ) {
    return NextResponse.next();
  }

  if (isPlatformPath(pathname)) {
    const platformToken = request.cookies.get("platform_session")?.value;
    const isLoginPage = pathname === PLATFORM_LOGIN_PATH;

    if (!platformToken && !isLoginPage) {
      return NextResponse.redirect(new URL(PLATFORM_LOGIN_PATH, request.url));
    }
    if (platformToken && isLoginPage) {
      return NextResponse.redirect(new URL(`${PLATFORM_ADMIN_BASE}/dashboard`, request.url));
    }
    return NextResponse.next();
  }

  if (pathname.startsWith("/platform")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  // Company subdomain (synentrix-demo.localhost)
  if (hostSlug) {
    return handleTenantSubdomain(request, hostSlug, pathname, token, tenantSlugCookie);
  }

  // Legacy /{slug}/login on apex → redirect to subdomain when enabled
  const tenant = matchTenantPath(pathname);
  if (tenant && isSubdomainTenancyEnabled()) {
    const { slug, rest } = tenant;
    if (rest === "" || rest === "/") {
      return NextResponse.redirect(tenantLoginUrl(slug));
    }
    if (rest === "/login" || rest.startsWith("/dashboard")) {
      return NextResponse.redirect(new URL(rest || "/login", tenantOrigin(slug)));
    }
  }

  if (tenant) {
    const { slug, rest } = tenant;

    if (rest === "" || rest === "/") {
      return NextResponse.redirect(new URL(`/${slug}/login`, request.url));
    }

    if (rest === "/login") {
      if (token && tenantSlugCookie === slug && !wantsExplicitSignIn(request)) {
        return NextResponse.redirect(new URL(`/${slug}/dashboard`, request.url));
      }
      return NextResponse.next();
    }

    if (rest.startsWith("/dashboard")) {
      if (!token) {
        return NextResponse.redirect(new URL(`/${slug}/login`, request.url));
      }
      const url = request.nextUrl.clone();
      url.pathname = rest;
      return NextResponse.rewrite(url);
    }
  }

  if (publicPaths.includes(pathname)) {
    return NextResponse.next();
  }

  if (!token) {
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.redirect(new URL("/login", request.url));
  }

  if (isSubdomainTenancyEnabled() && tenantSlugCookie && pathname.startsWith("/dashboard")) {
    return NextResponse.redirect(new URL(pathname, tenantOrigin(tenantSlugCookie)));
  }

  if (pathname.startsWith("/dashboard") && tenantSlugCookie) {
    return NextResponse.redirect(new URL(`/${tenantSlugCookie}${pathname}`, request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
