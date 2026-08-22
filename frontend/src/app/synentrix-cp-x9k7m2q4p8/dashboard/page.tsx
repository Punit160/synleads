"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Building2,
  Users,
  DollarSign,
  AlertTriangle,
  Clock,
  Target,
  CreditCard,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { usePlatformAuth } from "@/lib/platform-auth-context";
import { formatPlatformCurrency } from "@/components/platform/platform-shell";
import { PLATFORM_NAV } from "@/lib/platform-config";
import { PACKAGE_LABELS } from "@/lib/crm-constants";
import { Panel } from "@/components/ui/dashboard-ui";
import { KpiCard, BarChartList, StackedBar, BarRow } from "@/components/ui/dashboard-charts";
import { cn } from "@/lib/utils";

type Analytics = {
  stats: {
    companyCount: number;
    activeCompanies: number;
    suspendedCompanies: number;
    totalMembers: number;
    trialCount: number;
    paidCount: number;
    platformRevenue: number;
    totalSales: number;
    revenueThisMonth: number;
    salesThisMonth: number;
    expiringSoon: number;
    interestedCount: number;
  };
  charts: {
    packageDistribution: Array<{ package: string; label: string; count: number; pct: number }>;
    packageInterest: Array<{ package: string; label: string; count: number; pct: number; potentialRevenue: number }>;
    revenueByMonth: Array<{ month: string; revenue: number; sales: number }>;
    maxMonthlyRevenue: number;
    subscriptionMix: Array<{ label: string; count: number; pct: number; color: string }>;
  };
  memberPerformance: Array<{
    id: string;
    name: string;
    email: string;
    role: string;
    companiesAdded: number;
    salesCount: number;
    revenue: number;
  }>;
  recentPlatformSales: Array<{
    id: string;
    companyId: string;
    companyName: string;
    packageLabel: string;
    amountInr: number;
    soldBy: { name: string } | null;
    createdAt: string;
  }>;
  trialCompanies: Array<{
    id: string;
    name: string;
    owner: { email: string };
    memberCount: number;
    expiresAt?: string;
    interestedPackage: string | null;
    provisionedBy: { name: string } | null;
  }>;
  packageInterestList: Array<{
    id: string;
    name: string;
    ownerEmail: string;
    interestedLabel: string | null;
    provisionedBy: { name: string } | null;
  }>;
  expiringCompanies: Array<{
    id: string;
    name: string;
    packageLabel: string;
    expiresAt: string;
    daysLeft: number;
    memberCount: number;
    interestedPackage: string | null;
  }>;
  upgradeStats: {
    upgradesThisMonth: number;
    upgradesThisYear: number;
    renewalsThisMonth: number;
    renewalsThisYear: number;
    conversionsThisMonth: number;
  };
};

type Overview = {
  stats: Analytics["stats"];
  analytics: Analytics;
  recentCompanies: Array<{
    id: string;
    name: string;
    status: string;
    owner: { email: string };
    memberCount: number;
    subscription?: { package: string };
    provisionedBy?: { name: string } | null;
  }>;
};

function ClickableKpi({
  href,
  label,
  value,
  sub,
  icon,
  theme = "blue",
}: {
  href: string;
  label: string;
  value: string | number;
  sub?: string;
  icon: typeof Building2;
  theme?: "blue" | "emerald" | "violet" | "amber" | "rose" | "cyan" | "teal" | "indigo";
}) {
  return (
    <Link href={href} className="block group">
      <div className="relative">
        <KpiCard label={label} value={value} sub={sub} icon={icon} theme={theme} />
        <span className="absolute top-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity text-slate-400">
          <ArrowRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function PlatformOverviewPage() {
  const { hasPermission } = usePlatformAuth();
  const [data, setData] = useState<Overview | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    apiFetch<Overview>("/api/platform/overview")
      .then(setData)
      .catch((err) => setError(err instanceof ApiError ? err.message : "Failed to load overview"));
  }, []);

  if (error) {
    return (
      <div className="p-8">
        <p className="text-sm text-red-600">{error}</p>
      </div>
    );
  }

  if (!data) {
    return <div className="p-8 text-sm text-slate-500">Loading platform dashboard...</div>;
  }

  const { stats, analytics } = data;
  const canCompanies = hasPermission("provision_companies") || hasPermission("manage_companies");
  const canSubscriptions = hasPermission("manage_subscriptions");

  const maxMemberRevenue = Math.max(...analytics.memberPerformance.map((m) => m.revenue), 1);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Platform Command Center</h1>
        <p className="text-sm text-slate-500 mt-1">
          Revenue, trials, package interest, team performance — click any card to drill down
        </p>
      </div>

      {/* Revenue & subscription KPIs */}
      {analytics.upgradeStats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
          <Link href={PLATFORM_NAV.subscriptions} className="rounded-xl border border-violet-200 bg-violet-50 p-4 hover:border-violet-300 transition-colors">
            <p className="text-[10px] font-semibold text-violet-700 uppercase">Upgrades this month</p>
            <p className="text-2xl font-bold text-violet-900 tabular-nums">{analytics.upgradeStats.upgradesThisMonth}</p>
            <p className="text-[10px] text-violet-600">{analytics.upgradeStats.upgradesThisYear} this year →</p>
          </Link>
          <Link href={PLATFORM_NAV.subscriptions} className="rounded-xl border border-blue-200 bg-blue-50 p-4 hover:border-blue-300 transition-colors">
            <p className="text-[10px] font-semibold text-blue-700 uppercase">Renewals this month</p>
            <p className="text-2xl font-bold text-blue-900 tabular-nums">{analytics.upgradeStats.renewalsThisMonth}</p>
            <p className="text-[10px] text-blue-600">{analytics.upgradeStats.renewalsThisYear} this year →</p>
          </Link>
          <Link href={PLATFORM_NAV.subscriptions} className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 hover:border-emerald-300 transition-colors">
            <p className="text-[10px] font-semibold text-emerald-700 uppercase">Trial conversions</p>
            <p className="text-2xl font-bold text-emerald-900 tabular-nums">{analytics.upgradeStats.conversionsThisMonth}</p>
            <p className="text-[10px] text-emerald-600">This month →</p>
          </Link>
          <Link href={`${PLATFORM_NAV.companies}?filter=paid`} className="rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300 transition-colors shadow-sm">
            <p className="text-[10px] font-semibold text-slate-500 uppercase">Paid companies</p>
            <p className="text-2xl font-bold text-slate-900 tabular-nums">{stats.paidCount}</p>
            <p className="text-[10px] text-slate-400">Active yearly plans →</p>
          </Link>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-4">
        <ClickableKpi
          href={canCompanies ? `${PLATFORM_NAV.companies}?filter=paid` : PLATFORM_NAV.overview}
          label="Platform revenue"
          value={formatPlatformCurrency(stats.platformRevenue)}
          sub={`${stats.totalSales} subscription sales · ${formatPlatformCurrency(stats.revenueThisMonth)} this month`}
          icon={DollarSign}
          theme="emerald"
        />
        <ClickableKpi
          href={canCompanies ? `${PLATFORM_NAV.companies}?filter=trial` : PLATFORM_NAV.overview}
          label="Free trials (7 days)"
          value={stats.trialCount}
          sub={`${stats.paidCount} on paid yearly plans`}
          icon={Clock}
          theme="amber"
        />
        <ClickableKpi
          href={canCompanies ? `${PLATFORM_NAV.companies}?filter=interested` : PLATFORM_NAV.overview}
          label="Package interest"
          value={stats.interestedCount}
          sub="Companies interested in upgrading"
          icon={Target}
          theme="violet"
        />
        <ClickableKpi
          href={canSubscriptions ? PLATFORM_NAV.subscriptions : PLATFORM_NAV.overview}
          label="Expiring soon"
          value={stats.expiringSoon}
          sub="Within 30 days — renew or upgrade"
          icon={AlertTriangle}
          theme={stats.expiringSoon > 0 ? "rose" : "blue"}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <ClickableKpi
          href={canCompanies ? PLATFORM_NAV.companies : PLATFORM_NAV.overview}
          label="Total companies"
          value={stats.companyCount}
          sub={`${stats.activeCompanies} active · ${stats.suspendedCompanies} suspended`}
          icon={Building2}
          theme="blue"
        />
        <ClickableKpi
          href={canCompanies ? PLATFORM_NAV.companies : PLATFORM_NAV.overview}
          label="Active users"
          value={stats.totalMembers}
          sub="Seat usage across all plans"
          icon={Users}
          theme="cyan"
        />
        <ClickableKpi
          href={canSubscriptions ? PLATFORM_NAV.subscriptions : PLATFORM_NAV.overview}
          label="Revenue this month"
          value={formatPlatformCurrency(stats.revenueThisMonth)}
          sub={`${stats.salesThisMonth} subscription sale${stats.salesThisMonth !== 1 ? "s" : ""}`}
          icon={DollarSign}
          theme="indigo"
        />
        <ClickableKpi
          href={hasPermission("manage_team") ? PLATFORM_NAV.team : PLATFORM_NAV.overview}
          label="Synentrix team"
          value={analytics.memberPerformance.length}
          sub="Sales executives & admins"
          icon={Sparkles}
          theme="teal"
        />
      </div>

      <div className="grid lg:grid-cols-3 gap-6 mb-6">
        {/* Revenue chart */}
        <Panel title="Subscription revenue (6 months)" subtitle="Platform sales only" className="lg:col-span-2">
          <div className="p-4">
            {analytics.charts.revenueByMonth.every((m) => m.revenue === 0) ? (
              <p className="text-sm text-slate-500 py-8 text-center">No subscription sales recorded yet</p>
            ) : (
              <div className="flex items-end gap-2 h-44">
                {analytics.charts.revenueByMonth.map((m) => {
                  const h = (m.revenue / analytics.charts.maxMonthlyRevenue) * 100;
                  return (
                    <div key={m.month} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                      <span className="text-[10px] font-semibold text-emerald-700 tabular-nums truncate w-full text-center">
                        {m.revenue > 0 ? formatPlatformCurrency(m.revenue) : "—"}
                      </span>
                      <div className="w-full flex flex-col justify-end h-28 bg-slate-50 rounded-t-lg overflow-hidden">
                        <div
                          className="w-full bg-emerald-500 rounded-t-lg transition-all duration-700 hover:bg-emerald-600"
                          style={{ height: `${Math.max(h, m.revenue > 0 ? 8 : 0)}%` }}
                          title={`${m.sales} sale(s)`}
                        />
                      </div>
                      <span className="text-[10px] text-slate-500 font-medium">{m.month}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </Panel>

        {/* Trial vs paid mix */}
        <Panel title="Subscription mix" subtitle="Active companies">
          <div className="p-4">
            <StackedBar segments={analytics.charts.subscriptionMix} />
            <div className="mt-4 grid grid-cols-2 gap-3">
              {analytics.charts.subscriptionMix.map((s) => (
                <Link
                  key={s.label}
                  href={`${PLATFORM_NAV.companies}?filter=${s.label.includes("trial") ? "trial" : "paid"}`}
                  className="rounded-lg border border-slate-200 p-3 hover:border-blue-300 hover:bg-blue-50/50 transition-colors"
                >
                  <p className="text-[10px] text-slate-500 uppercase">{s.label}</p>
                  <p className="text-xl font-bold text-slate-900 tabular-nums">{s.count}</p>
                </Link>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid lg:grid-cols-2 gap-6 mb-6">
        <Panel title="Active plans" subtitle="Companies by current package" noPadding action={
          canCompanies ? <Link href={PLATFORM_NAV.companies} className="text-xs text-blue-600 hover:underline">Manage →</Link> : undefined
        }>
          {analytics.charts.packageDistribution.length === 0 ? (
            <p className="text-sm text-slate-500 p-4">No active subscriptions</p>
          ) : (
            <BarChartList items={analytics.charts.packageDistribution.map((p) => ({
              label: p.label,
              value: p.count,
              pct: p.pct,
            }))} />
          )}
        </Panel>

        <Panel title="Package interest" subtitle="What trials want to buy" noPadding action={
          canCompanies ? <Link href={`${PLATFORM_NAV.companies}?filter=interested`} className="text-xs text-blue-600 hover:underline">View all →</Link> : undefined
        }>
          {analytics.charts.packageInterest.length === 0 ? (
            <p className="text-sm text-slate-500 p-4">No package interest recorded yet — set interest on company detail</p>
          ) : (
            <div className="p-4 space-y-4">
              {analytics.charts.packageInterest.map((p, i) => (
                <BarRow
                  key={p.package}
                  label={p.label}
                  value={p.count}
                  pct={p.pct}
                  colorIndex={i + 2}
                  suffix={`· ${formatPlatformCurrency(p.potentialRevenue)} potential`}
                />
              ))}
            </div>
          )}
        </Panel>
      </div>

      {/* Team performance */}
      {hasPermission("manage_team") && analytics.memberPerformance.length > 0 && (
        <Panel
          title="Synentrix team performance"
          subtitle="Companies added & subscription revenue by member"
          className="mb-6"
          action={<Link href={PLATFORM_NAV.team} className="text-xs text-blue-600 hover:underline">Team →</Link>}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="px-4 py-2.5 font-medium">Member</th>
                  <th className="px-4 py-2.5 font-medium">Companies added</th>
                  <th className="px-4 py-2.5 font-medium">Sales closed</th>
                  <th className="px-4 py-2.5 font-medium text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.memberPerformance.map((m) => (
                  <tr key={m.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{m.name}</p>
                      <p className="text-xs text-slate-500">{m.email}</p>
                    </td>
                    <td className="px-4 py-3 tabular-nums">{m.companiesAdded}</td>
                    <td className="px-4 py-3 tabular-nums">{m.salesCount}</td>
                    <td className="px-4 py-3 text-right">
                      <span className="font-semibold text-emerald-700 tabular-nums">{formatPlatformCurrency(m.revenue)}</span>
                      {m.revenue > 0 && (
                        <div className="mt-1 h-1 rounded-full bg-slate-100 overflow-hidden w-24 ml-auto">
                          <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${(m.revenue / maxMemberRevenue) * 100}%` }} />
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Recent platform sales */}
        <Panel
          title="Recent subscription sales"
          subtitle="Revenue per sale"
          className="lg:col-span-1"
          action={canSubscriptions ? <Link href={PLATFORM_NAV.subscriptions} className="text-xs text-blue-600 hover:underline"><CreditCard className="inline h-3 w-3" /> Subscriptions</Link> : undefined}
        >
          <ul className="divide-y divide-slate-100">
            {analytics.recentPlatformSales.length === 0 ? (
              <li className="px-4 py-6 text-sm text-slate-500 text-center">No sales yet</li>
            ) : (
              analytics.recentPlatformSales.slice(0, 8).map((s) => (
                <li key={s.id}>
                  <Link href={canCompanies ? `${PLATFORM_NAV.companies}?id=${s.companyId}` : "#"} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50">
                    <div className="h-8 w-8 rounded-lg bg-emerald-50 border border-emerald-100 flex items-center justify-center shrink-0">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-slate-900 truncate">{s.companyName}</p>
                      <p className="text-[10px] text-slate-500 truncate">
                        {s.packageLabel} · {s.soldBy?.name || "Platform"}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold text-emerald-700 tabular-nums">{formatPlatformCurrency(s.amountInr)}</p>
                      <p className="text-[10px] text-slate-400">{formatDate(s.createdAt)}</p>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Panel>

        {/* Free trials */}
        <Panel
          title="Active free trials"
          subtitle="7-day trial companies"
          action={canCompanies ? <Link href={`${PLATFORM_NAV.companies}?filter=trial`} className="text-xs text-blue-600 hover:underline">View all →</Link> : undefined}
        >
          <ul className="divide-y divide-slate-100">
            {analytics.trialCompanies.length === 0 ? (
              <li className="px-4 py-6 text-sm text-slate-500 text-center">No active trials</li>
            ) : (
              analytics.trialCompanies.map((c) => (
                <li key={c.id}>
                  <Link href={canCompanies ? `${PLATFORM_NAV.companies}?id=${c.id}` : "#"} className="block px-4 py-3 hover:bg-slate-50">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-500">{c.owner.email} · {c.memberCount} users</p>
                      </div>
                      <div className="text-right shrink-0">
                        {c.expiresAt && (
                          <p className={cn(
                            "text-[10px] font-medium",
                            new Date(c.expiresAt).getTime() - Date.now() < 3 * 86400000 ? "text-red-600" : "text-amber-600"
                          )}>
                            {Math.ceil((new Date(c.expiresAt).getTime() - Date.now()) / 86400000)}d left
                          </p>
                        )}
                        {c.interestedPackage && (
                          <p className="text-[10px] text-violet-600">
                            Interested: {PACKAGE_LABELS[c.interestedPackage] ?? c.interestedPackage}
                          </p>
                        )}
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Panel>

        {/* Expiring */}
        <Panel
          title="Expiring subscriptions"
          subtitle="Next 30 days"
          action={canSubscriptions ? <Link href={PLATFORM_NAV.subscriptions} className="text-xs text-blue-600 hover:underline">Renew →</Link> : undefined}
        >
          <ul className="divide-y divide-slate-100">
            {analytics.expiringCompanies.length === 0 ? (
              <li className="px-4 py-6 text-sm text-slate-500 text-center">Nothing expiring soon</li>
            ) : (
              analytics.expiringCompanies.map((c) => (
                <li key={c.id}>
                  <Link href={canCompanies ? `${PLATFORM_NAV.companies}?id=${c.id}` : PLATFORM_NAV.subscriptions} className="block px-4 py-3 hover:bg-slate-50">
                    <div className="flex justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                        <p className="text-[10px] text-slate-500">{c.packageLabel} · {c.memberCount} users</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={cn("text-xs font-bold tabular-nums", c.daysLeft <= 7 ? "text-red-600" : "text-amber-600")}>
                          {c.daysLeft < 0 ? "Expired" : `${c.daysLeft}d`}
                        </p>
                        <p className="text-[10px] text-slate-400">{formatDate(c.expiresAt)}</p>
                      </div>
                    </div>
                  </Link>
                </li>
              ))
            )}
          </ul>
        </Panel>
      </div>

      {/* Package interest list */}
      {analytics.packageInterestList.length > 0 && (
        <Panel
          title="Companies interested in upgrading"
          subtitle="Follow up to convert trials to paid"
          className="mt-6"
          action={canCompanies ? <Link href={`${PLATFORM_NAV.companies}?filter=interested`} className="text-xs text-blue-600 hover:underline">View all →</Link> : undefined}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500 text-left">
                  <th className="px-4 py-2.5 font-medium">Company</th>
                  <th className="px-4 py-2.5 font-medium">Interested plan</th>
                  <th className="px-4 py-2.5 font-medium">Added by</th>
                  <th className="px-4 py-2.5 font-medium"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {analytics.packageInterestList.map((c) => (
                  <tr key={c.id} className="hover:bg-slate-50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-900">{c.name}</p>
                      <p className="text-xs text-slate-500">{c.ownerEmail}</p>
                    </td>
                    <td className="px-4 py-3 text-violet-700 font-medium text-xs">{c.interestedLabel}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.provisionedBy?.name || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {canCompanies && (
                        <Link href={`${PLATFORM_NAV.companies}?id=${c.id}`} className="text-xs text-blue-600 hover:underline">Open →</Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      )}
    </div>
  );
}
