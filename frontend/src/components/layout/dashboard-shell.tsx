"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Bell, ChevronDown, Plus } from "lucide-react";
import { TenantLink } from "@/components/ui/tenant-link";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { apiFetch } from "@/lib/api";
import { Sidebar } from "./sidebar";
import { GlobalSearch } from "./global-search";
import { RouteGuard } from "@/components/auth/route-guard";
import { ReadOnlyBanner } from "@/components/auth/read-only-banner";
import { SidebarProvider, useSidebar } from "@/lib/sidebar-context";
import { cn } from "@/lib/utils";

const PAGE_TITLES: Array<{ test: (path: string) => boolean; title: string; context?: string }> = [
  { test: (p) => /\/leads\/new/.test(p), title: "New lead", context: "Leads" },
  { test: (p) => /\/leads\/[^/]+\/edit/.test(p), title: "Edit lead", context: "Leads" },
  { test: (p) => /\/leads\/[^/]+/.test(p), title: "Lead workspace", context: "Leads" },
  { test: (p) => p.includes("/leads"), title: "Leads" },
  { test: (p) => p.includes("/pipeline"), title: "Pipeline" },
  { test: (p) => p.includes("/follow-ups"), title: "Follow-ups" },
  { test: (p) => p.includes("/tasks"), title: "Tasks" },
  { test: (p) => p.includes("/activities"), title: "Activities" },
  { test: (p) => p.includes("/quotations"), title: "Quotations" },
  { test: (p) => p.includes("/customers"), title: "Customers" },
  { test: (p) => p.includes("/contacts"), title: "Contacts" },
  { test: (p) => p.includes("/accounts"), title: "Companies" },
  { test: (p) => p.includes("/reports"), title: "Reports" },
  { test: (p) => p.includes("/notifications"), title: "Notifications" },
  { test: (p) => p.includes("/users"), title: "Team" },
  { test: (p) => p.includes("/settings"), title: "Settings" },
  { test: (p) => p.includes("/assignment"), title: "Lead routing" },
  { test: (p) => p.includes("/automation"), title: "Workflows" },
  { test: (p) => p.includes("/calendar"), title: "Calendar" },
  { test: (p) => p.endsWith("/dashboard") || /\/dashboard$/.test(p), title: "Dashboard" },
];

function pageMeta(pathname: string): { title: string; context?: string } {
  const found = PAGE_TITLES.find((row) => row.test(pathname));
  return found ? { title: found.title, context: found.context } : { title: "Workspace" };
}

function DashboardInner({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const pathname = usePathname();
  const { collapsed } = useSidebar();
  const [unreadCount, setUnreadCount] = useState(0);
  const [quickOpen, setQuickOpen] = useState(false);
  const canAdd = auth.hasPermission("add");
  const meta = pageMeta(pathname);

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
      <div className={cn("flex flex-col min-h-screen transition-[padding] duration-200", collapsed ? "lg:pl-[72px]" : "lg:pl-[248px]")}>
        <header className="pro-topbar sticky top-0 z-30">
          <div className="px-4 lg:px-6 h-14 flex items-center gap-4">
            <div className="hidden md:block min-w-[140px] pl-11 lg:pl-0">
              {meta.context && (
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 leading-none mb-0.5">{meta.context}</p>
              )}
              <p className="text-sm font-semibold text-slate-900 tracking-tight truncate">{meta.title}</p>
            </div>
            <div className="flex-1 min-w-0 max-w-xl pl-11 md:pl-0">
              <GlobalSearch />
            </div>
            <div className="flex items-center gap-2 ml-auto">
              {canAdd && (
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setQuickOpen((v) => !v)}
                    className="hidden sm:inline-flex items-center gap-1.5 h-8 px-3 rounded-lg bg-brand text-white text-xs font-semibold hover:bg-brand-dark shadow-sm shadow-brand/20"
                  >
                    <Plus className="h-3.5 w-3.5" strokeWidth={2} />
                    New
                    <ChevronDown className="h-3 w-3 opacity-80" />
                  </button>
                  {quickOpen && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setQuickOpen(false)} />
                      <div className="absolute right-0 top-full mt-1.5 z-50 w-56 rounded-lg border border-slate-200 bg-white py-1 shadow-xl shadow-slate-900/10">
                        {[
                          { href: "/dashboard/leads/new", label: "Add lead" },
                          { href: "/dashboard/follow-ups", label: "Schedule follow-up" },
                          { href: "/dashboard/tasks", label: "Add task" },
                          { href: "/dashboard/activities/new", label: "Add note / activity" },
                          { href: "/dashboard/deals/new", label: "Add deal" },
                          { href: "/dashboard/quotations/new", label: "New quotation" },
                        ].map((item) => (
                          <TenantLink
                            key={item.href}
                            href={item.href}
                            className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900"
                            onClick={() => setQuickOpen(false)}
                          >
                            {item.label}
                          </TenantLink>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
              <TenantLink
                href="/dashboard/notifications"
                className="relative h-8 w-8 inline-flex items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:text-slate-800 hover:border-slate-300"
                title="Notifications"
              >
                <Bell className="h-4 w-4" strokeWidth={1.75} />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-4 min-w-4 px-0.5 rounded-full bg-red-500 text-white text-[9px] font-bold flex items-center justify-center">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </TenantLink>
              <div className="hidden sm:flex items-center gap-2 pl-2 border-l border-slate-200">
                <div className="text-right hidden lg:block">
                  <p className="text-xs font-semibold text-slate-800 leading-tight truncate max-w-[140px]">{auth.user?.name}</p>
                  <p className="text-[10px] text-slate-500">{auth.roleLabel}</p>
                </div>
                {auth.workspace?.logoUrl ? (
                  <img
                    src={auth.workspace.logoUrl}
                    alt={auth.workspace.name}
                    className="h-8 w-8 rounded-full object-contain bg-white border border-slate-200 shrink-0"
                  />
                ) : (
                  <div className="h-8 w-8 rounded-full brand-logo flex items-center justify-center text-white text-[11px] font-semibold shrink-0">
                    {auth.user?.name.charAt(0).toUpperCase()}
                  </div>
                )}
              </div>
            </div>
          </div>
        </header>
        <main className="flex-1 min-w-0 overflow-x-hidden overflow-y-auto">
          <div className="px-4 sm:px-5 lg:px-7 py-5 sm:py-6 pt-14 lg:pt-6 [&:has(.crm-page-header)]:p-0 [&:has(.crm-page-header)]:py-0 [&:has(.crm-page-header)]:pt-[3.5rem] lg:[&:has(.crm-page-header)]:pt-0">
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
      <SidebarProvider>
        <DashboardInner>{children}</DashboardInner>
      </SidebarProvider>
    </AuthProvider>
  );
}
