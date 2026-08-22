"use client";

import { useEffect, useState } from "react";
import { TenantLink } from "@/components/ui/tenant-link";
import { Bell } from "lucide-react";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "./sidebar";
import { GlobalSearch } from "./global-search";
import { RouteGuard } from "@/components/auth/route-guard";
import { ReadOnlyBanner } from "@/components/auth/read-only-banner";

function DashboardInner({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    apiFetch<{ count: number }>("/api/notifications/unread-count")
      .then((r) => setUnreadCount(r.count))
      .catch(() => setUnreadCount(0));
    const interval = setInterval(() => {
      apiFetch<{ count: number }>("/api/notifications/unread-count")
        .then((r) => setUnreadCount(r.count))
        .catch(() => {});
    }, 60000);
    return () => clearInterval(interval);
  }, [auth.user?.id]);

  return (
    <div className="min-h-screen pro-shell">
      <Sidebar
        workspaceName={auth.workspace?.name || "Workspace"}
        workspaceSlug={auth.workspace?.slug}
        logoUrl={auth.workspace?.logoUrl}
        userName={auth.user?.name || ""}
        roleLabel={auth.roleLabel}
        permissions={auth.permissions}
      />
      <div className="lg:pl-[230px] flex flex-col min-h-screen">
        <header className="pro-topbar sticky top-0 z-30">
          <div className="px-4 lg:px-6 h-12 flex items-center gap-3 border-b border-slate-200 bg-white">
            <div className="flex-1 min-w-0 max-w-md pl-11 sm:pl-10 md:pl-0">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-2 ml-auto text-xs text-slate-500">
              <span className="hidden lg:inline px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-100 font-medium">
                {auth.roleLabel}
              </span>
              <span className="hidden lg:inline">{auth.workspace?.name}</span>
              <TenantLink href="/dashboard/notifications" className="p-2 rounded hover:bg-slate-100 text-slate-500 relative" title="Notifications">
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </TenantLink>
              {auth.workspace?.logoUrl ? (
                <img
                  src={auth.workspace.logoUrl}
                  alt={auth.workspace.name}
                  className="h-7 w-7 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
                />
              ) : (
                <div className="h-7 w-7 rounded-lg brand-logo flex items-center justify-center text-white text-[10px] font-semibold">
                  {auth.user?.name.charAt(0).toUpperCase()}
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
          <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-5 pt-14 lg:pt-5 [&:has(.crm-page-header)]:p-0 [&:has(.crm-page-header)]:py-0 [&:has(.crm-page-header)]:pt-[3.25rem] lg:[&:has(.crm-page-header)]:pt-0">
            <ReadOnlyBanner />
            <RouteGuard>{children}</RouteGuard>
          </div>
        </main>
      </div>
    </div>
  );
}

export function DashboardShell({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardInner>{children}</DashboardInner>
    </AuthProvider>
  );
}
