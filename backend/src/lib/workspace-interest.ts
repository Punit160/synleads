import { prisma } from "./prisma";
import { comparePackageTier, isPaidPackage, type SubscriptionPackage } from "./roles";

/** Clear interest when company is on the interested plan or a higher paid plan. */
export function shouldClearPackageInterest(
  interestedPackage: string | null | undefined,
  newPackage: string
): boolean {
  if (!interestedPackage) return false;
  if (!isPaidPackage(newPackage)) return false;
  if (!isPaidPackage(interestedPackage)) return false;
  return comparePackageTier(newPackage, interestedPackage) >= 0;
}

export async function maybeClearPackageInterest(workspaceId: string, newPackage: SubscriptionPackage) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { interestedPackage: true },
  });

  if (!workspace?.interestedPackage) {
    return { cleared: false as const, previousInterest: null };
  }

  if (!shouldClearPackageInterest(workspace.interestedPackage, newPackage)) {
    return { cleared: false as const, previousInterest: workspace.interestedPackage };
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { interestedPackage: null },
  });

  return { cleared: true as const, previousInterest: workspace.interestedPackage };
}

export async function clearPackageInterest(workspaceId: string) {
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { interestedPackage: true },
  });

  if (!workspace?.interestedPackage) {
    return { cleared: false as const, previousInterest: null };
  }

  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { interestedPackage: null },
  });

  return { cleared: true as const, previousInterest: workspace.interestedPackage };
}
