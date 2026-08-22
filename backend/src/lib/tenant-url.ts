const APP_DOMAIN = process.env.APP_DOMAIN?.trim() || "";

function normalizeHostname(host: string): string {
  return host.split(":")[0].toLowerCase();
}

function getAppDomainHost(): string {
  return normalizeHostname(APP_DOMAIN || "localhost");
}

export function isSubdomainTenancyEnabled(): boolean {
  return APP_DOMAIN.length > 0;
}

export function tenantOrigin(slug: string): string {
  const domain = APP_DOMAIN || "localhost:3000";
  const protocol = domain.includes("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${domain}`;
}

/** Company portal login URL returned to platform admin & integrations */
export function tenantPortalLoginUrl(slug: string): string {
  if (isSubdomainTenancyEnabled()) {
    return `${tenantOrigin(slug)}/login`;
  }
  const frontend = process.env.FRONTEND_URL || "http://localhost:3000";
  try {
    const base = new URL(frontend);
    return `${base.origin}/${slug}/login`;
  } catch {
    return `/${slug}/login`;
  }
}

/** @deprecated use tenantPortalLoginUrl — kept for field name compatibility */
export function tenantPortalLoginPath(slug: string): string {
  return tenantPortalLoginUrl(slug);
}

export function tenantPortalLabel(slug: string): string {
  if (isSubdomainTenancyEnabled()) {
    return `${slug}.${getAppDomainHost()}`;
  }
  return `/${slug}`;
}
