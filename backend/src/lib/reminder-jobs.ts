import { prisma } from "./prisma";
import { createNotification } from "./notifications";

/** Create in-app alerts for overdue follow-ups (idempotent per day). */
export async function checkOverdueFollowUpAlerts(workspaceId: string, userId: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);

  const overdue = await prisma.followUp.findMany({
    where: {
      workspaceId,
      ownerId: userId,
      completed: false,
      scheduledAt: { lt: now },
    },
    include: { lead: { select: { firstName: true, lastName: true, leadNumber: true } } },
    take: 20,
  });

  for (const fu of overdue) {
    const existing = await prisma.notification.findFirst({
      where: {
        workspaceId,
        userId,
        type: "follow_up_overdue",
        relatedId: fu.id,
        createdAt: { gte: startOfDay },
      },
    });
    if (existing) continue;

    const name = fu.lead
      ? `${fu.lead.firstName} ${fu.lead.lastName || ""}`.trim()
      : "Lead";
    await createNotification({
      workspaceId,
      userId,
      type: "follow_up_overdue",
      title: "Overdue follow-up",
      message: `Follow-up overdue for ${name} (${fu.lead?.leadNumber || "—"})`,
      channel: "browser",
      relatedType: "follow_up",
      relatedId: fu.id,
    });
  }
}

export async function notifyLeadAssigned(input: {
  workspaceId: string;
  assigneeId: string;
  leadId: string;
  leadNumber: string;
  leadName: string;
  assignedByName: string;
}) {
  if (!input.assigneeId) return;
  await createNotification({
    workspaceId: input.workspaceId,
    userId: input.assigneeId,
    type: "lead_assigned",
    title: "New lead assigned",
    message: `${input.leadName} (${input.leadNumber}) assigned by ${input.assignedByName}`,
    channel: "browser",
    relatedType: "lead",
    relatedId: input.leadId,
  });
}
