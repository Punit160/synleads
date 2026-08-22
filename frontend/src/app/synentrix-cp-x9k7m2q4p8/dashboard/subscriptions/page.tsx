"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, RefreshCw, TrendingUp } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/platform-auth-context";
import { PLATFORM_NAV } from "@/lib/platform-config";
import { formatPlatformCurrency } from "@/components/platform/platform-shell";
import { SubscriptionPlanSelector } from "@/components/platform/subscription-plan-selector";
import { cn } from "@/lib/utils";

type ExpiringSub = {
  workspaceId: string;
  companyName: string;
  companyStatus: string;
  owner: { name: string; email: string };
  memberCount: number;
  package: string;
  packageLabel: string;
  maxUsers: number | null;
  status: string;
  expiresAt: string;
  expired: boolean;
};

type UpgradeStats = {
  upgradesThisMonth: number;
  upgradesThisYear: number;
  renewalsThisMonth: number;
  renewalsThisYear: number;
  conversionsThisMonth: number;
  recentChanges: Array<{
    id: string;
    companyName: string;
    changeType: string;
    amountInr: number;
    creditInr: number;
    remainingDays: number | null;
    soldBy: string | null;
    createdAt: string;
  }>;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function changeLabel(type: string) {
  if (type === "upgrade") return "Upgrade";
  if (type === "trial_conversion") return "Trial → Paid";
  if (type === "renewal") return "Renewal";
  return type;
}

export default function PlatformSubscriptionsPage() {
  const { hasPermission } = usePlatformAuth();
  const [items, setItems] = useState<ExpiringSub[]>([]);
  const [upgradeStats, setUpgradeStats] = useState<UpgradeStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function load() {
    setLoading(true);
    setError("");
    try {
      const [expiring, stats] = await Promise.all([
        apiFetch<ExpiringSub[]>("/api/platform/subscriptions/expiring?days=60"),
        apiFetch<UpgradeStats>("/api/platform/subscriptions/upgrades"),
      ]);
      setItems(expiring);
      setUpgradeStats(stats);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load subscriptions");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (hasPermission("manage_subscriptions")) {
      load().catch(console.error);
    }
  }, [hasPermission]);

  if (!hasPermission("manage_subscriptions")) {
    return (
      <div className="p-8">
        <p className="text-sm text-slate-500">You don&apos;t have permission to manage subscriptions.</p>
      </div>
    );
  }

  const expired = items.filter((i) => i.expired);
  const expiringSoon = items.filter((i) => !i.expired);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Subscriptions</h1>
          <p className="text-sm text-slate-500 mt-1">
            Prorated upgrades, renewals, and expiring plans — paid companies cannot return to free trial
          </p>
        </div>
        <button type="button" onClick={load} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white text-sm text-slate-600 hover:bg-slate-50">
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      )}

      {upgradeStats && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-[10px] font-semibold text-violet-700 uppercase">Upgrades this month</p>
            <p className="text-2xl font-bold text-violet-900 mt-1 tabular-nums">{upgradeStats.upgradesThisMonth}</p>
            <p className="text-[10px] text-violet-600 mt-0.5">{upgradeStats.upgradesThisYear} this year</p>
          </div>
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-[10px] font-semibold text-blue-700 uppercase">Renewals this month</p>
            <p className="text-2xl font-bold text-blue-900 mt-1 tabular-nums">{upgradeStats.renewalsThisMonth}</p>
            <p className="text-[10px] text-blue-600 mt-0.5">{upgradeStats.renewalsThisYear} this year</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[10px] font-semibold text-emerald-700 uppercase">Trial conversions</p>
            <p className="text-2xl font-bold text-emerald-900 mt-1 tabular-nums">{upgradeStats.conversionsThisMonth}</p>
            <p className="text-[10px] text-emerald-600 mt-0.5">This month</p>
          </div>
          <div className="rounded-xl border border-red-200 bg-red-50 p-4">
            <p className="text-[10px] font-semibold text-red-800 uppercase">Expired</p>
            <p className="text-2xl font-bold text-red-900 mt-1">{expired.length}</p>
          </div>
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[10px] font-semibold text-amber-800 uppercase">Expiring in 60 days</p>
            <p className="text-2xl font-bold text-amber-900 mt-1">{expiringSoon.length}</p>
          </div>
        </div>
      )}

      {upgradeStats && upgradeStats.recentChanges.length > 0 && (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm mb-6 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-200 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-violet-600" />
            <h2 className="text-sm font-semibold text-slate-900">Recent plan changes</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                  <th className="px-4 py-2.5 text-left font-medium">Company</th>
                  <th className="px-4 py-2.5 text-left font-medium">Type</th>
                  <th className="px-4 py-2.5 text-left font-medium">Amount</th>
                  <th className="px-4 py-2.5 text-left font-medium">Credit</th>
                  <th className="px-4 py-2.5 text-left font-medium">By</th>
                  <th className="px-4 py-2.5 text-left font-medium">Date</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {upgradeStats.recentChanges.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-2.5 font-medium text-slate-900">{c.companyName}</td>
                    <td className="px-4 py-2.5">
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-100 font-medium">
                        {changeLabel(c.changeType)}
                        {c.remainingDays ? ` · ${c.remainingDays}d left` : ""}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 font-semibold text-emerald-700 tabular-nums">{formatPlatformCurrency(c.amountInr)}</td>
                    <td className="px-4 py-2.5 text-slate-500 tabular-nums">{c.creditInr > 0 ? `−${formatPlatformCurrency(c.creditInr)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{c.soldBy || "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-400 tabular-nums">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-slate-500">Loading subscriptions...</p>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
          No subscriptions expiring in the next 60 days.
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-sm min-w-[720px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <th className="px-4 py-3 text-left font-medium">Company</th>
                <th className="px-4 py-3 text-left font-medium">Plan</th>
                <th className="px-4 py-3 text-left font-medium">Users</th>
                <th className="px-4 py-3 text-left font-medium">Expires</th>
                <th className="px-4 py-3 text-left font-medium">Change plan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item) => (
                <tr key={item.workspaceId} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`${PLATFORM_NAV.companies}?id=${item.workspaceId}`} className="font-medium text-blue-700 hover:underline">{item.companyName}</Link>
                    <p className="text-xs text-slate-500">{item.owner.email}</p>
                    {item.expired && (
                      <span className="inline-flex mt-1 items-center gap-1 text-[10px] text-red-700 font-medium">
                        <AlertTriangle className="h-3 w-3" /> Expired
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs">{item.packageLabel}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">{item.memberCount}{item.maxUsers ? ` / ${item.maxUsers}` : ""}</td>
                  <td className="px-4 py-3 text-xs tabular-nums">{formatDate(item.expiresAt)}</td>
                  <td className="px-4 py-3 min-w-[180px]">
                    <SubscriptionPlanSelector
                      workspaceId={item.workspaceId}
                      currentPackage={item.package}
                      compact
                      onSuccess={load}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
