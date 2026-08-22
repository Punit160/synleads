"use client";

import { useTenantPath } from "@/lib/use-tenant-path";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { ArrowLeft, Trash2 } from "lucide-react";
import { apiFetch, formatCurrency, formatDate } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Panel, ProTable, Th, Td, BtnSecondary } from "@/components/ui/dashboard-ui";

type Deal = {
  id: string;
  name: string;
  amount: number;
  probability: number | null;
  status: string;
  notes: string | null;
  expectedCloseDate: string | null;
  createdAt: string;
  updatedAt: string;
  stage: { id: string; name: string };
  account: { id: string; name: string } | null;
  contact: { id: string; firstName: string; lastName: string | null } | null;
  owner: { id: string; name: string } | null;
  activities: Array<{ id: string; subject: string; type: string; completed: boolean; dueDate: string | null; createdAt: string }>;
};

type Stage = { id: string; name: string; isWon?: boolean; isLost?: boolean };

export default function DealDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTenantPath();
  const auth = useAuth();
  const [deal, setDeal] = useState<Deal | null>(null);
  const [stages, setStages] = useState<Stage[]>([]);
  const canEdit = auth.hasPermission("edit");
  const canDelete = auth.hasPermission("delete");

  async function load() {
    const [d, s] = await Promise.all([
      apiFetch<Deal>(`/api/deals/${id}`),
      apiFetch<Stage[]>("/api/workspace/stages"),
    ]);
    setDeal(d);
    setStages(s);
  }

  useEffect(() => {
    load().catch(() => router.push(tp("/dashboard/pipeline")));
  }, [id, router]);

  async function changeStage(stageId: string) {
    await apiFetch(`/api/deals/${id}/stage`, { method: "PATCH", body: JSON.stringify({ stageId }) });
    await load();
  }

  async function remove() {
    if (!confirm("Delete this deal?")) return;
    await apiFetch(`/api/deals/${id}`, { method: "DELETE" });
    router.push(tp("/dashboard/pipeline"));
  }

  if (!deal) {
    return <p className="text-sm text-slate-500 p-6">Loading deal...</p>;
  }

  return (
    <div className="max-w-[900px]">
      <TenantLink href="/dashboard/pipeline" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900 mb-4">
        <ArrowLeft className="h-4 w-4" /> Back to pipeline
      </TenantLink>

      <PageHeader
        title={deal.name}
        description={`${deal.stage.name} · ${deal.status}`}
        action={
          <div className="flex gap-2">
            {canDelete && (
              <BtnSecondary onClick={remove} className="!inline-flex items-center gap-1 text-red-600">
                <Trash2 className="h-4 w-4" /> Delete
              </BtnSecondary>
            )}
          </div>
        }
      />

      <div className="grid md:grid-cols-2 gap-4 mb-4">
        <Panel title="Deal details">
          <dl className="space-y-2 text-sm">
            <Row label="Amount" value={formatCurrency(deal.amount)} />
            <Row label="Probability" value={deal.probability != null ? `${deal.probability}%` : "—"} />
            <Row label="Expected close" value={deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "—"} />
            <Row label="Owner" value={deal.owner?.name || "—"} />
            <Row label="Created" value={formatDate(deal.createdAt)} />
            {deal.notes && (
              <div className="pt-2 border-t border-slate-100">
                <p className="text-xs text-slate-500 mb-1">Notes</p>
                <p className="text-slate-700 whitespace-pre-wrap">{deal.notes}</p>
              </div>
            )}
          </dl>
        </Panel>

        <Panel title="Related">
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Account</span>
              {deal.account ? (
                <TenantLink href={`/dashboard/accounts/${deal.account.id}`} className="font-medium text-blue-600 hover:underline">
                  {deal.account.name}
                </TenantLink>
              ) : (
                <span>—</span>
              )}
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-slate-500">Contact</span>
              {deal.contact ? (
                <TenantLink href={`/dashboard/contacts/${deal.contact.id}`} className="font-medium text-blue-600 hover:underline">
                  {deal.contact.firstName} {deal.contact.lastName}
                </TenantLink>
              ) : (
                <span>—</span>
              )}
            </div>
            {canEdit && (
              <div className="pt-3">
                <label className="block text-xs font-medium text-slate-500 mb-1">Move to stage</label>
                <select
                  className="pro-input w-full text-sm"
                  value={deal.stage.id}
                  onChange={(e) => changeStage(e.target.value)}
                >
                  {stages.map((s) => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>
            )}
          </dl>
        </Panel>
      </div>

      <Panel title="Recent activities" noPadding>
        {deal.activities.length === 0 ? (
          <p className="p-4 text-sm text-slate-500">No activities logged</p>
        ) : (
          <ProTable>
            <thead>
              <tr>
                <Th>Activity</Th>
                <Th>Type</Th>
                <Th>Due</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {deal.activities.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <Td className="font-medium">{a.subject}</Td>
                  <Td className="capitalize">{a.type}</Td>
                  <Td>{a.dueDate ? formatDate(a.dueDate) : "—"}</Td>
                  <Td>{a.completed ? "Done" : "Open"}</Td>
                </tr>
              ))}
            </tbody>
          </ProTable>
        )}
      </Panel>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900 text-right">{value}</span>
    </div>
  );
}
