"use client";

import { useEffect, useState } from "react";
import { Loader2, StickyNote, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";

export type LeadNoteTarget = {
  id: string;
  leadNumber: string;
  name: string;
};

type Props = {
  lead: LeadNoteTarget | null;
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
};

export function LeadNoteModal({ lead, open, onClose, onSaved }: Props) {
  const [content, setContent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setContent("");
      setError("");
    }
  }, [open, lead?.id]);

  if (!open || !lead) return null;

  async function save() {
    if (!content.trim() || !lead) return;
    setBusy(true);
    setError("");
    try {
      await apiFetch(`/api/leads/${lead.id}/notes`, {
        method: "POST",
        body: JSON.stringify({ content: content.trim() }),
      });
      onSaved?.();
      onClose();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to save note");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40"
      onClick={(e) => {
        if (e.target === e.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="w-full max-w-md rounded-xl bg-white shadow-xl border border-slate-200 overflow-hidden"
        role="dialog"
        aria-labelledby="lead-note-title"
      >
        <div className="flex items-start justify-between gap-3 px-4 py-3 border-b border-slate-100 bg-gradient-to-r from-amber-50/80 to-white">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <StickyNote className="h-4 w-4 text-amber-600 shrink-0" />
              <h2 id="lead-note-title" className="text-sm font-semibold text-slate-900">
                Add note
              </h2>
            </div>
            <p className="text-xs text-slate-500 mt-0.5 truncate">
              {lead.leadNumber} · {lead.name}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="p-1 rounded-lg hover:bg-slate-100 text-slate-400"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <textarea
            autoFocus
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Conversation summary, next steps, internal context..."
            className="pro-input w-full min-h-[120px] text-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                void save();
              }
            }}
          />
          {error && <p className="text-xs text-red-600">{error}</p>}
          <p className="text-[10px] text-slate-400">Tip: Ctrl+Enter to save</p>
        </div>

        <div className="flex items-center justify-end gap-2 px-4 py-3 border-t border-slate-100 bg-slate-50/60">
          <button type="button" onClick={onClose} disabled={busy} className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-white border border-transparent hover:border-slate-200">
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void save()}
            disabled={busy || !content.trim()}
            className="pro-btn-primary text-sm inline-flex items-center gap-1.5"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Save note
          </button>
        </div>
      </div>
    </div>
  );
}
