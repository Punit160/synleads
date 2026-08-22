"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Mail, Phone, AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { AuthShell } from "@/components/auth/auth-shell";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { cn } from "@/lib/utils";
import { stashPortalLoginHandoff } from "@/lib/portal-login-handoff";

type ResolveResult = {
  workspaceSlug: string;
  companyName: string;
  email: string;
  userName: string;
  loginUrl: string;
};

function cacheKey(identifier: string) {
  return identifier.trim().toLowerCase();
}

function redirectToCompanyLogin(result: ResolveResult) {
  stashPortalLoginHandoff(result.email);
  const base = result.loginUrl.startsWith("http")
    ? result.loginUrl
    : `${window.location.origin}${result.loginUrl.startsWith("/") ? result.loginUrl : `/${result.loginUrl}`}`;
  const url = new URL(base);
  url.search = "";
  window.location.assign(url.toString());
}

export function PortalLookupForm() {
  const [mode, setMode] = useState<"email" | "phone">("email");
  const [identifier, setIdentifier] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [redirectCompany, setRedirectCompany] = useState("");
  const [apiDown, setApiDown] = useState(false);

  const resolveCache = useRef(new Map<string, ResolveResult>());
  const prefetchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const prefetchAbort = useRef<AbortController | null>(null);

  useEffect(() => {
    fetch("/health")
      .then((r) => setApiDown(!r.ok))
      .catch(() => setApiDown(true));
  }, []);

  const resolvePortal = useCallback(async (value: string, signal?: AbortSignal) => {
    return apiFetch<ResolveResult>("/api/auth/resolve-portal", {
      method: "POST",
      body: JSON.stringify({ identifier: value }),
      signal,
    });
  }, []);

  useEffect(() => {
    const trimmed = identifier.trim();
    if (trimmed.length < 3) return;

    if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    prefetchTimer.current = setTimeout(() => {
      const key = cacheKey(trimmed);
      if (resolveCache.current.has(key)) return;

      prefetchAbort.current?.abort();
      const controller = new AbortController();
      prefetchAbort.current = controller;

      resolvePortal(trimmed, controller.signal)
        .then((result) => {
          resolveCache.current.set(key, result);
        })
        .catch(() => {
          /* ignore prefetch errors */
        });
    }, 350);

    return () => {
      if (prefetchTimer.current) clearTimeout(prefetchTimer.current);
    };
  }, [identifier, resolvePortal]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = identifier.trim();
    if (!value) {
      setError("Enter your work email or mobile number");
      return;
    }

    setLoading(true);
    setError("");
    setRedirectCompany("");

    const cached = resolveCache.current.get(cacheKey(value));
    if (cached) {
      setRedirectCompany(cached.companyName);
      redirectToCompanyLogin(cached);
      return;
    }

    try {
      const result = await resolvePortal(value);
      resolveCache.current.set(cacheKey(value), result);
      setRedirectCompany(result.companyName);
      redirectToCompanyLogin(result);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
      } else {
        setError("No account found with this email or mobile number");
      }
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title="Sign in to Synentrix Flow"
      subtitle="Enter your work email or mobile — we'll take you to your company login page"
      footer={
        <div className="text-center text-sm text-slate-500 space-y-2">
          <p className="text-xs text-slate-500">
            Already know your company URL? Open it directly for email &amp; password sign-in.
          </p>
          <p>
            Don&apos;t have access yet?{" "}
            <a href={SUPPORT_MAILTO} className="text-indigo-600 font-semibold hover:underline">
              Contact Synentrix
            </a>
          </p>
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

      {loading ? (
        <div className="text-center py-10 space-y-3">
          <Loader2 className="h-10 w-10 text-indigo-600 animate-spin mx-auto" />
          <p className="text-sm font-medium text-slate-900">
            {redirectCompany ? `Opening ${redirectCompany}…` : "Finding your company portal…"}
          </p>
          <p className="text-xs text-slate-500">Redirecting to your company login</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="flex rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(["email", "phone"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className={cn(
                  "flex-1 rounded-md py-2 text-xs font-semibold transition",
                  mode === m ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                )}
              >
                {m === "email" ? "Work email" : "Mobile number"}
              </button>
            ))}
          </div>

          <div>
            <label htmlFor="identifier" className="auth-label">
              {mode === "email" ? "Work email" : "Mobile number"}
            </label>
            <div className="auth-input-wrap">
              {mode === "email" ? (
                <Mail className="auth-input-icon" />
              ) : (
                <Phone className="auth-input-icon" />
              )}
              <input
                id="identifier"
                name="identifier"
                type={mode === "email" ? "email" : "tel"}
                required
                autoComplete={mode === "email" ? "email" : "tel"}
                placeholder={mode === "email" ? "you@company.com" : "10-digit mobile number"}
                className="auth-input"
                inputMode={mode === "phone" ? "numeric" : undefined}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
              />
            </div>
            <p className="text-[11px] text-slate-500 mt-1.5">
              No password here — you&apos;ll sign in on your company login page next.
            </p>
          </div>

          {error && (
            <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              {error}
            </div>
          )}

          <button type="submit" disabled={apiDown} className="auth-btn-primary w-full">
            Continue
            <ArrowRight className="inline h-4 w-4 ml-1 -mt-0.5" />
          </button>
        </form>
      )}
    </AuthShell>
  );
}
