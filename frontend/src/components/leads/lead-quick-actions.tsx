"use client";

import { useState } from "react";
import { Phone, Mail, MessageCircle, CalendarClock, StickyNote, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { FOLLOWUP_TYPES } from "@/lib/lead-constants";

type Props = {
  leadId: string;
  phone: string | null;
  onRefresh: () => Promise<void>;
  compact?: boolean;
};

export function LeadQuickActions({ leadId, phone, onRefresh, compact }: Props) {
  const [mode, setMode] = useState<"note" | "call" | "email" | "followup" | null>(null);
  const [busy, setBusy] = useState(false);
  const [noteText, setNoteText] = useState("");
  const [callNotes, setCallNotes] = useState("");
  const [emailSubject, setEmailSubject] = useState("");
  const [emailBody, setEmailBody] = useState("");
  const [followUp, setFollowUp] = useState({ type: "call", scheduledAt: "", notes: "" });

  async function submit(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
      setMode(null);
      setNoteText("");
      setCallNotes("");
      setEmailSubject("");
      setEmailBody("");
      setFollowUp({ type: "call", scheduledAt: "", notes: "" });
      await onRefresh();
    } finally {
      setBusy(false);
    }
  }

  async function addNote() {
    if (!noteText.trim()) return;
    await submit(async () => {
      const { apiFetch } = await import("@/lib/api");
      await apiFetch(`/api/leads/${leadId}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: noteText.trim() }),
      });
    });
  }

  async function logCall() {
    await submit(async () => {
      const { apiFetch } = await import("@/lib/api");
      await apiFetch("/api/communications", {
        method: "POST",
        body: JSON.stringify({
          leadId,
          channel: "call",
          direction: "outbound",
          subject: "Phone call",
          body: callNotes || "Call logged",
          phoneNumber: phone,
        }),
      });
    });
  }

  async function logEmail() {
    await submit(async () => {
      const { apiFetch } = await import("@/lib/api");
      await apiFetch("/api/communications", {
        method: "POST",
        body: JSON.stringify({
          leadId,
          channel: "email",
          direction: "outbound",
          subject: emailSubject || "Email sent",
          body: emailBody,
        }),
      });
    });
  }

  async function scheduleFollowUp(e: React.FormEvent) {
    e.preventDefault();
    if (!followUp.scheduledAt) return;
    await submit(async () => {
      const { apiFetch } = await import("@/lib/api");
      await apiFetch("/api/followups", {
        method: "POST",
        body: JSON.stringify({
          leadId,
          type: followUp.type,
          scheduledAt: followUp.scheduledAt,
          notes: followUp.notes,
          reminderAt: followUp.scheduledAt,
        }),
      });
    });
  }

  const btn = cn(
    "inline-flex items-center gap-1.5 rounded-lg border text-xs font-medium transition-colors",
    compact ? "px-2.5 py-1.5" : "px-3 py-2"
  );

  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white", compact ? "p-3" : "p-4")}>
      <p className={cn("font-semibold text-slate-800 mb-2", compact ? "text-xs" : "text-sm")}>Log work on this lead</p>
      <div className="flex flex-wrap gap-2 mb-3">
        {[
          { id: "call" as const, label: "Log Call", icon: Phone },
          { id: "email" as const, label: "Log Email", icon: Mail },
          { id: "note" as const, label: "Add Note", icon: StickyNote },
          { id: "followup" as const, label: "Schedule", icon: CalendarClock },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            type="button"
            onClick={() => setMode(mode === id ? null : id)}
            className={cn(
              btn,
              mode === id ? "border-blue-500 bg-blue-50 text-blue-700" : "border-slate-200 bg-slate-50 text-slate-700 hover:bg-white"
            )}
          >
            <Icon className="h-3.5 w-3.5" /> {label}
          </button>
        ))}
        {phone && (
          <a href={`tel:${phone}`} className={cn(btn, "border-blue-600 bg-blue-600 text-white hover:bg-blue-700")}>
            <Phone className="h-3.5 w-3.5" /> Call now
          </a>
        )}
        {phone && (
          <a
            href={`https://wa.me/${phone.replace(/\D/g, "")}`}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(btn, "border-emerald-600 bg-emerald-600 text-white hover:bg-emerald-700")}
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </a>
        )}
      </div>

      {mode === "note" && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder="What happened? Conversation summary, next steps..."
            className="pro-input w-full min-h-[72px] text-sm"
          />
          <button type="button" onClick={addNote} disabled={busy || !noteText.trim()} className="pro-btn-primary text-xs">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save note"}
          </button>
        </div>
      )}

      {mode === "call" && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <textarea
            value={callNotes}
            onChange={(e) => setCallNotes(e.target.value)}
            placeholder="Call outcome, who answered, next action..."
            className="pro-input w-full min-h-[72px] text-sm"
          />
          <button type="button" onClick={logCall} disabled={busy} className="pro-btn-primary text-xs">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Log call"}
          </button>
        </div>
      )}

      {mode === "email" && (
        <div className="space-y-2 pt-2 border-t border-slate-100">
          <input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder="Subject" className="pro-input w-full text-sm" />
          <textarea value={emailBody} onChange={(e) => setEmailBody(e.target.value)} placeholder="Email summary..." className="pro-input w-full min-h-[72px] text-sm" />
          <button type="button" onClick={logEmail} disabled={busy} className="pro-btn-primary text-xs">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Log email"}
          </button>
        </div>
      )}

      {mode === "followup" && (
        <form onSubmit={scheduleFollowUp} className="space-y-2 pt-2 border-t border-slate-100">
          <div className="grid sm:grid-cols-2 gap-2">
            <select value={followUp.type} onChange={(e) => setFollowUp({ ...followUp, type: e.target.value })} className="pro-input text-sm">
              {FOLLOWUP_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
            <input
              type="datetime-local"
              required
              value={followUp.scheduledAt}
              onChange={(e) => setFollowUp({ ...followUp, scheduledAt: e.target.value })}
              className="pro-input text-sm"
            />
          </div>
          <textarea value={followUp.notes} onChange={(e) => setFollowUp({ ...followUp, notes: e.target.value })} placeholder="Follow-up agenda..." className="pro-input w-full min-h-[60px] text-sm" />
          <button type="submit" disabled={busy} className="pro-btn-primary text-xs">
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Schedule follow-up"}
          </button>
        </form>
      )}
    </div>
  );
}
