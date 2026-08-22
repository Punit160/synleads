import { prisma } from "./prisma";

export async function generateLeadNumber(workspaceId: string): Promise<string> {
  const count = await prisma.lead.count({ where: { workspaceId } });
  return `LF-${String(count + 1).padStart(5, "0")}`;
}

export async function findDuplicateLeads(
  workspaceId: string,
  email?: string | null,
  phone?: string | null,
  excludeId?: string
) {
  if (!email && !phone) return [];

  const conditions = [];
  if (email) conditions.push({ email: email.toLowerCase() });
  if (phone) conditions.push({ phone }, { alternatePhone: phone });

  return prisma.lead.findMany({
    where: {
      workspaceId,
      ...(excludeId ? { id: { not: excludeId } } : {}),
      OR: conditions,
    },
    select: {
      id: true,
      leadNumber: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      company: true,
      status: true,
    },
    take: 10,
  });
}

export async function addTimelineEvent(
  leadId: string,
  type: string,
  title: string,
  description?: string,
  userId?: string
) {
  return prisma.leadTimelineEvent.create({
    data: { leadId, type, title, description: description || null, userId: userId || null },
  });
}
