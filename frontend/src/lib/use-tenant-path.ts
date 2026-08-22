"use client";

import { useCallback } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  parseTenantSlugFromHost,
  parseTenantSlugFromPath,
  tenantPath,
} from "@/lib/tenant-config";

/** Resolve tenant slug from auth, subdomain host, or legacy URL path. */
export function useTenantSlug(): string | null {
  const auth = useAuth();
  const pathname = usePathname();
  const hostSlug =
    typeof window !== "undefined" ? parseTenantSlugFromHost(window.location.host) : null;
  return auth.workspace?.slug ?? hostSlug ?? parseTenantSlugFromPath(pathname);
}

/** Build tenant navigation paths (subdomain-aware). */
export function useTenantPath() {
  const slug = useTenantSlug();
  const host = typeof window !== "undefined" ? window.location.host : undefined;
  return useCallback((path: string) => tenantPath(slug, path, { host }), [slug, host]);
}

/** Router helpers that always use tenant-scoped dashboard paths. */
export function useTenantRouter() {
  const router = useRouter();
  const tp = useTenantPath();
  return {
    push: (path: string) => router.push(tp(path)),
    replace: (path: string) => router.replace(tp(path)),
    tenantPath: tp,
  };
}
