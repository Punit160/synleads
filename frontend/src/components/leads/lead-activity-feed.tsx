"use client";

import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import { cn } from "@/lib/utils";
import { formatDateTime, formatRelativeTime } from "@/lib/api";
import {
  type UnifiedActivityItem,
  type LeadActivityPreview,
  activityIcon,
  activityColor,
  previewToUnified,
} from "@/lib/lead-activity";
import { CheckCircle2 } from "lucide-react";

function ActivityRow({
  item,
  compact,
}: {
  item: UnifiedActivityItem;
  compact?: boolean;
}) {
  const Icon = activityIcon(item.followUpType || item.channel || item.title, item.kind);
  const color = activityColor(item.title, item.kind, item.status);

  return (
    <li className="relative flex gap-3 pb-4 last:pb-0">
      {!compact && <span className="absolute left-[15px] top-8 bottom-0 w-px bg-slate-200 last:hidden" aria-hidden />}
      <div className={cn("relative z-10 h-8 w-8 rounded-full border flex items-center justify-center shrink-0", color)}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <p className={cn("font-medium text-slate-900", compact ? "text-xs" : "text-sm")}>{item.title}</p>
          <time className="text-[10px] text-slate-400 shrink-0" title={formatDateTime(item.at)}>
            {formatRelativeTime(item.at)}
          </time>
        </div>
        {item.description && (
          <p className={cn("text-slate-600 mt-0.5 whitespace-pre-wrap break-words", compact ? "text-[11px] line-clamp-2" : "text-xs")}>
            {item.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-2 mt-1">
          {item.userName && (
            <span className="text-[10px] text-slate-400">by {item.userName}</span>
          )}
          {item.status === "scheduled" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-100">
              Scheduled · {formatDateTime(item.at)}
            </span>
          )}
          {item.status === "overdue" && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-50 text-red-700 border border-red-100 font-medium">
              Overdue · {formatDateTime(item.at)}
            </span>
          )}
          {item.status === "done" && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
              <CheckCircle2 className="h-3 w-3" /> Done
            </span>
          )}
        </div>
      </div>
    </li>
  );
}

export function LeadActivityFeed({
  items,
  previews,
  compact,
  limit,
  emptyMessage = "No work logged yet — add a note, log a call, or schedule a follow-up.",
  leadId,
  showViewAll,
}: {
  items?: UnifiedActivityItem[];
  previews?: LeadActivityPreview[];
  compact?: boolean;
  limit?: number;
  emptyMessage?: string;
  leadId?: string;
  showViewAll?: boolean;
}) {
  const feed = items ?? (previews || []).map(previewToUnified);
  const visible = limit ? feed.slice(0, limit) : feed;

  if (visible.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-slate-200 bg-slate-50/50 text-center", compact ? "p-3" : "p-6")}>
        <p className={cn("text-slate-500", compact ? "text-xs" : "text-sm")}>{emptyMessage}</p>
        {leadId && (
          <TenantLink href={`/dashboard/leads/${leadId}?tab=activity`} className="inline-block mt-2 text-xs font-medium text-blue-600 hover:underline">
            Log first activity →
          </TenantLink>
        )}
      </div>
    );
  }

  return (
    <div>
      <ul className={compact ? "space-y-0" : "space-y-0 pl-0"}>
        {visible.map((item) => (
          <ActivityRow key={item.id} item={item} compact={compact} />
        ))}
      </ul>
      {showViewAll && leadId && feed.length > (limit || 0) && (
        <TenantLink
          href={`/dashboard/leads/${leadId}?tab=activity`}
          className="inline-block mt-3 text-xs font-medium text-blue-600 hover:underline"
        >
          View full history ({feed.length} items) →
        </TenantLink>
      )}
    </div>
  );
}

export function ActivityStatChips({
  counts,
  className,
}: {
  counts: {
    notes: number;
    communications: number;
    followUps: number;
    pendingFollowUps: number;
    attachments: number;
  };
  className?: string;
}) {
  const chips = [
    counts.communications > 0 && { label: `${counts.communications} comms`, tone: "text-violet-700 bg-violet-50 border-violet-100" },
    counts.notes > 0 && { label: `${counts.notes} notes`, tone: "text-amber-800 bg-amber-50 border-amber-100" },
    counts.followUps > 0 && { label: `${counts.followUps} follow-ups`, tone: "text-cyan-700 bg-cyan-50 border-cyan-100" },
    counts.pendingFollowUps > 0 && { label: `${counts.pendingFollowUps} pending`, tone: "text-red-700 bg-red-50 border-red-100" },
    counts.attachments > 0 && { label: `${counts.attachments} files`, tone: "text-slate-700 bg-slate-100 border-slate-200" },
  ].filter(Boolean) as { label: string; tone: string }[];

  if (chips.length === 0) return null;

  return (
    <div className={cn("flex flex-wrap gap-1.5", className)}>
      {chips.map((chip) => (
        <span key={chip.label} className={cn("text-[10px] px-2 py-0.5 rounded-full border font-medium", chip.tone)}>
          {chip.label}
        </span>
      ))}
    </div>
  );
}
