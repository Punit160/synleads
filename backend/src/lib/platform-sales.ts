import { prisma } from "./prisma";
import type { SubscriptionChangeType } from "./subscription-billing";
import type { SubscriptionPackage } from "./roles";

export async function recordPlatformSale(input: {
  workspaceId: string;
  package: SubscriptionPackage;
  previousPackage?: string | null;
  changeType?: SubscriptionChangeType | "initial";
  amountInr: number;
  listPriceInr?: number;
  creditInr?: number;
  remainingDays?: number;
  soldByPlatformAdminId?: string | null;
  notes?: string;
}) {
  if (input.amountInr <= 0 && input.changeType !== "trial_conversion") {
    if (input.changeType === "upgrade" && input.amountInr === 0) {
      // zero-cost upgrade edge case — still record for audit
    } else if (input.changeType !== "upgrade") {
      return null;
    }
  }

  return prisma.platformSale.create({
    data: {
      workspaceId: input.workspaceId,
      package: input.package,
      previousPackage: input.previousPackage ?? null,
      changeType: input.changeType ?? "initial",
      amountInr: input.amountInr,
      listPriceInr: input.listPriceInr ?? null,
      creditInr: input.creditInr ?? 0,
      remainingDays: input.remainingDays ?? null,
      soldByPlatformAdminId: input.soldByPlatformAdminId ?? null,
      notes: input.notes,
    },
  });
}

export async function getUpgradeStats() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const [upgradesThisMonth, upgradesThisYear, renewalsThisMonth, renewalsThisYear, conversionsThisMonth] =
    await Promise.all([
      prisma.platformSale.count({
        where: { changeType: "upgrade", createdAt: { gte: monthStart } },
      }),
      prisma.platformSale.count({
        where: { changeType: "upgrade", createdAt: { gte: yearStart } },
      }),
      prisma.platformSale.count({
        where: { changeType: "renewal", createdAt: { gte: monthStart } },
      }),
      prisma.platformSale.count({
        where: { changeType: "renewal", createdAt: { gte: yearStart } },
      }),
      prisma.platformSale.count({
        where: { changeType: "trial_conversion", createdAt: { gte: monthStart } },
      }),
    ]);

  const recentChanges = await prisma.platformSale.findMany({
    where: { changeType: { in: ["upgrade", "renewal", "trial_conversion"] } },
    orderBy: { createdAt: "desc" },
    take: 15,
    include: {
      workspace: { select: { id: true, name: true } },
      soldBy: { select: { name: true } },
    },
  });

  return {
    upgradesThisMonth,
    upgradesThisYear,
    renewalsThisMonth,
    renewalsThisYear,
    conversionsThisMonth,
    recentChanges: recentChanges.map((s) => ({
      id: s.id,
      companyId: s.workspace.id,
      companyName: s.workspace.name,
      changeType: s.changeType,
      previousPackage: s.previousPackage,
      package: s.package,
      amountInr: s.amountInr,
      creditInr: s.creditInr,
      remainingDays: s.remainingDays,
      soldBy: s.soldBy?.name ?? null,
      createdAt: s.createdAt,
    })),
  };
}
