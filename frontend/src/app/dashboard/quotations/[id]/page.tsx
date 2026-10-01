"use client";

import { useTenantPath } from "@/lib/use-tenant-path";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { ArrowLeft, FileDown, Send, CheckCircle } from "lucide-react";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { QUOTE_STATUSES } from "@/lib/crm-constants";
import { cn } from "@/lib/utils";
import { PageHeader, Panel, ProTable, Th, Td } from "@/components/ui/dashboard-ui";

type Quotation = {
  id: string;
  quoteNumber: string;
  status: string;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  discount: number;
  total: number;
  validUntil: string | null;
  notes: string | null;
  createdAt: string;
  sentAt: string | null;
  approvedAt: string | null;
  items: Array<{ id: string; name: string; description: string | null; quantity: number; unitPrice: number; taxRate: number; lineTotal: number }>;
  history: Array<{ id: string; action: string; notes: string | null; createdAt: string }>;
  lead: { id: string; leadNumber: string; firstName: string; lastName: string | null; company: string | null } | null;
  createdBy: { name: string } | null;
  approvedBy: { name: string } | null;
};

const QUOTE_STATUS_BADGE: Record<string, string> = {
  draft: "bg-slate-100 text-slate-700 border border-slate-200",
  sent: "bg-blue-50 text-blue-700 border border-blue-200",
  approved: "bg-emerald-50 text-emerald-700 border border-emerald-200",
  rejected: "bg-rose-50 text-rose-700 border border-rose-200",
  expired: "bg-amber-50 text-amber-800 border border-amber-200",
};

export default function QuotationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTenantPath();
  const [quote, setQuote] = useState<Quotation | null>(null);

  async function load() {
    setQuote(await apiFetch<Quotation>(`/api/quotations/${id}`));
  }

  useEffect(() => {
    load().catch(() => router.push(tp("/dashboard/quotations")));
  }, [id, router]);

  async function markSent() {
    await apiFetch(`/api/quotations/${id}/send`, { method: "PATCH" });
    await load();
  }

  async function approve() {
    await apiFetch(`/api/quotations/${id}/approve`, { method: "PATCH" });
    await load();
  }

  if (!quote) {
    return <p className="text-sm text-slate-500 p-6">Loading quotation...</p>;
  }

  return (
    <div className="max-w-[900px]">
      <TenantLink href="/dashboard/quotations" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to quotations
      </TenantLink>

      <PageHeader
        title={quote.quoteNumber}
        description={quote.lead ? `${quote.lead.firstName} ${quote.lead.lastName || ""} · ${quote.lead.company || "No company"}` : "Quotation details"}
        action={
          <div className="flex items-center gap-2">
            <a href={`/api/quotations/${id}/pdf`} target="_blank" rel="noreferrer" className="pro-btn-secondary inline-flex items-center gap-1.5">
              <FileDown className="h-4 w-4" /> PDF
            </a>
            {quote.status === "draft" && (
              <button type="button" onClick={markSent} className="pro-btn-secondary inline-flex items-center gap-1.5">
                <Send className="h-4 w-4" /> Mark as sent
              </button>
            )}
            {quote.status === "sent" && (
              <button type="button" onClick={approve} className="pro-btn-primary inline-flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4" /> Approve
              </button>
            )}
          </div>
        }
      />

      <div className="flex items-center gap-2 mb-4">
        <span className={cn("inline-flex px-2.5 py-1 rounded text-xs font-medium", QUOTE_STATUS_BADGE[quote.status])}>
          {QUOTE_STATUSES[quote.status] || quote.status}
        </span>
        <span className="text-sm text-slate-500">Created {formatDate(quote.createdAt)} by {quote.createdBy?.name || "—"}</span>
      </div>

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Panel title="Summary">
          <dl className="space-y-2 text-sm">
            <Row label="Subtotal" value={formatCurrency(quote.subtotal)} />
            <Row label="Discount" value={formatCurrency(quote.discount)} />
            <Row label={`Tax (${quote.taxRate}%)`} value={formatCurrency(quote.taxAmount)} />
            <Row label="Total" value={formatCurrency(quote.total)} bold />
            <Row label="Valid until" value={quote.validUntil ? formatDate(quote.validUntil) : "—"} />
            {quote.lead && (
              <div className="flex justify-between gap-4 pt-2 border-t">
                <span className="text-slate-500">Lead</span>
                <TenantLink href={`/dashboard/leads/${quote.lead.id}`} className="font-medium text-brand hover:underline">
                  {quote.lead.leadNumber}
                </TenantLink>
              </div>
            )}
          </dl>
        </Panel>
        <Panel title="Notes">
          <p className="text-sm text-slate-700 whitespace-pre-wrap">{quote.notes || "No notes"}</p>
        </Panel>
      </div>

      <Panel title="Line items" noPadding className="mb-4">
        <ProTable>
          <thead>
            <tr>
              <Th>Item</Th>
              <Th className="text-right">Qty</Th>
              <Th className="text-right">Unit price</Th>
              <Th className="text-right">Tax</Th>
              <Th className="text-right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {quote.items.map((item) => (
              <tr key={item.id} className="hover:bg-slate-50">
                <Td>
                  <p className="font-medium">{item.name}</p>
                  {item.description && <p className="text-xs text-slate-500">{item.description}</p>}
                </Td>
                <Td className="text-right">{item.quantity}</Td>
                <Td className="text-right">{formatCurrency(item.unitPrice)}</Td>
                <Td className="text-right">{item.taxRate}%</Td>
                <Td className="text-right font-semibold">{formatCurrency(item.lineTotal)}</Td>
              </tr>
            ))}
          </tbody>
        </ProTable>
      </Panel>

      <Panel title="History" noPadding>
        {quote.history.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No history</p>
        ) : (
          <ul className="divide-y divide-slate-100">
            {quote.history.map((h) => (
              <li key={h.id} className="px-4 py-3 text-sm flex justify-between gap-4">
                <span className="capitalize font-medium text-slate-800">{h.action}</span>
                <span className="text-slate-500">{h.notes || "—"} · {formatDate(h.createdAt)}</span>
              </li>
            ))}
          </ul>
        )}
      </Panel>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className={bold ? "font-bold text-slate-900" : "font-medium text-slate-900"}>{value}</span>
    </div>
  );
}
