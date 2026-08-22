"use client";

import { Fragment, useEffect, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Search,
} from "lucide-react";
import { apiFetch, formatDate } from "@/lib/api";
import { usePlatformAuth } from "@/lib/platform-auth-context";
import { Panel, ProTable, Th, Td, BtnSecondary, EmptyState } from "@/components/ui/dashboard-ui";
import { cn } from "@/lib/utils";

type SystemErrorRow = {
  id: string;
  reference: string;
  severity: string;
  status: string;
  source: string;
  message: string;
  technical: string | null;
  route: string | null;
  method: string | null;
  statusCode: number | null;
  userEmail: string | null;
  createdAt: string;
  resolutionNotes: string | null;
  workspace: { id: string; name: string; slug: string | null } | null;
};

type ErrorsResponse = {
  errors: SystemErrorRow[];
  total: number;
  openCount: number;
};

const STATUS_STYLES: Record<string, string> = {
  open: "bg-red-50 text-red-700 border-red-200",
  investigating: "bg-amber-50 text-amber-800 border-amber-200",
  resolved: "bg-emerald-50 text-emerald-700 border-emerald-200",
  ignored: "bg-slate-100 text-slate-600 border-slate-200",
};

export default function PlatformErrorsPage() {
  const auth = usePlatformAuth();
  const canView = auth.hasPermission("manage_errors");
  const [data, setData] = useState<ErrorsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("");
  const [q, setQ] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (statusFilter) params.set("status", statusFilter);
      if (q.trim()) params.set("q", q.trim());
      setData(await apiFetch<ErrorsResponse>(`/api/platform/errors?${params}`));
    } catch {
      setData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (canView) load().catch(console.error);
  }, [canView, statusFilter]);

  async function updateStatus(reference: string, status: string) {
    setUpdating(reference);
    try {
      await apiFetch(`/api/platform/errors/${reference}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      await load();
    } finally {
      setUpdating(null);
    }
  }

  if (!canView) {
    return (
      <EmptyState
        title="Access denied"
        description="Only platform admins with error management permission can view this page."
        icon={AlertTriangle}
      />
    );
  }

  const errors = data?.errors ?? [];

  return (
    <div className="space-y-6 max-w-[1400px]">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Error inbox</h1>
          <p className="text-sm text-slate-500 mt-1">
            User-facing issues logged from the app — no raw code shown to customers. Reference codes tie reports to rows here.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-red-600 bg-red-50 border border-red-200 px-3 py-1 rounded-full">
            {data?.openCount ?? 0} open
          </span>
          <BtnSecondary onClick={() => load()} className="!inline-flex">
            <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} /> Refresh
          </BtnSecondary>
        </div>
      </div>

      <Panel title="Filters">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="form-control pl-9"
              placeholder="Search reference, route, email…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <select
            className="form-control w-auto min-w-[140px]"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All statuses</option>
            <option value="open">Open</option>
            <option value="investigating">Investigating</option>
            <option value="resolved">Resolved</option>
            <option value="ignored">Ignored</option>
          </select>
          <BtnSecondary onClick={() => load()}>Apply</BtnSecondary>
        </div>
      </Panel>

      <Panel title={`Errors (${data?.total ?? 0})`}>
        <ProTable>
          <thead>
            <tr>
              <Th>Reference</Th>
              <Th>When</Th>
              <Th>Source</Th>
              <Th>Status</Th>
              <Th>Message</Th>
              <Th>Company</Th>
              <Th>Actions</Th>
            </tr>
          </thead>
          <tbody>
            {errors.length === 0 ? (
              <tr>
                <Td colSpan={7} className="text-center text-slate-500 py-12">
                  {loading ? "Loading…" : "No errors logged yet — that's a good sign."}
                </Td>
              </tr>
            ) : (
              errors.map((err) => (
                <Fragment key={err.reference}>
                  <tr className="align-top">
                    <Td>
                      <code className="text-xs font-bold text-indigo-700 bg-indigo-50 px-1.5 py-0.5 rounded">
                        {err.reference}
                      </code>
                    </Td>
                    <Td className="text-xs text-slate-500 whitespace-nowrap">{formatDate(err.createdAt)}</Td>
                    <Td>
                      <span className="text-xs capitalize">{err.source}</span>
                      {err.route && (
                        <p className="text-[10px] text-slate-400 mt-0.5 truncate max-w-[120px]" title={err.route}>
                          {err.method} {err.route}
                        </p>
                      )}
                    </Td>
                    <Td>
                      <span className={cn("text-[10px] font-semibold uppercase px-2 py-0.5 rounded-full border", STATUS_STYLES[err.status])}>
                        {err.status}
                      </span>
                    </Td>
                    <Td className="max-w-xs">
                      <p className="text-sm text-slate-800 line-clamp-2">{err.message}</p>
                      {err.userEmail && <p className="text-[10px] text-slate-400 mt-0.5">{err.userEmail}</p>}
                    </Td>
                    <Td className="text-xs">{err.workspace?.name ?? "—"}</Td>
                    <Td>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          className="text-xs text-indigo-600 hover:underline flex items-center gap-0.5"
                          onClick={() => setExpanded(expanded === err.reference ? null : err.reference)}
                        >
                          {expanded === err.reference ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                          Details
                        </button>
                        {err.status !== "resolved" && (
                          <button
                            type="button"
                            disabled={updating === err.reference}
                            className="text-xs text-emerald-600 hover:underline flex items-center gap-0.5"
                            onClick={() => updateStatus(err.reference, "resolved")}
                          >
                            <CheckCircle2 className="h-3 w-3" /> Resolve
                          </button>
                        )}
                      </div>
                    </Td>
                  </tr>
                  {expanded === err.reference && (
                    <tr>
                      <Td colSpan={7} className="bg-slate-50">
                        <pre className="text-[11px] text-slate-700 whitespace-pre-wrap font-mono p-3 rounded-lg border border-slate-200 max-h-48 overflow-auto">
                          {err.technical || "No technical details captured."}
                        </pre>
                      </Td>
                    </tr>
                  )}
                </Fragment>
              ))
            )}
          </tbody>
        </ProTable>
      </Panel>
    </div>
  );
}
