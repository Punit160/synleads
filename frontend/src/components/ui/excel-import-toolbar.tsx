"use client";

import { useEffect, useRef, useState } from "react";
import {
  Download,
  Upload,
  FileSpreadsheet,
  X,
  CheckCircle2,
  AlertCircle,
  FileUp,
} from "lucide-react";
import { apiFetch, apiUpload, ApiError } from "@/lib/api";
import { BtnSecondary } from "@/components/ui/dashboard-ui";
import { cn } from "@/lib/utils";

type ImportResult = { imported: number; duplicates: number; errors?: string[] };

type AssignableUser = { userId: string; name: string };

export function ExcelImportToolbar({
  apiBase,
  entityLabel,
  canImport,
  onImported,
  assignable,
  importOwnerId: _externalOwnerId,
  onImportOwnerChange: _externalOwnerChange,
  className,
}: {
  apiBase: string;
  entityLabel: string;
  canImport: boolean;
  onImported?: () => void;
  assignable?: AssignableUser[];
  /** @deprecated handled inside modal */
  importOwnerId?: string;
  /** @deprecated handled inside modal */
  onImportOwnerChange?: (id: string) => void;
  className?: string;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [ownerId, setOwnerId] = useState("");
  const [fileName, setFileName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error" | "info">("info");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !busy) closeModal();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy]);

  if (!canImport) return null;

  function resetForm() {
    setOwnerId("");
    setFileName("");
    setFile(null);
    setMessage("");
    setMessageType("info");
    if (fileRef.current) fileRef.current.value = "";
  }

  function closeModal() {
    if (busy) return;
    setOpen(false);
    resetForm();
  }

  function downloadTemplate() {
    window.open(`${apiBase}/import-template`, "_blank");
  }

  function onFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked) return;
    setFile(picked);
    setFileName(picked.name);
    setMessage("");
  }

  async function runImport() {
    if (!file) {
      setMessage("Please choose a CSV or Excel file first.");
      setMessageType("error");
      return;
    }
    setBusy(true);
    setMessage("Importing your data…");
    setMessageType("info");
    try {
      const ext = file.name.split(".").pop()?.toLowerCase();
      let result: ImportResult;
      if (ext === "csv") {
        const csv = await file.text();
        const body: { csv: string; ownerId?: string } = { csv };
        if (ownerId) body.ownerId = ownerId;
        result = await apiFetch<ImportResult>(`${apiBase}/import`, {
          method: "POST",
          body: JSON.stringify(body),
        });
      } else if (ext === "xlsx" || ext === "xls") {
        const fd = new FormData();
        fd.append("file", file);
        if (ownerId) fd.append("ownerId", ownerId);
        result = await apiUpload<ImportResult>(`${apiBase}/import-excel`, fd);
      } else {
        setMessage("Use CSV or Excel (.xlsx, .xls) files only.");
        setMessageType("error");
        setBusy(false);
        return;
      }
      const errNote =
        result.errors && result.errors.length > 0
          ? ` ${result.errors.length} row warning(s).`
          : "";
      setMessage(
        `Done — ${result.imported} ${entityLabel.toLowerCase()} imported, ${result.duplicates} duplicates skipped.${errNote}`
      );
      setMessageType("success");
      onImported?.();
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : "Import failed. Check your file and try again.");
      setMessageType("error");
    } finally {
      setBusy(false);
    }
  }

  const showAssign = assignable && assignable.length > 0;

  return (
    <>
      <BtnSecondary
        onClick={() => setOpen(true)}
        className={cn("!inline-flex shrink-0", className)}
      >
        <Upload className="h-4 w-4" />
        Import
      </BtnSecondary>

      {open && (
        <div
          className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/45"
          onClick={(e) => {
            if (e.target === e.currentTarget && !busy) closeModal();
          }}
        >
          <div
            className="bg-white w-full sm:max-w-lg sm:rounded-xl rounded-t-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 bg-slate-50/80 shrink-0">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                    <FileSpreadsheet className="h-4 w-4 text-blue-700" />
                  </div>
                  <div>
                    <h2 id="import-modal-title" className="font-semibold text-slate-900">
                      Import {entityLabel}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Upload Excel or CSV with your existing data
                    </p>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                disabled={busy}
                className="p-2 rounded-lg hover:bg-slate-200/60 text-slate-400 hover:text-slate-600 shrink-0 disabled:opacity-40"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body — scrollable on small screens */}
            <div className="flex-1 overflow-y-auto px-5 py-5 space-y-5">
              {/* Step 1 */}
              <div className="rounded-xl border border-slate-200 p-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-600 mb-1">
                  Step 1
                </p>
                <p className="text-sm font-medium text-slate-900 mb-1">Download sample template</p>
                <p className="text-xs text-slate-500 mb-3 leading-relaxed">
                  The Excel file includes required columns (marked with *), example rows, and a
                  column guide sheet. Match that format when preparing your data.
                </p>
                <button
                  type="button"
                  onClick={downloadTemplate}
                  className="inline-flex items-center gap-2 rounded-lg border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-medium text-blue-800 hover:bg-blue-100 transition-colors w-full sm:w-auto justify-center"
                >
                  <Download className="h-4 w-4" />
                  Download sample Excel
                </button>
              </div>

              {/* Step 2 — assign (optional) */}
              {showAssign && (
                <div className="space-y-1.5">
                  <label htmlFor="import-owner" className="block text-sm font-medium text-slate-700">
                    Assign imported records to
                  </label>
                  <select
                    id="import-owner"
                    className="pro-input w-full text-sm py-2.5"
                    value={ownerId}
                    onChange={(e) => setOwnerId(e.target.value)}
                    disabled={busy}
                  >
                    <option value="">Me (current user)</option>
                    {assignable!.map((u) => (
                      <option key={u.userId} value={u.userId}>
                        {u.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Step 3 — file */}
              <div className="space-y-1.5">
                <label htmlFor="import-file" className="block text-sm font-medium text-slate-700">
                  {showAssign ? "Step 2 — Upload file" : "Step 2 — Upload file"}
                </label>
                <input
                  ref={fileRef}
                  id="import-file"
                  type="file"
                  accept=".csv,.xlsx,.xls"
                  className="sr-only"
                  onChange={onFilePick}
                  disabled={busy}
                />
                <button
                  type="button"
                  onClick={() => fileRef.current?.click()}
                  disabled={busy}
                  className={cn(
                    "w-full rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors",
                    fileName
                      ? "border-emerald-300 bg-emerald-50/50"
                      : "border-slate-200 bg-slate-50/50 hover:border-blue-300 hover:bg-blue-50/30"
                  )}
                >
                  {fileName ? (
                    <>
                      <CheckCircle2 className="h-8 w-8 text-emerald-600 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-900 truncate">{fileName}</p>
                      <p className="text-xs text-slate-500 mt-1">Tap to choose a different file</p>
                    </>
                  ) : (
                    <>
                      <FileUp className="h-8 w-8 text-slate-400 mx-auto mb-2" />
                      <p className="text-sm font-medium text-slate-700">
                        Click to choose Excel or CSV
                      </p>
                      <p className="text-xs text-slate-400 mt-1">.xlsx, .xls, or .csv</p>
                    </>
                  )}
                </button>
              </div>

              {/* Result message */}
              {message && (
                <div
                  className={cn(
                    "flex items-start gap-2.5 rounded-lg px-3.5 py-3 text-sm",
                    messageType === "success" && "bg-emerald-50 border border-emerald-200 text-emerald-800",
                    messageType === "error" && "bg-rose-50 border border-rose-200 text-rose-800",
                    messageType === "info" && "bg-slate-50 border border-slate-200 text-slate-700"
                  )}
                >
                  {messageType === "success" ? (
                    <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : messageType === "error" ? (
                    <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  ) : (
                    <Upload className="h-4 w-4 shrink-0 mt-0.5 animate-pulse" />
                  )}
                  <p className="leading-relaxed">{message}</p>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 px-5 py-4 border-t border-slate-200 bg-slate-50/50 shrink-0">
              <button
                type="button"
                onClick={closeModal}
                disabled={busy}
                className="pro-btn-secondary w-full sm:w-auto justify-center disabled:opacity-50"
              >
                {messageType === "success" ? "Close" : "Cancel"}
              </button>
              <button
                type="button"
                onClick={runImport}
                disabled={busy || !file}
                className="pro-btn-primary w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {busy ? "Importing…" : "Import now"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/** @deprecated Help text is now inside the import modal */
export function ImportHelpBanner(_props: { entityLabel: string }) {
  return null;
}
