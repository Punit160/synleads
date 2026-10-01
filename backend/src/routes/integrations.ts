import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";
import { ensureWorkspaceLeadApiKey } from "../lib/workspace-lead-key";
import { WEBHOOK_API_KEY_HEADER } from "../lib/brand";
import { ensureWorkspaceSlug } from "../lib/workspace-slug";
import { tenantPortalLoginUrl, companyWebhookUrl, companyPortalUrl } from "../lib/tenant-url";
import {
  INTEGRATION_CATALOG,
  INTEGRATION_CONFIG_SCHEMAS,
  INTEGRATION_IDS,
  getCatalogItem,
  isIntegrationConnected,
  maskIntegrationConfig,
  type IntegrationId,
} from "../lib/integration-catalog";
import {
  applyImapProviderDefaults,
  generateInboundToken,
  hasImapCredentials,
  inboundAddressForToken,
  inboundWebhookUrl,
  pollWorkspaceInbox,
  testImapConnection,
  type EmailInboxConfig,
} from "../lib/inbound-email";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function publicWebhookUrl(slug?: string | null): string | null {
  if (!slug) return null;
  return companyWebhookUrl(slug, "leads");
}

const WEBHOOK_INTEGRATIONS = ["website", "zapier", "google_ads", "facebook", "linkedin", "indiamart"] as const;

function inboxExtras(id: string, config: Record<string, unknown>, slug?: string | null) {
  if (id !== "email_inbox" || !slug) {
    return {};
  }
  const inbox = config as EmailInboxConfig;
  const token = typeof inbox.inboundToken === "string" ? inbox.inboundToken : null;
  return {
    inboundAddress: token ? inboundAddressForToken(slug, token) : null,
    inboundWebhookUrl: inboundWebhookUrl(slug, token),
    lastError: typeof inbox.lastError === "string" ? inbox.lastError : null,
    imapReady: hasImapCredentials(inbox),
  };
}

async function loadWorkspaceIntegrationContext(workspaceId: string) {
  const [rows, workspace] = await Promise.all([
    prisma.workspaceIntegration.findMany({ where: { workspaceId } }),
    prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { leadApiKey: true, name: true, id: true, slug: true },
    }),
  ]);
  const leadApiKey = workspace ? await ensureWorkspaceLeadApiKey(workspace.id) : null;
  const workspaceSlug = workspace
    ? workspace.slug || (await ensureWorkspaceSlug(workspace.id, workspace.name))
    : null;
  const byId = new Map(rows.map((r) => [r.integrationId, r]));
  const hasLeadApiKey = !!leadApiKey;
  return {
    byId,
    hasLeadApiKey,
    leadApiKey,
    workspaceId: workspace?.id ?? workspaceId,
    workspaceName: workspace?.name ?? "Workspace",
    workspaceSlug,
  };
}

function buildConnectionList(
  byId: Map<string, { config: unknown; lastSyncAt: Date | null; connectedAt: Date | null; enabled: boolean }>,
  hasLeadApiKey: boolean
) {
  return INTEGRATION_CATALOG.map((item) => {
    const row = byId.get(item.id);
    const config = (row?.config as Record<string, unknown>) || {};
    const connected = isIntegrationConnected(item.id as IntegrationId, config, { hasLeadApiKey });
    return {
      id: item.id,
      name: item.name,
      category: item.category,
      status: connected ? ("connected" as const) : ("disconnected" as const),
      lastSync: row?.lastSyncAt?.toISOString() ?? null,
      connectedAt: row?.connectedAt?.toISOString() ?? null,
    };
  });
}

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const { byId, hasLeadApiKey, leadApiKey, workspaceId, workspaceName, workspaceSlug } =
      await loadWorkspaceIntegrationContext(ctx.workspace.id);

    const integrations = INTEGRATION_CATALOG.map((item) => {
      const row = byId.get(item.id);
      const config = (row?.config as Record<string, unknown>) || {};
      const connected = isIntegrationConnected(item.id as IntegrationId, config, { hasLeadApiKey });
      return {
        id: item.id,
        name: item.name,
        category: item.category,
        summary: item.summary,
        status: connected ? "connected" : "disconnected",
        enabled: row?.enabled ?? connected,
        config: maskIntegrationConfig(config),
        lastSync: row?.lastSyncAt?.toISOString() ?? null,
        connectedAt: row?.connectedAt?.toISOString() ?? null,
        steps: item.steps,
        fields: item.fields,
        docsUrl: item.docsUrl ?? null,
        webhookUrl: WEBHOOK_INTEGRATIONS.includes(item.id as (typeof WEBHOOK_INTEGRATIONS)[number])
          ? publicWebhookUrl(workspaceSlug)
          : item.id === "email_inbox" && workspaceSlug
            ? inboundWebhookUrl(workspaceSlug, typeof config.inboundToken === "string" ? config.inboundToken : null)
            : null,
        leadApiKey: WEBHOOK_INTEGRATIONS.includes(item.id as (typeof WEBHOOK_INTEGRATIONS)[number])
          ? leadApiKey
          : null,
        portalUrl: workspaceSlug ? companyPortalUrl(workspaceSlug) : null,
        ...inboxExtras(item.id, config, workspaceSlug),
        workspaceId,
        workspaceName,
      };
    });

    res.json({
      workspaceId,
      workspaceName,
      workspaceSlug,
      leadApiKey,
      webhookUrl: publicWebhookUrl(workspaceSlug),
      webhookHeader: WEBHOOK_API_KEY_HEADER,
      loginPath: workspaceSlug ? tenantPortalLoginUrl(workspaceSlug) : null,
      portalPath: workspaceSlug ? `/${workspaceSlug}/dashboard` : null,
      portalUrl: workspaceSlug ? companyPortalUrl(workspaceSlug) : null,
      integrations,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/connections", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const { byId, hasLeadApiKey } = await loadWorkspaceIntegrationContext(ctx.workspace.id);
    res.json(buildConnectionList(byId, hasLeadApiKey));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const id = param(req, "id");
    const catalog = getCatalogItem(id);
    if (!catalog) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    const { byId, hasLeadApiKey, leadApiKey, workspaceId, workspaceName, workspaceSlug } =
      await loadWorkspaceIntegrationContext(ctx.workspace.id);
    const row = byId.get(id);
    const config = (row?.config as Record<string, unknown>) || {};
    const connected = isIntegrationConnected(id as IntegrationId, config, { hasLeadApiKey });

    res.json({
      ...catalog,
      status: connected ? "connected" : "disconnected",
      enabled: row?.enabled ?? connected,
      config: maskIntegrationConfig(config),
      rawConfigKeys: Object.keys(config),
      lastSync: row?.lastSyncAt?.toISOString() ?? null,
      webhookUrl:
        id === "email_inbox" && workspaceSlug
          ? inboundWebhookUrl(workspaceSlug, typeof config.inboundToken === "string" ? config.inboundToken : null)
          : WEBHOOK_INTEGRATIONS.includes(id as (typeof WEBHOOK_INTEGRATIONS)[number])
            ? publicWebhookUrl(workspaceSlug)
            : null,
      leadApiKey: WEBHOOK_INTEGRATIONS.includes(id as (typeof WEBHOOK_INTEGRATIONS)[number]) ? leadApiKey : null,
      webhookHeader: WEBHOOK_API_KEY_HEADER,
      workspaceId,
      workspaceName,
      workspaceSlug,
      loginPath: workspaceSlug ? tenantPortalLoginUrl(workspaceSlug) : null,
      portalUrl: workspaceSlug ? companyPortalUrl(workspaceSlug) : null,
      ...inboxExtras(id, config, workspaceSlug),
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");

    const id = param(req, "id");
    if (!INTEGRATION_IDS.includes(id as IntegrationId)) {
      res.status(404).json({ error: "Integration not found" });
      return;
    }

    const body = z
      .object({
        config: z.record(z.unknown()),
        enabled: z.boolean().optional(),
      })
      .parse(req.body);

    const schema = INTEGRATION_CONFIG_SCHEMAS[id as IntegrationId];
    const parsed = schema.parse(body.config) as Record<string, unknown>;

    const existing = await prisma.workspaceIntegration.findUnique({
      where: { workspaceId_integrationId: { workspaceId: ctx.workspace.id, integrationId: id } },
    });

    const merged: Record<string, unknown> = { ...((existing?.config as Record<string, unknown>) || {}), ...parsed };
    for (const [k, v] of Object.entries(body.config)) {
      if (typeof v === "string" && v.startsWith("****") && existing?.config) {
        const prev = (existing.config as Record<string, unknown>)[k];
        if (typeof prev === "string") merged[k] = prev;
      }
    }

    if (id === "email_inbox") {
      Object.assign(merged, applyImapProviderDefaults(merged as EmailInboxConfig));
      if (!merged.inboundToken) merged.inboundToken = generateInboundToken();
    }

    const ws = await prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: { leadApiKey: true },
    });
    const connected = isIntegrationConnected(id as IntegrationId, merged, { hasLeadApiKey: !!ws?.leadApiKey });

    const jsonConfig = merged as Prisma.InputJsonValue;

    const row = await prisma.workspaceIntegration.upsert({
      where: { workspaceId_integrationId: { workspaceId: ctx.workspace.id, integrationId: id } },
      create: {
        workspaceId: ctx.workspace.id,
        integrationId: id,
        config: jsonConfig,
        enabled: body.enabled ?? connected,
        connectedAt: connected ? new Date() : null,
        lastSyncAt: connected ? new Date() : null,
      },
      update: {
        config: jsonConfig,
        enabled: body.enabled ?? connected,
        connectedAt: connected ? new Date() : undefined,
        lastSyncAt: connected ? new Date() : undefined,
      },
    });

    res.json({
      id,
      status: connected ? "connected" : "disconnected",
      config: maskIntegrationConfig(merged),
      connectedAt: row.connectedAt?.toISOString() ?? null,
      ...inboxExtras(id, merged, (await ensureWorkspaceSlug(ctx.workspace.id, ctx.workspace.name))),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0]?.message || "Invalid configuration" });
      return;
    }
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

router.post("/:id/disconnect", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");

    const id = param(req, "id");
    await prisma.workspaceIntegration.deleteMany({
      where: { workspaceId: ctx.workspace.id, integrationId: id },
    });
    res.json({ success: true, status: "disconnected" });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

router.post("/:id/sync", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");
    const id = param(req, "id");
    if (id !== "email_inbox") {
      res.status(400).json({ error: "Fetch is only available for Email Inbox" });
      return;
    }
    const result = await pollWorkspaceInbox(ctx.workspace.id, "catchup");
    if (result.error && result.processed === 0 && result.created === 0 && result.attached === 0) {
      res.status(400).json({ error: result.error, ...result });
      return;
    }
    res.json({
      ok: true,
      message: result.error
        ? result.error
        : `Checked mailbox: ${result.created} new lead${result.created === 1 ? "" : "s"}, ${result.attached} updated, ${result.skipped} skipped.`,
      ...result,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Sync failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

router.post("/:id/test", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");

    const id = param(req, "id");
    const row = await prisma.workspaceIntegration.findUnique({
      where: { workspaceId_integrationId: { workspaceId: ctx.workspace.id, integrationId: id } },
    });
    const config = (row?.config as Record<string, unknown>) || {};
    const ws = await prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: { leadApiKey: true },
    });

    const connected = isIntegrationConnected(id as IntegrationId, config, { hasLeadApiKey: !!ws?.leadApiKey });
    if (!connected) {
      res.status(400).json({ error: "Complete required fields before testing" });
      return;
    }

    if (id === "email_inbox") {
      const inbox = config as EmailInboxConfig;
      if (hasImapCredentials(inbox)) {
        const test = await testImapConnection(inbox);
        if (!test.ok) {
          res.status(400).json({ error: test.error });
          return;
        }
      }
      await prisma.workspaceIntegration.updateMany({
        where: { workspaceId: ctx.workspace.id, integrationId: id },
        data: { lastSyncAt: new Date() },
      });
      const slug = await ensureWorkspaceSlug(ctx.workspace.id, ctx.workspace.name);
      const token = inbox.inboundToken;
      res.json({
        ok: true,
        message: hasImapCredentials(inbox)
          ? "Mailbox connected. New enquiry emails will be imported as leads."
          : token
            ? `Inbox ready. Forward lead emails to ${inboundAddressForToken(slug, token)}.`
            : "Inbox saved. Save again if the inbound address is missing.",
        ...inboxExtras(id, config, slug),
      });
      return;
    }

    await prisma.workspaceIntegration.updateMany({
      where: { workspaceId: ctx.workspace.id, integrationId: id },
      data: { lastSyncAt: new Date() },
    });

    res.json({
      ok: true,
      message:
        id === "email"
          ? "SMTP settings saved. Live send will use these credentials when email dispatch is enabled."
          : "Configuration validated and marked as connected.",
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Test failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

export default router;
