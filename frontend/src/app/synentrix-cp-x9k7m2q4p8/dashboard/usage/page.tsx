"use client";

import { useEffect, useMemo, useState, Fragment } from "react";
import {
  Building2,
  Database,
  Users,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Layers,
  UserCog,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  HardDrive,
  CreditCard,
} from "lucide-react";
import { apiFetch } from "@/lib/api";
import { usePlatformAuth } from "@/lib/platform-auth-context";
import { Panel, ProTable, Th, Td, EmptyState } from "@/components/ui/dashboard-ui";
import { SearchInput } from "@/components/ui/search-input";
import { KpiCard, BarRow } from "@/components/ui/dashboard-charts";
import { cn } from "@/lib/utils";

type UsageCounts = {
  users: number;
  admins: number;
  managers: number;
  employees: number;
  viewers: number;
  leads: number;
  contacts: number;
  accounts: number;
  deals: number;
  activities: number;
  tasks: number;
  quotations: number;
  documents: number;
  customers: number;
  followUps: number;
  communications: number;
  calendarEvents: number;
  notifications: number;
};

type PackageHistoryRow = {
  id: string;
  package: string;
  packageLabel: string;
  previousPackage: string | null;
  changeType: string;
  startsAt: string;
  expiresAt: string;
  endedAt: string | null;
  isCurrent: boolean;
};

type CompanyUsage = {
  id: string;
  name: string;
  status: string;
  createdAt: string;
  currentPackage: string;
  currentPackageLabel: string;
  maxUsers: number | null;
  expiresAt: string | null;
  packageHistory: PackageHistoryRow[];
  usage: UsageCounts;
  totalRecords: number;
};

type UsageReport = {
  summary: {
    companyCount: number;
    activeCompanies: number;
    totalMembers: number;
    totalRecords: number;
    recordsByEntity: Array<{ key: string; label: string; count: number; pct: number }>;
  };
  companies: CompanyUsage[];
  topByUsage: Array<{
    id: string;
    name: string;
    totalRecords: number;
    pct: number;
    users: number;
    leads: number;
  }>;
};

type SortKey = "name" | "totalRecords" | "leads" | "users" | "managers";

function formatNum(n: number) {
  return n.toLocaleString("en-IN");
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const ENTITY_COLUMNS: Array<{ key: keyof UsageCounts; label: string }> = [
  { key: "leads", label: "Leads" },
  { key: "contacts", label: "Contacts" },
  { key: "accounts", label: "Accounts" },
  { key: "deals", label: "Deals" },
  { key: "customers", label: "Customers" },
  { key: "activities", label: "Activities" },
  { key: "tasks", label: "Tasks" },
  { key: "quotations", label: "Quotations" },
  { key: "documents", label: "Documents" },
  { key: "followUps", label: "Follow-ups" },
  { key: "communications", label: "Communications" },
  { key: "calendarEvents", label: "Calendar" },
  { key: "notifications", label: "Notifications" },
];

const CHANGE_LABELS: Record<string, string> = {
  initial: "Started",
  upgrade: "Upgrade",
  downgrade: "Downgrade",
  renewal: "Renewal",
  trial_start: "Trial",
  conversion: "Conversion",
  no_change: "No change",
};

function SortButton({
  label,
  active,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
  onClick: () => void;
  align?: "left" | "right";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-800 transition-colors",
        align === "right" && "ml-auto",
        active && "text-blue-700"
      )}
    >
      {label}
      {active ? (
        dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
      ) : (
        <ArrowUpDown className="h-3 w-3 opacity-40" />
      )}
    </button>
  );
}

function StatusBadge({ status }: { status: string }) {
  const active = status === "active";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-[10px] font-medium capitalize",
        active ? "text-emerald-700" : "text-slate-500"
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", active ? "bg-emerald-500" : "bg-slate-300")} />
      {status}
    </span>
  );
}

function PackageBadge({ label, maxUsers }: { label: string; maxUsers: number | null }) {
  return (
    <div className="min-w-0">
      <span className="inline-block max-w-full truncate text-xs font-medium px-2.5 py-1 rounded-md bg-indigo-50 text-indigo-800 border border-indigo-100">
        {label}
      </span>
      {maxUsers != null && (
        <p className="text-[10px] text-slate-400 mt-1 tabular-nums">Up to {maxUsers} users</p>
      )}
    </div>
  );
}

function LoadBar({ pct }: { pct: number }) {
  return (
    <div className="flex items-center gap-2 min-w-[88px]">
      <div className="flex-1 h-2 rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-blue-500 transition-all duration-500"
          style={{ width: `${Math.max(4, Math.min(100, pct))}%` }}
        />
      </div>
      <span className="text-[10px] font-medium text-slate-500 tabular-nums w-8 text-right">
        {pct.toFixed(0)}%
      </span>
    </div>
  );
}

function CompanyDetail({ company }: { company: CompanyUsage }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <Database className="h-3.5 w-3.5 text-indigo-500" />
          Entity counts
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-2 sm:gap-3">
          {ENTITY_COLUMNS.map((col) => (
            <div
              key={col.key}
              className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2.5 hover:border-slate-200 transition-colors"
            >
              <p className="text-[10px] font-medium text-slate-500 truncate">{col.label}</p>
              <p className="text-lg font-bold tabular-nums text-slate-900 mt-0.5">
                {formatNum(company.usage[col.key])}
              </p>
            </div>
          ))}
        </div>
        <div className="mt-4 pt-4 border-t border-slate-100">
          <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <UserCog className="h-3.5 w-3.5" />
            Team breakdown
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {(
              [
                ["Admins", company.usage.admins],
                ["Managers", company.usage.managers],
                ["Employees", company.usage.employees],
                ["Viewers", company.usage.viewers],
              ] as const
            ).map(([role, count]) => (
              <div key={role} className="rounded-lg bg-white border border-slate-100 px-3 py-2 text-center">
                <p className="text-[10px] text-slate-500">{role}</p>
                <p className="text-base font-bold tabular-nums text-slate-900">{formatNum(count)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-4 flex items-center gap-2">
          <CreditCard className="h-3.5 w-3.5 text-violet-500" />
          Package history
        </h3>
        {company.packageHistory.length === 0 ? (
          <p className="text-sm text-slate-500 py-4">No subscription history recorded yet.</p>
        ) : (
          <div className="space-y-0">
            {company.packageHistory.map((h, idx) => (
              <div key={h.id} className="flex gap-3">
                <div className="flex flex-col items-center pt-1">
                  <div
                    className={cn(
                      "h-2.5 w-2.5 rounded-full shrink-0 ring-4 ring-white",
                      h.isCurrent ? "bg-emerald-500" : "bg-slate-300"
                    )}
                  />
                  {idx < company.packageHistory.length - 1 && (
                    <div className="w-px flex-1 bg-slate-200 my-1 min-h-[24px]" />
                  )}
                </div>
                <div
                  className={cn(
                    "flex-1 mb-3 rounded-lg border px-3 py-2.5 min-w-0",
                    h.isCurrent ? "border-emerald-200 bg-emerald-50/50" : "border-slate-100 bg-slate-50/50"
                  )}
                >
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-sm font-semibold text-slate-900">{h.packageLabel}</span>
                    {h.isCurrent && (
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-semibold uppercase">
                        Current
                      </span>
                    )}
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600">
                      {CHANGE_LABELS[h.changeType] || h.changeType}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500 mt-1 tabular-nums">
                    {formatDate(h.startsAt)} — {formatDate(h.expiresAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
        {company.expiresAt && (
          <p className="text-xs text-slate-500 mt-2 pt-3 border-t border-slate-100">
            Current plan expires <strong className="text-slate-700">{formatDate(company.expiresAt)}</strong>
          </p>
        )}
      </div>
    </div>
  );
}

function UsageSkeleton() {
  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px] animate-pulse">
      <div className="h-8 w-48 bg-slate-200 rounded mb-2" />
      <div className="h-4 w-72 bg-slate-100 rounded mb-8" />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 bg-slate-100 rounded-xl" />
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        <div className="h-80 bg-slate-100 rounded-xl" />
        <div className="h-80 bg-slate-100 rounded-xl" />
      </div>
      <div className="h-96 bg-slate-100 rounded-xl" />
    </div>
  );
}

export default function PlatformUsagePage() {
  const { hasPermission } = usePlatformAuth();
  const canView = hasPermission("view_overview");

  const [report, setReport] = useState<UsageReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortKey>("totalRecords");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [search, setSearch] = useState("");

  async function load() {
    setLoading(true);
    try {
      const data = await apiFetch<UsageReport>("/api/platform/usage");
      setReport(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) load().catch(console.error);
  }, [canView]);

  const filteredCompanies = useMemo(() => {
    if (!report) return [];
    const q = search.trim().toLowerCase();
    let rows = report.companies;
    if (q) {
      rows = rows.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.currentPackageLabel.toLowerCase().includes(q) ||
          c.status.toLowerCase().includes(q)
      );
    }
    rows = [...rows];
    rows.sort((a, b) => {
      let cmp = 0;
      if (sortBy === "name") cmp = a.name.localeCompare(b.name);
      else if (sortBy === "totalRecords") cmp = a.totalRecords - b.totalRecords;
      else if (sortBy === "leads") cmp = a.usage.leads - b.usage.leads;
      else if (sortBy === "users") cmp = a.usage.users - b.usage.users;
      else if (sortBy === "managers") cmp = a.usage.managers - b.usage.managers;
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [report, sortBy, sortDir, search]);

  const entityChartItems = useMemo(() => {
    if (!report) return [];
    const total = report.summary.totalRecords || 1;
    return report.summary.recordsByEntity.map((e) => ({
      label: e.label,
      value: e.count,
      pct: (e.count / total) * 100,
    }));
  }, [report]);

  const platformLeads = useMemo(() => {
    if (!report) return 0;
    return report.summary.recordsByEntity.find((e) => e.key === "leads")?.count ?? 0;
  }, [report]);

  function toggleSort(col: SortKey) {
    if (sortBy === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(col);
      setSortDir("desc");
    }
  }

  function toggleExpand(id: string) {
    setExpanded((prev) => (prev === id ? null : id));
  }

  if (!canView) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState
          title="Access restricted"
          description="You do not have permission to view database usage."
        />
      </div>
    );
  }

  if (loading && !report) {
    return <UsageSkeleton />;
  }

  if (!report) {
    return (
      <div className="p-4 sm:p-6 lg:p-8">
        <EmptyState title="Unable to load usage data" description="Try refreshing the page." />
      </div>
    );
  }

  const maxRecords = Math.max(...report.companies.map((c) => c.totalRecords), 1);

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-[1400px]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6 sm:mb-8">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-blue-600 uppercase tracking-wider mb-1">Platform</p>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900">Database usage</h1>
          <p className="text-sm text-slate-500 mt-1 max-w-xl">
            Per-company portal footprint in numbers only — leads, users, packages, and record counts. No CRM content is shown.
          </p>
        </div>
        <button
          type="button"
          onClick={() => load()}
          disabled={loading}
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50 disabled:opacity-50 shrink-0 self-start"
        >
          <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
          Refresh
        </button>
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4 mb-6">
        <KpiCard
          label="Companies"
          value={formatNum(report.summary.companyCount)}
          sub={`${formatNum(report.summary.activeCompanies)} active tenants`}
          icon={Building2}
          theme="blue"
        />
        <KpiCard
          label="Total records"
          value={formatNum(report.summary.totalRecords)}
          sub={`${formatNum(platformLeads)} leads platform-wide`}
          icon={Database}
          theme="indigo"
        />
        <KpiCard
          label="Portal users"
          value={formatNum(report.summary.totalMembers)}
          sub="Active workspace members"
          icon={Users}
          theme="teal"
        />
        <KpiCard
          label="Avg per company"
          value={formatNum(
            report.summary.companyCount
              ? Math.round(report.summary.totalRecords / report.summary.companyCount)
              : 0
          )}
          sub="Records per tenant"
          icon={Layers}
          theme="violet"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
        <Panel title="Records by entity" subtitle="Platform-wide database counts" noPadding>
          <div className="p-4 sm:p-5 space-y-3.5 max-h-[420px] overflow-y-auto">
            {entityChartItems.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">No records yet.</p>
            ) : (
              entityChartItems.map((item, i) => (
                <BarRow
                  key={item.label}
                  label={item.label}
                  value={formatNum(item.value)}
                  pct={item.pct}
                  colorIndex={i}
                />
              ))
            )}
          </div>
        </Panel>

        <Panel title="Top tenants by usage" subtitle="Highest database record counts">
          <div className="p-4 sm:p-5 space-y-3.5">
            {report.topByUsage.length === 0 ? (
              <p className="text-sm text-slate-500 text-center py-10">No usage data yet.</p>
            ) : (
              report.topByUsage.map((c, i) => (
                <BarRow
                  key={c.id}
                  label={c.name}
                  value={formatNum(c.totalRecords)}
                  pct={c.pct}
                  colorIndex={i}
                  suffix={`${formatNum(c.leads)} leads · ${formatNum(c.users)} users`}
                />
              ))
            )}
          </div>
        </Panel>
      </div>

      {/* Company table section */}
      <Panel
        title="All companies"
        subtitle={`${filteredCompanies.length} of ${report.companies.length} tenants · tap or click a row for full breakdown`}
        noPadding
      >
        <div className="px-4 sm:px-5 py-3 border-b border-slate-100 bg-slate-50/50">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search company, package, status…"
            className="max-w-md"
          />
        </div>
        {filteredCompanies.length === 0 ? (
          <EmptyState
            title={search ? "No matches" : "No companies yet"}
            description={search ? "Try a different search term." : "Companies will appear here once provisioned."}
          />
        ) : (
          <>
            {/* Mobile / tablet cards */}
            <div className="lg:hidden divide-y divide-slate-100">
              {filteredCompanies.map((c) => {
                const isOpen = expanded === c.id;
                const loadPct = (c.totalRecords / maxRecords) * 100;
                return (
                  <div key={c.id} className={cn("p-4 sm:p-5", isOpen && "bg-slate-50/60")}>
                    <button
                      type="button"
                      onClick={() => toggleExpand(c.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-900 truncate">{c.name}</p>
                            <StatusBadge status={c.status} />
                          </div>
                          <div className="mt-2">
                            <PackageBadge label={c.currentPackageLabel} maxUsers={c.maxUsers} />
                          </div>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-xl font-bold tabular-nums text-slate-900">{formatNum(c.totalRecords)}</p>
                          <p className="text-[10px] text-slate-500 uppercase tracking-wide">Total records</p>
                        </div>
                      </div>

                      <div className="grid grid-cols-4 gap-2 mt-4">
                        {(
                          [
                            ["Leads", c.usage.leads],
                            ["Users", c.usage.users],
                            ["Managers", c.usage.managers],
                            ["Deals", c.usage.deals],
                          ] as const
                        ).map(([label, val]) => (
                          <div key={label} className="rounded-lg bg-white border border-slate-100 px-2 py-2 text-center">
                            <p className="text-[10px] text-slate-500">{label}</p>
                            <p className="text-sm font-bold tabular-nums text-slate-900">{formatNum(val)}</p>
                          </div>
                        ))}
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <LoadBar pct={loadPct} />
                        <span className="text-slate-400">
                          {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                        </span>
                      </div>
                    </button>

                    {isOpen && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <CompanyDetail company={c} />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Desktop table */}
            <div className="hidden lg:block overflow-x-auto">
              <ProTable>
                <thead className="sticky top-0 z-10">
                  <tr>
                    <Th className="w-10 px-4">&nbsp;</Th>
                    <Th className="min-w-[180px] px-4">
                      <SortButton label="Company" active={sortBy === "name"} dir={sortDir} onClick={() => toggleSort("name")} />
                    </Th>
                    <Th className="min-w-[140px] px-4">Package</Th>
                    <Th className="text-right px-4">
                      <SortButton label="Users" active={sortBy === "users"} dir={sortDir} onClick={() => toggleSort("users")} align="right" />
                    </Th>
                    <Th className="text-right px-4">
                      <SortButton label="Managers" active={sortBy === "managers"} dir={sortDir} onClick={() => toggleSort("managers")} align="right" />
                    </Th>
                    <Th className="text-right px-4">
                      <SortButton label="Leads" active={sortBy === "leads"} dir={sortDir} onClick={() => toggleSort("leads")} align="right" />
                    </Th>
                    <Th className="text-right px-4">Deals</Th>
                    <Th className="text-right px-4">Contacts</Th>
                    <Th className="text-right px-4">
                      <SortButton label="Total" active={sortBy === "totalRecords"} dir={sortDir} onClick={() => toggleSort("totalRecords")} align="right" />
                    </Th>
                    <Th className="min-w-[120px] px-4">
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
                        <HardDrive className="h-3 w-3" />
                        Load
                      </span>
                    </Th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCompanies.map((c) => {
                    const isOpen = expanded === c.id;
                    const loadPct = (c.totalRecords / maxRecords) * 100;
                    return (
                      <Fragment key={c.id}>
                        <tr
                          className={cn(
                            "hover:bg-blue-50/40 transition-colors cursor-pointer",
                            isOpen && "bg-blue-50/30"
                          )}
                          onClick={() => toggleExpand(c.id)}
                        >
                          <Td className="px-4 w-10">
                            <span className="inline-flex text-slate-400">
                              {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                            </span>
                          </Td>
                          <Td className="px-4">
                            <p className="font-semibold text-slate-900 truncate max-w-[220px]">{c.name}</p>
                            <StatusBadge status={c.status} />
                          </Td>
                          <Td className="px-4">
                            <PackageBadge label={c.currentPackageLabel} maxUsers={c.maxUsers} />
                          </Td>
                          <Td className="px-4 text-right">
                            <span className="font-semibold text-slate-900">{formatNum(c.usage.users)}</span>
                            <p className="text-[10px] text-slate-400 tabular-nums">
                              {formatNum(c.usage.admins)} admin · {formatNum(c.usage.managers)} mgr
                            </p>
                          </Td>
                          <Td className="px-4 text-right font-medium">{formatNum(c.usage.managers)}</Td>
                          <Td className="px-4 text-right font-semibold text-blue-700">{formatNum(c.usage.leads)}</Td>
                          <Td className="px-4 text-right">{formatNum(c.usage.deals)}</Td>
                          <Td className="px-4 text-right">{formatNum(c.usage.contacts)}</Td>
                          <Td className="px-4 text-right font-bold text-slate-900">{formatNum(c.totalRecords)}</Td>
                          <Td className="px-4">
                            <LoadBar pct={loadPct} />
                          </Td>
                        </tr>
                        {isOpen && (
                          <tr className="bg-slate-50/80">
                            <Td colSpan={10} className="px-4 sm:px-6 py-5 sm:py-6">
                              <CompanyDetail company={c} />
                            </Td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </ProTable>
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}
