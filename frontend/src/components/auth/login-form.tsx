"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { tenantPath, tenantPortalLabel, isSubdomainTenancyEnabled } from "@/lib/tenant-config";
import {
  cleanPortalLoginQueryFromUrl,
  clearPortalSignInCookie,
  consumePortalLoginEmail,
} from "@/lib/portal-login-handoff";
import { PRODUCT_NAME } from "@/lib/brand";

type TenantBranding = {
  slug: string;
  name: string;
  companyLegalName: string | null;
  logoUrl: string | null;
};

export function LoginForm({
  workspaceSlug,
  tenantBranding,
}: {
  workspaceSlug?: string;
  tenantBranding?: TenantBranding | null;
}) {
  const searchParams = useSearchParams();
  const queryEmail = searchParams.get("email")?.trim() || "";

  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiDown, setApiDown] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState(queryEmail);

  useEffect(() => {
    const fromPortal = consumePortalLoginEmail();
    const prefill = fromPortal || queryEmail;
    if (prefill) setEmail(prefill);
    clearPortalSignInCookie();
    cleanPortalLoginQueryFromUrl();
  }, [queryEmail]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const err = params.get("error");
    if (err) setError(err);
    fetch("/health")
      .then((r) => setApiDown(!r.ok))
      .catch(() => setApiDown(true));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    const submitEmail = (fd.get("email") as string)?.trim() || email;
    try {
      const result = await apiFetch<{ workspaceSlug?: string }>("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: submitEmail,
          password: fd.get("password"),
          ...(workspaceSlug ? { workspaceSlug } : {}),
        }),
      });
      const slug = result.workspaceSlug || workspaceSlug;
      window.location.href = slug ? tenantPath(slug, "/dashboard") : "/dashboard";
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Invalid email or password. Please try again.");
      setLoading(false);
    }
  }

  const displayName = tenantBranding?.companyLegalName || tenantBranding?.name || undefined;
  const portalLabel = workspaceSlug ? tenantPortalLabel(workspaceSlug) : null;

  return (
    <AuthShell
      title={displayName ? `Sign in to ${displayName}` : "Welcome back"}
      subtitle={
        workspaceSlug
          ? `Company portal · ${portalLabel}`
          : `Sign in to your ${PRODUCT_NAME} workspace`
      }
      logoUrl={tenantBranding?.logoUrl}
      footer={
        <div className="text-center text-sm text-slate-500 space-y-2">
          {workspaceSlug && (
            <p className="text-xs text-slate-500">
              Enter your work email and password for this company workspace.
            </p>
          )}
          {!workspaceSlug && (
            <p className="text-xs">
              <Link href="/login" className="text-indigo-600 hover:underline font-medium">
                Find your company portal
              </Link>
              {" "}with email or mobile first.
            </p>
          )}
          <p className="text-xs">
            Need help?{" "}
            <a href={SUPPORT_MAILTO} className="text-indigo-600 hover:underline">{SUPPORT_EMAIL}</a>
          </p>
        </div>
      }
    >
      {apiDown && (
        <div className="mb-5 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-medium">Service temporarily unavailable</p>
            <p className="text-xs text-amber-800/80 mt-0.5">Please try again in a moment.</p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="auth-label">Work email</label>
          <div className="auth-input-wrap">
            <Mail className="auth-input-icon" />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@company.com"
              className="auth-input"
            />
          </div>
        </div>

        <div>
          <label htmlFor="password" className="auth-label">Password</label>
          <div className="auth-input-wrap">
            <Lock className="auth-input-icon" />
            <input
              id="password"
              name="password"
              type={showPassword ? "text" : "password"}
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="auth-input pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Forgot password? Contact your workspace admin or{" "}
            <a href={SUPPORT_MAILTO} className="text-indigo-600 hover:underline">{SUPPORT_EMAIL}</a>.
          </p>
        </div>

        {error && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading || apiDown} className="auth-btn-primary w-full">
          {loading ? "Signing in…" : "Sign in"}
        </button>
      </form>

      {workspaceSlug && isSubdomainTenancyEnabled() && portalLabel && (
        <p className="mt-4 text-center text-[11px] text-slate-400">
          You&apos;re on <span className="font-medium text-slate-500">{portalLabel}</span>
        </p>
      )}
    </AuthShell>
  );
}
