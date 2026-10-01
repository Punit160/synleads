"use client";

import { useEffect, useState } from "react";
import { X, ExternalLink, Copy, CheckCircle2, Loader2 } from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { BtnPrimary, BtnSecondary } from "@/components/ui/dashboard-ui";
import { cn } from "@/lib/utils";
import { WEBHOOK_API_KEY_HEADER } from "@/lib/brand";

type IntegrationField = {
  key: string;
  label: string;
  type: "text" | "password" | "number" | "url" | "select";
  placeholder?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  help?: string;
};

export type IntegrationDetail = {
  id: string;
  name: string;
  category: string;
  summary: string;
  status: "connected" | "disconnected";
  steps: string[];
  fields: IntegrationField[];
  config: Record<string, string | number>;
  docsUrl?: string | null;
  webhookUrl?: string | null;
  leadApiKey?: string | null;
  webhookHeader?: string;
  workspaceId?: string;
  workspaceName?: string;
  workspaceSlug?: string | null;
  portalUrl?: string | null;
  inboundAddress?: string | null;
  inboundWebhookUrl?: string | null;
  lastError?: string | null;
  imapReady?: boolean;
};

export function IntegrationSetupModal({
  integrationId,
  onClose,
  onSaved,
}: {
  integrationId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [detail, setDetail] = useState<IntegrationDetail | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    setLoading(true);
    apiFetch<IntegrationDetail>(`/api/integrations/${integrationId}`)
      .then((d) => {
        setDetail(d);
        const initial: Record<string, string> = {};
        for (const f of d.fields) {
          const v = d.config[f.key];
          initial[f.key] = v != null ? String(v) : "";
        }
        setForm(initial);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, [integrationId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !saving) onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, saving]);

  function copyText(label: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  async function save(alsoTest = false) {
    if (!detail) return;
    setSaving(true);
    setError("");
    setMessage("");
    try {
      const config: Record<string, unknown> = {};
      for (const f of detail.fields) {
        const v = form[f.key]?.trim();
        if (v) config[f.key] = f.type === "number" ? Number(v) : v;
      }
      await apiFetch(`/api/integrations/${integrationId}`, {
        method: "PUT",
        body: JSON.stringify({ config, enabled: true }),
      });
      const refreshed = await apiFetch<IntegrationDetail>(`/api/integrations/${integrationId}`);
      setDetail(refreshed);
      if (alsoTest) {
        setTesting(true);
        const test = await apiFetch<{ message: string }>(`/api/integrations/${integrationId}/test`, {
          method: "POST",
        });
        setMessage(test.message);
      } else {
        setMessage(
          refreshed.inboundAddress
            ? `Saved. Forward lead emails to ${refreshed.inboundAddress}`
            : "Integration saved successfully."
        );
      }
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Save failed");
    } finally {
      setSaving(false);
      setTesting(false);
    }
  }

  async function fetchInbox() {
    setSyncing(true);
    setError("");
    setMessage("");
    try {
      const result = await apiFetch<{ message: string }>(`/api/integrations/${integrationId}/sync`, { method: "POST" });
      setMessage(result.message);
      const refreshed = await apiFetch<IntegrationDetail>(`/api/integrations/${integrationId}`);
      setDetail(refreshed);
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Fetch failed");
    } finally {
      setSyncing(false);
    }
  }

  async function disconnect() {
    if (!confirm("Disconnect this integration? Saved credentials will be removed.")) return;
    setSaving(true);
    try {
      await apiFetch(`/api/integrations/${integrationId}/disconnect`, { method: "POST" });
      onSaved();
      onClose();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Disconnect failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50" onClick={() => !saving && onClose()}>
      <div
        className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 px-5 py-4 border-b border-slate-200">
          <div>
            <p className="text-xs text-slate-500 uppercase tracking-wide">{detail?.category || "Integration"}</p>
            <h2 className="text-lg font-semibold text-slate-900">{detail?.name || "Configure integration"}</h2>
            {detail && (
              <span
                className={cn(
                  "inline-flex mt-1 text-xs font-medium px-2 py-0.5 rounded-full",
                  detail.status === "connected" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"
                )}
              >
                {detail.status === "connected" ? "Connected" : "Not connected"}
              </span>
            )}
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-slate-100 text-slate-500" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 px-5 py-4 space-y-5">
          {loading && <p className="text-sm text-slate-500">Loading…</p>}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {message && (
            <p className="text-sm text-emerald-700 flex items-center gap-1.5">
              <CheckCircle2 className="h-4 w-4" /> {message}
            </p>
          )}

          {detail && !loading && (
            <>
              <p className="text-sm text-slate-600">{detail.summary}</p>
              {detail.portalUrl && (
                <p className="text-xs text-slate-500">
                  Company portal: <span className="font-medium text-slate-700">{detail.portalUrl}</span>
                </p>
              )}

              <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-4">
                <p className="text-sm font-medium text-slate-900 mb-2">Setup procedure</p>
                <ol className="list-decimal list-inside space-y-1.5 text-sm text-slate-700">
                  {detail.steps.map((step, i) => (
                    <li key={i}>{step}</li>
                  ))}
                </ol>
                {detail.docsUrl && (
                  <a
                    href={detail.docsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:underline mt-3"
                  >
                    External documentation <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>

              {detail.webhookUrl && (
                <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 space-y-2 text-sm">
                  <p className="font-medium text-slate-900">
                    {detail.id === "email_inbox" ? "This company's inbound email URL" : "This company's webhook URL"}
                  </p>
                  <div className="flex gap-2 items-start">
                    <code className="flex-1 text-xs break-all bg-white border border-slate-200 rounded px-2 py-1.5">{detail.webhookUrl}</code>
                    <button
                      type="button"
                      onClick={() => copyText("url", detail.webhookUrl!)}
                      className="shrink-0 p-1.5 rounded border border-slate-200 hover:bg-white"
                      title="Copy URL"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  {detail.leadApiKey && detail.id !== "email_inbox" ? (
                    <p className="text-xs text-slate-600">
                      Header <code className="bg-white px-1 rounded">{detail.webhookHeader || WEBHOOK_API_KEY_HEADER}</code>:{" "}
                      <code className="bg-white px-1 rounded">{detail.leadApiKey}</code>
                      <button type="button" onClick={() => copyText("key", detail.leadApiKey!)} className="ml-1 text-blue-600 hover:underline text-xs">
                        {copied === "key" ? "Copied" : "Copy key"}
                      </button>
                    </p>
                  ) : detail.id === "email_inbox" ? (
                    <p className="text-xs text-slate-600">
                      Only this company receives mail posted here. Do not share this URL with another workspace.
                    </p>
                  ) : (
                    <p className="text-xs text-amber-700">
                      Your company API key loads automatically on the Integrations page. Refresh if missing.
                    </p>
                  )}
                  {copied === "url" && <p className="text-xs text-emerald-600">URL copied</p>}
                </div>
              )}

              {detail.id === "email_inbox" && (
                <div className="rounded-lg border border-emerald-100 bg-emerald-50/50 p-4 space-y-2 text-sm">
                  <p className="font-medium text-slate-900">Forward lead emails here</p>
                  {detail.inboundAddress ? (
                    <>
                      <div className="flex gap-2 items-start">
                        <code className="flex-1 text-xs break-all bg-white border border-slate-200 rounded px-2 py-1.5">{detail.inboundAddress}</code>
                        <button
                          type="button"
                          onClick={() => copyText("inbound", detail.inboundAddress!)}
                          className="shrink-0 p-1.5 rounded border border-slate-200 hover:bg-white"
                          title="Copy inbound address"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <p className="text-xs text-slate-600">
                        Forward from {detail.config.captureEmail || "your inbox"} to this company-specific address. Mail for this address is imported only into this workspace.
                      </p>
                      {copied === "inbound" && <p className="text-xs text-emerald-600">Inbound address copied</p>}
                    </>
                  ) : (
                    <p className="text-xs text-slate-600">Save the company inbox first to generate a unique inbound address.</p>
                  )}
                  {detail.lastError && <p className="text-xs text-rose-600">Last mailbox error: {detail.lastError}</p>}
                </div>
              )}

              {detail.fields.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-medium text-slate-900">Connection settings</p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    {detail.fields.map((f) => (
                      <div key={f.key} className={f.type === "password" || f.key.includes("notes") ? "sm:col-span-2" : ""}>
                        <label className="block text-xs font-medium text-slate-600 mb-1">
                          {f.label}
                          {f.required && <span className="text-rose-500"> *</span>}
                        </label>
                        {f.type === "select" ? (
                          <select
                            className="pro-input w-full"
                            value={form[f.key] || ""}
                            onChange={(e) => {
                              const next = { ...form, [f.key]: e.target.value };
                              if (integrationId === "email_inbox" && f.key === "provider") {
                                if (e.target.value === "gmail") {
                                  next.imapHost = "imap.gmail.com";
                                  next.imapPort = "993";
                                } else if (e.target.value === "outlook") {
                                  next.imapHost = "outlook.office365.com";
                                  next.imapPort = "993";
                                } else if (e.target.value === "yahoo") {
                                  next.imapHost = "imap.mail.yahoo.com";
                                  next.imapPort = "993";
                                }
                              }
                              setForm(next);
                            }}
                          >
                            <option value="">Select…</option>
                            {f.options?.map((o) => (
                              <option key={o.value} value={o.value}>{o.label}</option>
                            ))}
                          </select>
                        ) : (
                          <input
                            type={f.type === "password" ? "password" : f.type === "number" ? "number" : "text"}
                            className="pro-input w-full"
                            placeholder={f.placeholder}
                            value={form[f.key] || ""}
                            onChange={(e) => setForm({ ...form, [f.key]: e.target.value })}
                          />
                        )}
                        {f.help && <p className="text-xs text-slate-500 mt-0.5">{f.help}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-5 py-4 border-t border-slate-200 flex flex-wrap gap-2 justify-end bg-slate-50">
          {detail?.status === "connected" && (
            <BtnSecondary onClick={disconnect} className="!text-rose-600 mr-auto">
              Disconnect
            </BtnSecondary>
          )}
          {detail?.id === "email_inbox" && detail.status === "connected" && detail.imapReady && (
            <BtnSecondary onClick={fetchInbox} className={syncing ? "opacity-50 pointer-events-none" : ""}>
              {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Fetch now"}
            </BtnSecondary>
          )}
          <BtnSecondary onClick={onClose} className={saving ? "opacity-50 pointer-events-none" : ""}>Cancel</BtnSecondary>
          {detail && detail.fields.length > 0 && (
            <>
              <BtnSecondary onClick={() => save(false)} className={saving || loading ? "opacity-50 pointer-events-none" : ""}>
                {saving && !testing ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
              </BtnSecondary>
              <BtnPrimary onClick={() => save(true)} className={saving || loading ? "opacity-50 pointer-events-none" : ""}>
                {saving && testing ? "Testing…" : "Save & connect"}
              </BtnPrimary>
            </>
          )}
          {detail && detail.fields.length === 0 && detail.webhookUrl && (
            <BtnPrimary onClick={onClose}>Done</BtnPrimary>
          )}
        </div>
      </div>
    </div>
  );
}
