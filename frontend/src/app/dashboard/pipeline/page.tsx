"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { Plus, Zap, LayoutGrid, List, Archive, Kanban } from "lucide-react";
import { apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { FilterBar } from "@/components/ui/filter-bar";
import { ExcelImportToolbar } from "@/components/ui/excel-import-toolbar";
import { PageLoader, FetchError, EmptyState, BtnPrimary } from "@/components/ui/dashboard-ui";
import { formatPipelineTotal } from "@/components/crm/deal-card";
import {
  DealCard,
  STAGE_THEMES,
  type PipelineDeal,
} from "@/components/crm/deal-card";

type Stage = {
  id: string;
  name: string;
  order: number;
  probability: number;
  isWon?: boolean;
  isLost?: boolean;
  deals: PipelineDeal[];
};

type ArchivedDeal = PipelineDeal & {
  status: string;
  stage?: { name: string };
};

type AssignableUser = { userId: string; name: string };

type ViewMode = "board" | "list" | "archived";

function filterDeals(
  deals: PipelineDeal[],
  search: string,
  ownerFilter: string,
  industryFilter: string
) {
  return deals.filter((d) => {
    if (ownerFilter && d.owner?.id !== ownerFilter) return false;
    if (industryFilter && (d.account?.industry || "") !== industryFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      d.name.toLowerCase().includes(q) ||
      (d.account?.name || "").toLowerCase().includes(q) ||
      (d.contact?.firstName || "").toLowerCase().includes(q)
    );
  });
}

export default function PipelinePage() {
  const auth = useAuth();
  const [stages, setStages] = useState<Stage[]>([]);
  const [archivedDeals, setArchivedDeals] = useState<ArchivedDeal[]>([]);
  const [assignable, setAssignable] = useState<AssignableUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>("board");
  const [search, setSearch] = useState("");
  const [stageFilter, setStageFilter] = useState("");
  const [ownerFilter, setOwnerFilter] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [dragOverStage, setDragOverStage] = useState<string | null>(null);
  const [todayActivities, setTodayActivities] = useState(0);
  const [noActivities, setNoActivities] = useState(0);

  async function load() {
    setError(null);
    try {
      const [pipeline, activities, won, lost] = await Promise.all([
        apiFetch<Stage[]>("/api/deals/pipeline"),
        apiFetch<Array<{ dueDate: string | null; completed: boolean }>>("/api/activities"),
        apiFetch<ArchivedDeal[]>("/api/deals?status=won"),
        apiFetch<ArchivedDeal[]>("/api/deals?status=lost"),
      ]);
      setStages(pipeline.filter((s) => !s.isWon && !s.isLost));
      setArchivedDeals([...won, ...lost]);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      setTodayActivities(
        activities.filter((a) => {
          if (a.completed || !a.dueDate) return false;
          const d = new Date(a.dueDate);
          return d >= today && d < tomorrow;
        }).length
      );
      setNoActivities(activities.filter((a) => !a.completed && !a.dueDate).length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load pipeline");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch(console.error);
    if (auth.hasPermission("assign")) {
      apiFetch<AssignableUser[]>("/api/users/assignable").then(setAssignable).catch(() => {});
    }
  }, [auth]);

  async function moveDeal(dealId: string, stageId: string) {
    await apiFetch(`/api/deals/${dealId}/stage`, {
      method: "PATCH",
      body: JSON.stringify({ stageId }),
    });
    await load();
  }

  async function handleDrop(stageId: string, e: React.DragEvent) {
    e.preventDefault();
    setDragOverStage(null);
    const dealId = e.dataTransfer.getData("dealId");
    if (dealId) await moveDeal(dealId, stageId);
  }

  const industries = useMemo(() => {
    const set = new Set<string>();
    stages.forEach((s) => s.deals.forEach((d) => d.account?.industry && set.add(d.account.industry)));
    archivedDeals.forEach((d) => d.account?.industry && set.add(d.account.industry));
    return Array.from(set).sort();
  }, [stages, archivedDeals]);

  const filteredStages = useMemo(() => {
    return stages
      .filter((s) => !stageFilter || s.id === stageFilter)
      .map((stage) => ({
        ...stage,
        deals: filterDeals(stage.deals, search, ownerFilter, industryFilter),
      }));
  }, [stages, search, stageFilter, ownerFilter, industryFilter]);

  const allDeals = useMemo(
    () => filteredStages.flatMap((s) => s.deals.map((d) => ({ ...d, stageName: s.name, stageId: s.id }))),
    [filteredStages]
  );

  const filteredArchived = useMemo(
    () => archivedDeals.filter((d) => {
      if (ownerFilter && d.owner?.id !== ownerFilter) return false;
      if (industryFilter && (d.account?.industry || "") !== industryFilter) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase();
      return (
        d.name.toLowerCase().includes(q) ||
        (d.account?.name || "").toLowerCase().includes(q) ||
        (d.contact?.firstName || "").toLowerCase().includes(q)
      );
    }),
    [archivedDeals, search, ownerFilter, industryFilter]
  );

  const hasActiveFilters = !!(search || stageFilter || ownerFilter || industryFilter);
  const canImport = auth.hasPermission("import");

  function clearFilters() {
    setSearch("");
    setStageFilter("");
    setOwnerFilter("");
    setIndustryFilter("");
  }

  if (loading) return <PageLoader />;
  if (error) return <FetchError message={error} onRetry={() => { setLoading(true); load().catch(console.error); }} />;

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="crm-page-header px-4 lg:px-6 py-3">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <h1 className="text-xl font-bold text-slate-900">Pipeline</h1>
              <p className="text-xs text-slate-500 mt-0.5">Drag deals between stages or switch to list view</p>
            </div>
            <div className="flex items-center rounded-lg border border-slate-200 p-0.5 bg-slate-50">
              {(
                [
                  { id: "board" as const, label: "Board", icon: LayoutGrid },
                  { id: "list" as const, label: "List", icon: List },
                  { id: "archived" as const, label: "Archived", icon: Archive },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setView(tab.id)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
                    view === tab.id
                      ? "bg-white text-slate-900 shadow-sm border border-slate-200"
                      : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  <tab.icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <ExcelImportToolbar
              apiBase="/api/deals"
              entityLabel="Deals"
              canImport={canImport}
              onImported={load}
            />
            <TenantLink
              href="/dashboard/integrations"
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border border-slate-200 bg-white text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              <Zap className="h-3.5 w-3.5 text-amber-500" />
              Integrations
            </TenantLink>
            <TenantLink
              href="/dashboard/deals/new"
              className="pro-btn-primary"
            >
              <Plus className="h-4 w-4" />
              New deal
            </TenantLink>
          </div>
        </div>
      </div>

      {/* Filter bar */}
      <div className="px-4 lg:px-6 py-2.5">
        <FilterBar
          showClear={hasActiveFilters}
          onClear={clearFilters}
          fields={[
            {
              type: "search",
              key: "search",
              label: "Search",
              placeholder: "Deal name, account, contact...",
              value: search,
              onChange: setSearch,
              className: "flex-1 min-w-0 w-full sm:min-w-[200px]",
            },
            ...(view !== "archived"
              ? [{
                  type: "select" as const,
                  key: "stage",
                  label: "Stage",
                  placeholder: "All stages",
                  value: stageFilter,
                  onChange: setStageFilter,
                  options: stages.map((s) => ({ value: s.id, label: s.name })),
                }]
              : []),
            ...(assignable.length > 0
              ? [{
                  type: "select" as const,
                  key: "owner",
                  label: "Owner",
                  placeholder: "All owners",
                  value: ownerFilter,
                  onChange: setOwnerFilter,
                  options: assignable.map((u) => ({ value: u.userId, label: u.name })),
                }]
              : []),
            ...(industries.length > 0
              ? [{
                  type: "select" as const,
                  key: "industry",
                  label: "Industry",
                  placeholder: "All industries",
                  value: industryFilter,
                  onChange: setIndustryFilter,
                  options: industries.map((i) => ({ value: i, label: i })),
                }]
              : []),
          ]}
        />
        <div className="flex items-center gap-2 mt-2 ml-1">
          <span className="crm-activity-pill">{todayActivities} Today&apos;s Activities</span>
          <span className="crm-activity-pill">{noActivities} No Activities</span>
        </div>
      </div>

      {/* Board / List */}
      <div className="flex-1 overflow-hidden p-4 lg:p-5">
        {view === "board" && (
          <div className="flex gap-3 overflow-x-auto pb-4 h-full min-h-[500px]">
            {filteredStages.map((stage, idx) => {
              const theme = STAGE_THEMES[idx % STAGE_THEMES.length];
              const total = stage.deals.reduce((s, d) => s + d.amount, 0);
              const isFirst = idx === 0;

              return (
                <div
                  key={stage.id}
                  className="w-[85vw] max-w-[272px] sm:w-[272px] shrink-0 flex flex-col"
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverStage(stage.id);
                  }}
                  onDragLeave={() => setDragOverStage(null)}
                  onDrop={(e) => handleDrop(stage.id, e)}
                >
                  <div
                    className={`rounded-t border-t-4 px-3 py-2.5 mb-2 bg-slate-50 ${theme.header}`}
                    style={{ borderTopWidth: 4 }}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className={`font-semibold text-sm ${theme.accent}`}>{stage.name}</h3>
                    </div>
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      {stage.deals.length} {stage.deals.length === 1 ? "deal" : "deals"}{" "}
                      <span className="font-semibold text-slate-800">{formatPipelineTotal(total)}</span>
                    </p>
                  </div>

                  <div
                    className={`crm-kanban-col flex-1 p-2 space-y-2.5 overflow-y-auto max-h-[calc(100vh-260px)] ${
                      dragOverStage === stage.id ? "drag-over" : ""
                    }`}
                  >
                    {isFirst && (
                      <div className="flex gap-1.5 mb-1">
                        <TenantLink
                          href="/dashboard/deals/new"
                          className="flex-1 text-center py-1.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
                        >
                          Quick Add
                        </TenantLink>
                        <TenantLink
                          href="/dashboard/deals/new"
                          className="flex-1 text-center py-1.5 rounded bg-white border border-slate-200 text-[11px] font-medium text-slate-600 hover:border-slate-400 hover:text-slate-900"
                        >
                          Full Form
                        </TenantLink>
                      </div>
                    )}

                    {stage.deals.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        stages={stages}
                        currentStageId={stage.id}
                        onMove={moveDeal}
                      />
                    ))}

                    {stage.deals.length === 0 && !isFirst && (
                      <p className="text-center text-[11px] text-slate-400 py-8">Drop deals here</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {view === "list" && (
          <div className="pro-panel overflow-hidden">
            {allDeals.length === 0 ? (
              <EmptyState
                icon={Kanban}
                title={hasActiveFilters ? "No deals match your filters" : "No open deals yet"}
                description={hasActiveFilters ? "Try clearing filters or create a new deal." : "Create your first deal to start tracking revenue."}
                action={
                  <BtnPrimary href="/dashboard/deals/new">
                    <Plus className="h-4 w-4" /> New deal
                  </BtnPrimary>
                }
              />
            ) : (
            <div className="overflow-x-auto">
            <table className="pro-table w-full text-sm min-w-[560px]">
              <thead>
                <tr>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Deal</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Account</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Stage</th>
                  <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Owner</th>
                  <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Amount</th>
                </tr>
              </thead>
              <tbody>
                {allDeals.map((deal) => (
                  <tr key={deal.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2.5 font-medium text-slate-900 border-b border-slate-100 max-w-[160px] truncate">
                      <TenantLink href={`/dashboard/deals/${deal.id}`} className="hover:text-blue-700 hover:underline block truncate">{deal.name}</TenantLink>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 border-b border-slate-100 max-w-[120px] truncate">{deal.account?.name || "—"}</td>
                    <td className="px-3 py-2.5 border-b border-slate-100">
                      <span className="inline-flex px-2 py-0.5 rounded text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                        {deal.stageName}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-slate-600 border-b border-slate-100">{deal.owner?.name || "—"}</td>
                    <td className="px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums border-b border-slate-100">
                      {formatPipelineTotal(deal.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
            )}
          </div>
        )}

        {view === "archived" && (
          <div className="pro-panel overflow-hidden">
            {filteredArchived.length === 0 ? (
              <EmptyState
                icon={Archive}
                title="No closed deals yet"
                description="Won and lost deals will appear here once you close them."
              />
            ) : (
              <div className="overflow-x-auto">
              <table className="pro-table w-full text-sm min-w-[560px]">
                <thead>
                  <tr>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Deal</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Account</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Outcome</th>
                    <th className="px-3 py-2 text-left text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Owner</th>
                    <th className="px-3 py-2 text-right text-[11px] font-semibold text-slate-500 uppercase tracking-wide border-b border-slate-200 bg-slate-50">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredArchived.map((deal) => (
                    <tr key={deal.id} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium text-slate-900 border-b border-slate-100">
                      <TenantLink href={`/dashboard/deals/${deal.id}`} className="hover:text-blue-700 hover:underline">{deal.name}</TenantLink>
                    </td>
                      <td className="px-3 py-2.5 text-slate-600 border-b border-slate-100">{deal.account?.name || "—"}</td>
                      <td className="px-3 py-2.5 border-b border-slate-100">
                        <span className={`inline-flex px-2 py-0.5 rounded text-xs font-medium border ${
                          deal.status === "won"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                            : "bg-rose-50 text-rose-700 border-rose-200"
                        }`}>
                          {deal.status === "won" ? "Won" : "Lost"}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 text-slate-600 border-b border-slate-100">{deal.owner?.name || "—"}</td>
                      <td className="px-3 py-2.5 text-right font-semibold text-slate-900 tabular-nums border-b border-slate-100">
                        {formatPipelineTotal(deal.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
