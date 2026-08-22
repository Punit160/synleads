import { prisma } from "./prisma";
import type { SubscriptionChangeType } from "./subscription-billing";

export async function recordSubscriptionHistory(input: {
  workspaceId: string;
  package: string;
  previousPackage?: string | null;
  changeType: SubscriptionChangeType | "initial";
  startsAt: Date;
  expiresAt: Date;
}) {
  await prisma.subscriptionHistory.updateMany({
    where: { workspaceId: input.workspaceId, endedAt: null },
    data: { endedAt: new Date() },
  });

  return prisma.subscriptionHistory.create({
    data: {
      workspaceId: input.workspaceId,
      package: input.package,
      previousPackage: input.previousPackage ?? null,
      changeType: input.changeType,
      startsAt: input.startsAt,
      expiresAt: input.expiresAt,
    },
  });
}

/** Backfill a history row for workspaces that predate subscription_history. */
export async function ensureSubscriptionHistory(workspaceId: string) {
  const count = await prisma.subscriptionHistory.count({ where: { workspaceId } });
  if (count > 0) return;

  const sub = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!sub) return;

  await prisma.subscriptionHistory.create({
    data: {
      workspaceId,
      package: sub.package,
      changeType: "initial",
      startsAt: sub.startsAt,
      expiresAt: sub.expiresAt,
    },
  });
}
