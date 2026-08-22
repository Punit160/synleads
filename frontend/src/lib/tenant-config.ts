/** Root app domain for subdomain tenancy, e.g. localhost:3000 or synentrix.com */
export const APP_DOMAIN = process.env.NEXT_PUBLIC_APP_DOMAIN?.trim() || "";

/** URL segments that are not company portal slugs */
export const RESERVED_TENANT_SLUGS = new Set([
  "login",
  "register",
  "dashboard",
  "api",
  "health",
  "platform",
  "admin",
  "www",
  "app",
  "static",
  "_next",
]);

export function isReservedTenantSlug(slug: string): boolean {
  const s = slug.toLowerCase();
  return RESERVED_TENANT_SLUGS.has(s) || s.startsWith("synentrix-cp-");
}

export function isSubdomainTenancyEnabled(): boolean {
  return APP_DOMAIN.length > 0;
}

function normalizeHostname(host: string): string {
  return host.split(":")[0].toLowerCase();
}

export function getAppDomainHost(): string {
  return normalizeHostname(APP_DOMAIN || "localhost");
}

/** Extract tenant slug from Host header, e.g. synentrix-demo.localhost → synentrix-demo */
export function parseTenantSlugFromHost(host: string): string | null {
  if (!host) return null;
  const hostname = normalizeHostname(host);
  const domainHost = getAppDomainHost();

  if (hostname === domainHost || hostname === `www.${domainHost}`) return null;

  const suffix = `.${domainHost}`;
  if (!hostname.endsWith(suffix)) return null;

  const slug = hostname.slice(0, -suffix.length);
  if (!slug || slug.includes(".") || isReservedTenantSlug(slug)) return null;
  return slug;
}

export function tenantOrigin(slug: string): string {
  const domain = APP_DOMAIN || "localhost:3000";
  const protocol = domain.includes("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${domain}`;
}

/** Full company login URL */
export function tenantLoginUrl(slug: string): string {
  if (isSubdomainTenancyEnabled()) {
    return `${tenantOrigin(slug)}/login`;
  }
  return `/${slug}/login`;
}

export function parseTenantSlugFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/([^/]+)/);
  if (!match) return null;
  const slug = match[1];
  if (isReservedTenantSlug(slug)) return null;
  return slug;
}

/** Prefer subdomain host, then legacy path prefix. */
export function resolveTenantSlug(host: string | null | undefined, pathname: string): string | null {
  if (host) {
    const fromHost = parseTenantSlugFromHost(host);
    if (fromHost) return fromHost;
  }
  return parseTenantSlugFromPath(pathname);
}

/**
 * Build tenant-scoped navigation target.
 * Subdomain mode on tenant host: /dashboard/leads (no slug prefix).
 * Subdomain mode from apex: https://slug.domain/dashboard/leads
 * Legacy path mode: /{slug}/dashboard/leads
 */
export function tenantPath(
  slug: string | null | undefined,
  path: string,
  opts?: { host?: string }
): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;

  if (isSubdomainTenancyEnabled() && slug) {
    const host = opts?.host ?? (typeof window !== "undefined" ? window.location.host : "");
    const hostSlug = host ? parseTenantSlugFromHost(host) : null;
    if (hostSlug === slug) {
      if (normalized === "/login") return "/login";
      if (normalized.startsWith("/dashboard")) return normalized;
      return normalized;
    }
    if (normalized === "/login") return tenantLoginUrl(slug);
    if (normalized.startsWith("/dashboard")) return `${tenantOrigin(slug)}${normalized}`;
  }

  if (!slug) return normalized;
  if (normalized === "/dashboard" || normalized.startsWith("/dashboard/")) {
    return `/${slug}${normalized}`;
  }
  if (normalized === "/login") return `/${slug}/login`;
  return `/${slug}${normalized}`;
}

/** Human-readable portal label for UI copy */
export function tenantPortalLabel(slug: string): string {
  if (isSubdomainTenancyEnabled()) {
    return `${slug}.${getAppDomainHost()}`;
  }
  return `/${slug}`;
}
