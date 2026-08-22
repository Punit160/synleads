"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Shield,
  CreditCard,
  Users,
  Database,
  AlertTriangle,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { usePlatformAuth } from "@/lib/platform-auth-context";
import { PLATFORM_LOGIN_PATH, PLATFORM_NAV } from "@/lib/platform-config";
import { PRODUCT_NAME, PLATFORM_ADMIN_NAME } from "@/lib/brand";
import { cn } from "@/lib/utils";

const navItems = [
  { href: PLATFORM_NAV.overview, label: "Overview", shortLabel: "Home", icon: LayoutDashboard, permission: "view_overview" },
  { href: PLATFORM_NAV.companies, label: "Companies", shortLabel: "Cos", icon: Building2, permission: "provision_companies" },
  { href: PLATFORM_NAV.subscriptions, label: "Plans", shortLabel: "Plans", icon: CreditCard, permission: "manage_subscriptions" },
  { href: PLATFORM_NAV.usage, label: "Usage", shortLabel: "Usage", icon: Database, permission: "view_overview" },
  { href: PLATFORM_NAV.errors, label: "Errors", shortLabel: "Err", icon: AlertTriangle, permission: "manage_errors" },
  { href: PLATFORM_NAV.team, label: "Team", shortLabel: "Team", icon: Users, permission: "manage_team" },
];

export function PlatformShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { admin, hasPermission } = usePlatformAuth();

  async function logout() {
    await apiFetch("/api/platform/auth/logout", { method: "POST" });
    window.location.href = PLATFORM_LOGIN_PATH;
  }

  function navVisible(permission: string) {
    if (permission === "provision_companies") {
      return hasPermission("provision_companies") || hasPermission("manage_companies");
    }
    return hasPermission(permission);
  }

  const visibleNav = navItems.filter((item) => navVisible(item.permission));

  return (
    <div className="h-screen overflow-hidden bg-slate-100 flex">
      {/* Desktop sidebar — fixed height, no page stretch */}
      <aside className="hidden lg:flex w-[200px] h-screen flex-col bg-slate-900 text-white shrink-0 fixed inset-y-0 left-0 z-30">
        <div className="px-4 py-4 border-b border-white/10 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shrink-0">
              <Shield className="h-3.5 w-3.5 text-white" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-sm truncate">{PRODUCT_NAME}</p>
              <p className="text-[10px] text-slate-400 truncate">Synentrix Platform</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 py-3 space-y-0.5 overflow-y-auto">
          {visibleNav.map((item) => {
            const active =
              item.href === PLATFORM_NAV.overview
                ? pathname === PLATFORM_NAV.overview
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-2 px-2.5 py-2 rounded-lg text-[13px] font-medium transition-colors",
                  active
                    ? "bg-indigo-600 text-white"
                    : "text-slate-300 hover:bg-white/10 hover:text-white"
                )}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-white/10 shrink-0">
          <p className="text-[11px] font-medium text-white truncate">{admin?.name}</p>
          <p className="text-[10px] text-slate-400 truncate">{admin?.roleLabel}</p>
          <button
            type="button"
            onClick={logout}
            className="mt-2 flex items-center gap-1.5 text-[11px] text-slate-400 hover:text-white transition-colors w-full"
          >
            <LogOut className="h-3 w-3" /> Sign out
          </button>
        </div>
      </aside>

      {/* Main — scrolls independently */}
      <div className="flex-1 flex flex-col min-w-0 h-screen lg:ml-[200px]">
        <header className="lg:hidden bg-slate-900 text-white px-4 h-12 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2 min-w-0">
            <Shield className="h-4 w-4 text-indigo-400 shrink-0" />
            <span className="font-semibold text-sm truncate">{PLATFORM_ADMIN_NAME}</span>
          </div>
          <button type="button" onClick={logout} className="text-[11px] text-slate-400 shrink-0">
            Sign out
          </button>
        </header>

        <main className="flex-1 overflow-y-auto overscroll-contain pb-16 lg:pb-0">{children}</main>

        {/* Mobile bottom nav — no horizontal scroll bar */}
        <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-slate-200 safe-area-pb">
          <div className="flex items-stretch justify-around">
            {visibleNav.map((item) => {
              const active =
                item.href === PLATFORM_NAV.overview
                  ? pathname === PLATFORM_NAV.overview
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 px-1 min-w-0",
                    active ? "text-indigo-600" : "text-slate-500"
                  )}
                >
                  <item.icon className={cn("h-4 w-4", active && "text-indigo-600")} />
                  <span className="text-[10px] font-medium truncate max-w-full">{item.shortLabel}</span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </div>
  );
}

export function PlatformStatCard({
  label,
  value,
  sub,
  icon: Icon,
  accent = "blue",
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  accent?: "blue" | "emerald" | "violet" | "amber";
}) {
  const colors = {
    blue: "text-indigo-600 bg-indigo-50 border-indigo-100",
    emerald: "text-emerald-600 bg-emerald-50 border-emerald-100",
    violet: "text-violet-600 bg-violet-50 border-violet-100",
    amber: "text-amber-600 bg-amber-50 border-amber-100",
  };
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{value}</p>
          {sub && <p className="text-[11px] text-slate-400 mt-1">{sub}</p>}
        </div>
        <div className={cn("h-10 w-10 rounded-lg border flex items-center justify-center shrink-0", colors[accent])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}

export function formatPlatformCurrency(amount: number): string {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}
