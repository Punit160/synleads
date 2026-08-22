"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Target, Kanban, CalendarClock, Users, Building2,
  BarChart3, Settings, LogOut, Menu, X, CheckSquare, FileText,
  Shield, Calendar, FolderOpen, BookOpen, Mail, Plug, GitBranch, Zap, ScrollText,
  UserCheck, AlarmClock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { tenantPath, tenantLoginUrl } from "@/lib/tenant-config";
import { apiFetch } from "@/lib/api";
import { SUPPORT_EMAIL, SUPPORT_MAILTO } from "@/lib/support";
import { canAccessRoute, type Permission } from "@/lib/route-access";

type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  permission?: Permission;
  anyOf?: Permission[];
};

const navGroups: { label: string; items: NavItem[] }[] = [
  {
    label: "Workspace",
    items: [
      { id: "dashboard", href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, permission: "view" },
      { id: "inbox", href: "/dashboard/notifications", label: "Inbox", icon: Mail, permission: "view" },
      { id: "my-work", href: "/dashboard/tasks", label: "My Work", icon: CheckSquare, permission: "view" },
      { id: "calendar", href: "/dashboard/calendar", label: "Calendar", icon: Calendar, permission: "view" },
    ],
  },
  {
    label: "Sales",
    items: [
      { id: "leads", href: "/dashboard/leads", label: "Leads", icon: Target, permission: "view" },
      { id: "pipeline", href: "/dashboard/pipeline", label: "Pipeline", icon: Kanban, permission: "view" },
      { id: "activities", href: "/dashboard/activities", label: "Activities", icon: CalendarClock, permission: "view" },
      { id: "follow-ups", href: "/dashboard/follow-ups", label: "Follow-ups", icon: AlarmClock, permission: "view" },
      { id: "quotations", href: "/dashboard/quotations", label: "Quotations", icon: FileText, permission: "view" },
      { id: "customers", href: "/dashboard/customers", label: "Customers", icon: UserCheck, permission: "view" },
    ],
  },
  {
    label: "Customers",
    items: [
      { id: "contacts", href: "/dashboard/contacts", label: "Contacts", icon: Users, permission: "view" },
      { id: "accounts", href: "/dashboard/accounts", label: "Accounts", icon: Building2, permission: "view" },
      { id: "documents", href: "/dashboard/documents", label: "Documents", icon: FolderOpen, permission: "view" },
    ],
  },
  {
    label: "Automation",
    items: [
      { id: "workflows", href: "/dashboard/automation", label: "Workflows", icon: Zap, permission: "manage_team" },
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
    label: "Admin",
    items: [
      { id: "team", href: "/dashboard/users", label: "Team", icon: Shield, anyOf: ["manage_team", "manage_users"] },
      { id: "integrations", href: "/dashboard/integrations", label: "Integrations", icon: Plug, permission: "view" },
      { id: "settings", href: "/dashboard/settings", label: "Settings", icon: Settings, permission: "view" },
      { id: "audit", href: "/dashboard/audit", label: "Audit log", icon: ScrollText, permission: "reports" },
    ],
  },
  {
    label: "Help",
    items: [
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
      <button type="button" className="lg:hidden fixed top-3 left-3 z-[60] p-2 rounded-lg border border-slate-300 bg-white text-slate-700 shadow-sm" onClick={() => setOpen(true)} aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
      {open && <div className="lg:hidden fixed inset-0 z-[55] bg-black/30" onClick={() => setOpen(false)} aria-hidden="true" />}
      <aside className={cn("pro-sidebar fixed inset-y-0 left-0 z-[56] w-[min(85vw,230px)] flex flex-col transition-transform lg:translate-x-0", open ? "translate-x-0" : "-translate-x-full lg:translate-x-0")}>
        <button type="button" className="lg:hidden absolute top-3 right-3 p-1 text-slate-500" onClick={() => setOpen(false)}><X className="h-5 w-5" /></button>
        <div className="px-4 py-4 border-b border-slate-200">
          <Link href={href("/dashboard")} className="flex items-center gap-2.5" onClick={() => setOpen(false)}>
            {logoUrl ? (
              <img
                src={logoUrl}
                alt={workspaceName}
                className="h-8 w-8 rounded-lg object-contain bg-white border border-slate-200 shrink-0"
              />
            ) : (
              <div className="h-8 w-8 rounded-lg brand-logo flex items-center justify-center shrink-0">
                <span className="text-white text-xs font-bold">
                  {workspaceName.slice(0, 2).toUpperCase()}
                </span>
              </div>
            )}
            <div className="min-w-0">
              <p className="font-semibold text-slate-900 text-sm truncate">{workspaceName}</p>
              <p className="text-[10px] text-slate-500">CRM Portal</p>
            </div>
          </Link>
        </div>
        <nav className="flex-1 px-2 py-3 space-y-4 overflow-y-auto">
          {navGroups.map((group) => {
            const visibleItems = group.items.filter(canSee);
            if (visibleItems.length === 0) return null;
            return (
              <div key={group.label}>
                <p className="px-3 mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-400">{group.label}</p>
                <div className="space-y-0.5">
                  {visibleItems.map((item) => {
                    const itemHref = href(item.href);
                    const active =
                      item.href === "/dashboard"
                        ? pathname === itemHref || pathname === "/dashboard"
                        : pathname.startsWith(itemHref) || pathname.startsWith(item.href);
                    return (
                      <Link key={item.id} href={itemHref} onClick={() => setOpen(false)} className={cn("pro-nav-item", active && "pro-nav-item-active")}>
                        <item.icon className="h-4 w-4 shrink-0" />
                        {item.label}
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </nav>
        <div className="p-3 border-t border-slate-200">
          <div className="px-2 py-2 mb-2">
            <p className="text-xs font-medium text-slate-800 truncate">{userName}</p>
            <p className="text-[10px] text-slate-500 truncate">{workspaceName}</p>
            <p className="text-[10px] text-indigo-600 font-semibold mt-0.5">{roleLabel}</p>
          </div>
          <a
            href={SUPPORT_MAILTO}
            className="pro-nav-item text-slate-500 mb-1 !text-[11px]"
            title="Contact support"
          >
            <Mail className="h-4 w-4 shrink-0" />
            <span className="truncate">{SUPPORT_EMAIL}</span>
          </a>
          <button type="button" onClick={logout} className="pro-nav-item w-full text-slate-500">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>
      </aside>
    </>
  );
}
