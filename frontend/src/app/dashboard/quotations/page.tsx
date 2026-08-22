"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { Plus, FileDown, Send, CheckCircle } from "lucide-react";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { QUOTE_STATUSES } from "@/lib/crm-constants";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  Panel,
  ProTable,
  Th,
  Td,
  BtnPrimary,
  PageLoader,
  EmptyState,
} from "@/components/ui/dashboard-ui";

type Quotation = {
  id: string;
  quoteNumber: string;
  status: string;
  total: number;
  createdAt: string;
  lead: { id: string; leadNumber: string; firstName: string; lastName: string | null; company: string | null } | null;
  createdBy: { name: string } | null;
};

const QUOTE_STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border border-slate-200",
  sent: "bg-blue-50 text-blue-700 border border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200",
  expired: "bg-amber-50 text-amber-800 border border-amber-200",
};

export default function QuotationsPage() {
  const [quotes, setQuotes] = useState<Quotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");

  async function load() {
    const url = status ? `/api/quotations?status=${status}` : "/api/quotations";
    setQuotes(await apiFetch<Quotation[]>(url));
    setLoading(false);
  }

  useEffect(() => {
    setLoading(true);
    load().catch(console.error);
  }, [status]);

  async function approve(id: string) {
    await apiFetch(`/api/quotations/${id}/approve`, { method: "PATCH" });
    await load();
  }

  async function send(id: string) {
    await apiFetch(`/api/quotations/${id}/send`, { method: "PATCH" });
    await load();
  }

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Sales"
        title="Quotations"
        description="Create, send, and track customer quotations"
        action={
          <BtnPrimary href="/dashboard/quotations/new">
            <Plus className="h-4 w-4" /> New Quotation
          </BtnPrimary>
        }
      />

      <Panel
        title={`${quotes.length} quotations`}
        action={
          <select
            className="pro-input text-sm py-1.5 px-2"
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="">All Statuses</option>
            {Object.entries(QUOTE_STATUSES).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        }
        noPadding
      >
        {quotes.length === 0 ? (
          <EmptyState title="No quotations yet" description="Create your first quotation to send to a customer" action={<BtnPrimary href="/dashboard/quotations/new">New Quotation</BtnPrimary>} />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <Th>Quote #</Th>
                <Th>Customer</Th>
                <Th>Company</Th>
                <Th>Status</Th>
                <Th className="text-right">Total</Th>
                <Th>Created</Th>
                <Th>By</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {quotes.map((q) => (
                <tr key={q.id} className="hover:bg-slate-50">
                  <Td>
                    <TenantLink href={`/dashboard/quotations/${q.id}`} className="font-mono text-xs font-medium text-blue-700 hover:underline">
                      {q.quoteNumber}
                    </TenantLink>
                  </Td>
                  <Td>
                    {q.lead ? (
                      <TenantLink href={`/dashboard/leads/${q.lead.id}`} className="font-medium text-slate-900 hover:underline">
                        {q.lead.firstName} {q.lead.lastName}
                      </TenantLink>
                    ) : "—"}
                  </Td>
                  <Td>{q.lead?.company || "—"}</Td>
                  <Td>
                    <span className={cn("inline-flex px-2 py-0.5 rounded text-[11px] font-medium", QUOTE_STATUS_BADGE[q.status])}>
                      {QUOTE_STATUSES[q.status] || q.status}
                    </span>
                  </Td>
                  <Td className="text-right font-semibold text-blue-700">{formatCurrency(q.total)}</Td>
                  <Td className="tabular-nums">{formatDate(q.createdAt)}</Td>
                  <Td>{q.createdBy?.name || "—"}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      <a href={`/api/quotations/${q.id}/pdf`} target="_blank" rel="noreferrer" className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="View / Print PDF">
                        <FileDown className="h-3.5 w-3.5" />
                      </a>
                      {q.status === "draft" && (
                        <button type="button" onClick={() => send(q.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Mark as sent">
                          <Send className="h-3.5 w-3.5" />
                        </button>
                      )}
                      {q.status === "sent" && (
                        <button type="button" onClick={() => approve(q.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Approve">
                          <CheckCircle className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </Panel>
    </div>
  );
}
