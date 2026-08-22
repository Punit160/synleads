"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { apiFetch } from "@/lib/api";
import { PLATFORM_LOGIN_PATH } from "@/lib/platform-config";

export type PlatformAdmin = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleLabel: string;
  permissions: string[];
};

type PlatformAuthState = {
  admin: PlatformAdmin | null;
  loading: boolean;
  hasPermission: (p: string) => boolean;
  refresh: () => Promise<void>;
};

const PlatformAuthContext = createContext<PlatformAuthState | null>(null);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);

  async function refresh() {
    const data = await apiFetch<{ admin: PlatformAdmin | null }>("/api/platform/auth/me");
    if (!data.admin) {
      router.push(PLATFORM_LOGIN_PATH);
      return;
    }
    setAdmin(data.admin);
    setLoading(false);
  }

  useEffect(() => {
    refresh().catch(() => router.push(PLATFORM_LOGIN_PATH));
  }, [router]);

  const value: PlatformAuthState = {
    admin,
    loading,
    hasPermission: (p: string) => admin?.permissions.includes(p) ?? false,
    refresh,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center">
        <p className="text-sm text-slate-500">Loading control panel...</p>
      </div>
    );
  }

  return <PlatformAuthContext.Provider value={value}>{children}</PlatformAuthContext.Provider>;
}

export function usePlatformAuth() {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  return ctx;
}
