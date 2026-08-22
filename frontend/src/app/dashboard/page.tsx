"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Plus, CalendarPlus, Loader2, Target, AlarmClock, Kanban, CheckSquare } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";
import { isManagerOrAbove } from "@/lib/route-access";
import { LEAD_STATUS_LABELS, STATUS_BADGE } from "@/lib/lead-constants";
import {
  Panel,
  BtnSecondary,
  PageLoader,
  FetchError,
  EmptyState,
} from "@/components/ui/dashboard-ui";
import { TenantLink } from "@/components/ui/tenant-link";
import { ActivityRow, LeadRow } from "@/components/ui/dashboard-charts";
import {
  NeutralKpiCard,
  AttentionChip,
  DashboardFilterBar,
  PipelineHero,
  AgendaTimeline,
  DealAtRiskRow,
  RevenueTrendChart,
  LeadFunnelChart,
  ForecastPanel,
  TargetProgress,
  AiBriefCard,
  SalesPerformanceTable,
  LeadSourceTable,
  QuickActionBtn,
  DashboardSectionLabel,
  QuickActionTile,
} from "@/components/dashboard/action-dashboard-parts";

type Stats = {
  userName?: string;
  userRole?: string;
  attention?: {
    followUpsDue: number;
    followUpsOverdue: number;
    pipelineValue: number;
    weightedPipeline: number;
    dealsAtRiskCount: number;
  };
  kpiTrends?: {
    pipelineChangePct: number | null;
    wonChangePct: number | null;
    conversionChangePct: number | null;
    forecastChangePct: number | null;
  };
  salesTarget?: { target: number; achieved: number; pct: number; remaining: number };
  forecast?: {
    commit: number;
    bestCase: number;
    pipeline: number;
    target: number;
    attainmentPct: number;
    won: number;
  };
  dealsAtRisk?: Array<{
    id: string;
    name: string;
    amount: number;
    stage: string;
    reason: string;
  }>;
  todaysAgenda?: Array<{
    id: string;
    time: string;
    title: string;
    subtitle: string;
    type: string;
    href: string;
  }>;
  revenueTrend?: Array<{ month: string; pipeline: number; won: number; forecast: number }>;
  leadFunnel?: Array<{ stage: string; label: string; count: number; conversionPct: number | null }>;
  overallFunnelConversion?: number;
  salesPerformance?: Array<{
    userId: string;
    name: string;
    role: string;
    leads: number;
    qualified: number;
    deals: number;
    won: number;
    revenue: number;
  }>;
  topPerformer?: { name: string; revenue: number } | null;
  leadSourcePerformance?: Array<{
    source: string;
    leads: number;
    qualified: number;
    won: number;
    revenue: number;
  }>;
  bestSource?: string | null;
  aiBrief?: Array<{
    dealId: string;
    dealName: string;
    amount: number;
    stage: string;
    recommendation: string;
  }>;
  filterOptions?: { owners: Array<{ id: string; name: string }> };
  avgSalesCycleDays?: number;
  pipelineValue?: number;
  weightedForecast?: number;
  avgDealSize?: number;
  wonRevenue?: number;
  conversionRate?: number;
  openDealCount?: number;
  pipelineByStage?: Array<{
    id: string;
    name: string;
    dealCount: number;
    totalValue: number;
    probability: number;
  }>;
  recentLeads?: Array<{
    id: string;
    leadNumber: string;
    firstName: string;
    lastName: string | null;
    company: string | null;
    status: string;
    score: number;
  }>;
  recentActivities?: Array<{
    id: string;
    title: string;
    createdAt: string;
    lead: { id: string; leadNumber: string };
    user: { name: string } | null;
  }>;
};

type NormalizedStats = {
  userName?: string;
  userRole?: string;
  attention: {
    followUpsDue: number;
    followUpsOverdue: number;
    pipelineValue: number;
    weightedPipeline: number;
    dealsAtRiskCount: number;
  };
  kpiTrends: {
    pipelineChangePct: number | null;
    wonChangePct: number | null;
    conversionChangePct: number | null;
    forecastChangePct: number | null;
  };
  salesTarget: { target: number; achieved: number; pct: number; remaining: number };
  forecast: {
    commit: number;
    bestCase: number;
    pipeline: number;
    target: number;
    attainmentPct: number;
    won: number;
  };
  dealsAtRisk: Array<{ id: string; name: string; amount: number; stage: string; reason: string }>;
  todaysAgenda: Array<{ id: string; time: string; title: string; subtitle: string; type: string; href: string }>;
  revenueTrend: Array<{ month: string; pipeline: number; won: number; forecast: number }>;
  leadFunnel: Array<{ stage: string; label: string; count: number; conversionPct: number | null }>;
  overallFunnelConversion: number;
  salesPerformance: Array<{ userId: string; name: string; role: string; leads: number; qualified: number; deals: number; won: number; revenue: number }>;
  topPerformer?: { name: string; revenue: number } | null;
  leadSourcePerformance: Array<{ source: string; leads: number; qualified: number; won: number; revenue: number }>;
  bestSource?: string | null;
  aiBrief: Array<{ dealId: string; dealName: string; amount: number; stage: string; message?: string; recommendation: string }>;
  filterOptions: { owners: Array<{ id: string; name: string }> };
  pipelineByStage: Array<{ id: string; name: string; dealCount: number; totalValue: number; probability: number }>;
  recentLeads: Array<{ id: string; leadNumber: string; firstName: string; lastName: string | null; company: string | null; status: string; score: number }>;
  recentActivities: Array<{ id: string; title: string; createdAt: string; lead: { id: string; leadNumber: string }; user: { name: string } | null }>;
  pipelineValue: number;
  weightedForecast: number;
  avgDealSize: number;
  wonRevenue: number;
  conversionRate: number;
  openDealCount: number;
  avgSalesCycleDays: number;
};

const EMPTY_STATS: NormalizedStats = {
  attention: { followUpsDue: 0, followUpsOverdue: 0, pipelineValue: 0, weightedPipeline: 0, dealsAtRiskCount: 0 },
  kpiTrends: { pipelineChangePct: null, wonChangePct: null, conversionChangePct: null, forecastChangePct: null },
  salesTarget: { target: 0, achieved: 0, pct: 0, remaining: 0 },
  forecast: { commit: 0, bestCase: 0, pipeline: 0, target: 0, attainmentPct: 0, won: 0 },
  dealsAtRisk: [],
  todaysAgenda: [],
  revenueTrend: [],
  leadFunnel: [],
  overallFunnelConversion: 0,
  salesPerformance: [],
  leadSourcePerformance: [],
  aiBrief: [],
  filterOptions: { owners: [] },
  pipelineByStage: [],
  recentLeads: [],
  recentActivities: [],
  pipelineValue: 0,
  weightedForecast: 0,
  avgDealSize: 0,
  wonRevenue: 0,
  conversionRate: 0,
  openDealCount: 0,
  avgSalesCycleDays: 0,
};

function normalizeStats(raw: Stats): NormalizedStats {
  return {
    ...EMPTY_STATS,
    ...raw,
    attention: { ...EMPTY_STATS.attention, ...raw.attention },
    kpiTrends: { ...EMPTY_STATS.kpiTrends, ...raw.kpiTrends },
    salesTarget: { ...EMPTY_STATS.salesTarget, ...raw.salesTarget },
    forecast: { ...EMPTY_STATS.forecast, ...raw.forecast },
    filterOptions: {
      owners: raw.filterOptions?.owners ?? [],
    },
    dealsAtRisk: raw.dealsAtRisk ?? [],
    todaysAgenda: raw.todaysAgenda ?? [],
    revenueTrend: raw.revenueTrend ?? [],
    leadFunnel: raw.leadFunnel ?? [],
    salesPerformance: raw.salesPerformance ?? [],
    leadSourcePerformance: raw.leadSourcePerformance ?? [],
    aiBrief: raw.aiBrief ?? [],
    pipelineByStage: raw.pipelineByStage ?? [],
    recentLeads: raw.recentLeads ?? [],
    recentActivities: raw.recentActivities ?? [],
    pipelineValue: raw.pipelineValue ?? 0,
    weightedForecast: raw.weightedForecast ?? 0,
    avgDealSize: raw.avgDealSize ?? 0,
    wonRevenue: raw.wonRevenue ?? 0,
    conversionRate: raw.conversionRate ?? 0,
    openDealCount: raw.openDealCount ?? 0,
    avgSalesCycleDays: raw.avgSalesCycleDays ?? 0,
    overallFunnelConversion: raw.overallFunnelConversion ?? 0,
  };
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
}

function fmtShort(n: number) {
  return n >= 100000 ? `₹${(n / 100000).toFixed(1)}L` : formatCurrency(n);
}

function todayLabel() {
  return new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default function DashboardPage() {
  const auth = useAuth();
  const [stats, setStats] = useState<NormalizedStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState("month");
  const [ownerId, setOwnerId] = useState("all");

  const role = stats?.userRole || auth.role;
  const isEmployee = role === "employee";
  const isManagerOrAboveRole = isManagerOrAbove(role);
  const canAdd = auth.hasPermission("add");

  const load = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ range });
      if (ownerId !== "all") params.set("ownerId", ownerId);
      const raw = await apiFetch<Stats>(`/api/dashboard/stats?${params}`);
      setStats(normalizeStats(raw));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [range, ownerId]);

  useEffect(() => {
    load().catch(console.error);
  }, [load]);

  const displayName = stats?.userName || auth.user?.name?.split(" ")[0] || "there";

  const trendLabel = useMemo(() => {
    const labels: Record<string, string> = {
      today: "vs yesterday",
      week: "vs last week",
      month: "vs last month",
      quarter: "vs last quarter",
      all: "",
    };
    return labels[range] || "vs prior period";
  }, [range]);

  if (loading && !stats) return <PageLoader />;
  if (error && !stats) return <FetchError message={error} onRetry={() => load().catch(console.error)} />;
  if (!stats) return <PageLoader />;

  const owners = stats.filterOptions.owners;

  return (
    <div className="dash-page max-w-[1600px] min-w-0 space-y-5 sm:space-y-7 relative pb-6">
      {refreshing && (
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center pointer-events-none">
          <span className="inline-flex items-center gap-2 mt-2 px-4 py-1.5 rounded-full bg-white/95 border border-indigo-100 shadow-lg shadow-indigo-100/50 text-xs font-medium text-slate-600 backdrop-blur-sm">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-600" /> Updating dashboard…
          </span>
        </div>
      )}

      {/* Hero header */}
      <div className="dash-hero relative overflow-hidden rounded-2xl p-5 sm:p-6">
        <div className="absolute -top-20 -right-16 h-56 w-56 rounded-full bg-indigo-300/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-10 h-40 w-40 rounded-full bg-violet-300/15 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col xl:flex-row xl:items-start xl:justify-between gap-5">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="text-[11px] font-semibold text-slate-600 bg-white/70 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-200/60 shadow-sm">
                {todayLabel()}
              </span>
              {auth.workspace?.name && (
                <span className="text-[11px] font-semibold text-indigo-700 bg-white/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-indigo-200/60 truncate max-w-[220px] shadow-sm">
                  {auth.workspace.name}
                </span>
              )}
              <span className="text-[11px] font-semibold text-violet-700 bg-violet-50/80 px-2.5 py-1 rounded-lg border border-violet-200/50">
                {auth.roleLabel}
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {greeting()}, <span className="bg-gradient-to-r from-indigo-700 to-violet-600 bg-clip-text text-transparent">{displayName}</span>
            </h1>
            <p className="text-sm text-slate-600 mt-1.5 font-medium">Here&apos;s what needs your attention today</p>
            <div className="flex flex-wrap gap-2 mt-5">
              <AttentionChip
                label="Follow-ups due"
                value={stats.attention.followUpsDue}
                href="/dashboard/follow-ups"
                tone={stats.attention.followUpsDue > 0 ? "brand" : "neutral"}
              />
              <AttentionChip
                label="Overdue"
                value={stats.attention.followUpsOverdue}
                href="/dashboard/follow-ups"
                tone={stats.attention.followUpsOverdue > 0 ? "danger" : "neutral"}
              />
              <AttentionChip label="Pipeline" value={fmtShort(stats.attention.pipelineValue)} href="/dashboard/pipeline" />
              <AttentionChip label="Weighted" value={fmtShort(stats.attention.weightedPipeline)} href="/dashboard/pipeline" />
              <AttentionChip
                label="At risk"
                value={stats.attention.dealsAtRiskCount}
                tone={stats.attention.dealsAtRiskCount > 0 ? "warn" : "neutral"}
              />
            </div>
          </div>
          <div className="relative flex flex-col items-stretch sm:items-end gap-3 shrink-0 w-full xl:w-auto">
            <DashboardFilterBar
              range={range}
              ownerId={ownerId}
              owners={owners}
              onRangeChange={setRange}
              onOwnerChange={setOwnerId}
            />
            <div className="flex flex-wrap items-center gap-2">
              {canAdd && (
                <>
                  <QuickActionBtn href="/dashboard/leads/new" primary>
                    <Plus className="h-3.5 w-3.5" /> Add Lead
                  </QuickActionBtn>
                  <QuickActionBtn href="/dashboard/deals/new">
                    <Plus className="h-3.5 w-3.5" /> Add Deal
                  </QuickActionBtn>
                </>
              )}
              <QuickActionBtn href="/dashboard/activities">
                <CalendarPlus className="h-3.5 w-3.5" /> Activity
              </QuickActionBtn>
              <BtnSecondary onClick={() => load(true)} disabled={refreshing} className="!inline-flex">
                <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
              </BtnSecondary>
            </div>
          </div>
        </div>
      </div>

      <DashboardSectionLabel>Key metrics</DashboardSectionLabel>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <NeutralKpiCard label="Pipeline" value={fmtShort(stats.pipelineValue)} trend={stats.kpiTrends.pipelineChangePct} trendLabel={trendLabel} href="/dashboard/pipeline" />
        <NeutralKpiCard label="Won Revenue" value={fmtShort(stats.wonRevenue)} trend={stats.kpiTrends.wonChangePct} trendLabel={trendLabel} href="/dashboard/leads?status=won" highlight="success" />
        <NeutralKpiCard label="Forecast" value={fmtShort(stats.weightedForecast)} trend={stats.kpiTrends.forecastChangePct} trendLabel={trendLabel} href="/dashboard/reports" />
        <NeutralKpiCard label="Conversion" value={`${stats.conversionRate}%`} href="/dashboard/reports" />
        <NeutralKpiCard label="At Risk" value={stats.attention.dealsAtRiskCount} highlight={stats.attention.dealsAtRiskCount > 0 ? "warn" : undefined} />
      </div>

      <DashboardSectionLabel>Pipeline & schedule</DashboardSectionLabel>

      {/* Hero: Pipeline + Agenda */}
      <div className="grid lg:grid-cols-12 gap-4">
        <Panel title="Sales Pipeline" subtitle="Deal value by stage" className="lg:col-span-7" noPadding action={<TenantLink href="/dashboard/pipeline" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">Open →</TenantLink>}>
          <PipelineHero stages={stats.pipelineByStage} totalValue={stats.pipelineValue} openDeals={stats.openDealCount} weightedPipeline={stats.weightedForecast} avgDealSize={stats.avgDealSize} avgSalesCycleDays={stats.avgSalesCycleDays} />
        </Panel>
        <Panel title="Today's Agenda" subtitle="Follow-ups & activities" className="lg:col-span-5" noPadding action={<TenantLink href="/dashboard/activities" className="text-xs text-indigo-600 hover:text-indigo-700 font-semibold">All →</TenantLink>}>
          <AgendaTimeline items={stats.todaysAgenda} />
        </Panel>
      </div>

      {stats.aiBrief.length > 0 && <AiBriefCard items={stats.aiBrief} />}

      <DashboardSectionLabel>Intelligence</DashboardSectionLabel>

      {/* Intelligence row */}
      <div className="grid lg:grid-cols-12 gap-4">
        {isManagerOrAboveRole && (
          <Panel title="Revenue Trend" subtitle="6-month view" className="lg:col-span-4" noPadding>
            <RevenueTrendChart points={stats.revenueTrend} />
          </Panel>
        )}
        <Panel title="Deals at Risk" subtitle="Needs immediate action" className={isManagerOrAboveRole ? "lg:col-span-4" : "lg:col-span-6"} noPadding>
          {stats.dealsAtRisk.length === 0 ? (
            <EmptyState title="All clear" description="No deals flagged as at-risk." />
          ) : (
            stats.dealsAtRisk.map((d) => (
              <DealAtRiskRow key={d.id} id={d.id} name={d.name} amount={d.amount} stage={d.stage} reason={d.reason} />
            ))
          )}
        </Panel>
        <Panel title={isEmployee ? "My Target" : "Forecast & Target"} subtitle={isEmployee ? "Monthly progress" : "Commit vs target"} className={isManagerOrAboveRole ? "lg:col-span-4" : "lg:col-span-6"} noPadding>
          <TargetProgress {...stats.salesTarget} />
          {isManagerOrAboveRole && (
            <ForecastPanel commit={stats.forecast.commit} bestCase={stats.forecast.bestCase} pipeline={stats.forecast.pipeline} target={stats.forecast.target} attainmentPct={stats.forecast.attainmentPct} won={stats.forecast.won} />
          )}
        </Panel>
      </div>

      <DashboardSectionLabel>Analytics</DashboardSectionLabel>

      {/* Analytics row */}
      <div className="grid lg:grid-cols-12 gap-4">
        <Panel title="Lead Funnel" subtitle="Click stage to filter" className="lg:col-span-4" noPadding>
          <LeadFunnelChart stages={stats.leadFunnel} overallConversion={stats.overallFunnelConversion} />
        </Panel>
        {isManagerOrAboveRole ? (
          <>
            <Panel title="Lead Sources" subtitle="Channel ROI" className="lg:col-span-4" noPadding>
              <LeadSourceTable rows={stats.leadSourcePerformance} bestSource={stats.bestSource} />
            </Panel>
            <Panel title="Sales Performance" subtitle="Team leaderboard" className="lg:col-span-4" noPadding action={<TenantLink href="/dashboard/reports" className="text-xs text-indigo-600 font-semibold">Reports →</TenantLink>}>
              <SalesPerformanceTable rows={stats.salesPerformance} topPerformer={stats.topPerformer} />
            </Panel>
          </>
        ) : (
          <Panel title="Quick Actions" subtitle="Jump to your daily work" className="lg:col-span-8 dash-panel" noPadding>
            <div className="grid sm:grid-cols-2">
              <QuickActionTile href="/dashboard/leads" label="My Leads" sub="View & update prospects" icon={Target} accent="from-indigo-500 to-violet-600" />
              <QuickActionTile href="/dashboard/follow-ups" label="Follow-ups" sub={`${stats.attention.followUpsDue} due today`} icon={AlarmClock} accent="from-cyan-500 to-blue-600" />
              <QuickActionTile href="/dashboard/pipeline" label="My Pipeline" sub={`${stats.openDealCount} open deals`} icon={Kanban} accent="from-violet-500 to-purple-600" />
              <QuickActionTile href="/dashboard/tasks" label="My Tasks" sub="Tasks & to-dos" icon={CheckSquare} accent="from-emerald-500 to-teal-600" />
            </div>
          </Panel>
        )}
      </div>

      <DashboardSectionLabel>Recent activity</DashboardSectionLabel>

      {/* Recent activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Recent Leads" noPadding action={<TenantLink href="/dashboard/leads" className="text-xs text-indigo-600 font-semibold">All →</TenantLink>}>
          <div className="divide-y divide-slate-100 max-h-[280px] overflow-y-auto">
            {stats.recentLeads.length === 0 ? (
              <EmptyState title="No leads yet" action={canAdd ? <QuickActionBtn href="/dashboard/leads/new" primary>+ Add lead</QuickActionBtn> : undefined} />
            ) : (
              stats.recentLeads.slice(0, 5).map((l) => (
                <LeadRow key={l.id} href={`/dashboard/leads/${l.id}`} leadNumber={l.leadNumber} name={`${l.firstName} ${l.lastName || ""}`.trim()} company={l.company} status={LEAD_STATUS_LABELS[l.status] || l.status} score={l.score} statusClass={STATUS_BADGE[l.status]} />
              ))
            )}
          </div>
        </Panel>
        <Panel title="Recent Activity" noPadding action={<TenantLink href="/dashboard/activities" className="text-xs text-indigo-600 font-semibold">All →</TenantLink>}>
          {stats.recentActivities.length === 0 ? (
            <EmptyState title="No recent activity" />
          ) : (
            <div className="max-h-[280px] overflow-y-auto">
              {stats.recentActivities.slice(0, 6).map((a) => (
                <ActivityRow key={a.id} title={a.title} meta={`${a.user?.name || "System"} · ${formatDate(a.createdAt)} · ${a.lead.leadNumber}`} href={`/dashboard/leads/${a.lead.id}`} dotColor="bg-slate-400" />
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
