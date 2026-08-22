"use client";

import { useEffect, useState } from "react";
import { Lock, Mail, AlertCircle } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { PlatformAuthShell } from "@/components/auth/platform-auth-shell";
import { PLATFORM_DASHBOARD_PATH } from "@/lib/platform-config";

export default function PlatformLoginPage() {
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [apiDown, setApiDown] = useState(false);

  useEffect(() => {
    fetch("/health")
      .then((r) => setApiDown(!r.ok))
      .catch(() => setApiDown(true));
  }, []);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const fd = new FormData(e.currentTarget);
    try {
      await apiFetch("/api/platform/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: fd.get("email"),
          password: fd.get("password"),
        }),
      });
      window.location.href = PLATFORM_DASHBOARD_PATH;
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Login failed");
      setLoading(false);
    }
  }

  return (
    <PlatformAuthShell
      title="Operator sign in"
      subtitle="Synentrix platform credentials required"
    >
      {apiDown && (
        <div className="mb-5 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
          <div>
            <p className="font-medium">API server offline</p>
            <p className="text-xs text-amber-800/80 mt-0.5">
              Run from project root: <code className="font-mono bg-amber-100/80 px-1 rounded">npm run dev</code>
            </p>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="auth-label">Operator email</label>
          <div className="auth-input-wrap">
            <Mail className="auth-input-icon" />
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="username"
              placeholder="you@synentrix.com"
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
              type="password"
              required
              autoComplete="current-password"
              placeholder="Enter your password"
              className="auth-input"
            />
          </div>
        </div>

        {error && (
          <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        <button type="submit" disabled={loading} className="auth-btn-primary w-full bg-slate-900 hover:bg-slate-800">
          {loading ? "Verifying..." : "Access control panel"}
        </button>
      </form>
    </PlatformAuthShell>
  );
}
