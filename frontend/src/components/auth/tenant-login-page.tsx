"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { parseTenantSlugFromHost, tenantPortalLabel } from "@/lib/tenant-config";
import { LoginForm } from "@/components/auth/login-form";
import { apiFetch, ApiError } from "@/lib/api";

type TenantBranding = {
  slug: string;
  name: string;
  companyLegalName: string | null;
  logoUrl: string | null;
};

function TenantLoginInner({ slug }: { slug: string }) {
  const [tenant, setTenant] = useState<TenantBranding | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState("");

  useEffect(() => {
    let cancelled = false;

    apiFetch<TenantBranding>(`/api/public/tenants/${slug}`)
      .then((data) => {
        if (!cancelled) setTenant(data);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 404) {
          setNotFound(true);
        } else {
          setLoadError(err instanceof ApiError ? err.message : "Failed to load company portal");
        }
      });

    return () => {
      cancelled = true;
    };
  }, [slug]);

  if (notFound) {
    return (
      <div className="min-h-screen pro-shell flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Company portal not found</h1>
          <p className="text-sm text-slate-500 mb-4">
            No active company matches <code className="bg-slate-100 px-1 rounded">{tenantPortalLabel(slug)}</code>.
          </p>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">Go to generic login</Link>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen pro-shell flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-red-50 text-red-600 mb-3">
            <AlertCircle className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-semibold text-slate-900 mb-2">Could not load portal</h1>
          <p className="text-sm text-slate-500 mb-4">{loadError}</p>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">Go to generic login</Link>
        </div>
      </div>
    );
  }

  return <LoginForm workspaceSlug={slug} tenantBranding={tenant} />;
}

export function TenantLoginPage({
  initialSlug,
  slugFromPath,
}: {
  /** From Host header (subdomain rewrite) */
  initialSlug?: string | null;
  /** From /{slug}/login path */
  slugFromPath?: string | null;
}) {
  const [hostSlug, setHostSlug] = useState<string | null>(initialSlug ?? null);

  useEffect(() => {
    if (!hostSlug) {
      setHostSlug(parseTenantSlugFromHost(window.location.host));
    }
  }, [hostSlug]);

  const slug = hostSlug || slugFromPath;

  if (!slug) {
    return (
      <div className="min-h-screen pro-shell flex items-center justify-center p-6">
        <div className="text-center max-w-md">
          <p className="text-sm text-slate-500 mb-4">Open your company portal URL to sign in.</p>
          <Link href="/login" className="text-sm text-blue-600 hover:underline">Find your company portal</Link>
        </div>
      </div>
    );
  }

  return (
    <Suspense fallback={null}>
      <TenantLoginInner slug={slug} />
    </Suspense>
  );
}
