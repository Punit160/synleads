"use client";

import { useTenantPath } from "@/lib/use-tenant-path";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import {
  ArrowLeft,
  Pencil,
  Copy,
  Trash2,
  Phone,
  Mail,
  RefreshCw,
  Paperclip,
  CalendarClock,
  Sparkles,
  MessageCircle,
  UserPlus,
} from "lucide-react";
import { apiFetch, ApiError, formatCurrency, formatDate, formatRelativeTime, apiUpload } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { LEAD_STATUS_LABELS, STATUS_BADGE, PRIORITY_BADGE, FOLLOWUP_TYPES, LEAD_STATUSES, LEAD_PRIORITIES } from "@/lib/lead-constants";
import { cn } from "@/lib/utils";
import { mergeLeadActivity, totalWorkCount } from "@/lib/lead-activity";
import { LeadActivityFeed, ActivityStatChips } from "@/components/leads/lead-activity-feed";
import { LeadQuickActions } from "@/components/leads/lead-quick-actions";
import { PageLoader } from "@/components/ui/dashboard-ui";
import { useToast } from "@/components/ui/toast";

type Lead = {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  alternatePhone: string | null;
  company: string | null;
  title: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pinCode: string | null;
  industry: string | null;
  website: string | null;
  source: string | null;
  status: string;
  priority: string;
  budget: number | null;
  requirement: string | null;
  expectedClosingDate: string | null;
  remarks: string | null;
  score: number;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  owner: { id?: string; name: string } | null;
  followUps: Array<{ id: string; type: string; scheduledAt: string; notes: string | null; completed: boolean; owner: { name: string } | null }>;
  communications: Array<{ id: string; channel: string; direction: string; subject: string | null; body: string | null; createdAt: string; owner: { name: string } | null }>;
  leadNotes: Array<{ id: string; content: string; createdAt: string; author: { name: string } | null }>;
  attachments: Array<{ id: string; fileName: string; fileSize: number; uploadedAt: string }>;
  timeline: Array<{ id: string; type: string; title: string; description: string | null; createdAt: string; user: { name: string } | null }>;
};

const TABS = [
  { id: "activity", label: "Work & History" },
  { id: "details", label: "Details" },
  { id: "schedule", label: "Follow-ups" },
  { id: "files", label: "Files" },
] as const;

type TabId = (typeof TABS)[number]["id"];

function leadHeading(lead: Lead) {
  if (lead.requirement?.trim()) return lead.requirement.trim();
  if (lead.title?.trim()) return lead.title.trim();
  return `${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}`;
}

export default function LeadDetailPage() {
  return (
    <Suspense fallback={<PageLoader />}>
      <LeadDetailContent />
    </Suspense>
  );
}

function LeadDetailContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const tp = useTenantPath();
  const searchParams = useSearchParams();
  const auth = useAuth();
  const canEdit = auth.hasPermission("edit");
  const canDelete = auth.hasPermission("delete");
  const canAdd = auth.hasPermission("add");
  const canAssign = auth.hasPermission("assign");
  const toast = useToast();

  const tabParam = searchParams.get("tab");
  const initialTab: TabId =
    tabParam === "timeline" || tabParam === "activity" ? "activity"
    : tabParam === "details" ? "details"
    : tabParam === "schedule" || tabParam === "follow-ups" ? "schedule"
    : tabParam === "files" || tabParam === "attachments" ? "files"
    : "activity";

  const [lead, setLead] = useState<Lead | null>(null);
  const [tab, setTab] = useState<TabId>(initialTab);
  const [followUpForm, setFollowUpForm] = useState({ type: "call", scheduledAt: "", notes: "" });
  const [uploadError, setUploadError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [assignable, setAssignable] = useState<Array<{ userId: string; name: string }>>([]);
  const [completeId, setCompleteId] = useState<string | null>(null);
  const [nextFollow, setNextFollow] = useState({ type: "call", scheduledAt: "", notes: "" });

  async function load() {
    setLead(await apiFetch<Lead>(`/api/leads/${id}`));
  }

  useEffect(() => {
    load().catch(() => router.push(tp("/dashboard/leads")));
  }, [id, router]);

  useEffect(() => {
    if (canAssign) {
      apiFetch<Array<{ userId: string; name: string }>>("/api/users/assignable").then(setAssignable).catch(() => {});
    }
  }, [canAssign]);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const activityItems = useMemo(() => (lead ? mergeLeadActivity(lead) : []), [lead]);

  const activityCounts = useMemo(() => {
    if (!lead) return null;
    return {
      timeline: lead.timeline.length,
      notes: lead.leadNotes.length,
      communications: lead.communications.length,
      followUps: lead.followUps.length,
      pendingFollowUps: lead.followUps.filter((f) => !f.completed).length,
      attachments: lead.attachments.length,
    };
  }, [lead]);

  async function completeFollowUp(followUpId: string, scheduleNext = false) {
    await apiFetch(`/api/followups/${followUpId}/complete`, {
      method: "PATCH",
      body: JSON.stringify(
        scheduleNext && nextFollow.scheduledAt
          ? { next: { type: nextFollow.type, scheduledAt: nextFollow.scheduledAt, notes: nextFollow.notes } }
          : {}
      ),
    });
    setCompleteId(null);
    setNextFollow({ type: "call", scheduledAt: "", notes: "" });
    toast.success("Follow-up updated");
    await load();
  }

  async function updateLead(patch: Record<string, unknown>) {
    await apiFetch(`/api/leads/${id}`, { method: "PUT", body: JSON.stringify(patch) });
    toast.success("Lead updated");
    await load();
  }

  async function assignLead(ownerId: string) {
    if (!ownerId) return;
    await apiFetch(`/api/leads/${id}/assign`, { method: "PATCH", body: JSON.stringify({ ownerId }) });
    toast.success("Lead assigned");
    await load();
  }

  async function scheduleFollowUp(e: React.FormEvent) {
    e.preventDefault();
    await apiFetch("/api/followups", {
      method: "POST",
      body: JSON.stringify({ leadId: id, ...followUpForm, reminderAt: followUpForm.scheduledAt }),
    });
    setFollowUpForm({ type: "call", scheduledAt: "", notes: "" });
    await load();
  }

  async function uploadFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadError("");
    const fd = new FormData();
    fd.append("file", file);
    try {
      await apiUpload(`/api/leads/${id}/attachments`, fd);
      await load();
    } catch (err) {
      setUploadError(err instanceof ApiError ? err.message : "Upload failed");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function convert() {
    await apiFetch(`/api/leads/${id}/convert`, { method: "POST", body: JSON.stringify({ createDeal: true, dealAmount: lead?.budget || 0 }) });
    await load();
  }

  async function duplicate() {
    const dup = await apiFetch<{ id: string }>(`/api/leads/${id}/duplicate`, { method: "POST" });
    router.push(tp(`/dashboard/leads/${dup.id}`));
  }

  async function remove() {
    if (!confirm("Delete this lead permanently?")) return;
    await apiFetch(`/api/leads/${id}`, { method: "DELETE" });
    router.push(tp("/dashboard/leads"));
  }

  function setActiveTab(next: TabId) {
    setTab(next);
    router.replace(`/dashboard/leads/${id}?tab=${next}`, { scroll: false });
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-sm text-slate-500">Loading lead...</p>
      </div>
    );
  }

  const btn = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border border-slate-200 bg-white text-slate-700 hover:bg-slate-50";
  const btnPrimary = "inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold bg-brand text-white hover:bg-brand-dark";

  const pendingFollowUps = lead.followUps.filter((f) => !f.completed);

  return (
    <div className="max-w-6xl mx-auto space-y-4">
      <TenantLink href="/dashboard/leads" className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back to leads
      </TenantLink>

      {/* Header */}
      <div className="rounded-[10px] border border-slate-200 bg-white p-5">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <span className="font-mono text-xs text-slate-500">{lead.leadNumber}</span>
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold", STATUS_BADGE[lead.status])}>
                {LEAD_STATUS_LABELS[lead.status]}
              </span>
              <span className={cn("px-2 py-0.5 rounded text-[10px] font-semibold capitalize", PRIORITY_BADGE[lead.priority])}>
                {lead.priority}
              </span>
              <span className="inline-flex items-center gap-1 text-[10px] text-slate-500">
                <Sparkles className="h-3 w-3" /> Score {lead.score || "N/A"}
              </span>
            </div>
            <h1 className="text-[1.45rem] font-semibold text-slate-900 leading-snug tracking-tight">{leadHeading(lead)}</h1>
            <p className="text-sm text-slate-500 mt-1.5">
              {lead.company || "No company"} · {lead.firstName} {lead.lastName} · Assigned: {lead.owner?.name || "Unassigned"}
            </p>
            {(lead.remarks || lead.requirement) && (
              <p className="text-xs text-slate-600 mt-2 leading-relaxed max-w-3xl">{lead.remarks || lead.requirement}</p>
            )}
          </div>
          <div className="flex flex-wrap gap-2 shrink-0">
            {lead.phone && <a href={`tel:${lead.phone}`} className={btnPrimary}><Phone className="h-3.5 w-3.5" /> Call</a>}
            {lead.phone && (
              <a href={`https://wa.me/${lead.phone.replace(/\D/g, "")}`} target="_blank" rel="noopener noreferrer" className={btn}>
                <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
              </a>
            )}
            {lead.email && <a href={`mailto:${lead.email}`} className={btn}><Mail className="h-3.5 w-3.5" /> Email</a>}
            {canEdit && <TenantLink href={`/dashboard/leads/${id}/edit`} className={btn}><Pencil className="h-3.5 w-3.5" /> Edit</TenantLink>}
            {canAdd && <button type="button" onClick={duplicate} className={btn}><Copy className="h-3.5 w-3.5" /> Duplicate</button>}
            {canEdit && lead.status !== "won" && (
              <button type="button" onClick={convert} className={btnPrimary}><RefreshCw className="h-3.5 w-3.5" /> Convert</button>
            )}
            {canDelete && (
              <button type="button" onClick={remove} className={`${btn} text-red-700 border-red-200 hover:bg-red-50`}>
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            )}
          </div>
        </div>

        {/* Summary stats */}
        <div className="mt-4 pt-4 border-t border-slate-100 grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
          {[
            { label: "Last worked", value: formatRelativeTime(lead.updatedAt) },
            { label: "Total work", value: activityCounts ? totalWorkCount(activityCounts) : 0 },
            { label: "Pending F/U", value: pendingFollowUps.length, alert: pendingFollowUps.length > 0 },
            { label: "Comms", value: lead.communications.length },
            { label: "Deal value", value: lead.budget != null ? formatCurrency(lead.budget) : "—" },
            { label: "Closure", value: lead.expectedClosingDate ? formatDate(lead.expectedClosingDate) : "—" },
          ].map((s) => (
            <div key={s.label} className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2">
              <p className="text-[10px] text-slate-400 uppercase tracking-wide">{s.label}</p>
              <p className={cn("text-sm font-bold text-slate-900", s.alert && "text-red-600")}>{s.value}</p>
            </div>
          ))}
        </div>

        {activityCounts && <ActivityStatChips counts={activityCounts} className="mt-3" />}
      </div>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Tabs */}
          <div className="flex gap-0 overflow-x-auto border-b border-slate-200 bg-white rounded-t-xl px-2">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={cn(
                  "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
                  tab === t.id ? "border-brand text-brand" : "border-transparent text-slate-500 hover:text-slate-700"
                )}
              >
                {t.label}
                {t.id === "schedule" && pendingFollowUps.length > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 text-[10px]">{pendingFollowUps.length}</span>
                )}
              </button>
            ))}
          </div>

          <div className="pro-panel p-5 rounded-t-none rounded-b-xl border border-t-0 border-slate-200">
            {tab === "activity" && (
              <div className="space-y-5">
                {canEdit && (
                  <LeadQuickActions leadId={id} phone={lead.phone} onRefresh={load} />
                )}
                <div>
                  <h3 className="text-sm font-semibold text-slate-900 mb-4">Complete work history</h3>
                  <LeadActivityFeed items={activityItems} />
                </div>
              </div>
            )}

            {tab === "details" && (
              <div className="grid sm:grid-cols-2 gap-x-8 gap-y-3">
                {[
                  ["Customer", `${lead.firstName} ${lead.lastName || ""}`.trim()],
                  ["Company", lead.company],
                  ["Mobile", lead.phone],
                  ["Email", lead.email],
                  ["Location", [lead.city, lead.state, lead.country].filter(Boolean).join(", ")],
                  ["Source", lead.source],
                  ["Industry", lead.industry],
                  ["Website", lead.website],
                  ["Requirement", lead.requirement],
                  ["Remarks", lead.remarks],
                  ["Budget", lead.budget != null ? formatCurrency(lead.budget) : null],
                  ["Expected closing", lead.expectedClosingDate ? formatDate(lead.expectedClosingDate) : null],
                  ["Created", formatDate(lead.createdAt)],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-4 py-1.5 border-b border-slate-50 text-sm">
                    <span className="text-slate-500 shrink-0">{label}</span>
                    <span className="text-slate-900 font-medium text-right">{value || "—"}</span>
                  </div>
                ))}
              </div>
            )}

            {tab === "schedule" && (
              <div className="grid lg:grid-cols-2 gap-6">
                {canEdit && (
                  <form onSubmit={scheduleFollowUp} className="space-y-3 rounded-lg bg-slate-50 border border-slate-100 p-4">
                    <h3 className="text-sm font-semibold flex items-center gap-2"><CalendarClock className="h-4 w-4" /> Schedule follow-up</h3>
                    <select value={followUpForm.type} onChange={(e) => setFollowUpForm({ ...followUpForm, type: e.target.value })} className="pro-input text-sm">
                      {FOLLOWUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                    </select>
                    <input type="datetime-local" required value={followUpForm.scheduledAt} onChange={(e) => setFollowUpForm({ ...followUpForm, scheduledAt: e.target.value })} className="pro-input text-sm" />
                    <textarea value={followUpForm.notes} onChange={(e) => setFollowUpForm({ ...followUpForm, notes: e.target.value })} placeholder="Agenda / notes" className="pro-input min-h-[60px] text-sm" />
                    <button type="submit" className="pro-btn-primary text-xs">Schedule</button>
                  </form>
                )}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase mb-3">All follow-ups</h3>
                  <ul className="divide-y divide-slate-100">
                    {lead.followUps.length === 0 ? (
                      <p className="text-sm text-slate-500">No follow-ups scheduled yet.</p>
                    ) : lead.followUps.map((f) => {
                      const overdue = !f.completed && new Date(f.scheduledAt).getTime() < Date.now();
                      const open = completeId === f.id;
                      return (
                        <li key={f.id} className="py-3">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-100 border border-slate-200">{f.type}</span>
                                {f.completed ? (
                                  <span className="text-[10px] text-emerald-600 font-semibold">Completed</span>
                                ) : overdue ? (
                                  <span className="text-[10px] text-red-600 font-semibold">Overdue</span>
                                ) : (
                                  <span className="text-[10px] text-brand font-semibold">Upcoming</span>
                                )}
                              </div>
                              <p className="text-sm font-medium">{formatDate(f.scheduledAt)}</p>
                              {f.notes && <p className="text-xs text-slate-500 mt-0.5">{f.notes}</p>}
                              {f.owner && <p className="text-[10px] text-slate-400 mt-0.5">{f.owner.name}</p>}
                            </div>
                            {canEdit && !f.completed && (
                              <button
                                type="button"
                                onClick={() => setCompleteId(open ? null : f.id)}
                                className="text-xs px-2 py-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 shrink-0"
                              >
                                Mark done
                              </button>
                            )}
                          </div>
                          {open && (
                            <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-2">
                              <p className="text-[11px] font-semibold text-slate-600">Schedule next action</p>
                              <select value={nextFollow.type} onChange={(e) => setNextFollow({ ...nextFollow, type: e.target.value })} className="pro-input text-xs">
                                {FOLLOWUP_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                              <input type="datetime-local" value={nextFollow.scheduledAt} onChange={(e) => setNextFollow({ ...nextFollow, scheduledAt: e.target.value })} className="pro-input text-xs" />
                              <div className="flex gap-2">
                                <button type="button" onClick={() => completeFollowUp(f.id, true)} className="pro-btn-primary text-xs">Complete + next</button>
                                <button type="button" onClick={() => completeFollowUp(f.id, false)} className="pro-btn-secondary text-xs">Complete only</button>
                              </div>
                            </div>
                          )}
                        </li>
                      );
                    })}
                  </ul>
                </div>
              </div>
            )}

            {tab === "files" && (
              <div className="space-y-4">
                {canEdit && (
                  <>
                    <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 text-sm font-medium">
                      <Paperclip className="h-4 w-4" /> Upload file
                    </button>
                    <input ref={fileRef} type="file" className="hidden" onChange={uploadFile} />
                    {uploadError && (
                      <p className="text-sm text-red-600">{uploadError}</p>
                    )}
                  </>
                )}
                <ul className="divide-y divide-slate-100">
                  {lead.attachments.length === 0 ? (
                    <p className="text-sm text-slate-500">No files attached.</p>
                  ) : lead.attachments.map((a) => (
                    <li key={a.id} className="py-3 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium">{a.fileName}</p>
                        <p className="text-xs text-slate-500">{(a.fileSize / 1024).toFixed(1)} KB · {formatDate(a.uploadedAt)}</p>
                      </div>
                      <a href={`/api/leads/${id}/attachments/${a.id}/download`} className="text-xs font-medium text-brand hover:underline">Download</a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Ownership & stage</p>
            {canEdit ? (
              <select
                className="pro-input text-sm mb-2"
                value={lead.status}
                onChange={(e) => updateLead({ status: e.target.value }).catch(console.error)}
              >
                {LEAD_STATUSES.map((s) => (
                  <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm font-medium mb-2">{LEAD_STATUS_LABELS[lead.status]}</p>
            )}
            {canEdit && (
              <select
                className="pro-input text-sm mb-2"
                value={lead.priority}
                onChange={(e) => updateLead({ priority: e.target.value }).catch(console.error)}
              >
                {LEAD_PRIORITIES.map((p) => (
                  <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
                ))}
              </select>
            )}
            {canAssign && assignable.length > 0 ? (
              <select
                className="pro-input text-sm"
                value={lead.owner?.id || ""}
                onChange={(e) => assignLead(e.target.value).catch(console.error)}
              >
                <option value="">Unassigned</option>
                {assignable.map((u) => (
                  <option key={u.userId} value={u.userId}>{u.name}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-slate-600 flex items-center gap-1.5">
                <UserPlus className="h-3.5 w-3.5" /> {lead.owner?.name || "Unassigned"}
              </p>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-3">Contact</p>
            <p className="font-semibold text-slate-900">{lead.company || `${lead.firstName} ${lead.lastName || ""}`}</p>
            <div className="mt-3 space-y-1.5 text-sm text-slate-600">
              {lead.phone && <p><span className="text-slate-400">Mobile:</span> {lead.phone}</p>}
              {lead.email && <p className="truncate"><span className="text-slate-400">Email:</span> {lead.email}</p>}
              <p><span className="text-slate-400">Source:</span> {lead.source || "—"}</p>
            </div>
          </div>

          {pendingFollowUps.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
              <p className="text-xs font-semibold text-amber-800 uppercase mb-2">Next actions</p>
              <ul className="space-y-2">
                {pendingFollowUps.slice(0, 3).map((f) => (
                  <li key={f.id} className="text-xs">
                    <span className="font-medium capitalize text-amber-900">{f.type}</span>
                    <span className="text-amber-700"> · {formatDate(f.scheduledAt)}</span>
                  </li>
                ))}
              </ul>
              <button type="button" onClick={() => setActiveTab("schedule")} className="mt-2 text-xs font-medium text-amber-800 hover:underline">
                View all follow-ups →
              </button>
            </div>
          )}

          <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <p className="text-xs font-semibold text-slate-500 uppercase mb-2">Recent activity</p>
            <LeadActivityFeed items={activityItems} compact limit={5} />
            {activityItems.length > 5 && (
              <button type="button" onClick={() => setActiveTab("activity")} className="mt-2 text-xs font-medium text-brand hover:underline">
                View all {activityItems.length} items →
              </button>
            )}
          </div>

          <TenantLink
            href={`/dashboard/quotations/new?leadId=${id}`}
            className="block text-center px-4 py-2.5 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-dark"
          >
            Send quotation
          </TenantLink>
        </div>
      </div>
    </div>
  );
}
