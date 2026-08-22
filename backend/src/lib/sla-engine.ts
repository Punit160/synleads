import { prisma } from "./prisma";
import { createNotification } from "./notifications";
import { recordAuditLog } from "./audit-log";

export async function getOrCreateSlaPolicy(workspaceId: string) {
  const existing = await prisma.slaPolicy.findUnique({ where: { workspaceId } });
  if (existing) return existing;
  return prisma.slaPolicy.create({
    data: { workspaceId },
  });
}

export async function applySlaOnLeadCreate(workspaceId: string, leadId: string): Promise<void> {
  const policy = await getOrCreateSlaPolicy(workspaceId);
  if (!policy.enabled) return;

  const slaDueAt = new Date(Date.now() + policy.firstResponseHours * 60 * 60 * 1000);
  await prisma.lead.update({
    where: { id: leadId },
    data: { slaDueAt },
  });
}

export async function markLeadFirstResponse(workspaceId: string, leadId: string): Promise<void> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
  if (!lead || lead.firstResponseAt) return;

  const now = new Date();
  const breached = lead.slaDueAt ? now > lead.slaDueAt : false;

  await prisma.lead.update({
    where: { id: leadId },
    data: {
      firstResponseAt: now,
      slaBreached: breached,
      ...(lead.status === "new" || lead.status === "assigned" ? { status: "contacted" } : {}),
    },
  });

  await recordAuditLog({
    workspaceId,
    action: "sla_first_response",
    entityType: "lead",
    entityId: leadId,
    details: breached ? "First response recorded (SLA breached)" : "First response recorded within SLA",
  });
}

export async function runSlaChecks(workspaceId: string): Promise<{ breached: number; escalated: number }> {
  const policy = await getOrCreateSlaPolicy(workspaceId);
  if (!policy.enabled) return { breached: 0, escalated: 0 };

  const now = new Date();
  let breached = 0;
  let escalated = 0;

  const overdue = await prisma.lead.findMany({
    where: {
      workspaceId,
      archivedAt: null,
      firstResponseAt: null,
      slaDueAt: { lt: now },
      slaBreached: false,
    },
    include: { owner: { select: { id: true, name: true } } },
    take: 100,
  });

  for (const lead of overdue) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { slaBreached: true },
    });
    breached += 1;

    if (policy.notifyOnBreach && lead.ownerId) {
      const existing = await prisma.notification.findFirst({
        where: {
          workspaceId,
          userId: lead.ownerId,
          type: "sla_breach",
          relatedId: lead.id,
        },
      });
      if (!existing) {
        await createNotification({
          workspaceId,
          userId: lead.ownerId,
          type: "sla_breach",
          title: "SLA breach",
          message: `First response overdue for ${lead.firstName} ${lead.lastName || ""} (${lead.leadNumber})`.trim(),
          channel: "browser",
          relatedType: "lead",
          relatedId: lead.id,
        });
      }
    }

    await recordAuditLog({
      workspaceId,
      action: "sla_breach",
      entityType: "lead",
      entityId: lead.id,
      details: `SLA breached for ${lead.leadNumber}`,
    });
  }

  const escalateCutoff = new Date(now.getTime() - policy.escalateAfterHours * 60 * 60 * 1000);
  const toEscalate = await prisma.lead.findMany({
    where: {
      workspaceId,
      archivedAt: null,
      firstResponseAt: null,
      slaBreached: true,
      slaEscalatedAt: null,
      slaDueAt: { lt: escalateCutoff },
    },
    take: 50,
  });

  for (const lead of toEscalate) {
    await prisma.lead.update({
      where: { id: lead.id },
      data: { slaEscalatedAt: now },
    });
    escalated += 1;

    if (policy.escalateToManager && lead.ownerId) {
      const member = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId: lead.ownerId } },
        select: { managerUserId: true },
      });
      if (member?.managerUserId) {
        await createNotification({
          workspaceId,
          userId: member.managerUserId,
          type: "sla_escalation",
          title: "SLA escalation",
          message: `Lead ${lead.leadNumber} requires manager attention — no first response`,
          channel: "browser",
          relatedType: "lead",
          relatedId: lead.id,
        });
      }
    }

    await recordAuditLog({
      workspaceId,
      action: "sla_escalation",
      entityType: "lead",
      entityId: lead.id,
      details: `Escalated after ${policy.escalateAfterHours}h`,
    });
  }

  return { breached, escalated };
}

export async function runSlaChecksAllWorkspaces(): Promise<void> {
  const workspaces = await prisma.workspace.findMany({
    where: { status: "active" },
    select: { id: true },
  });
  for (const ws of workspaces) {
    await runSlaChecks(ws.id).catch(() => {});
  }
}
