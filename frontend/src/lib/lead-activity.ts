import type { LucideIcon } from "lucide-react";
import {
  Phone,
  Mail,
  MessageCircle,
  CalendarClock,
  FileText,
  Paperclip,
  UserPlus,
  RefreshCw,
  StickyNote,
  Sparkles,
  CheckCircle2,
  Clock,
} from "lucide-react";

export type UnifiedActivityItem = {
  id: string;
  kind: "timeline" | "note" | "communication" | "followup" | "attachment";
  at: string;
  title: string;
  description?: string | null;
  userName?: string | null;
  status?: "done" | "scheduled" | "overdue";
  channel?: string;
  followUpType?: string;
};

export type LeadActivityPreview = {
  id: string;
  type: string;
  title: string;
  description: string | null;
  createdAt: string;
  userName: string | null;
};

export type LeadActivityCounts = {
  timeline: number;
  notes: number;
  communications: number;
  followUps: number;
  pendingFollowUps: number;
  attachments: number;
};

type LeadActivitySource = {
  timeline: Array<{ id: string; type: string; title: string; description: string | null; createdAt: string; user: { name: string } | null }>;
  leadNotes: Array<{ id: string; content: string; createdAt: string; author: { name: string } | null }>;
  communications: Array<{ id: string; channel: string; direction: string; subject: string | null; body: string | null; createdAt: string; owner: { name: string } | null }>;
  followUps: Array<{ id: string; type: string; scheduledAt: string; notes: string | null; completed: boolean; owner: { name: string } | null }>;
  attachments: Array<{ id: string; fileName: string; uploadedAt: string }>;
};

export function mergeLeadActivity(lead: LeadActivitySource): UnifiedActivityItem[] {
  const items: UnifiedActivityItem[] = [];

  for (const e of lead.timeline) {
    items.push({
      id: `tl-${e.id}`,
      kind: "timeline",
      at: e.createdAt,
      title: e.title,
      description: e.description,
      userName: e.user?.name,
    });
  }

  for (const n of lead.leadNotes) {
    items.push({
      id: `note-${n.id}`,
      kind: "note",
      at: n.createdAt,
      title: "Note added",
      description: n.content,
      userName: n.author?.name,
    });
  }

  for (const c of lead.communications) {
    items.push({
      id: `comm-${c.id}`,
      kind: "communication",
      at: c.createdAt,
      title: `${c.channel} ${c.direction}`,
      description: c.subject || c.body,
      userName: c.owner?.name,
      channel: c.channel,
    });
  }

  for (const f of lead.followUps) {
    const overdue = !f.completed && new Date(f.scheduledAt).getTime() < Date.now();
    items.push({
      id: `fu-${f.id}`,
      kind: "followup",
      at: f.scheduledAt,
      title: f.completed ? `${f.type} follow-up completed` : `${f.type} follow-up scheduled`,
      description: f.notes,
      userName: f.owner?.name,
      status: f.completed ? "done" : overdue ? "overdue" : "scheduled",
      followUpType: f.type,
    });
  }

  for (const a of lead.attachments) {
    items.push({
      id: `att-${a.id}`,
      kind: "attachment",
      at: a.uploadedAt,
      title: "File attached",
      description: a.fileName,
    });
  }

  items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

  const seen = new Set<string>();
  return items.filter((item) => {
    const key = `${item.kind}:${item.title}:${item.at.slice(0, 16)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function activityIcon(type: string, kind?: UnifiedActivityItem["kind"]): LucideIcon {
  if (kind === "note") return StickyNote;
  if (kind === "attachment") return Paperclip;
  if (kind === "communication") return MessageCircle;
  if (kind === "followup") return CalendarClock;
  if (type === "communication") return MessageCircle;
  if (type === "follow_up") return CalendarClock;
  if (type === "note") return StickyNote;
  if (type === "attachment") return Paperclip;
  if (type === "assigned") return UserPlus;
  if (type === "converted") return RefreshCw;
  if (type === "status_change") return Sparkles;
  if (type === "created") return Sparkles;
  if (type.includes("call")) return Phone;
  if (type.includes("email")) return Mail;
  return Clock;
}

export function activityColor(type: string, kind?: UnifiedActivityItem["kind"], status?: UnifiedActivityItem["status"]) {
  if (status === "overdue") return "bg-red-100 text-red-700 border-red-200";
  if (status === "done") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  if (kind === "communication" || type === "communication") return "bg-violet-50 text-violet-700 border-violet-200";
  if (kind === "followup" || type === "follow_up") return "bg-cyan-50 text-cyan-700 border-cyan-200";
  if (kind === "note" || type === "note") return "bg-amber-50 text-amber-800 border-amber-200";
  if (type === "assigned") return "bg-blue-50 text-blue-700 border-blue-200";
  if (type === "converted") return "bg-emerald-50 text-emerald-700 border-emerald-200";
  return "bg-slate-100 text-slate-700 border-slate-200";
}

export function previewToUnified(p: LeadActivityPreview): UnifiedActivityItem {
  return {
    id: p.id,
    kind: "timeline",
    at: p.createdAt,
    title: p.title,
    description: p.description,
    userName: p.userName,
  };
}

export function totalWorkCount(counts: LeadActivityCounts): number {
  return counts.notes + counts.communications + counts.followUps + counts.attachments;
}
