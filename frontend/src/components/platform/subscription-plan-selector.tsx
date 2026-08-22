"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, ArrowUpCircle, CreditCard, X } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { formatPlatformCurrency } from "@/components/platform/platform-shell";
import { cn } from "@/lib/utils";

export type SubscriptionQuote = {
  allowed: boolean;
  changeType: string;
  reason?: string;
  currentPackage: string;
  targetPackage: string;
  currentLabel: string;
  targetLabel: string;
  currentPriceInr: number;
  targetPriceInr: number;
  remainingDays: number;
  remainingMonths: number;
  creditInr: number;
  chargeInr: number;
  listPriceInr: number;
  newExpiresAt: string;
  keepsExpiry: boolean;
  breakdown: string;
};

type PlanOption = {
  package: string;
  label: string;
  allowed: boolean;
  changeType: string;
  chargeInr: number;
  creditInr: number;
  remainingDays: number;
  reason?: string;
  breakdown?: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function changeTypeLabel(type: string) {
  switch (type) {
    case "upgrade":
      return "Prorated upgrade";
    case "trial_conversion":
      return "Trial conversion";
    case "renewal":
      return "Renewal";
    case "no_change":
      return "Current plan";
    default:
      return type;
  }
}

export function SubscriptionPlanSelector({
  workspaceId,
  currentPackage,
  disabled,
  onSuccess,
  compact,
}: {
  workspaceId: string;
  currentPackage: string;
  disabled?: boolean;
  onSuccess?: () => void;
  compact?: boolean;
}) {
  const [options, setOptions] = useState<PlanOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingPkg, setPendingPkg] = useState<string | null>(null);
  const [quote, setQuote] = useState<SubscriptionQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [applying, setApplying] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  useEffect(() => {
    setLoading(true);
    apiFetch<{ options: PlanOption[] }>(`/api/platform/companies/${workspaceId}/subscription/options`)
      .then((data) => setOptions(data.options))
      .catch(() => setOptions([]))
      .finally(() => setLoading(false));
  }, [workspaceId, currentPackage]);

  async function openQuote(targetPackage: string) {
    if (targetPackage === currentPackage) return;
    setPendingPkg(targetPackage);
    setQuoteLoading(true);
    setError("");
    try {
      const q = await apiFetch<SubscriptionQuote>(
        `/api/platform/companies/${workspaceId}/subscription/quote?package=${encodeURIComponent(targetPackage)}`
      );
      setQuote(q);
      if (!q.allowed) setError(q.reason || "Plan change not allowed");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to load quote");
      setQuote(null);
    } finally {
      setQuoteLoading(false);
    }
  }

  async function confirmChange() {
    if (!pendingPkg || !quote?.allowed) return;
    setApplying(true);
    setError("");
    setSuccessMsg("");
    try {
      const result = await apiFetch<{ interestCleared?: boolean }>(`/api/platform/companies/${workspaceId}/subscription`, {
        method: "PUT",
        body: JSON.stringify({ package: pendingPkg }),
      });
      if (result.interestCleared) {
        setSuccessMsg("Plan updated. Package interest removed automatically.");
        await new Promise((r) => setTimeout(r, 1400));
      }
      setPendingPkg(null);
      setQuote(null);
      setSuccessMsg("");
      onSuccess?.();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Failed to apply plan change");
    } finally {
      setApplying(false);
    }
  }

  function closeModal() {
    setPendingPkg(null);
    setQuote(null);
    setError("");
  }

  if (loading) {
    return <p className="text-xs text-slate-400">Loading plans...</p>;
  }

  return (
    <>
      <select
        className={cn("pro-input text-xs py-1 px-1.5", compact ? "block w-full" : "")}
        value={currentPackage}
        disabled={disabled}
        onChange={(e) => {
          const val = e.target.value;
          if (val !== currentPackage) openQuote(val);
          e.target.value = currentPackage;
        }}
      >
        {options.map((opt) => (
          <option key={opt.package} value={opt.package} disabled={!opt.allowed && opt.package !== currentPackage}>
            {opt.package === currentPackage ? `● ${opt.label}` : opt.label}
            {opt.allowed && opt.package !== currentPackage && opt.chargeInr > 0
              ? ` — pay ${formatPlatformCurrency(opt.chargeInr)}`
              : ""}
            {!opt.allowed && opt.package !== currentPackage ? " (not available)" : ""}
          </option>
        ))}
      </select>

      {pendingPkg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-xl max-w-md w-full overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-blue-600" />
                <h3 className="font-semibold text-slate-900">Confirm plan change</h3>
              </div>
              <button type="button" onClick={closeModal} className="p-1 rounded hover:bg-slate-100 text-slate-400">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-5 space-y-4">
              {quoteLoading ? (
                <p className="text-sm text-slate-500">Calculating amount...</p>
              ) : quote ? (
                <>
                  <div className="rounded-lg bg-slate-50 border border-slate-200 p-3 space-y-2 text-sm">
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">Change type</span>
                      <span className="font-medium text-slate-900">{changeTypeLabel(quote.changeType)}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">From</span>
                      <span className="text-slate-800 text-right text-xs">{quote.currentLabel}</span>
                    </div>
                    <div className="flex justify-between gap-2">
                      <span className="text-slate-500">To</span>
                      <span className="font-medium text-blue-700 text-right text-xs">{quote.targetLabel}</span>
                    </div>

                    {quote.changeType === "upgrade" && (
                      <>
                        <div className="border-t border-slate-200 pt-2 flex justify-between gap-2">
                          <span className="text-slate-500">Time remaining</span>
                          <span className="font-medium tabular-nums">
                            {quote.remainingDays} days (~{quote.remainingMonths} mo)
                          </span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">Credit (unused plan)</span>
                          <span className="text-emerald-700 font-medium tabular-nums">−{formatPlatformCurrency(quote.creditInr)}</span>
                        </div>
                        <div className="flex justify-between gap-2">
                          <span className="text-slate-500">New plan list price / yr</span>
                          <span className="tabular-nums">{formatPlatformCurrency(quote.listPriceInr)}</span>
                        </div>
                      </>
                    )}

                    {quote.changeType === "renewal" || quote.changeType === "trial_conversion" ? (
                      <div className="flex justify-between gap-2">
                        <span className="text-slate-500">Yearly price</span>
                        <span className="tabular-nums">{formatPlatformCurrency(quote.listPriceInr)}</span>
                      </div>
                    ) : null}

                    <div className="border-t border-slate-200 pt-2 flex justify-between gap-2">
                      <span className="font-semibold text-slate-900">Amount to collect</span>
                      <span className="text-lg font-bold text-emerald-700 tabular-nums">{formatPlatformCurrency(quote.chargeInr)}</span>
                    </div>

                    <div className="flex justify-between gap-2 text-xs">
                      <span className="text-slate-500">{quote.keepsExpiry ? "Expiry (unchanged)" : "New expiry"}</span>
                      <span className="font-medium">{formatDate(quote.newExpiresAt)}</span>
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 leading-relaxed">{quote.breakdown}</p>

                  {!quote.allowed && quote.reason && (
                    <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      {quote.reason}
                    </div>
                  )}
                </>
              ) : null}

              {successMsg && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-xs text-emerald-800">
                  {successMsg}
                </div>
              )}

              {error && (
                <div className="flex gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}
            </div>

            <div className="px-5 py-4 border-t border-slate-200 flex gap-2 justify-end bg-slate-50">
              <button type="button" onClick={closeModal} className="px-4 py-2 rounded-lg border border-slate-200 text-sm text-slate-600 hover:bg-white">
                Cancel
              </button>
              <button
                type="button"
                disabled={!quote?.allowed || applying || quoteLoading}
                onClick={confirmChange}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <ArrowUpCircle className="h-4 w-4" />
                {applying ? "Applying..." : quote ? `Confirm · ${formatPlatformCurrency(quote.chargeInr)}` : "Confirm"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
