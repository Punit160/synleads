"use client";

import { useEffect, useState } from "react";
import { CheckCheck } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  Panel,
  ProTable,
  Th,
  Td,
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
};

type Settings = {
  channels: Array<{ id: string; label: string; enabled: boolean }>;
};

const TYPE_BADGE: Record<string, string> = {
  follow_up: "bg-cyan-50 text-cyan-700 border-cyan-200",
  lead: "bg-blue-50 text-blue-700 border-blue-200",
  deal: "bg-indigo-50 text-indigo-700 border-indigo-200",
  quote: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

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
          <ProTable>
            <thead>
              <tr>
                <Th>Status</Th>
                <Th>Type</Th>
                <Th>Title</Th>
                <Th>Message</Th>
                <Th>Channel</Th>
                <Th>Date</Th>
              </tr>
            </thead>
            <tbody>
              {notifications.map((n) => (
                <tr key={n.id} className={cn("hover:bg-slate-50", !n.read && "bg-blue-50/30")}>
                  <Td>
                    {!n.read ? (
                      <span className="inline-block h-2 w-2 rounded-full bg-blue-600" />
                    ) : (
                      <span className="text-xs text-slate-400">Read</span>
                    )}
                  </Td>
                  <Td>
                    <span className={cn("inline-flex px-2 py-0.5 rounded text-[10px] font-semibold uppercase border", TYPE_BADGE[n.type] || "bg-slate-100 text-slate-600 border-slate-200")}>
                      {n.type.replace(/_/g, " ")}
                    </span>
                  </Td>
                  <Td className="font-medium text-slate-900">{n.title}</Td>
                  <Td className="max-w-[300px] truncate">{n.message}</Td>
                  <Td className="capitalize">{n.channel}</Td>
                  <Td className="tabular-nums">{formatDate(n.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </Panel>
    </div>
  );
}
