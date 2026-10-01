"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Target, Kanban, CalendarClock, Users, Building2,
  BarChart3, Settings, LogOut, Menu, X, CheckSquare, FileText,
  Shield, Calendar, FolderOpen, BookOpen, Mail, Plug, GitBranch, Zap, ScrollText,
  UserCheck, AlarmClock, PanelLeftClose, PanelLeft,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tenantPath, tenantLoginUrl } from "@/lib/tenant-config";
import { apiFetch } from "@/lib/api";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { canAccessRoute, type Permission } from "@/lib/route-access";
import { useSidebar } from "@/lib/sidebar-context";

type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  permission?: Permission;
  anyOf?: Permission[];
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Main",
    items: [
      { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "view" },
      { id: "leads", href: "/dashboard/leads", label: "Leads", icon: Target, permission: "view" },
      { id: "pipeline", href: "/dashboard/pipeline", label: "Pipeline", icon: Kanban, permission: "view" },
      { id: "follow-ups", href: "/dashboard/follow-ups", label: "Follow-ups", icon: AlarmClock, permission: "view" },
      { id: "my-work", href: "/dashboard/tasks", label: "Tasks", icon: CheckSquare, permission: "view" },
    ],
  },
  {
    label: "Sales",
    items: [
      { id: "activities", href: "/dashboard/activities", label: "Activities", icon: CalendarClock, permission: "view" },
      { id: "quotations", href: "/dashboard/quotations", label: "Quotations", icon: FileText, permission: "view" },
      { id: "customers", href: "/dashboard/customers", label: "Customers", icon: UserCheck, permission: "view" },
      { id: "calendar", href: "/dashboard/calendar", label: "Calendar", icon: Calendar, permission: "view" },
    ],
  },
  {
    label: "Management",
    items: [
      { id: "contacts", href: "/dashboard/contacts", label: "Contacts", icon: Users, permission: "view" },
      { id: "accounts", href: "/dashboard/accounts", label: "Companies", icon: Building2, permission: "view" },
      { id: "documents", href: "/dashboard/documents", label: "Documents", icon: FolderOpen, permission: "view" },
      { id: "team", href: "/dashboard/users", label: "Team", icon: Shield, anyOf: ["manage_team", "manage_users"] },
      { id: "lead-routing", href: "/dashboard/assignment", label: "Lead Routing", icon: GitBranch, permission: "manage_team" },
    ],
  },
  {
    label: "Analytics",
    items: [
      { id: "reports", href: "/dashboard/reports", label: "Reports", icon: BarChart3, permission: "reports" },
    ],
  },
  {
    label: "System",
    items: [
      { id: "inbox", href: "/dashboard/notifications", label: "Notifications", icon: Mail, permission: "view" },
      { id: "workflows", href: "/dashboard/automation", label: "Workflows", icon: Zap, permission: "manage_team" },
      { id: "integrations", href: "/dashboard/integrations", label: "Integrations", icon: Plug, permission: "view" },
      { id: "settings", href: "/dashboard/settings", label: "Settings", icon: Settings, permission: "view" },
      { id: "audit", href: "/dashboard/audit", label: "Audit log", icon: ScrollText, permission: "reports" },
      { id: "manual", href: "/dashboard/manual", label: "User Manual", icon: BookOpen, permission: "view" },
    ],
  },
];

export function Sidebar({
  workspaceName,
  workspaceSlug,
  logoUrl,
  userName,
  roleLabel,
  permissions,
}: {
  workspaceName: string;
  workspaceSlug?: string | null;
  logoUrl?: string | null;
  userName: string;
  roleLabel: string;
  permissions: string[];
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const { collapsed, toggle } = useSidebar();

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  function href(path: string) {
    return tenantPath(workspaceSlug, path);
  }

  function canSee(item: NavItem) {
    const { allowed } = canAccessRoute(item.href, permissions);
    if (!allowed) return false;
    if (item.anyOf) {
      return item.anyOf.some((p) => permissions.includes(p));
    }
    if (item.permission) {
      return permissions.includes(item.permission);
    }
    return true;
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    window.location.href = workspaceSlug ? tenantLoginUrl(workspaceSlug) : "/login";
  }

  return (
    <>
      <button
        type="button"
        className="lg:hidden fixed top-3 left-3 z-[60] p-2 rounded-lg border border-slate-200 bg-white text-slate-700 shadow-sm"
        onClick={() => setOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && <div className="lg:hidden fixed inset-0 z-[55] bg-slate-950/50" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside
        className={cn(
          "pro-sidebar fixed inset-y-0 left-0 z-[56] flex flex-col transition-all duration-200",
          open ? "translate-x-0 w-[min(88vw,248px)]" : "-translate-x-full lg:translate-x-0",
          collapsed ? "lg:w-[72px]" : "lg:w-[248px]"
        )}
      >
        <button type="button" className="lg:hidden absolute top-3 right-3 p-1 text-slate-400" onClick={() => setOpen(false)}>
          <X className="h-5 w-5" />
        </button>
        <div className={cn("border-b border-white/10", collapsed ? "px-2 py-3.5" : "px-3.5 py-3.5")}>
          <div className="flex items-center gap-2.5">
            <Link href={href("/dashboard")} className="flex items-center gap-2.5 min-w-0" onClick={() => setOpen(false)}>
              {logoUrl ? (
                <img
                  src={logoUrl}
                  alt={workspaceName}
                  className="h-8 w-8 rounded-lg object-contain bg-white shrink-0"
                />
              ) : (
                <div className="h-8 w-8 rounded-lg brand-logo flex items-center justify-center shrink-0 shadow-sm shadow-brand/30">
                  <span className="text-white text-[11px] font-bold tracking-wide">
                    {workspaceName.slice(0, 2).toUpperCase()}
                  </span>
                </div>
              )}
              <div className={cn("min-w-0", collapsed && "lg:hidden")}>
                <p className="font-semibold text-white text-sm truncate leading-tight">{workspaceName}</p>
                <p className="text-[10px] text-slate-400 mt-0.5">Sales CRM</p>
              </div>
            </Link>
            <button
              type="button"
              onClick={toggle}
              className="hidden lg:inline-flex ml-auto p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/10"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
          </div>
        </div>
        <nav className={cn("flex-1 py-3 space-y-5 overflow-y-auto", collapsed ? "px-1.5" : "px-2.5")}>
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(canSee);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <p className={cn("mb-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500", collapsed ? "lg:hidden px-2" : "px-2.5")}>
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const itemHref = href(item.href);
                    const active =
                      item.href === "/dashboard"
                        ? pathname === itemHref || pathname === "/dashboard"
                        : pathname.startsWith(itemHref) || pathname.startsWith(item.href);
                    return (
                      <Link
                        key={item.id}
                        href={itemHref}
                        onClick={() => setOpen(false)}
                        title={collapsed ? item.label : undefined}
                        className={cn(
                          "pro-nav-item",
                          active && "pro-nav-item-active",
                          collapsed && "lg:justify-center lg:px-2"
                        )}
                      >
                        <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                        <span className={cn(collapsed && "lg:hidden")}>{item.label}</span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className={cn("border-t border-white/10", collapsed ? "p-2" : "p-3")}>
          <div className={cn("flex items-center gap-2.5 px-1.5 py-2 mb-1", collapsed && "lg:justify-center")}>
            <div className="h-7 w-7 rounded-full bg-brand text-white text-[11px] font-semibold flex items-center justify-center shrink-0">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className={cn("min-w-0", collapsed && "lg:hidden")}>
              <p className="text-xs font-medium text-slate-100 truncate">{userName}</p>
              <p className="text-[10px] text-slate-400 truncate">{roleLabel}</p>
            </div>
          </div>
          <a
            href={SUPPORT_MAILTO}
            className={cn("pro-nav-item text-slate-500 mb-0.5 !text-[11px]", collapsed && "lg:justify-center lg:px-2")}
            title="Contact support"
          >
            <Mail className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            <span className={cn("truncate", collapsed && "lg:hidden")}>{SUPPORT_EMAIL}</span>
          </a>
          <button
            type="button"
            onClick={logout}
            className={cn("pro-nav-item w-full text-slate-500", collapsed && "lg:justify-center lg:px-2")}
            title="Sign out"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span className={cn(collapsed && "lg:hidden")}>Sign out</span>
          </button>
        </div>
      </aside>
    </>
  );
}
