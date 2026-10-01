"use client";

import { useMemo, useState } from "react";
import { TenantLink } from "@/components/ui/tenant-link";
import { apiFetch, formatCurrency, formatRelativeTime } from "@/lib/api";
import { cn } from "@/lib/utils";
import {
  LEAD_STATUSES,
  LEAD_STATUS_LABELS,
  PRIORITY_BADGE,
} from "@/lib/lead-constants";
import type { LeadCardData } from "@/components/leads/lead-card";

const KANBAN_STATUSES = LEAD_STATUSES.filter((s) => s !== "on_hold");

function isOverdue(iso?: string | null) {
  if (!iso) return false;
  return new Date(iso).getTime() < Date.now();
}

export function LeadKanban({
  leads,
  canEdit,
  onMoved,
}: {
  leads: LeadCardData[];
  canEdit: boolean;
  onMoved: () => Promise<void> | void;
}) {
  const [dragOver, setDragOver] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const columns = useMemo(() => {
    return KANBAN_STATUSES.map((status) => {
      const items = leads.filter((l) => (l.status === "converted" ? "won" : l.status) === status);
      const value = items.reduce((sum, l) => sum + (l.budget || 0), 0);
      const overdue = items.filter((l) => isOverdue(l.nextFollowUp?.scheduledAt)).length;
      return { status, items, value, overdue, active: items.filter((l) => l.status !== "won" && l.status !== "lost").length };
    });
  }, [leads]);

  async function moveLead(leadId: string, status: string) {
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === status) return;
    setBusyId(leadId);
    try {
      await apiFetch(`/api/leads/${leadId}`, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      await onMoved();
    } finally {
      setBusyId(null);
      setDragOver(null);
    }
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1">
      {columns.map((col) => (
        <div
          key={col.status}
          className={cn(
            "w-[252px] shrink-0 rounded-[10px]",
            dragOver === col.status ? "bg-brand-muted/50 ring-1 ring-brand" : "bg-transparent"
          )}
          onDragOver={(e) => {
            if (!canEdit) return;
            e.preventDefault();
            setDragOver(col.status);
          }}
          onDragLeave={() => setDragOver((s) => (s === col.status ? null : s))}
          onDrop={(e) => {
            e.preventDefault();
            const id = e.dataTransfer.getData("leadId");
            if (id && canEdit) void moveLead(id, col.status);
          }}
        >
          <div className="px-1 py-2 mb-1">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 truncate">{LEAD_STATUS_LABELS[col.status]}</p>
              <span className="text-[11px] font-semibold tabular-nums text-slate-700 bg-white border border-slate-200 rounded-md px-1.5 py-0.5">{col.items.length}</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
              {col.value > 0 ? formatCurrency(col.value) : "No value"}
              {col.overdue > 0 && <span className="text-red-600 font-medium"> · {col.overdue} overdue</span>}
            </p>
          </div>
          <div className="p-2 space-y-2 min-h-[120px] max-h-[calc(100vh-280px)] overflow-y-auto">
            {col.items.length === 0 && (
              <p className="text-[11px] text-slate-400 px-1 py-6 text-center">No leads</p>
            )}
            {col.items.map((lead) => {
              const overdue = isOverdue(lead.nextFollowUp?.scheduledAt);
              return (
                <article
                  key={lead.id}
                  draggable={canEdit}
                  onDragStart={(e) => e.dataTransfer.setData("leadId", lead.id)}
                  className={cn(
                    "rounded-[10px] border border-slate-200 bg-white p-2.5",
                    canEdit && "cursor-grab active:cursor-grabbing",
                    busyId === lead.id && "opacity-50"
                  )}
                >
                  <TenantLink href={`/dashboard/leads/${lead.id}`} className="block">
                    <p className="text-sm font-semibold text-slate-900 leading-snug truncate">
                      {lead.firstName} {lead.lastName || ""}
                    </p>
                    <p className="text-[11px] text-slate-500 truncate mt-0.5">{lead.company || "No company"}</p>
                  </TenantLink>
                  <div className="mt-2 space-y-1 text-[11px] text-slate-600">
                    {lead.phone && <p className="truncate">{lead.phone}</p>}
                    <p className="truncate">{lead.owner?.name || "Unassigned"}</p>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cn("px-1.5 py-0.5 rounded capitalize border text-[10px]", PRIORITY_BADGE[lead.priority])}>
                        {lead.priority}
                      </span>
                      <span className="font-semibold tabular-nums">{lead.budget ? formatCurrency(lead.budget) : "—"}</span>
                    </div>
                    <p className={cn("truncate", overdue && "text-red-600 font-medium")}>
                      {lead.nextFollowUp
                        ? `${overdue ? "Overdue" : "Next"} · ${formatRelativeTime(lead.nextFollowUp.scheduledAt)}`
                        : "No follow-up"}
                    </p>
                    <p className="truncate text-slate-400">
                      {lead.source || "—"}
                      {lead.lastActivityAt ? ` · ${formatRelativeTime(lead.lastActivityAt)}` : ""}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
