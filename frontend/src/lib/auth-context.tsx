"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { parseTenantSlugFromHost, parseTenantSlugFromPath, tenantPath, tenantLoginUrl, isSubdomainTenancyEnabled } from "@/lib/tenant-config";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
};

export type AuthState = {
  user: AuthUser | null;
  workspace: { id: string; name: string; slug?: string; status: string; logoUrl?: string | null } | null;
  role: string;
  roleLabel: string;
  permissions: string[];
  subscription: {
    package: string;
    packageLabel?: string;
    status: string;
    expiresAt: string;
    maxUsers?: number | null;
    memberCount?: number;
  } | null;
  loading: boolean;
  hasPermission: (p: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const pathSlug =
    (typeof window !== "undefined" ? parseTenantSlugFromHost(window.location.host) : null) ??
    parseTenantSlugFromPath(pathname);
  const [state, setState] = useState<Omit<AuthState, "hasPermission">>({
    user: null,
    workspace: null,
    role: "employee",
    roleLabel: "Employee",
    permissions: [],
    subscription: null,
    loading: true,
  });

  useEffect(() => {
    let cancelled = false;
    apiFetch<{
      user: AuthUser | null;
      workspace?: { id: string; name: string; slug?: string; status: string; logoUrl?: string | null };
      membership?: { role: string; roleLabel: string };
      permissions?: string[];
      subscription?: {
        package: string;
        packageLabel?: string;
        status: string;
        expiresAt: string;
        maxUsers?: number | null;
        memberCount?: number;
      } | null;
      error?: string;
    }>("/api/auth/me")
      .then((data) => {
        if (cancelled) return;
        const loginPath = pathSlug ? tenantPath(pathSlug, "/login") : "/login";
        if (!data.user) {
          router.replace(loginPath);
          return;
        }
        if (data.error) {
          router.replace(`${loginPath}?error=${encodeURIComponent(data.error)}`);
          return;
        }
        setState({
          user: data.user,
          workspace: data.workspace || null,
          role: data.membership?.role || "employee",
          roleLabel: data.membership?.roleLabel || "Employee",
          permissions: data.permissions || [],
          subscription: data.subscription || null,
          loading: false,
        });
      })
      .catch(() => {
        if (!cancelled) router.replace(pathSlug ? tenantPath(pathSlug, "/login") : "/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router, pathSlug]);

  useEffect(() => {
    if (state.loading || !state.workspace?.slug) return;
    const slug = state.workspace.slug;
    const hostSlug = typeof window !== "undefined" ? parseTenantSlugFromHost(window.location.host) : null;

    if (hostSlug) {
      if (slug !== hostSlug) {
        window.location.href = tenantLoginUrl(slug);
      }
      return;
    }

    if (pathSlug && slug !== pathSlug) {
      const rest = pathname.replace(/^\/[^/]+/, "") || "/dashboard";
      if (isSubdomainTenancyEnabled()) {
        window.location.href = tenantPath(slug, rest);
        return;
      }
      router.replace(tenantPath(slug, rest));
      return;
    }
    if (pathname.startsWith("/dashboard") && !isSubdomainTenancyEnabled()) {
      router.replace(tenantPath(slug, pathname));
    }
  }, [state.loading, state.workspace?.slug, pathname, pathSlug, router]);

  const value: AuthState = {
    ...state,
    hasPermission: (p: string) => state.permissions.includes(p),
  };

  if (state.loading) {
    return (
      <div className="min-h-screen pro-shell flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 rounded-full border-2 border-blue-600 border-t-transparent animate-spin" />
          <p className="text-sm text-slate-500">Loading workspace…</p>
        </div>
      </div>
    );
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
