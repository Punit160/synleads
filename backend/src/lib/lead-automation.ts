import { prisma } from "./prisma";
import { applyLeadScore } from "./lead-scoring";
import { runWorkflows } from "./workflow-engine";
import { applySlaOnLeadCreate } from "./sla-engine";

export async function onLeadCreated(input: {
  workspaceId: string;
  leadId: string;
  actorUserId?: string | null;
}): Promise<void> {
  await applySlaOnLeadCreate(input.workspaceId, input.leadId);
  await applyLeadScore(input.workspaceId, input.leadId);

  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) return;

  await runWorkflows({
    workspaceId: input.workspaceId,
    trigger: "lead.created",
    lead,
    actorUserId: input.actorUserId,
  });
}

export async function onLeadUpdated(input: {
  workspaceId: string;
  leadId: string;
  previousStatus?: string | null;
  actorUserId?: string | null;
}): Promise<void> {
  await applyLeadScore(input.workspaceId, input.leadId);

  const lead = await prisma.lead.findUnique({ where: { id: input.leadId } });
  if (!lead) return;

  if (input.previousStatus != null && input.previousStatus !== lead.status) {
    await runWorkflows({
      workspaceId: input.workspaceId,
      trigger: "lead.status_changed",
      lead,
      previousStatus: input.previousStatus,
      actorUserId: input.actorUserId,
    });
  }
}
