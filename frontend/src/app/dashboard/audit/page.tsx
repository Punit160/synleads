"use client";

import { useEffect, useState } from "react";
import { Download, Shield, Search } from "lucide-react";
import { apiFetch, ApiError, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import {
  PageHeader,
  Panel,
  PageLoader,
  ProTable,
  Th,
  Td,
  FetchError,
  EmptyState,
  BtnSecondary,
} from "@/components/ui/dashboard-ui";

type AuditEntry = {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string | null;
  createdAt: string;
  user: { id: string; name: string; email: string } | null;
};

type AuditResponse = {
  logs: AuditEntry[];
  total: number;
  limit: number;
  offset: number;
};

export default function AuditLogPage() {
  const auth = useAuth();
  const canView = auth.hasPermission("reports");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<AuditResponse | null>(null);
  const [q, setQ] = useState("");
  const [entityType, setEntityType] = useState("");
  const [action, setAction] = useState("");

  async function load(offset = 0) {
    setError(null);
    try {
      const params = new URLSearchParams({ limit: "50", offset: String(offset) });
      if (q.trim()) params.set("q", q.trim());
      if (entityType) params.set("entityType", entityType);
      if (action) params.set("action", action);
      setData(await apiFetch<AuditResponse>(`/api/audit?${params}`));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load audit log");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!canView) return;
    load().catch(console.error);
  }, [canView]);

  if (!canView) {
    return (
      <EmptyState
        icon={Shield}
        title="Reports access required"
        description="Audit logs are available to admins and users with reports permission."
      />
    );
  }

  if (loading && !data) return <PageLoader />;
  if (error && !data) return <FetchError message={error} onRetry={() => { setLoading(true); load().catch(console.error); }} />;

  const logs = data?.logs ?? [];

  return (
    <div className="max-w-[1200px]">
      <PageHeader
        title="Audit log"
        description="Compliance trail of lead changes, assignments, SLA events, and admin actions."
        action={
          <BtnSecondary onClick={() => window.open("/api/audit/export", "_blank")} className="!inline-flex">
            <Download className="h-4 w-4" /> Export CSV
          </BtnSecondary>
        }
      />

      <Panel title="Filter events">
        <div className="flex flex-wrap gap-3">
          <div className="relative flex-1 min-w-0 w-full sm:min-w-[200px]">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm"
              placeholder="Search action, entity, details…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && load()}
            />
          </div>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={entityType} onChange={(e) => setEntityType(e.target.value)}>
            <option value="">All entities</option>
            {["lead", "workflow_rule", "sla_policy", "custom_field", "user"].map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <select className="rounded-lg border border-slate-200 px-3 py-2 text-sm" value={action} onChange={(e) => setAction(e.target.value)}>
            <option value="">All actions</option>
            {["lead_create", "lead_assign", "lead_bulk_update", "lead_webhook_create", "sla_breach", "sla_escalation", "sla_first_response", "workflow_create", "custom_field_create", "sla_policy_update"].map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <BtnSecondary onClick={() => { setLoading(true); load().catch(console.error); }}>Apply</BtnSecondary>
        </div>
      </Panel>

      <Panel title={`Events (${data?.total ?? 0})`} className="mt-6">
        <ProTable>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>User</Th>
              <Th>Action</Th>
              <Th>Entity</Th>
              <Th>Details</Th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr><Td colSpan={5} className="text-center text-slate-500 py-10">No audit events match your filters.</Td></tr>
            ) : logs.map((log) => (
              <tr key={log.id}>
                <Td className="whitespace-nowrap text-slate-600">{formatDate(log.createdAt)}</Td>
                <Td>{log.user?.name ?? "System"}</Td>
                <Td><code className="text-xs bg-slate-100 px-1.5 py-0.5 rounded">{log.action}</code></Td>
                <Td>{log.entityType}{log.entityId ? ` · ${log.entityId.slice(0, 8)}…` : ""}</Td>
                <Td className="max-w-xs truncate text-slate-600">{log.details ?? "—"}</Td>
              </tr>
            ))}
          </tbody>
        </ProTable>
      </Panel>
    </div>
  );
}
