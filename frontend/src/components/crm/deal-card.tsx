"use client";

import { useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { cn } from "@/lib/utils";
import { ExternalLink, MessageCircle, MoreHorizontal } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/api";

export type PipelineDeal = {
  id: string;
  name: string;
  amount: number;
  probability?: number;
  createdAt?: string;
  expectedCloseDate?: string | null;
  account?: { id: string; name: string; industry?: string | null } | null;
  contact?: { firstName: string; lastName: string | null } | null;
  owner?: { id: string; name: string } | null;
  _count?: { activities: number };
};

function getTags(deal: PipelineDeal): string[] {
  const tags: string[] = [];
  if (deal.account?.industry) tags.push(deal.account.industry.toLowerCase());
  if (deal.probability && deal.probability >= 60) tags.push("high prob");
  if (deal.amount >= 500000) tags.push("enterprise");
  else if (deal.amount >= 100000) tags.push("mid-market");
  if (tags.length === 0) tags.push("sales");
  return tags.slice(0, 3);
}

export function DealCard({
  deal,
  stages,
  currentStageId,
  onMove,
  dragging,
}: {
  deal: PipelineDeal;
  stages: Array<{ id: string; name: string }>;
  currentStageId: string;
  onMove: (dealId: string, stageId: string) => void;
  dragging?: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const tags = getTags(deal);
  const clientName =
    deal.account?.name ||
    (deal.contact ? `${deal.contact.firstName} ${deal.contact.lastName}` : "No account");
  const activityCount = deal._count?.activities ?? 0;
  const startDate = deal.createdAt ? formatDate(deal.createdAt) : "—";
  const endDate = deal.expectedCloseDate ? formatDate(deal.expectedCloseDate) : "—";

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("dealId", deal.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className={cn(
        "crm-deal-card group cursor-grab active:cursor-grabbing",
        dragging && "opacity-50 scale-[0.98]"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-2">
        <TenantLink
          href={`/dashboard/deals/${deal.id}`}
          className="font-semibold text-[13px] text-slate-800 leading-snug hover:text-brand hover:underline"
          onMouseDown={(e) => e.stopPropagation()}
        >
          {deal.name}
        </TenantLink>
        <div className="relative shrink-0">
          <button
            type="button"
            className="p-0.5 rounded text-slate-400 opacity-0 group-hover:opacity-100 hover:bg-slate-100 transition-opacity"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((v) => !v);
            }}
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 z-10 min-w-[140px] rounded-lg border border-slate-200 bg-white shadow-lg py-1 text-xs">
              <TenantLink
                href={`/dashboard/deals/${deal.id}`}
                className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50 text-slate-700"
                onClick={() => setMenuOpen(false)}
              >
                <ExternalLink className="h-3.5 w-3.5" /> View deal
              </TenantLink>
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-2.5">
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex px-2 py-0.5 rounded text-[10px] font-medium capitalize bg-brand-muted text-brand border border-brand-light"
          >
            {tag}
          </span>
        ))}
      </div>

      <p className="text-[11px] text-slate-500 mb-2 truncate">{clientName}</p>
      <p className="text-sm font-bold text-slate-900 mb-3 tabular-nums">{formatCurrency(deal.amount)}</p>

      <div className="flex items-center justify-between pt-2 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {deal.owner && (
            <div
              className="h-6 w-6 rounded-lg bg-brand flex items-center justify-center text-[9px] font-bold text-white"
              title={deal.owner.name}
            >
              {deal.owner.name.charAt(0)}
            </div>
          )}
          <span className="text-[10px] text-slate-400 tabular-nums">
            {startDate} → {endDate}
          </span>
        </div>
        {activityCount > 0 && (
          <span className="flex items-center gap-0.5 text-[10px] text-slate-400">
            <MessageCircle className="h-3 w-3" />
            {activityCount}
          </span>
        )}
      </div>

      <select
        className="mt-2 w-full text-[10px] rounded border border-slate-200 px-2 py-1 bg-slate-50 text-slate-600 opacity-0 group-hover:opacity-100 transition-opacity focus:opacity-100"
        value={currentStageId}
        onChange={(e) => onMove(deal.id, e.target.value)}
        onClick={(e) => e.stopPropagation()}
      >
        {stages.map((s) => (
          <option key={s.id} value={s.id}>
            Move to {s.name}
          </option>
        ))}
      </select>
    </div>
  );
}

export const STAGE_THEMES = [
  { header: "bg-blue-50 border-blue-400", accent: "text-blue-800" },
  { header: "bg-indigo-50 border-indigo-400", accent: "text-indigo-800" },
  { header: "bg-violet-50 border-violet-400", accent: "text-violet-800" },
  { header: "bg-cyan-50 border-cyan-500", accent: "text-cyan-800" },
  { header: "bg-teal-50 border-teal-500", accent: "text-teal-800" },
  { header: "bg-emerald-50 border-emerald-500", accent: "text-emerald-800" },
];

export function formatPipelineTotal(amount: number): string {
  return `₹ ${amount.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
