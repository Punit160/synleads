import crypto from "crypto";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { ingestInboundLead } from "./inbound-lead";
import { parseLeadFromEmail, extractEmailAddress, htmlToText } from "./email-lead-parser";
import { companyWebhookUrl } from "./tenant-url";

export type EmailInboxConfig = {
  captureEmail?: string;
  provider?: string;
  imapHost?: string;
  imapPort?: number | string;
  imapUser?: string;
  imapPassword?: string;
  mailbox?: string;
  inboundToken?: string;
  lastUid?: number;
  processedMessageIds?: string[];
  lastError?: string | null;
};

const MAX_PROCESSED_IDS = 250;

export function inboundMailDomain(): string {
  return (
    process.env.MAIL_INBOUND_DOMAIN?.trim() ||
    process.env.APP_DOMAIN?.split(":")[0]?.trim() ||
    "inbound.synentrixflow.local"
  );
}

export function inboundWebhookUrl(slug: string, token?: string | null): string {
  const url = companyWebhookUrl(slug, "inbound-email");
  if (!token) return url;
  const withToken = new URL(url);
  withToken.searchParams.set("token", token);
  return withToken.toString();
}

export function inboundAddressForToken(slug: string, token: string): string {
  return `${slug}.${token}@${inboundMailDomain()}`;
}

export function generateInboundToken(): string {
  return crypto.randomBytes(12).toString("hex");
}

export function applyImapProviderDefaults(config: EmailInboxConfig): EmailInboxConfig {
  const next = { ...config };
  if (next.provider === "gmail") {
    next.imapHost = next.imapHost || "imap.gmail.com";
    next.imapPort = next.imapPort || 993;
  } else if (next.provider === "outlook") {
    next.imapHost = next.imapHost || "outlook.office365.com";
    next.imapPort = next.imapPort || 993;
  } else if (next.provider === "yahoo") {
    next.imapHost = next.imapHost || "imap.mail.yahoo.com";
    next.imapPort = next.imapPort || 993;
  }
  return next;
}

export function hasImapCredentials(config: EmailInboxConfig): boolean {
  const withDefaults = applyImapProviderDefaults(config);
  return !!(withDefaults.imapHost && withDefaults.imapUser && withDefaults.imapPassword);
}

function rememberMessageId(config: EmailInboxConfig, messageId: string | undefined): EmailInboxConfig {
  if (!messageId) return config;
  const ids = [...(config.processedMessageIds || [])];
  if (ids.includes(messageId)) return config;
  ids.push(messageId);
  return { ...config, processedMessageIds: ids.slice(-MAX_PROCESSED_IDS) };
}

export async function findEmailInboxForWorkspace(workspaceId: string) {
  return prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationId: { workspaceId, integrationId: "email_inbox" } },
    include: {
      workspace: { select: { id: true, userId: true, name: true, slug: true, status: true, leadApiKey: true } },
    },
  });
}

export function extractInboundToken(recipient: string | undefined | null): string | undefined {
  if (!recipient) return undefined;
  const m = recipient.match(/\.([a-f0-9]{24})@/i) || recipient.match(/leads-([a-f0-9]{16,32})@/i);
  return m?.[1]?.toLowerCase();
}

export type InboundEmailPayload = {
  from?: string;
  to?: string;
  subject?: string;
  text?: string;
  html?: string;
  messageId?: string;
  autoSubmitted?: string;
};

export async function processInboundEmailMessage(
  workspace: { id: string; userId: string; name: string },
  config: EmailInboxConfig,
  payload: InboundEmailPayload
): Promise<{ skipped?: string; created?: boolean; attached?: boolean; leadId?: string; leadNumber?: string; config: EmailInboxConfig }> {
  const messageId = payload.messageId || crypto.createHash("sha1").update(`${payload.from}|${payload.subject}|${payload.text?.slice(0, 200)}`).digest("hex");
  if (config.processedMessageIds?.includes(messageId)) {
    return { skipped: "already processed", config };
  }

  const parsed = parseLeadFromEmail({
    from: payload.from,
    subject: payload.subject,
    text: payload.text,
    html: payload.html,
    messageId,
    captureEmail: config.captureEmail,
  });

  if (parsed.skip) {
    return { skipped: parsed.skipReason, config: rememberMessageId(config, messageId) };
  }

  const result = await ingestInboundLead({
    workspace,
    data: {
      firstName: parsed.firstName,
      lastName: parsed.lastName,
      email: parsed.email,
      phone: parsed.phone,
      company: parsed.company,
      city: parsed.city,
      state: parsed.state,
      source: "Email",
      requirement: parsed.requirement,
      remarks: parsed.remarks,
    },
    sourceDefault: "Email",
    auditAction: "lead_email_inbox_create",
    timelineDescription: `Captured from email inbox ${config.captureEmail || ""}`.trim(),
    onDuplicate: "attach",
    communication: {
      subject: payload.subject,
      body: (payload.text || (payload.html ? htmlToText(payload.html) : "")).slice(0, 10000),
    },
  });

  if ("error" in result) {
    return { skipped: "duplicate", config: rememberMessageId(config, messageId) };
  }

  return {
    created: !result.attached,
    attached: result.attached,
    leadId: result.lead.id,
    leadNumber: result.leadNumber,
    config: rememberMessageId(config, messageId),
  };
}

async function saveInboxConfig(workspaceId: string, config: EmailInboxConfig, extra?: { lastError?: string | null }) {
  const next = { ...config, lastError: extra?.lastError === undefined ? config.lastError : extra.lastError };
  await prisma.workspaceIntegration.update({
    where: { workspaceId_integrationId: { workspaceId, integrationId: "email_inbox" } },
    data: {
      config: next as Prisma.InputJsonValue,
      lastSyncAt: new Date(),
    },
  });
  return next;
}

export async function testImapConnection(config: EmailInboxConfig): Promise<{ ok: true } | { ok: false; error: string }> {
  const withDefaults = applyImapProviderDefaults(config);
  if (!hasImapCredentials(withDefaults)) {
    return { ok: false, error: "IMAP host, username, and password are required to test mailbox access" };
  }
  let ImapFlow: typeof import("imapflow").ImapFlow;
  try {
    ({ ImapFlow } = await import("imapflow"));
  } catch {
    return { ok: false, error: "IMAP library is not available on this server" };
  }
  const client = new ImapFlow({
    host: String(withDefaults.imapHost),
    port: Number(withDefaults.imapPort || 993),
    secure: Number(withDefaults.imapPort || 993) === 993,
    auth: { user: String(withDefaults.imapUser), pass: String(withDefaults.imapPassword) },
    logger: false,
  });
  try {
    await client.connect();
    await client.logout();
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "IMAP connection failed" };
  }
}

export async function pollWorkspaceInbox(
  workspaceId: string,
  mode: "poll" | "catchup" = "poll"
): Promise<{ processed: number; created: number; attached: number; skipped: number; error?: string }> {
  const row = await prisma.workspaceIntegration.findUnique({
    where: { workspaceId_integrationId: { workspaceId, integrationId: "email_inbox" } },
    include: { workspace: { select: { id: true, userId: true, name: true, status: true } } },
  });
  if (!row || !row.enabled || row.workspace.status !== "active") {
    return { processed: 0, created: 0, attached: 0, skipped: 0, error: "Inbox integration is not connected" };
  }

  let config = applyImapProviderDefaults((row.config as EmailInboxConfig) || {});
  if (!hasImapCredentials(config)) {
    return { processed: 0, created: 0, attached: 0, skipped: 0, error: "Connect IMAP to fetch mail from this inbox, or forward mail to your inbound address" };
  }

  let ImapFlow: typeof import("imapflow").ImapFlow;
  let simpleParser: typeof import("mailparser").simpleParser;
  try {
    ({ ImapFlow } = await import("imapflow"));
    ({ simpleParser } = await import("mailparser"));
  } catch {
    return { processed: 0, created: 0, attached: 0, skipped: 0, error: "IMAP library is not available on this server" };
  }
  const client = new ImapFlow({
    host: String(config.imapHost),
    port: Number(config.imapPort || 993),
    secure: Number(config.imapPort || 993) === 993,
    auth: { user: String(config.imapUser), pass: String(config.imapPassword) },
    logger: false,
  });

  let processed = 0;
  let created = 0;
  let attached = 0;
  let skipped = 0;
  let lastUid = Number(config.lastUid || 0);

  try {
    await client.connect();
    const mailbox = config.mailbox || "INBOX";
    const lock = await client.getMailboxLock(mailbox);
    try {
      if (!lastUid && mode === "poll") {
        lastUid = Math.max(0, Number((client.mailbox && client.mailbox.uidNext) || 1) - 1);
        config.lastUid = lastUid;
        await saveInboxConfig(workspaceId, config, { lastError: null });
        return { processed: 0, created: 0, attached: 0, skipped: 0 };
      }
      const query = lastUid > 0 && mode === "poll" ? `${lastUid + 1}:*` : { seen: false };
      const fetchOpts = lastUid > 0 && mode === "poll" ? { uid: true } : undefined;
      for await (const message of client.fetch(query, { envelope: true, source: true, uid: true }, fetchOpts)) {
        if (processed >= 40) break;
        processed += 1;
        if (message.uid && message.uid > lastUid) lastUid = message.uid;
        const parsedMail = message.source ? await simpleParser(message.source) : null;
        const from =
          parsedMail?.from?.text ||
          message.envelope?.from?.map((a) => (a.name ? `${a.name} <${a.address}>` : a.address)).join(", ") ||
          "";
        const toField = parsedMail?.to;
        const toText = Array.isArray(toField) ? toField.map((a) => a.text).join(", ") : toField?.text;
        const result = await processInboundEmailMessage(row.workspace, config, {
          from,
          to: toText || extractEmailAddress(config.captureEmail),
          subject: parsedMail?.subject || message.envelope?.subject || "",
          text: parsedMail?.text || undefined,
          html: typeof parsedMail?.html === "string" ? parsedMail.html : undefined,
          messageId: parsedMail?.messageId || undefined,
        });
        config = result.config;
        if (result.created) created += 1;
        else if (result.attached) attached += 1;
        else skipped += 1;
        if (message.uid) {
          await client.messageFlagsAdd(String(message.uid), ["\\Seen"], { uid: true });
        }
      }
    } finally {
      lock.release();
    }
    config.lastUid = lastUid;
    await saveInboxConfig(workspaceId, config, { lastError: null });
    return { processed, created, attached, skipped };
  } catch (error) {
    const message = error instanceof Error ? error.message : "IMAP poll failed";
    await saveInboxConfig(workspaceId, config, { lastError: message });
    return { processed, created, attached, skipped, error: message };
  } finally {
    try {
      await client.logout();
    } catch {
      /* ignore */
    }
  }
}

let polling = false;

export async function pollAllInboundInboxes(): Promise<void> {
  if (polling) return;
  polling = true;
  try {
    const rows = await prisma.workspaceIntegration.findMany({
      where: { integrationId: "email_inbox", enabled: true },
      select: { workspaceId: true, config: true },
    });
    for (const row of rows) {
      const config = (row.config as EmailInboxConfig) || {};
      if (!hasImapCredentials(config)) continue;
      await pollWorkspaceInbox(row.workspaceId);
    }
  } finally {
    polling = false;
  }
}
