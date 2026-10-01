"use client";

import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { TenantLink } from "@/components/ui/tenant-link";
import {
  PageHeader,
  Panel,
  BtnSecondary,
  PageLoader,
  EmptyState,
} from "@/components/ui/dashboard-ui";

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  channel: string;
  read: boolean;
  createdAt: string;
  relatedType?: string | null;
  relatedId?: string | null;
};

type Settings = {
  channels: Array<{ id: string; label: string; enabled: boolean }>;
};

const TYPE_BADGE: Record<string, string> = {
  follow_up: "bg-cyan-50 text-cyan-700 border-cyan-200",
  lead: "bg-blue-50 text-blue-700 border-blue-200",
  deal: "bg-brand-muted text-brand border-brand-light",
  quote: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

function notificationHref(n: Notification): string | null {
  if (n.relatedType === "lead" && n.relatedId) return `/dashboard/leads/${n.relatedId}`;
  if (n.relatedType === "follow_up") return "/dashboard/follow-ups?bucket=overdue";
  if (n.relatedType === "deal" && n.relatedId) return `/dashboard/deals/${n.relatedId}`;
  if (n.type === "follow_up") return "/dashboard/follow-ups";
  if (n.type === "lead") return "/dashboard/leads";
  if (n.type === "deal") return "/dashboard/pipeline";
  return null;
}

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [marking, setMarking] = useState(false);

  async function load() {
    try {
      const [n, s] = await Promise.all([
        apiFetch<Notification[]>("/api/notifications"),
        apiFetch<Settings>("/api/notifications/settings"),
      ]);
      setNotifications(n);
      setSettings(s);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
  }, []);

  async function markAllRead() {
    setMarking(true);
    try {
      await apiFetch("/api/notifications/read-all", { method: "PATCH" });
      await load();
    } finally {
      setMarking(false);
    }
  }

  async function openNotification(n: Notification) {
    if (!n.read) {
      await apiFetch(`/api/notifications/${n.id}/read`, { method: "PATCH" }).catch(() => {});
      setNotifications((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Alerts"
        title="Notifications"
        description={`${unreadCount} unread notification${unreadCount !== 1 ? "s" : ""}`}
        action={
          unreadCount > 0 ? (
            <BtnSecondary onClick={markAllRead} className="!inline-flex">
              <CheckCheck className="h-4 w-4" /> {marking ? "Marking..." : "Mark All Read"}
            </BtnSecondary>
          ) : undefined
        }
      />

      {settings && (
        <Panel title="Channel Settings" className="mb-4">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {settings.channels.map((ch) => (
              <div key={ch.id} className="flex items-center justify-between p-3 rounded border border-slate-200 bg-slate-50/50">
                <span className="text-sm font-medium text-slate-900">{ch.label}</span>
                <span className={cn(
                  "text-[11px] font-semibold px-2 py-0.5 rounded border",
                  ch.enabled
                    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                    : "bg-slate-100 text-slate-500 border-slate-200"
                )}>
                  {ch.enabled ? "Enabled" : "Disabled"}
                </span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Panel title={`${notifications.length} notifications`} noPadding>
        {notifications.length === 0 ? (
          <EmptyState title="No notifications" description="You're all caught up" />
        ) : (
          <ul className="divide-y divide-slate-100">
            {notifications.map((n) => {
              const href = notificationHref(n);
              const inner = (
                <div className={cn("px-4 py-3 flex items-start gap-3 hover:bg-slate-50", !n.read && "bg-blue-50/40")}>
                  <span className={cn("mt-1.5 h-2 w-2 rounded-full shrink-0", n.read ? "bg-slate-200" : "bg-brand")} />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-0.5">
                      <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase border", TYPE_BADGE[n.type] || "bg-slate-100 text-slate-600 border-slate-200")}>
                        {n.type.replace(/_/g, " ")}
                      </span>
                      <span className="text-[11px] text-slate-400 tabular-nums">{formatDate(n.createdAt)}</span>
                    </div>
                    <p className="text-sm font-semibold text-slate-900">{n.title}</p>
                    <p className="text-sm text-slate-600 mt-0.5">{n.message}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id}>
                  {href ? (
                    <TenantLink href={href} onClick={() => openNotification(n)} className="block">
                      {inner}
                    </TenantLink>
                  ) : (
                    <button type="button" className="block w-full text-left" onClick={() => openNotification(n)}>
                      {inner}
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </div>
  );
}
