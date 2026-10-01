"use client";

import { useCallback, useEffect, useState } from "react";
import { TenantLink } from "@/components/ui/tenant-link";
import { useAuth } from "@/lib/auth-context";
import { apiFetch, ApiError, formatCurrency, formatDate } from "@/lib/api";
import { LEAD_STATUS_LABELS } from "@/lib/lead-constants";
import { REPORT_TABS } from "@/lib/crm-constants";
import { PageHeader, Panel, ProTable, Th, Td, PageLoader, BtnSecondary } from "@/components/ui/dashboard-ui";
import { KpiCard, BarChartList, PipelineBars, STATUS_CHART_COLORS } from "@/components/ui/dashboard-charts";
import { Trophy, XCircle, Kanban, Target, TrendingUp, Users, CalendarClock, AlertTriangle, RefreshCw } from "lucide-react";

type FullReports = {
  leadsByStatus: Array<{ status: string; count: number }>;
  leadsBySource: Array<{ source: string; count: number }>;
  pipelineByStage: Array<{ id: string; name: string; dealCount: number; totalValue: number; isWon: boolean; isLost: boolean }>;
  won: { count: number; leadCount: number; revenue: number };
  lost: { count: number; value: number };
  conversionReport: { totalLeads: number; converted: number; rate: number; bySource: Array<{ source: string; count: number }> };
  salesReport: { pipelineValue: number; wonRevenue: number; lostValue: number; openDeals: number };
  executivePerformance: Array<{ userId: string; name: string; role: string; wonDeals: number; wonLeads: number; wonRevenue: number; leadCount?: number }>;
  followUpReport: {
    dueToday: number;
    overdue: number;
    completed: number;
    byEmployee: Array<{ userId: string | null; name: string; followUpCount: number }>;
  };
  lostLeadReport: Array<{ id: string; firstName: string; lastName: string | null; company: string | null; source: string | null; updatedAt: string }>;
  revenueReport: { total: number; monthly: number; wonCount: number };
  monthlyReport: { newLeads: number; dealsCreated: number; revenue: number; month: string };
  dailyActivityReport: Array<{ id: string; title: string; user: string | null; lead: string | null; createdAt: string }>;
  employeeLeadReport: Array<{ userId: string | null; name: string; role: string; managerName: string | null; leadCount: number }>;
  teamLeadReport: Array<{ managerId: string; managerName: string; leadCount: number; members: number }>;
  assignmentReport: { totalLeads: number; assigned: number; unassigned: number; assignmentsThisMonth: number; assignmentRate: number };
  wonLostAnalysis: { won: number; lost: number; winRate: number; dealWon: number; dealLost: number; dealWinRate: number };
};

export default function ReportsPage() {
  const auth = useAuth();
  const [reports, setReports] = useState<FullReports | null>(null);
  const [tab, setTab] = useState<string>("overview");
  const [denied, setDenied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadReports = useCallback(async () => {
    if (!auth.hasPermission("reports")) {
      setDenied(true);
      return;
    }
    setError(null);
    setRefreshing(true);
    try {
      const data = await apiFetch<FullReports>("/api/dashboard/reports");
      setReports(data);
      setDenied(false);
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setDenied(true);
        return;
      }
      setError(err instanceof Error ? err.message : "Failed to load reports");
    } finally {
      setRefreshing(false);
    }
  }, [auth]);

  useEffect(() => {
    loadReports().catch(console.error);
  }, [loadReports]);

  if (denied) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Reports access restricted</h1>
        <p className="text-sm text-slate-500 mb-4">Your role does not include permission to view reports.</p>
        <TenantLink href="/dashboard" className="text-sm text-brand hover:underline">Back to dashboard</TenantLink>
      </div>
    );
  }

  if (error && !reports) {
    return (
      <div className="max-w-lg mx-auto py-16 text-center">
        <h1 className="text-lg font-semibold text-slate-900 mb-2">Could not load reports</h1>
        <p className="text-sm text-slate-500 mb-4">{error}</p>
        <BtnSecondary onClick={() => loadReports().catch(console.error)}>
          <RefreshCw className="h-4 w-4" /> Try again
        </BtnSecondary>
      </div>
    );
  }

  if (!reports) return <PageLoader />;

  const statusTotal = reports.leadsByStatus.reduce((s, r) => s + r.count, 0) || 1;
  const sourceTotal = reports.leadsBySource.reduce((s, r) => s + r.count, 0) || 1;
  const openStages = reports.pipelineByStage.filter((s) => !s.isWon && !s.isLost);
  const pipelineTotal = openStages.reduce((s, x) => s + x.totalValue, 0);

  return (
    <div className="max-w-[1400px] space-y-5">
      <PageHeader
        meta="Analytics & Reports"
        title="Reports"
        description="Lead source, conversion, sales, revenue, and team performance"
        action={
          <div className="flex items-center gap-2">
            <BtnSecondary onClick={() => loadReports().catch(console.error)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
              Refresh
            </BtnSecondary>
            <TenantLink href="/dashboard" className="pro-btn-secondary">← Dashboard</TenantLink>
          </div>
        }
      />

      <div className="flex gap-1 overflow-x-auto pb-1 border-b border-slate-200">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${
              tab === t.id ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-700"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "overview" && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard
              label="Won Revenue"
              value={formatCurrency(reports.won.revenue)}
              sub={`${reports.won.leadCount} won leads · ${reports.won.count} deals · ${reports.wonLostAnalysis.winRate}% win rate`}
              icon={Trophy}
              theme="emerald"
            />
            <KpiCard label="Lost Deals" value={reports.lost.count} sub={formatCurrency(reports.lost.value)} icon={XCircle} theme="rose" />
            <KpiCard label="Open Pipeline" value={openStages.reduce((s, x) => s + x.dealCount, 0)} sub={formatCurrency(pipelineTotal)} icon={Kanban} theme="violet" />
            <KpiCard label="Total Leads" value={statusTotal} sub={`${reports.conversionReport.rate}% converted`} icon={Target} theme="blue" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Lead Status" noPadding>
              <BarChartList
                items={reports.leadsByStatus.sort((a,b)=>b.count-a.count).map((r)=>({
                  label: LEAD_STATUS_LABELS[r.status]||r.status,
                  value: r.count,
                  pct: (r.count/statusTotal)*100,
                  barClass: STATUS_CHART_COLORS[r.status],
                  href: `/dashboard/leads?status=${encodeURIComponent(r.status)}`,
                }))}
              />
            </Panel>
            <Panel title="Lead Sources" noPadding>
              <BarChartList
                items={reports.leadsBySource.sort((a,b)=>b.count-a.count).map((r)=>({
                  label: r.source,
                  value: r.count,
                  pct: (r.count/sourceTotal)*100,
                  href: `/dashboard/leads?source=${encodeURIComponent(r.source)}`,
                }))}
              />
            </Panel>
          </div>
          <Panel title="Pipeline Stages" noPadding><PipelineBars stages={openStages.map(s=>({name:s.name,dealCount:s.dealCount,totalValue:s.totalValue}))} totalValue={pipelineTotal} /></Panel>
        </>
      )}

      {tab === "source" && (
        <Panel title="Lead Source Report" subtitle="Acquisition channel breakdown" noPadding>
          <ProTable>
            <thead><tr><Th>Source</Th><Th className="text-right">Leads</Th><Th className="text-right">Share</Th></tr></thead>
            <tbody>
              {reports.leadsBySource.sort((a,b)=>b.count-a.count).map(r=>(
                <tr key={r.source} className="hover:bg-slate-50">
                  <Td className="font-medium !text-slate-900">
                    <TenantLink href={`/dashboard/leads?source=${encodeURIComponent(r.source)}`} className="hover:underline">
                      {r.source}
                    </TenantLink>
                  </Td>
                  <Td className="text-right font-semibold">{r.count}</Td>
                  <Td className="text-right text-slate-500">{((r.count/sourceTotal)*100).toFixed(1)}%</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        </Panel>
      )}

      {tab === "conversion" && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Panel title="Conversion Summary" noPadding>
            <div className="grid grid-cols-3 gap-3 p-4">
              <div className="rounded-[10px] border border-slate-200/90 bg-white px-3 py-3">
                <p className="text-[11px] font-semibold text-slate-500">Total Leads</p>
                <p className="text-2xl font-semibold tabular-nums text-slate-900 mt-1">{reports.conversionReport.totalLeads}</p>
              </div>
              <div className="rounded-[10px] border border-emerald-100 bg-emerald-50/40 px-3 py-3">
                <p className="text-[11px] font-semibold text-emerald-700">Converted</p>
                <p className="text-2xl font-semibold tabular-nums text-emerald-800 mt-1">{reports.conversionReport.converted}</p>
              </div>
              <div className="rounded-[10px] border border-brand-light bg-brand-muted/50 px-3 py-3">
                <p className="text-[11px] font-semibold text-brand">Rate</p>
                <p className="text-2xl font-semibold tabular-nums text-brand mt-1">{reports.conversionReport.rate}%</p>
              </div>
            </div>
          </Panel>
          <Panel title="Conversion by Source" noPadding>
            <ProTable>
              <thead><tr><Th>Source</Th><Th className="text-right">Leads</Th></tr></thead>
              <tbody>
                {reports.conversionReport.bySource.sort((a,b)=>b.count-a.count).map(r=>(
                  <tr key={r.source}><Td>{r.source}</Td><Td className="text-right font-semibold">{r.count}</Td></tr>
                ))}
              </tbody>
            </ProTable>
          </Panel>
        </div>
      )}

      {tab === "employees" && (
        <Panel title="Employee-wise Leads" subtitle="Lead count by assigned owner" noPadding>
          <ProTable>
            <thead><tr><Th>Employee</Th><Th>Role</Th><Th>Manager</Th><Th className="text-right">Leads</Th></tr></thead>
            <tbody>
              {reports.employeeLeadReport.length === 0 ? (
                <tr><Td colSpan={4} className="text-center text-slate-400 py-8">No assigned leads yet</Td></tr>
              ) : reports.employeeLeadReport.map((e) => (
                <tr key={e.userId ?? e.name} className="hover:bg-slate-50">
                  <Td className="font-medium !text-slate-900">{e.name}</Td>
                  <Td className="capitalize">{e.role.replace(/_/g, " ")}</Td>
                  <Td>{e.managerName || "—"}</Td>
                  <Td className="text-right font-semibold">{e.leadCount}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        </Panel>
      )}

      {tab === "teams" && (
        <Panel title="Team-wise Leads" subtitle="Leads grouped by manager / team leader" noPadding>
          <ProTable>
            <thead><tr><Th>Team / Manager</Th><Th className="text-right">Members</Th><Th className="text-right">Leads</Th></tr></thead>
            <tbody>
              {reports.teamLeadReport.length === 0 ? (
                <tr><Td colSpan={3} className="text-center text-slate-400 py-8">No team data yet</Td></tr>
              ) : reports.teamLeadReport.map((t) => (
                <tr key={t.managerId} className="hover:bg-slate-50">
                  <Td className="font-medium !text-slate-900">{t.managerName}</Td>
                  <Td className="text-right">{t.members}</Td>
                  <Td className="text-right font-semibold">{t.leadCount}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        </Panel>
      )}

      {tab === "assignment" && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KpiCard label="Total Leads" value={reports.assignmentReport.totalLeads} icon={Target} theme="blue" />
            <KpiCard label="Assigned" value={reports.assignmentReport.assigned} sub={`${reports.assignmentReport.assignmentRate}% rate`} icon={Users} theme="emerald" />
            <KpiCard label="Unassigned" value={reports.assignmentReport.unassigned} icon={AlertTriangle} theme="amber" />
            <KpiCard label="Assigned This Month" value={reports.assignmentReport.assignmentsThisMonth} icon={TrendingUp} theme="violet" />
          </div>
          <p className="text-xs text-slate-500">
            Configure assignment rules and teams on the{" "}
            <TenantLink href="/dashboard/assignment" className="text-brand hover:underline">Lead Assignment</TenantLink> page.
          </p>
        </>
      )}

      {tab === "sales" && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { label: "Pipeline Value", value: formatCurrency(reports.salesReport.pipelineValue), icon: Kanban, theme: "violet" as const },
            { label: "Won Revenue", value: formatCurrency(reports.salesReport.wonRevenue), icon: TrendingUp, theme: "emerald" as const },
            { label: "Lost Value", value: formatCurrency(reports.salesReport.lostValue), icon: XCircle, theme: "rose" as const },
            { label: "Open Deals", value: reports.salesReport.openDeals, icon: Target, theme: "blue" as const },
          ].map(c => <KpiCard key={c.label} label={c.label} value={c.value} icon={c.icon} theme={c.theme} />)}
        </div>
      )}

      {tab === "executive" && (
        <Panel title="Executive Performance" subtitle="Won deals and revenue by team member" noPadding>
          <ProTable>
            <thead><tr><Th>Name</Th><Th>Role</Th><Th className="text-right">Won Leads</Th><Th className="text-right">Won Deals</Th><Th className="text-right">Revenue</Th></tr></thead>
            <tbody>
              {reports.executivePerformance.sort((a,b)=>b.wonRevenue-a.wonRevenue).map(e=>(
                <tr key={e.userId} className="hover:bg-slate-50">
                  <Td className="font-medium !text-slate-900">{e.name}</Td>
                  <Td className="capitalize">{e.role.replace(/_/g," ")}</Td>
                  <Td className="text-right">{e.wonLeads}</Td>
                  <Td className="text-right">{e.wonDeals}</Td>
                  <Td className="text-right font-semibold">{formatCurrency(e.wonRevenue)}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        </Panel>
      )}

      {tab === "followup" && (
        <>
          <div className="grid sm:grid-cols-3 gap-4">
            <KpiCard label="Due Today" value={reports.followUpReport.dueToday} icon={CalendarClock} theme="amber" />
            <KpiCard label="Overdue" value={reports.followUpReport.overdue} icon={AlertTriangle} theme="rose" />
            <KpiCard label="Completed" value={reports.followUpReport.completed} icon={Users} theme="emerald" />
          </div>
          <Panel title="Follow-ups by Employee" noPadding>
            <ProTable>
              <thead><tr><Th>Employee</Th><Th className="text-right">Follow-ups</Th></tr></thead>
              <tbody>
                {(reports.followUpReport.byEmployee ?? []).length === 0 ? (
                  <tr><Td colSpan={2} className="text-center text-slate-400 py-8">No follow-up data</Td></tr>
                ) : reports.followUpReport.byEmployee.map((e) => (
                  <tr key={e.userId ?? e.name} className="hover:bg-slate-50">
                    <Td className="font-medium !text-slate-900">{e.name}</Td>
                    <Td className="text-right font-semibold">{e.followUpCount}</Td>
                  </tr>
                ))}
              </tbody>
            </ProTable>
          </Panel>
        </>
      )}

      {tab === "wonlost" && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <KpiCard label="Leads Won" value={reports.wonLostAnalysis.won} sub={`${reports.wonLostAnalysis.winRate}% win rate`} icon={Trophy} theme="emerald" />
            <KpiCard label="Leads Lost" value={reports.wonLostAnalysis.lost} icon={XCircle} theme="rose" />
            <KpiCard label="Deals Won / Lost" value={`${reports.wonLostAnalysis.dealWon} / ${reports.wonLostAnalysis.dealLost}`} sub={`${reports.wonLostAnalysis.dealWinRate}% deal win rate`} icon={Kanban} theme="violet" />
          </div>
          <div className="grid lg:grid-cols-2 gap-4">
            <Panel title="Won Summary" noPadding>
              <div className="p-4 grid grid-cols-3 gap-3">
                <div className="rounded-[10px] border border-emerald-100 bg-emerald-50/40 px-3 py-3">
                  <p className="text-[11px] font-semibold text-emerald-700">Won Leads</p>
                  <p className="text-2xl font-semibold tabular-nums text-emerald-800 mt-1">{reports.won.leadCount}</p>
                </div>
                <div className="rounded-[10px] border border-emerald-100 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold text-slate-500">Won Deals</p>
                  <p className="text-2xl font-semibold tabular-nums text-slate-900 mt-1">{reports.won.count}</p>
                </div>
                <div className="rounded-[10px] border border-emerald-100 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold text-slate-500">Revenue</p>
                  <p className="text-xl font-semibold tabular-nums text-emerald-800 mt-1">{formatCurrency(reports.won.revenue)}</p>
                </div>
              </div>
            </Panel>
            <Panel title="Lost Deals" noPadding>
              <div className="p-4 grid grid-cols-2 gap-3">
                <div className="rounded-[10px] border border-rose-100 bg-rose-50/40 px-3 py-3">
                  <p className="text-[11px] font-semibold text-rose-700">Count</p>
                  <p className="text-2xl font-semibold tabular-nums text-rose-700 mt-1">{reports.lost.count}</p>
                </div>
                <div className="rounded-[10px] border border-slate-200/90 bg-white px-3 py-3">
                  <p className="text-[11px] font-semibold text-slate-500">Value</p>
                  <p className="text-xl font-semibold tabular-nums text-slate-900 mt-1">{formatCurrency(reports.lost.value)}</p>
                </div>
              </div>
            </Panel>
          </div>
        </>
      )}

      {tab === "lost" && (
        <Panel title="Lost Lead Report" noPadding>
          <ProTable>
            <thead><tr><Th>Customer</Th><Th>Company</Th><Th>Source</Th><Th>Lost Date</Th></tr></thead>
            <tbody>
              {reports.lostLeadReport.map(l=>(
                <tr key={l.id} className="hover:bg-slate-50">
                  <Td className="font-medium !text-slate-900">{l.firstName} {l.lastName}</Td>
                  <Td>{l.company||"—"}</Td>
                  <Td>{l.source||"—"}</Td>
                  <Td>{formatDate(l.updatedAt)}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        </Panel>
      )}

      {tab === "revenue" && (
        <div className="grid sm:grid-cols-3 gap-4">
          <KpiCard label="Total Revenue" value={formatCurrency(reports.revenueReport.total)} sub={`${reports.revenueReport.wonCount} deals`} icon={TrendingUp} theme="emerald" />
          <KpiCard label="This Month" value={formatCurrency(reports.revenueReport.monthly)} icon={Target} theme="blue" />
          <KpiCard label="Won Deals" value={reports.revenueReport.wonCount} icon={Trophy} theme="violet" />
        </div>
      )}

      {tab === "monthly" && (
        <Panel title={`Monthly Report — ${reports.monthlyReport.month}`}>
          <div className="grid sm:grid-cols-3 gap-4 p-4">
            <div className="rounded-[10px] border border-slate-200/90 bg-white px-4 py-3">
              <p className="text-[11px] font-semibold text-slate-500">New Leads</p>
              <p className="text-3xl font-semibold text-slate-900 tabular-nums mt-1">{reports.monthlyReport.newLeads}</p>
            </div>
            <div className="rounded-[10px] border border-brand-light bg-brand-muted/40 px-4 py-3">
              <p className="text-[11px] font-semibold text-brand">Deals Created</p>
              <p className="text-3xl font-semibold text-brand tabular-nums mt-1">{reports.monthlyReport.dealsCreated}</p>
            </div>
            <div className="rounded-[10px] border border-emerald-100 bg-emerald-50/40 px-4 py-3">
              <p className="text-[11px] font-semibold text-emerald-700">Revenue</p>
              <p className="text-2xl font-semibold text-emerald-800 tabular-nums mt-1">{formatCurrency(reports.monthlyReport.revenue)}</p>
            </div>
          </div>
        </Panel>
      )}

      {tab === "daily" && (
        <Panel title="Daily Activity Report" subtitle="Today's workspace events" noPadding>
          <ProTable>
            <thead><tr><Th>Event</Th><Th>Lead</Th><Th>User</Th><Th>Time</Th></tr></thead>
            <tbody>
              {reports.dailyActivityReport.length === 0 ? (
                <tr><Td colSpan={4} className="text-center text-slate-400 py-8">No activity today</Td></tr>
              ) : reports.dailyActivityReport.map(a=>(
                <tr key={a.id} className="hover:bg-slate-50">
                  <Td className="font-medium !text-slate-900">{a.title}</Td>
                  <Td>{a.lead||"—"}</Td>
                  <Td>{a.user||"—"}</Td>
                  <Td>{formatDate(a.createdAt)}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        </Panel>
      )}
    </div>
  );
}
