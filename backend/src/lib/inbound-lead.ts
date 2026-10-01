import { prisma } from "./prisma";
import { generateLeadNumber, findDuplicateLeads, addTimelineEvent } from "./lead-utils";
import { pickLeadOwner } from "./auto-assign";
import { recordAuditLog } from "./audit-log";
import { notifyLeadAssigned } from "./reminder-jobs";
import { onLeadCreated } from "./lead-automation";
import { LEAD_SOURCES } from "./lead-constants";
import { createNotification } from "./notifications";

export type InboundLeadInput = {
  firstName: string;
  lastName?: string | null;
  email?: string | null;
  phone?: string | null;
  company?: string | null;
  city?: string | null;
  state?: string | null;
  source?: string | null;
  requirement?: string | null;
  budget?: number | null;
  remarks?: string | null;
};

export type IngestInboundLeadResult =
  | { error: "duplicate"; duplicateId: string }
  | {
      lead: { id: string };
      leadNumber: string;
      ownerId: string | null;
      source: string;
      attached: boolean;
    };

export async function ingestInboundLead(opts: {
  workspace: { id: string; userId: string; name: string };
  data: InboundLeadInput;
  sourceDefault: string;
  auditAction?: string;
  timelineDescription?: string;
  onDuplicate?: "reject" | "attach";
  communication?: { subject?: string | null; body?: string | null };
}): Promise<IngestInboundLeadResult> {
  const { workspace, data, sourceDefault } = opts;
  const onDuplicate = opts.onDuplicate ?? "reject";
  const source =
    data.source && LEAD_SOURCES.includes(data.source as (typeof LEAD_SOURCES)[number])
      ? data.source
      : sourceDefault;

  const dups = await findDuplicateLeads(workspace.id, data.email, data.phone);
  if (dups.length > 0) {
    if (onDuplicate === "reject") {
      return { error: "duplicate", duplicateId: dups[0].id };
    }
    const existing = dups[0];
    await attachInboundActivity({
      workspaceId: workspace.id,
      leadId: existing.id,
      timelineDescription: opts.timelineDescription || `Inbound from ${source}`,
      communication: opts.communication,
    });
    return {
      lead: { id: existing.id },
      leadNumber: existing.leadNumber,
      ownerId: null,
      source,
      attached: true,
    };
  }

  const ownerId = await pickLeadOwner(workspace.id, null, {
    source,
    city: data.city,
    state: data.state,
    requirement: data.requirement,
  });
  const leadNumber = await generateLeadNumber(workspace.id);

  const lead = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      ownerId,
      leadNumber,
      firstName: data.firstName,
      lastName: data.lastName || null,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      city: data.city || null,
      state: data.state || null,
      source,
      requirement: data.requirement || null,
      budget: data.budget ?? null,
      remarks: data.remarks || null,
      status: ownerId ? "assigned" : "new",
    },
  });

  await addTimelineEvent(
    lead.id,
    "created",
    "Lead captured",
    opts.timelineDescription || `Inbound from ${source} (webhook)`,
    ownerId ?? undefined
  );
  await recordAuditLog({
    workspaceId: workspace.id,
    userId: null,
    action: opts.auditAction || "lead_webhook_create",
    entityType: "lead",
    entityId: lead.id,
    details: `Source: ${source}`,
  });

  if (opts.communication?.body || opts.communication?.subject) {
    await prisma.communication.create({
      data: {
        workspaceId: workspace.id,
        leadId: lead.id,
        ownerId: ownerId ?? undefined,
        channel: "email",
        direction: "inbound",
        subject: opts.communication.subject || null,
        body: opts.communication.body || null,
      },
    });
  }

  if (ownerId) {
    await notifyLeadAssigned({
      workspaceId: workspace.id,
      assigneeId: ownerId,
      leadId: lead.id,
      leadNumber,
      leadName: `${data.firstName} ${data.lastName || ""}`.trim(),
      assignedByName: "Inbound integration",
    });
  }

  await onLeadCreated({ workspaceId: workspace.id, leadId: lead.id, actorUserId: ownerId });

  return { lead: { id: lead.id }, leadNumber, ownerId, source, attached: false };
}

async function attachInboundActivity(opts: {
  workspaceId: string;
  leadId: string;
  timelineDescription: string;
  communication?: { subject?: string | null; body?: string | null };
}) {
  await addTimelineEvent(opts.leadId, "email", "Inbound email", opts.timelineDescription);

  if (opts.communication?.body || opts.communication?.subject) {
    await prisma.communication.create({
      data: {
        workspaceId: opts.workspaceId,
        leadId: opts.leadId,
        channel: "email",
        direction: "inbound",
        subject: opts.communication.subject || null,
        body: opts.communication.body || null,
      },
    });
  }

  const lead = await prisma.lead.findUnique({
    where: { id: opts.leadId },
    select: { ownerId: true, firstName: true, lastName: true, leadNumber: true },
  });
  if (lead?.ownerId) {
    await createNotification({
      workspaceId: opts.workspaceId,
      userId: lead.ownerId,
      type: "inbound_email",
      title: "Inbound email on existing lead",
      message: `${lead.firstName} ${lead.lastName || ""}`.trim() + ` (${lead.leadNumber}) sent a new email`,
      channel: "browser",
      relatedType: "lead",
      relatedId: opts.leadId,
    });
  }
}
