import { Router } from "express";
import multer from "multer";
import type { Prisma } from "@prisma/client";
import { prisma } from "../lib/prisma";
import { readWebhookApiKey } from "../lib/brand";
import {
  extractInboundToken,
  findEmailInboxForWorkspace,
  processInboundEmailMessage,
  type EmailInboxConfig,
  type InboundEmailPayload,
} from "../lib/inbound-email";
import { ensureWorkspaceSlug } from "../lib/workspace-slug";

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

function str(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (Array.isArray(value) && typeof value[0] === "string") return value[0].trim();
  return undefined;
}

function payloadFromBody(body: Record<string, unknown>): InboundEmailPayload {
  const text =
    str(body.text) ||
    str(body["body-plain"]) ||
    str(body["stripped-text"]) ||
    str(body.plain) ||
    str(body.TextBody);
  const html = str(body.html) || str(body["body-html"]) || str(body["stripped-html"]) || str(body.HtmlBody);
  return {
    from: str(body.from) || str(body.sender) || str(body.From) || str(body.FromFull),
    to: str(body.to) || str(body.recipient) || str(body.To) || str(body.envelope),
    subject: str(body.subject) || str(body.Subject),
    text,
    html,
    messageId: str(body.headers) ? undefined : str(body["Message-Id"]) || str(body.messageId) || str(body["message-id"]),
    autoSubmitted: str(body.autoSubmitted),
  };
}

async function resolveWorkspaceBySlug(slug: string) {
  const ws = await prisma.workspace.findFirst({
    where: { slug, status: "active" },
    select: { id: true, userId: true, name: true, slug: true, leadApiKey: true, status: true },
  });
  if (!ws) return null;
  if (!ws.slug) {
    const resolved = await ensureWorkspaceSlug(ws.id, ws.name);
    return { ...ws, slug: resolved };
  }
  return ws;
}

async function resolveCompanyInbox(
  slug: string,
  req: { headers: Record<string, unknown>; query: Record<string, unknown>; body: Record<string, unknown> }
) {
  const workspace = await resolveWorkspaceBySlug(slug);
  if (!workspace || workspace.status !== "active") return null;

  const row = await findEmailInboxForWorkspace(workspace.id);
  if (!row || !row.enabled || row.workspace.status !== "active") return null;

  const config = (row.config as EmailInboxConfig) || {};
  const token =
    str(req.query.token) ||
    str(req.headers["x-inbound-token"]) ||
    str(req.body.token) ||
    extractInboundToken(str(req.body.to) || str(req.body.recipient) || str(req.body.To) || str(req.query.to));
  const apiKey = readWebhookApiKey(req.headers, req.query.key);

  const tokenOk = !!token && token === config.inboundToken;
  const keyOk = !!apiKey && apiKey === workspace.leadApiKey;
  if (!tokenOk && !keyOk) return null;

  return row;
}

router.post("/inbound-email", (_req, res) => {
  res.status(400).json({
    error: "Use your company inbound URL: /api/public/{company-slug}/inbound-email",
  });
});

router.post("/:slug/inbound-email", upload.any(), async (req, res) => {
  try {
    const slug = String(req.params.slug || "");
    const body = (req.body || {}) as Record<string, unknown>;
    const row = await resolveCompanyInbox(slug, {
      headers: req.headers as Record<string, unknown>,
      query: req.query as Record<string, unknown>,
      body,
    });
    if (!row) {
      res.status(401).json({ error: "Unknown company mailbox. Use this company's inbound URL and key." });
      return;
    }

    const payload = payloadFromBody(body);
    if (!payload.from && !payload.text && !payload.html && !payload.subject) {
      res.status(400).json({ error: "Email payload is empty" });
      return;
    }

    const config = (row.config as EmailInboxConfig) || {};
    const result = await processInboundEmailMessage(row.workspace, config, payload);

    await prisma.workspaceIntegration.update({
      where: { workspaceId_integrationId: { workspaceId: row.workspace.id, integrationId: "email_inbox" } },
      data: { config: result.config as Prisma.InputJsonValue, lastSyncAt: new Date() },
    });

    if (result.skipped) {
      res.status(202).json({ skipped: true, reason: result.skipped });
      return;
    }

    res.status(result.created ? 201 : 200).json({
      id: result.leadId,
      leadNumber: result.leadNumber,
      created: !!result.created,
      attached: !!result.attached,
      workspaceSlug: row.workspace.slug,
    });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : "Failed to import email" });
  }
});

export default router;
