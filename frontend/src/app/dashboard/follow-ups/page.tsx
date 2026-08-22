"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { Phone, Check } from "lucide-react";
import { apiFetch, formatDate } from "@/lib/api";
import { PageHeader, Panel, ProTable, Th, Td, PageLoader, EmptyState } from "@/components/ui/dashboard-ui";

type FollowUp = {
  id: string;
  type: string;
  scheduledAt: string;
  notes: string | null;
  completed: boolean;
  lead: { id: string; firstName: string; lastName: string | null; company: string | null; phone: string | null };
  owner: { name: string } | null;
};

export default function FollowUpsPage() {
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [filter, setFilter] = useState<"all" | "today">("today");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const url = filter === "today" ? "/api/followups?today=true" : "/api/followups";
      setFollowUps(await apiFetch<FollowUp[]>(url));
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    setLoading(true);
    load().catch(console.error);
  }, [filter]);

  async function complete(id: string) {
    await apiFetch(`/api/followups/${id}/complete`, { method: "PATCH" });
    await load();
  }

  if (loading) return <PageLoader />;

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Tasks"
        title="Follow-ups"
        description="Scheduled calls, meetings, emails, and reminders"
        action={
          <div className="flex gap-1 border border-slate-200 rounded p-0.5 bg-slate-50">
            {(["today", "all"] as const).map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded text-xs font-medium ${
                  filter === f ? "bg-white text-slate-900 border border-slate-200 shadow-sm" : "text-slate-600"
                }`}
              >
                {f === "today" ? "Due Today" : "All"}
              </button>
            ))}
          </div>
        }
      />

      <Panel title={`${followUps.length} follow-ups`} noPadding>
        {followUps.length === 0 ? (
          <EmptyState title="No follow-ups scheduled" description="Schedule follow-ups from a lead detail page" />
        ) : (
          <ProTable>
            <thead>
              <tr>
                <Th>Type</Th>
                <Th>Lead</Th>
                <Th>Company</Th>
                <Th>Scheduled</Th>
                <Th>Owner</Th>
                <Th>Status</Th>
                <Th>Notes</Th>
                <Th className="text-right">Actions</Th>
              </tr>
            </thead>
            <tbody>
              {followUps.map((f) => (
                <tr key={f.id} className="hover:bg-slate-50">
                  <Td>
                    <span className="text-[10px] font-semibold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                      {f.type}
                    </span>
                  </Td>
                  <Td>
                    <TenantLink href={`/dashboard/leads/${f.lead.id}`} className="font-medium text-slate-900 hover:underline">
                      {f.lead.firstName} {f.lead.lastName}
                    </TenantLink>
                  </Td>
                  <Td>{f.lead.company || "—"}</Td>
                  <Td className="tabular-nums">{formatDate(f.scheduledAt)}</Td>
                  <Td>{f.owner?.name || "Unassigned"}</Td>
                  <Td>{f.completed ? "Completed" : "Pending"}</Td>
                  <Td className="max-w-[200px] truncate">{f.notes || "—"}</Td>
                  <Td>
                    <div className="flex items-center justify-end gap-1">
                      {f.lead.phone && (
                        <a href={`tel:${f.lead.phone}`} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Call">
                          <Phone className="h-3.5 w-3.5" />
                        </a>
                      )}
                      {!f.completed && (
                        <button type="button" onClick={() => complete(f.id)} className="p-1.5 rounded hover:bg-slate-100 text-slate-600" title="Mark complete">
                          <Check className="h-3.5 w-3.5" />
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
