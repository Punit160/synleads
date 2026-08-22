import { prisma } from "./prisma";
import { packageExpiresAt, type SubscriptionPackage } from "./roles";
import {
  quoteSubscriptionChange,
  type SubscriptionChangeType,
  type SubscriptionSnapshot,
} from "./subscription-billing";
import { recordSubscriptionHistory } from "./subscription-history";

export async function getWorkspaceSubscription(workspaceId: string) {
  return prisma.subscription.findUnique({ where: { workspaceId } });
}

export async function getSubscriptionChangeQuote(workspaceId: string, targetPackage: SubscriptionPackage) {
  const current = await getWorkspaceSubscription(workspaceId);
  const snapshot = current
    ? {
        package: current.package,
        startsAt: current.startsAt,
        expiresAt: current.expiresAt,
        status: current.status,
      }
    : null;
  return quoteSubscriptionChange(snapshot, targetPackage);
}

export async function applySubscriptionChange(
  workspaceId: string,
  targetPackage: SubscriptionPackage,
  now: Date = new Date()
) {
  const current = await getWorkspaceSubscription(workspaceId);
  const snapshot: SubscriptionSnapshot | null = current
    ? {
        package: current.package,
        startsAt: current.startsAt,
        expiresAt: current.expiresAt,
        status: current.status,
      }
    : null;

  const quote = quoteSubscriptionChange(snapshot, targetPackage, now);
  if (!quote.allowed) {
    throw new Error(quote.reason || "Plan change not allowed");
  }

  const newExpiresAt = new Date(quote.newExpiresAt);

  const subscription = await prisma.subscription.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      package: targetPackage,
      status: "active",
      startsAt: now,
      expiresAt: newExpiresAt,
    },
    update: {
      package: targetPackage,
      status: "active",
      ...(quote.keepsExpiry && current
        ? { startsAt: current.startsAt, expiresAt: current.expiresAt }
        : { startsAt: now, expiresAt: newExpiresAt }),
    },
  });

  const effectiveStarts =
    quote.keepsExpiry && current ? current.startsAt : now;
  const effectiveExpires =
    quote.keepsExpiry && current ? current.expiresAt : newExpiresAt;

  if (quote.changeType !== "no_change") {
    await recordSubscriptionHistory({
      workspaceId,
      package: targetPackage,
      previousPackage: current?.package ?? null,
      changeType: quote.changeType,
      startsAt: effectiveStarts,
      expiresAt: effectiveExpires,
    });
  }

  return { subscription, quote };
}

export async function renewSubscription(workspaceId: string, pkg: SubscriptionPackage) {
  const { subscription } = await applySubscriptionChange(workspaceId, pkg);
  return subscription;
}

/** @deprecated use applySubscriptionChange */
export async function createSubscription(
  workspaceId: string,
  pkg: SubscriptionPackage = "trial_7d"
) {
  const startsAt = new Date();
  const expiresAt = packageExpiresAt(pkg, startsAt);

  const subscription = await prisma.subscription.upsert({
    where: { workspaceId },
    create: {
      workspaceId,
      package: pkg,
      status: "active",
      startsAt,
      expiresAt,
    },
    update: {
      package: pkg,
      status: "active",
      startsAt,
      expiresAt,
    },
  });

  await recordSubscriptionHistory({
    workspaceId,
    package: pkg,
    changeType: "initial",
    startsAt,
    expiresAt,
  });

  return subscription;
}

export type { SubscriptionChangeType };
