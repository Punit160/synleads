"use client";

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Phone, Check, CalendarClock, MessageCircle } from "lucide-react";
import { TenantLink } from "@/components/ui/tenant-link";
import { apiFetch, formatDate, formatRelativeTime } from "@/lib/api";
import { FOLLOWUP_TYPES, FOLLOWUP_TYPE_LABELS } from "@/lib/lead-constants";
import { PageHeader, Panel, PageLoader, EmptyState, BtnSecondary } from "@/components/ui/dashboard-ui";
import { cn } from "@/lib/utils";
import { useToast } from "@/components/ui/toast";
import { useAuth } from "@/lib/auth-context";

type FollowUp = {
  id: string;
  type: string;
  scheduledAt: string;
  notes: string | null;
  completed: boolean;
  lead: { id: string; firstName: string; lastName: string | null; company: string | null; phone: string | null };
  owner: { name: string } | null;
};

const BUCKETS = [
  { id: "overdue", label: "Overdue" },
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "upcoming", label: "Upcoming" },
] as const;

type Bucket = (typeof BUCKETS)[number]["id"];

function FollowUpsContent() {
  const searchParams = useSearchParams();
  const auth = useAuth();
  const toast = useToast();
  const canEdit = auth.hasPermission("edit");
  const initial = (searchParams.get("bucket") as Bucket) || "today";
  const [bucket, setBucket] = useState<Bucket>(BUCKETS.some((b) => b.id === initial) ? initial : "today");
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [counts, setCounts] = useState<Record<Bucket, number>>({ overdue: 0, today: 0, tomorrow: 0, upcoming: 0 });
  const [loading, setLoading] = useState(true);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [next, setNext] = useState({ type: "call", scheduledAt: "", notes: "" });
  const [busy, setBusy] = useState(false);

  async function load(active: Bucket) {
    setLoading(true);
    try {
      const [items, summary] = await Promise.all([
        apiFetch<FollowUp[]>(`/api/followups?bucket=${active}`),
        apiFetch<{ overdue: number; today: number; tomorrow: number; upcoming: number }>("/api/followups?summary=1"),
      ]);
      setFollowUps(items);
      setCounts(summary);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const nextBucket = (searchParams.get("bucket") as Bucket) || bucket;
    if (BUCKETS.some((b) => b.id === nextBucket) && nextBucket !== bucket) {
      setBucket(nextBucket);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    load(bucket).catch(console.error);
  }, [bucket]);

  async function complete(id: string, scheduleNext: boolean) {
    setBusy(true);
    try {
      await apiFetch(`/api/followups/${id}/complete`, {
        method: "PATCH",
        body: JSON.stringify(
          scheduleNext && next.scheduledAt
            ? { next: { type: next.type, scheduledAt: next.scheduledAt, notes: next.notes } }
            : {}
        ),
      });
      toast.success(scheduleNext && next.scheduledAt ? "Completed and next follow-up scheduled" : "Follow-up completed");
      setCompleteId(null);
      setNext({ type: "call", scheduledAt: "", notes: "" });
      await load(bucket);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not complete follow-up");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="max-w-[1400px]">
      <PageHeader
        meta="Tasks"
        title="Follow-up Center"
        description="Overdue, today, tomorrow, and upcoming actions across your leads"
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 mb-4">
        {BUCKETS.map((b) => (
          <button
            key={b.id}
            type="button"
            onClick={() => setBucket(b.id)}
            className={cn(
              "rounded-xl border px-3 py-3 text-left transition-colors",
              bucket === b.id ? "border-brand bg-brand-muted" : "border-slate-200 bg-white hover:border-brand/30",
              b.id === "overdue" && counts.overdue > 0 && bucket !== b.id && "border-red-200"
            )}
          >
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{b.label}</p>
            <p className={cn("text-xl font-semibold tabular-nums mt-1", b.id === "overdue" && counts.overdue > 0 && "text-red-700")}>
              {counts[b.id]}
            </p>
          </button>
        ))}
      </div>

      {loading ? (
        <PageLoader />
      ) : (
        <Panel title={`${followUps.length} ${BUCKETS.find((b) => b.id === bucket)?.label.toLowerCase()} follow-ups`} noPadding>
          {followUps.length === 0 ? (
            <EmptyState
              title="Nothing in this bucket"
              description="Schedule follow-ups from a lead workspace, then complete them here."
            />
          ) : (
            <ul className="divide-y divide-slate-100">
              {followUps.map((f) => {
                const overdue = !f.completed && new Date(f.scheduledAt).getTime() < Date.now();
                const open = completeId === f.id;
                return (
                  <li key={f.id} className="px-4 py-3">
                    <div className="flex flex-col sm:flex-row sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="text-[10px] font-semibold uppercase text-slate-600 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {FOLLOWUP_TYPE_LABELS[f.type] || f.type}
                          </span>
                          {overdue && <span className="text-[10px] font-semibold text-red-600">Overdue</span>}
                          <span className="text-xs text-slate-500">{formatDate(f.scheduledAt)} · {formatRelativeTime(f.scheduledAt)}</span>
                        </div>
                        <TenantLink href={`/dashboard/leads/${f.lead.id}`} className="font-semibold text-slate-900 hover:underline">
                          {f.lead.firstName} {f.lead.lastName}
                        </TenantLink>
                        <p className="text-xs text-slate-500 mt-0.5">
                          {f.lead.company || "No company"} · {f.owner?.name || "Unassigned"}
                        </p>
                        {f.notes && <p className="text-sm text-slate-600 mt-1">{f.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {f.lead.phone && (
                          <a href={`tel:${f.lead.phone}`} className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50" title="Call">
                            <Phone className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {f.lead.phone && (
                          <a
                            href={`https://wa.me/${f.lead.phone.replace(/\D/g, "")}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 rounded-lg border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                            title="WhatsApp"
                          >
                            <MessageCircle className="h-3.5 w-3.5" />
                          </a>
                        )}
                        {canEdit && !f.completed && (
                          <BtnSecondary
                            onClick={() => setCompleteId(open ? null : f.id)}
                            className="!inline-flex text-xs"
                          >
                            <Check className="h-3.5 w-3.5" /> Complete
                          </BtnSecondary>
                        )}
                      </div>
                    </div>
                    {open && (
                      <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3 space-y-2">
                        <p className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <CalendarClock className="h-3.5 w-3.5" /> Schedule the next action (optional)
                        </p>
                        <div className="grid sm:grid-cols-3 gap-2">
                          <select value={next.type} onChange={(e) => setNext({ ...next, type: e.target.value })} className="pro-input text-sm">
                            {FOLLOWUP_TYPES.map((t) => (
                              <option key={t.value} value={t.value}>{t.label}</option>
                            ))}
                          </select>
                          <input
                            type="datetime-local"
                            value={next.scheduledAt}
                            onChange={(e) => setNext({ ...next, scheduledAt: e.target.value })}
                            className="pro-input text-sm"
                          />
                          <input
                            value={next.notes}
                            onChange={(e) => setNext({ ...next, notes: e.target.value })}
                            placeholder="Next step notes"
                            className="pro-input text-sm"
                          />
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={busy}
                            onClick={() => complete(f.id, true)}
                            className="pro-btn-primary text-xs"
                          >
                            Complete{next.scheduledAt ? " + schedule next" : ""}
                          </button>
                          <button type="button" disabled={busy} onClick={() => complete(f.id, false)} className="pro-btn-secondary text-xs">
                            Complete only
                          </button>
                        </div>
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      )}
    </div>
  );
}

export default function FollowUpsPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <FollowUpsContent />
    </Suspense>
  );
}
