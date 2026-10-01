"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { TenantLink } from "@/components/ui/tenant-link";
import {
  Plug,
  Mail,
  Inbox,
  MessageCircle,
  Smartphone,
  Globe,
  Zap,
  Megaphone,
  Facebook,
  Linkedin,
  Copy,
  CheckCircle2,
  Settings2,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { PageHeader, Panel, BtnSecondary, StatusDot } from "@/components/ui/dashboard-ui";
import { IntegrationSetupModal } from "@/components/integrations/integration-setup-modal";
import { cn } from "@/lib/utils";
import { WEBHOOK_API_KEY_HEADER } from "@/lib/brand";
import { formatDate } from "@/lib/api";

type IntegrationItem = {
  id: string;
  name: string;
  category: string;
  summary: string;
  status: "connected" | "disconnected";
  lastSync: string | null;
  steps: string[];
};

type AutomationSettings = {
  workspaceId: string;
  workspaceName: string;
  autoAssignEnabled: boolean;
  autoAssignMode: string;
  leadApiKey: string | null;
  webhookUrl: string;
  webhookHeader?: string;
  webhookHint: string;
};

type IntegrationsResponse = {
  workspaceId: string;
  workspaceName: string;
  workspaceSlug?: string | null;
  leadApiKey: string | null;
  webhookUrl: string;
  webhookHeader: string;
  loginPath?: string | null;
  portalPath?: string | null;
  portalUrl?: string | null;
  integrations: IntegrationItem[];
};

const CATEGORY_ORDER = ["Communication", "Lead Source", "Automation"] as const;

const ICONS: Record<string, typeof Mail> = {
  email: Mail,
  email_inbox: Inbox,
  whatsapp: MessageCircle,
  sms: Smartphone,
  indiamart: Megaphone,
  google_ads: Megaphone,
  facebook: Facebook,
  linkedin: Linkedin,
  website: Globe,
  zapier: Zap,
};

function IntegrationCard({
  item,
  canConfigure,
  onConfigure,
}: {
  item: IntegrationItem;
  canConfigure: boolean;
  onConfigure: () => void;
}) {
  const Icon = ICONS[item.id] || Plug;
  const connected = item.status === "connected";

  return (
    <div
      className={cn(
        "rounded-xl border p-4 flex flex-col h-full transition-shadow hover:shadow-sm",
        connected ? "border-emerald-200 bg-emerald-50/30" : "border-slate-200 bg-white"
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className={cn(
              "h-10 w-10 rounded-lg flex items-center justify-center shrink-0",
              connected ? "bg-emerald-100 text-emerald-700" : "bg-slate-100 text-slate-600"
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="font-semibold text-slate-900 text-sm truncate">{item.name}</p>
            <p className="text-[11px] text-slate-500">{item.category}</p>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 shrink-0">
          <StatusDot status={connected ? "connected" : "disconnected"} />
          <span className={cn("text-[11px] font-medium", connected ? "text-emerald-700" : "text-slate-500")}>
            {connected ? "Connected" : "Not connected"}
          </span>
        </span>
      </div>

      <p className="text-xs text-slate-600 flex-1 mb-3 line-clamp-3">{item.summary}</p>

      {item.lastSync && (
        <p className="text-[10px] text-slate-400 mb-2">Last sync: {formatDate(item.lastSync)}</p>
      )}

      <div className="flex flex-wrap gap-2 mt-auto pt-2 border-t border-slate-100">
        {canConfigure ? (
          <button
            type="button"
            onClick={onConfigure}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:underline"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {connected ? "Manage setup" : "Connect & setup"}
          </button>
        ) : (
          <span className="text-[11px] text-slate-400">Ask your company admin to connect</span>
        )}
      </div>
    </div>
  );
}

export function IntegrationsHub() {
  const auth = useAuth();
  const canConfigure = auth.hasPermission("manage_users");

  const [items, setItems] = useState<IntegrationItem[]>([]);
  const [automation, setAutomation] = useState<AutomationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [configureId, setConfigureId] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [autoBusy, setAutoBusy] = useState(false);

  const [tenant, setTenant] = useState<{
    workspaceId: string;
    workspaceName: string;
    workspaceSlug?: string | null;
    leadApiKey: string | null;
    webhookUrl: string;
    portalUrl?: string | null;
  } | null>(null);

  const load = useCallback(async () => {
    const [integrationsRes, auto] = await Promise.all([
      apiFetch<IntegrationsResponse>("/api/integrations"),
      canConfigure
        ? apiFetch<AutomationSettings>("/api/workspace/automation").catch(() => null)
        : Promise.resolve(null),
    ]);
    setItems(integrationsRes.integrations);
    setTenant({
      workspaceId: integrationsRes.workspaceId,
      workspaceName: integrationsRes.workspaceName,
      workspaceSlug: integrationsRes.workspaceSlug,
      leadApiKey: integrationsRes.leadApiKey,
      webhookUrl: integrationsRes.webhookUrl,
      portalUrl: integrationsRes.portalUrl,
    });
    setAutomation(auto);
  }, [canConfigure]);

  useEffect(() => {
    load()
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [load]);

  function copyText(key: string, text: string) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    });
  }

  const connectedCount = items.filter((i) => i.status === "connected").length;
  const grouped = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    items: items.filter((i) => i.category === cat),
  })).filter((g) => g.items.length > 0);

  if (loading) {
    return <p className="text-sm text-slate-500 p-6">Loading integrations…</p>;
  }

  return (
    <div className="max-w-5xl space-y-5">
      <PageHeader
        meta="Company portal"
        title="Integrations"
        description={
          canConfigure
            ? `Connect your company's email, messaging, ad platforms, and forms to ${auth.workspace?.name || "your workspace"}. Each integration includes a step-by-step setup guide.`
            : `View which integrations are active for ${auth.workspace?.name || "your company"}. Your admin connects services from this page.`
        }
      />

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-xs text-slate-500">Connected</p>
          <p className="text-2xl font-bold text-slate-900">{connectedCount}</p>
          <p className="text-[11px] text-slate-400">of {items.length} available</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 sm:col-span-3 flex items-center gap-3">
          <Plug className="h-8 w-8 text-blue-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-semibold text-slate-900">{tenant?.workspaceName || auth.workspace?.name}</p>
            <p className="text-xs text-slate-500 mt-0.5">
              Connect email, ads, forms, and messaging for {tenant?.workspaceName || "your company"} only. Lead data is never shared with another workspace.
            </p>
          </div>
        </div>
      </div>

      {canConfigure && (tenant?.leadApiKey || automation?.leadApiKey) && (
        <Panel title="Lead capture credentials" subtitle="These URLs belong only to this company portal">
          <div className="space-y-3 text-sm p-4">
            {tenant?.portalUrl && (
              <div>
                <p className="text-[11px] font-medium text-slate-500 mb-1">Company portal</p>
                <code className="block text-xs break-all bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                  {tenant.portalUrl}
                </code>
              </div>
            )}
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">Company webhook URL</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs break-all bg-slate-50 border border-slate-200 rounded px-2 py-1.5">
                  {tenant?.webhookUrl || automation?.webhookUrl}
                </code>
                <BtnSecondary onClick={() => copyText("wh", tenant?.webhookUrl || automation?.webhookUrl || "")} className="!text-xs shrink-0">
                  {copied === "wh" ? "Copied" : "Copy"}
                </BtnSecondary>
              </div>
              <p className="text-[11px] text-slate-500 mt-1">Includes your company slug so inbound leads stay in this workspace.</p>
            </div>
            <div>
              <p className="text-[11px] font-medium text-slate-500 mb-1">API key (header: {automation?.webhookHeader || WEBHOOK_API_KEY_HEADER})</p>
              <div className="flex gap-2">
                <code className="flex-1 text-xs break-all bg-slate-50 border border-slate-200 rounded px-2 py-1.5 font-medium text-slate-800">
                  {tenant?.leadApiKey || automation?.leadApiKey}
                </code>
                <BtnSecondary onClick={() => copyText("key", tenant?.leadApiKey || automation?.leadApiKey || "")} className="!text-xs shrink-0">
                  {copied === "key" ? "Copied" : "Copy key"}
                </BtnSecondary>
              </div>
            </div>
          </div>
        </Panel>
      )}

      {canConfigure && automation && (
        <Panel title="Inbound lead automation" subtitle="Automatically assign leads when they arrive via webhook">
          <div className="space-y-4 text-sm p-4">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={automation.autoAssignEnabled}
                disabled={autoBusy}
                onChange={async (e) => {
                  setAutoBusy(true);
                  try {
                    const updated = await apiFetch<AutomationSettings>("/api/workspace/automation", {
                      method: "PATCH",
                      body: JSON.stringify({ autoAssignEnabled: e.target.checked }),
                    });
                    setAutomation((a) => (a ? { ...a, ...updated } : a));
                  } finally {
                    setAutoBusy(false);
                  }
                }}
                className="rounded border-slate-300"
              />
              <span>
                <strong className="text-slate-900">Auto-assign inbound leads</strong>
                <span className="block text-xs text-slate-500">Uses your assignment rules, then round-robin fallback</span>
              </span>
            </label>
            <BtnSecondary
              onClick={async () => {
                if (!confirm("Regenerate API key? Update IndiaMART, website forms, and Zapier with the new key.")) return;
                setAutoBusy(true);
                try {
                  const r = await apiFetch<{ leadApiKey: string }>("/api/workspace/automation/regenerate-key", {
                    method: "POST",
                  });
                  setAutomation((a) => (a ? { ...a, leadApiKey: r.leadApiKey } : a));
                  await load();
                } finally {
                  setAutoBusy(false);
                }
              }}
              className={cn("!inline-flex text-xs", autoBusy && "opacity-50 pointer-events-none")}
            >
              Regenerate company API key
            </BtnSecondary>
          </div>
        </Panel>
      )}

      {!canConfigure && (
        <Panel title="Company admin required">
          <p className="text-sm text-slate-600">
            Only your company admin can connect integrations and generate API keys. You can view connection status below.
            See the{" "}
            <TenantLink href="/dashboard/manual" className="text-blue-600 hover:underline">
              User Manual
            </TenantLink>{" "}
            for overview of each integration.
          </p>
        </Panel>
      )}

      {grouped.map(({ category, items: catItems }) => (
        <div key={category}>
          <h2 className="text-sm font-semibold text-slate-900 mb-3">{category}</h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {catItems.map((item) => (
              <IntegrationCard
                key={item.id}
                item={item}
                canConfigure={canConfigure}
                onConfigure={() => setConfigureId(item.id)}
              />
            ))}
          </div>
        </div>
      ))}

      <Panel title="Need help connecting?">
        <ul className="text-sm text-slate-600 space-y-2 list-disc list-inside">
          <li>Click <strong>Connect & setup</strong> on any card — a guided wizard opens with step-by-step instructions.</li>
          <li>For email marketing: connect <strong>Email Inbox (Lead capture)</strong> so enquiry emails become leads automatically.</li>
          <li>For Website, IndiaMART, Facebook, Google Ads, and LinkedIn — use your company webhook URL and unique API key above.</li>
          <li>Full documentation: <TenantLink href="/dashboard/manual" className="text-blue-600 hover:underline">User Manual → Integrations</TenantLink></li>
        </ul>
      </Panel>

      {configureId && canConfigure && (
        <IntegrationSetupModal
          integrationId={configureId}
          onClose={() => setConfigureId(null)}
          onSaved={() => load().catch(console.error)}
        />
      )}
    </div>
  );
}
