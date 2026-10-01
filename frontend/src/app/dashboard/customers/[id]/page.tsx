"use client";

import { useTenantPath } from "@/lib/use-tenant-path";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { ArrowLeft } from "lucide-react";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  PageHeader,
  Panel,
  ProTable,
  Th,
  Td,
  PageLoader,
  EmptyState,
} from "@/components/ui/dashboard-ui";

type Customer = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  company: string | null;
  convertedAt: string;
  lead: { id: string; leadNumber: string } | null;
  orders: Array<{ id: string; orderNumber: string; amount: number; status: string; orderDate: string }>;
  invoices: Array<{ id: string; invoiceNumber: string; amount: number; status: string; dueDate: string | null; createdAt: string }>;
  payments: Array<{ id: string; amount: number; method: string; paidAt: string; reference: string | null }>;
  serviceHistory: Array<{ id: string; title: string; description: string | null; serviceDate: string; status: string }>;
  documents: Array<{ id: string; fileName: string; category: string; fileSize: number; uploadedAt: string }>;
};

const TABS = ["Orders", "Invoices", "Payments", "Service History", "Documents"] as const;
type Tab = (typeof TABS)[number];

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTenantPath();
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [tab, setTab] = useState<Tab>("Orders");

  useEffect(() => {
    apiFetch<Customer>(`/api/customers/${id}`)
      .then(setCustomer)
      .catch(() => router.push(tp("/dashboard/customers")));
  }, [id, router]);

  if (!customer) return <PageLoader />;

  return (
    <div className="max-w-[1400px]">
      <TenantLink href="/dashboard/customers" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to customers
      </TenantLink>

      <PageHeader
        meta="Customer 360"
        title={customer.name}
        description={[customer.company, customer.email, customer.phone].filter(Boolean).join(" · ")}
      />

      <div className="grid md:grid-cols-3 gap-4 mb-5">
        <Panel title="Profile">
          <dl className="space-y-2 text-sm">
            <Row label="Company" value={customer.company} />
            <Row label="Email" value={customer.email} />
            <Row label="Phone" value={customer.phone} />
            <Row label="Converted" value={formatDate(customer.convertedAt)} />
            {customer.lead && (
              <div className="flex justify-between gap-4 pt-2 border-t border-slate-100">
                <span className="text-slate-500">Source Lead</span>
                <TenantLink href={`/dashboard/leads/${customer.lead.id}`} className="font-mono text-xs text-brand hover:underline">
                  {customer.lead.leadNumber}
                </TenantLink>
              </div>
            )}
          </dl>
        </Panel>
        <Panel title="Summary" className="md:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <Stat label="Orders" value={customer.orders.length} />
            <Stat label="Invoices" value={customer.invoices.length} />
            <Stat label="Payments" value={customer.payments.length} />
            <Stat label="Services" value={customer.serviceHistory.length} />
          </div>
        </Panel>
      </div>

      <div className="flex gap-1 border border-slate-200 rounded p-0.5 bg-slate-50 mb-4 w-fit">
        {TABS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap",
              tab === t ? "bg-white text-slate-900 border border-slate-200 shadow-sm" : "text-slate-600"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <Panel title={tab} noPadding>
        {tab === "Orders" && (
          customer.orders.length === 0 ? (
            <EmptyState title="No orders" />
          ) : (
            <ProTable>
              <thead><tr><Th>Order #</Th><Th>Date</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {customer.orders.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <Td><span className="font-mono text-xs">{o.orderNumber}</span></Td>
                    <Td className="tabular-nums">{formatDate(o.orderDate)}</Td>
                    <Td><span className="text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200 capitalize">{o.status}</span></Td>
                    <Td className="text-right font-semibold text-blue-700">{formatCurrency(o.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </ProTable>
          )
        )}

        {tab === "Invoices" && (
          customer.invoices.length === 0 ? (
            <EmptyState title="No invoices" />
          ) : (
            <ProTable>
              <thead><tr><Th>Invoice #</Th><Th>Created</Th><Th>Due</Th><Th>Status</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {customer.invoices.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50">
                    <Td><span className="font-mono text-xs">{inv.invoiceNumber}</span></Td>
                    <Td className="tabular-nums">{formatDate(inv.createdAt)}</Td>
                    <Td className="tabular-nums">{inv.dueDate ? formatDate(inv.dueDate) : "—"}</Td>
                    <Td><span className="text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200 capitalize">{inv.status}</span></Td>
                    <Td className="text-right font-semibold text-blue-700">{formatCurrency(inv.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </ProTable>
          )
        )}

        {tab === "Payments" && (
          customer.payments.length === 0 ? (
            <EmptyState title="No payments" />
          ) : (
            <ProTable>
              <thead><tr><Th>Date</Th><Th>Method</Th><Th>Reference</Th><Th className="text-right">Amount</Th></tr></thead>
              <tbody>
                {customer.payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50">
                    <Td className="tabular-nums">{formatDate(p.paidAt)}</Td>
                    <Td className="capitalize">{p.method.replace(/_/g, " ")}</Td>
                    <Td>{p.reference || "—"}</Td>
                    <Td className="text-right font-semibold text-emerald-700">{formatCurrency(p.amount)}</Td>
                  </tr>
                ))}
              </tbody>
            </ProTable>
          )
        )}

        {tab === "Service History" && (
          customer.serviceHistory.length === 0 ? (
            <EmptyState title="No service records" />
          ) : (
            <ProTable>
              <thead><tr><Th>Title</Th><Th>Date</Th><Th>Status</Th><Th>Description</Th></tr></thead>
              <tbody>
                {customer.serviceHistory.map((s) => (
                  <tr key={s.id} className="hover:bg-slate-50">
                    <Td className="font-medium">{s.title}</Td>
                    <Td className="tabular-nums">{formatDate(s.serviceDate)}</Td>
                    <Td><span className="text-[11px] font-medium bg-slate-100 px-2 py-0.5 rounded border border-slate-200 capitalize">{s.status}</span></Td>
                    <Td className="max-w-[300px] truncate">{s.description || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </ProTable>
          )
        )}

        {tab === "Documents" && (
          customer.documents.length === 0 ? (
            <EmptyState title="No documents" />
          ) : (
            <ProTable>
              <thead><tr><Th>File</Th><Th>Category</Th><Th>Size</Th><Th>Uploaded</Th></tr></thead>
              <tbody>
                {customer.documents.map((d) => (
                  <tr key={d.id} className="hover:bg-slate-50">
                    <Td className="font-medium">{d.fileName}</Td>
                    <Td className="capitalize">{d.category}</Td>
                    <Td className="tabular-nums">{(d.fileSize / 1024).toFixed(1)} KB</Td>
                    <Td className="tabular-nums">{formatDate(d.uploadedAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </ProTable>
          )
        )}
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="text-slate-900 font-medium">{value || "—"}</span>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-[10px] font-medium text-slate-500 uppercase">{label}</p>
      <p className="text-xl font-semibold text-blue-700 tabular-nums">{value}</p>
    </div>
  );
}
