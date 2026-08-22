import { prisma } from "./prisma";

export async function createNotification(params: {
  workspaceId: string;
  userId: string;
  type: string;
  title: string;
  message: string;
  channel?: string;
  relatedType?: string;
  relatedId?: string;
}) {
  return prisma.notification.create({
    data: {
      workspaceId: params.workspaceId,
      userId: params.userId,
      type: params.type,
      title: params.title,
      message: params.message,
      channel: params.channel || "browser",
      relatedType: params.relatedType ?? null,
      relatedId: params.relatedId ?? null,
    },
  });
}
