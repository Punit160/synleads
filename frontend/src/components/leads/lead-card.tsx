"use client";

import { useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import {
  Pencil,
  Phone,
  Mail,
  MessageCircle,
  Copy,
  Eye,
  Users,
  Building2,
  Calendar,
  Sparkles,
  FileText,
  History,
  Handshake,
  Star,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate, formatRelativeTime } from "@/lib/api";
import {
  LEAD_STATUS_LABELS,
  STATUS_BADGE,
  PRIORITY_BADGE,
} from "@/lib/lead-constants";
import { LeadActivityFeed, ActivityStatChips } from "@/components/leads/lead-activity-feed";
import type { LeadActivityCounts, LeadActivityPreview } from "@/lib/lead-activity";

export type LeadCardData = {
  id: string;
  leadNumber: string;
  firstName: string;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  company: string | null;
  title: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  source: string | null;
  status: string;
  priority: string;
  budget: number | null;
  requirement: string | null;
  remarks: string | null;
  expectedClosingDate: string | null;
  score: number;
  createdAt: string;
  slaBreached?: boolean;
  slaDueAt?: string | null;
  firstResponseAt?: string | null;
  owner?: { id: string; name: string } | null;
  nextFollowUp?: { scheduledAt: string; type: string } | null;
  callAttempts?: number;
  meetingAttempts?: number;
  progressPercent?: number;
  recentActivity?: LeadActivityPreview[];
  activityCounts?: LeadActivityCounts;
  lastActivityAt?: string;
};

type AssignableUser = { userId: string; name: string };

function leadHeading(lead: LeadCardData): string {
  if (lead.requirement?.trim()) return lead.requirement.trim();
  if (lead.title?.trim()) return lead.title.trim();
  if (lead.company?.trim()) return `Enquiry from ${lead.company.trim()}`;
  return `${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}`;
}

function leadSnippet(lead: LeadCardData): string {
  return lead.remarks?.trim() || lead.requirement?.trim() || "No description added yet.";
}

function locationLabel(lead: LeadCardData): string {
  return [lead.city, lead.state, lead.country].filter(Boolean).join(", ") || "—";
}

function whatsappUrl(phone: string) {
  const digits = phone.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : "#";
}

function isFollowUpOverdue(iso: string) {
  return new Date(iso).getTime() < Date.now();
}

function copyLeadDetails(lead: LeadCardData) {
  const lines = [
    `Lead ID: ${lead.leadNumber}`,
    `Name: ${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}`,
    `Company: ${lead.company || "—"}`,
    `Mobile: ${lead.phone || "—"}`,
    `Email: ${lead.email || "—"}`,
    `Location: ${locationLabel(lead)}`,
    `Source: ${lead.source || "—"}`,
    `Status: ${LEAD_STATUS_LABELS[lead.status] || lead.status}`,
  ];
  void navigator.clipboard.writeText(lines.join("\n"));
}

export function LeadCard({
  lead,
  canAssign,
  canEdit,
  assignable,
  onAssign,
}: {
  lead: LeadCardData;
  canAssign: boolean;
  canEdit: boolean;
  assignable: AssignableUser[];
  onAssign: (leadId: string, ownerId: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [showActivity, setShowActivity] = useState(true);
  const snippet = leadSnippet(lead);
  const showReadMore = snippet.length > 140;
  const progress = lead.progressPercent ?? 0;
  const overdue = lead.nextFollowUp ? isFollowUpOverdue(lead.nextFollowUp.scheduledAt) : false;

  return (
    <article className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden hover:border-slate-300 transition-colors">
      <div className="flex flex-col lg:flex-row">
        {/* Main content */}
        <div className="flex-1 min-w-0 p-4 lg:p-5 border-b lg:border-b-0 lg:border-r border-slate-100">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-start gap-2 min-w-0 flex-1">
              <h3 className="text-sm font-semibold text-blue-700 leading-snug line-clamp-2">
                {leadHeading(lead)}
              </h3>
              {canEdit && (
                <TenantLink
                  href={`/dashboard/leads/${lead.id}/edit`}
                  className="shrink-0 p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-blue-600"
                  title="Edit lead"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </TenantLink>
              )}
            </div>
          </div>

          <p className={cn("text-xs text-slate-600 leading-relaxed mb-3", !expanded && showReadMore && "line-clamp-2")}>
            {snippet}
          </p>
          {showReadMore && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="text-xs font-medium text-blue-600 hover:underline mb-3 inline-flex items-center gap-0.5"
            >
              {expanded ? (
                <>Show less <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Read More <ChevronDown className="h-3 w-3" /></>
              )}
            </button>
          )}

          {/* Score & attempts row */}
          <div className="flex flex-wrap items-center gap-4 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-semibold uppercase tracking-wide text-slate-400">Lead Score</span>
              <span className={cn(
                "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold",
                lead.score >= 70 ? "bg-emerald-50 text-emerald-700" : lead.score >= 40 ? "bg-amber-50 text-amber-700" : "bg-slate-100 text-slate-600"
              )}>
                <Sparkles className="h-3 w-3" />
                {lead.score > 0 ? lead.score : "N/A"}
              </span>
            </div>
            {!lead.firstResponseAt && lead.slaBreached && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-red-50 text-red-700">
                SLA breached
              </span>
            )}
            {!lead.firstResponseAt && !lead.slaBreached && lead.slaDueAt && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-sky-50 text-sky-700">
                Due {formatRelativeTime(lead.slaDueAt)}
              </span>
            )}
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span><strong className="text-slate-700">{lead.callAttempts ?? 0}</strong> Call Attempts</span>
              <span><strong className="text-slate-700">{lead.meetingAttempts ?? 0}</strong> Meeting Attempts</span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="mb-4">
            <div className="flex items-center justify-between text-[10px] text-slate-400 mb-1">
              <span>Pipeline progress</span>
              <span>{progress}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
              <div
                className={cn(
                  "h-full rounded-full transition-all",
                  progress >= 80 ? "bg-emerald-500" : progress >= 40 ? "bg-blue-500" : "bg-slate-400"
                )}
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          {/* Primary actions */}
          <div className="flex flex-wrap gap-2 mb-4">
            <TenantLink
              href={`/dashboard/quotations/new?leadId=${lead.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
            >
              <FileText className="h-3.5 w-3.5" /> Send Quotation
            </TenantLink>
            {canEdit && (
              <TenantLink
                href={`/dashboard/leads/${lead.id}/edit`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700"
              >
                Update
              </TenantLink>
            )}
            {lead.email && (
              <a
                href={`mailto:${lead.email}`}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-slate-700 text-xs font-medium hover:bg-slate-50"
              >
                <Mail className="h-3.5 w-3.5" /> Email Reply
              </a>
            )}
          </div>

          {/* Metadata footer bar */}
          <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2.5 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-3 gap-y-2 text-[11px]">
            <div>
              <p className="text-slate-400 mb-0.5 flex items-center gap-1">
                <Calendar className="h-3 w-3" /> Next Follow-up
              </p>
              <p className={cn("font-medium flex items-center gap-1", overdue ? "text-red-600" : "text-slate-800")}>
                {overdue && <span className="h-1.5 w-1.5 rounded-full bg-red-500 shrink-0" />}
                {lead.nextFollowUp
                  ? formatDate(lead.nextFollowUp.scheduledAt)
                  : "Not scheduled"}
              </p>
            </div>
            <div>
              <p className="text-slate-400 mb-0.5">Assigned to</p>
              {canAssign && assignable.length > 0 ? (
                <select
                  className="pro-input text-[11px] py-0.5 px-1 max-w-full font-medium text-blue-700"
                  value={lead.owner?.id || ""}
                  onChange={(e) => e.target.value && onAssign(lead.id, e.target.value)}
                >
                  <option value="">Unassigned</option>
                  {assignable.map((u) => (
                    <option key={u.userId} value={u.userId}>{u.name}</option>
                  ))}
                </select>
              ) : (
                <p className="font-medium text-blue-700">{lead.owner?.name || "Unassigned"}</p>
              )}
            </div>
            <div>
              <p className="text-slate-400 mb-0.5">Stage</p>
              <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase", STATUS_BADGE[lead.status] || STATUS_BADGE.new)}>
                {LEAD_STATUS_LABELS[lead.status] || lead.status}
              </span>
            </div>
            <div>
              <p className="text-slate-400 mb-0.5">Priority</p>
              <span className={cn("inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold capitalize", PRIORITY_BADGE[lead.priority] || PRIORITY_BADGE.medium)}>
                {lead.priority}
              </span>
            </div>
            <div>
              <p className="text-slate-400 mb-0.5">Source</p>
              <p className="font-medium text-slate-800 truncate">{lead.source || "—"}</p>
            </div>
          </div>

          {/* Lead ID & financials */}
          <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-[11px] text-slate-500">
            <span><span className="text-slate-400">Lead ID:</span> <span className="font-mono font-medium text-slate-700">{lead.leadNumber}</span></span>
            <span><span className="text-slate-400">Lead Date:</span> {formatDate(lead.createdAt)}</span>
            {lead.lastActivityAt && (
              <span><span className="text-slate-400">Last worked:</span> <strong className="text-slate-700">{formatRelativeTime(lead.lastActivityAt)}</strong></span>
            )}
            <span className="inline-flex items-center gap-1">
              <span className="text-slate-400">Closure Date:</span>
              {lead.expectedClosingDate ? formatDate(lead.expectedClosingDate) : "—"}
            </span>
            <span>
              <span className="text-slate-400">Deal Value:</span>{" "}
              <strong className="text-slate-800">{lead.budget != null ? formatCurrency(lead.budget) : "—"}</strong>
            </span>
          </div>

          {/* Work history preview */}
          <div className="mt-4 pt-4 border-t border-slate-100">
            <div className="flex items-center justify-between gap-2 mb-2">
              <button
                type="button"
                onClick={() => setShowActivity((v) => !v)}
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-700 hover:text-blue-700"
              >
                <History className="h-3.5 w-3.5" />
                Work & history
                {showActivity ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </button>
              <TenantLink href={`/dashboard/leads/${lead.id}?tab=activity`} className="text-[11px] font-medium text-blue-600 hover:underline">
                Log work →
              </TenantLink>
            </div>
            {lead.activityCounts && <ActivityStatChips counts={lead.activityCounts} className="mb-3" />}
            {showActivity && (
              <LeadActivityFeed
                previews={lead.recentActivity}
                compact
                limit={4}
                leadId={lead.id}
                showViewAll={(lead.recentActivity?.length || 0) >= 4}
              />
            )}
          </div>
        </div>

        {/* Contact panel */}
        <div className="w-full lg:w-[220px] shrink-0 bg-slate-50/80 p-4 flex flex-col">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-400 mb-1">
            {lead.source || "Contact"}
          </p>
          <p className="text-sm font-semibold text-slate-900 mb-3 truncate">
            {lead.company || `${lead.firstName}${lead.lastName ? ` ${lead.lastName}` : ""}`}
          </p>

          <div className="space-y-1.5 text-xs text-slate-600 mb-4 flex-1">
            {lead.phone && (
              <p><span className="text-slate-400">Mobile:</span> {lead.phone}</p>
            )}
            {lead.email && (
              <p className="truncate"><span className="text-slate-400">Email:</span> {lead.email}</p>
            )}
            <p><span className="text-slate-400">Location:</span> {locationLabel(lead)}</p>
          </div>

          {/* Quick icon actions */}
          <div className="grid grid-cols-4 gap-1 mb-3">
            <TenantLink href={`/dashboard/leads/${lead.id}`} className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-white text-slate-500 hover:text-blue-600" title="View Lead">
              <Eye className="h-4 w-4" />
              <span className="text-[9px]">View</span>
            </TenantLink>
            <button type="button" onClick={() => copyLeadDetails(lead)} className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-white text-slate-500 hover:text-blue-600" title="Copy Details">
              <Copy className="h-4 w-4" />
              <span className="text-[9px]">Copy</span>
            </button>
            {canAssign && (
              <TenantLink href={`/dashboard/leads/${lead.id}?tab=assign`} className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-white text-slate-500 hover:text-blue-600" title="Assign">
                <Users className="h-4 w-4" />
                <span className="text-[9px]">Assign</span>
              </TenantLink>
            )}
            <TenantLink href={`/dashboard/leads/${lead.id}`} className="flex flex-col items-center gap-0.5 p-2 rounded-lg hover:bg-white text-slate-500 hover:text-blue-600" title="Profile">
              <Building2 className="h-4 w-4" />
              <span className="text-[9px]">Profile</span>
            </TenantLink>
          </div>

          {/* Communication shortcuts */}
          <div className="grid grid-cols-4 gap-1.5">
            {lead.phone ? (
              <a href={`tel:${lead.phone}`} className="flex items-center justify-center p-2.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700" title="Call">
                <Phone className="h-4 w-4" />
              </a>
            ) : (
              <span className="flex items-center justify-center p-2.5 rounded-lg bg-slate-200 text-slate-400 cursor-not-allowed">
                <Phone className="h-4 w-4" />
              </span>
            )}
            {lead.phone ? (
              <a href={whatsappUrl(lead.phone)} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center p-2.5 rounded-lg bg-emerald-600 text-white hover:bg-emerald-700" title="WhatsApp">
                <MessageCircle className="h-4 w-4" />
              </a>
            ) : (
              <span className="flex items-center justify-center p-2.5 rounded-lg bg-slate-200 text-slate-400 cursor-not-allowed">
                <MessageCircle className="h-4 w-4" />
              </span>
            )}
            {lead.email ? (
              <a href={`mailto:${lead.email}`} className="flex items-center justify-center p-2.5 rounded-lg bg-slate-700 text-white hover:bg-slate-800" title="Email">
                <Mail className="h-4 w-4" />
              </a>
            ) : (
              <span className="flex items-center justify-center p-2.5 rounded-lg bg-slate-200 text-slate-400 cursor-not-allowed">
                <Mail className="h-4 w-4" />
              </span>
            )}
            <TenantLink href={`/dashboard/pipeline`} className="flex items-center justify-center p-2.5 rounded-lg bg-violet-600 text-white hover:bg-violet-700" title="Deals">
              <Handshake className="h-4 w-4" />
            </TenantLink>
          </div>

          {/* Footer actions */}
          <div className="mt-3 pt-3 border-t border-slate-200 flex items-center justify-between">
            <TenantLink
              href={`/dashboard/leads/${lead.id}?tab=timeline`}
              className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 hover:underline"
            >
              <History className="h-3.5 w-3.5" /> Lead History
            </TenantLink>
            <div className="flex items-center gap-0.5 text-slate-400">
              <button type="button" className="p-1 rounded hover:bg-white hover:text-amber-500" title="Star">
                <Star className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="p-1 rounded hover:bg-white hover:text-emerald-600" title="Good lead">
                <ThumbsUp className="h-3.5 w-3.5" />
              </button>
              <button type="button" className="p-1 rounded hover:bg-white hover:text-red-500" title="Poor lead">
                <ThumbsDown className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}
