"use client";

import { useCallback, useEffect, useState } from "react";
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
  CompactMetric,
} from "@/components/dashboard/action-dashboard-parts";

type Stats = {
  userName?: string;
  userRole?: string;
  attention?: {
    followUpsDue: number;
    followUpsOverdue: number;
    followUpsUpcoming?: number;
    followUpsTomorrow?: number;
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
  totalLeads?: number;
  newLeadsToday?: number;
  newLeads?: number;
  activeLeads?: number;
  unassignedLeads?: number;
  myLeads?: number;
  teamLeads?: number;
  followUpsDueToday?: number;
  followUpsOverdue?: number;
  followUpsTomorrow?: number;
  followUpsUpcoming?: number;
  convertedLeads?: number;
  lostLeads?: number;
  qualifiedLeads?: number;
  proposalLeads?: number;
  negotiationLeads?: number;
  leadPipelineValue?: number;
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
    followUpsUpcoming: number;
    followUpsTomorrow: number;
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
  totalLeads: number;
  newLeadsToday: number;
  newLeads: number;
  activeLeads: number;
  unassignedLeads: number;
  myLeads: number;
  teamLeads: number;
  convertedLeads: number;
  lostLeads: number;
  qualifiedLeads: number;
  proposalLeads: number;
  negotiationLeads: number;
  leadPipelineValue: number;
  avgSalesCycleDays: number;
};

const EMPTY_STATS: NormalizedStats = {
  attention: { followUpsDue: 0, followUpsOverdue: 0, followUpsUpcoming: 0, followUpsTomorrow: 0, pipelineValue: 0, weightedPipeline: 0, dealsAtRiskCount: 0 },
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
  totalLeads: 0,
  newLeadsToday: 0,
  newLeads: 0,
  activeLeads: 0,
  unassignedLeads: 0,
  myLeads: 0,
  teamLeads: 0,
  convertedLeads: 0,
  lostLeads: 0,
  qualifiedLeads: 0,
  proposalLeads: 0,
  negotiationLeads: 0,
  leadPipelineValue: 0,
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
    totalLeads: raw.totalLeads ?? 0,
    newLeadsToday: raw.newLeadsToday ?? 0,
    newLeads: raw.newLeads ?? 0,
    activeLeads: raw.activeLeads ?? 0,
    unassignedLeads: raw.unassignedLeads ?? 0,
    myLeads: raw.myLeads ?? 0,
    teamLeads: raw.teamLeads ?? raw.totalLeads ?? 0,
    convertedLeads: raw.convertedLeads ?? 0,
    lostLeads: raw.lostLeads ?? 0,
    qualifiedLeads: raw.qualifiedLeads ?? 0,
    proposalLeads: raw.proposalLeads ?? 0,
    negotiationLeads: raw.negotiationLeads ?? 0,
    leadPipelineValue: raw.leadPipelineValue ?? 0,
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

  if (loading && !stats) return <PageLoader />;
  if (error && !stats) return <FetchError message={error} onRetry={() => load().catch(console.error)} />;
  if (!stats) return <PageLoader />;

  const owners = stats.filterOptions.owners;

  return (
    <div className="dash-page max-w-[1600px] min-w-0 space-y-6 relative pb-8">
      {refreshing && (
        <div className="absolute inset-x-0 top-0 z-10 flex justify-center pointer-events-none">
          <span className="inline-flex items-center gap-2 mt-1 px-3 py-1 rounded-full bg-white border border-slate-200 shadow-sm text-xs font-medium text-slate-600">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" /> Updating dashboard…
          </span>
        </div>
      )}

      <div className="dash-welcome flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-slate-500">
            {todayLabel()}
            {auth.workspace?.name ? ` · ${auth.workspace.name}` : ""}
          </p>
          <h1 className="text-[1.65rem] sm:text-[1.85rem] font-semibold text-slate-900 tracking-tight mt-1">
            {greeting()}, {displayName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {stats.attention.followUpsOverdue > 0
              ? `${stats.attention.followUpsOverdue} overdue follow-up${stats.attention.followUpsOverdue === 1 ? "" : "s"} need${stats.attention.followUpsOverdue === 1 ? "s" : ""} attention.`
              : `${stats.attention.followUpsDue} follow-up${stats.attention.followUpsDue === 1 ? "" : "s"} due today.`}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          <DashboardFilterBar
            range={range}
            ownerId={ownerId}
            owners={owners}
            onRangeChange={setRange}
            onOwnerChange={setOwnerId}
          />
          <div className="flex flex-wrap items-center gap-2">
            {canAdd && (
              <QuickActionBtn href="/dashboard/leads/new" primary>
                <Plus className="h-3.5 w-3.5" /> Add Lead
              </QuickActionBtn>
            )}
            <QuickActionBtn href="/dashboard/follow-ups">
              <CalendarPlus className="h-3.5 w-3.5" /> Follow-ups
            </QuickActionBtn>
            <BtnSecondary onClick={() => load(true)} disabled={refreshing} className="!inline-flex">
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} />
            </BtnSecondary>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3">
        <NeutralKpiCard label="Total Leads" value={stats.totalLeads} href="/dashboard/leads" hint={`${stats.teamLeads} in current scope`} />
        <NeutralKpiCard label="Active Leads" value={stats.activeLeads} href="/dashboard/leads" />
        <NeutralKpiCard label="New Leads" value={stats.newLeads} href="/dashboard/leads?status=new" hint={`${stats.newLeadsToday} today`} />
        <NeutralKpiCard
          label="Follow-ups"
          value={stats.attention.followUpsDue}
          href="/dashboard/follow-ups?bucket=today"
          hint={stats.attention.followUpsOverdue > 0 ? `${stats.attention.followUpsOverdue} overdue` : "Due today"}
          highlight={stats.attention.followUpsOverdue > 0 ? "danger" : undefined}
        />
        <NeutralKpiCard label="Won Leads" value={stats.convertedLeads} href="/dashboard/leads?status=won" highlight="success" />
        <NeutralKpiCard label="Lost Leads" value={stats.lostLeads} href="/dashboard/leads?status=lost" />
      </div>

      <div className="flex flex-wrap gap-2">
        <CompactMetric label="Unassigned" value={stats.unassignedLeads} href="/dashboard/leads?unassigned=1" tone={stats.unassignedLeads > 0 ? "warn" : undefined} />
        <CompactMetric label="My leads" value={stats.myLeads} href="/dashboard/leads?mine=1" />
        <CompactMetric label="Overdue" value={stats.attention.followUpsOverdue} href="/dashboard/follow-ups?bucket=overdue" tone={stats.attention.followUpsOverdue > 0 ? "danger" : undefined} />
        <CompactMetric label="Upcoming" value={stats.attention.followUpsUpcoming} href="/dashboard/follow-ups?bucket=upcoming" />
        <CompactMetric label="Qualified" value={stats.qualifiedLeads} href="/dashboard/leads?status=qualified" />
        <CompactMetric label="Proposal" value={stats.proposalLeads} href="/dashboard/leads?status=proposal_sent" />
        <CompactMetric label="Negotiation" value={stats.negotiationLeads} href="/dashboard/leads?status=negotiation" />
        <CompactMetric label="Pipeline" value={fmtShort(stats.leadPipelineValue || stats.pipelineValue)} href="/dashboard/pipeline" />
        <CompactMetric label="Won revenue" value={fmtShort(stats.wonRevenue)} href="/dashboard/leads?status=won" tone="success" />
      </div>

      <div className="grid lg:grid-cols-12 gap-5">
        <Panel title="Sales pipeline" subtitle="Value by stage" className="lg:col-span-8" noPadding action={<TenantLink href="/dashboard/pipeline" className="text-xs text-brand hover:text-brand-dark font-semibold">Open →</TenantLink>}>
          <PipelineHero stages={stats.pipelineByStage} totalValue={stats.pipelineValue} openDeals={stats.openDealCount} weightedPipeline={stats.weightedForecast} avgDealSize={stats.avgDealSize} avgSalesCycleDays={stats.avgSalesCycleDays} />
        </Panel>
        <div className="lg:col-span-4 space-y-5">
          <Panel title="Today's agenda" subtitle="Follow-ups & activities" noPadding action={<TenantLink href="/dashboard/activities" className="text-xs text-brand hover:text-brand-dark font-semibold">All →</TenantLink>}>
            <AgendaTimeline items={stats.todaysAgenda} />
          </Panel>
        </div>
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
            <Panel title="Sales Performance" subtitle="Team leaderboard" className="lg:col-span-4" noPadding action={<TenantLink href="/dashboard/reports" className="text-xs text-brand font-semibold">Reports →</TenantLink>}>
              <SalesPerformanceTable rows={stats.salesPerformance} topPerformer={stats.topPerformer} />
            </Panel>
          </>
        ) : (
          <Panel title="Quick Actions" subtitle="Jump to your daily work" className="lg:col-span-8 dash-panel" noPadding>
            <div className="grid sm:grid-cols-2">
              <QuickActionTile href="/dashboard/leads" label="My Leads" sub="View & update prospects" icon={Target} accent="bg-brand" />
              <QuickActionTile href="/dashboard/follow-ups" label="Follow-ups" sub={`${stats.attention.followUpsDue} due today`} icon={AlarmClock} accent="bg-cyan-600" />
              <QuickActionTile href="/dashboard/pipeline" label="My Pipeline" sub={`${stats.openDealCount} open deals`} icon={Kanban} accent="bg-slate-700" />
              <QuickActionTile href="/dashboard/tasks" label="My Tasks" sub="Tasks & to-dos" icon={CheckSquare} accent="bg-emerald-600" />
            </div>
          </Panel>
        )}
      </div>

      <DashboardSectionLabel>Recent activity</DashboardSectionLabel>

      {/* Recent activity */}
      <div className="grid lg:grid-cols-2 gap-4">
        <Panel title="Recent Leads" noPadding action={<TenantLink href="/dashboard/leads" className="text-xs text-brand font-semibold">All →</TenantLink>}>
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
        <Panel title="Recent Activity" noPadding action={<TenantLink href="/dashboard/activities" className="text-xs text-brand font-semibold">All →</TenantLink>}>
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
