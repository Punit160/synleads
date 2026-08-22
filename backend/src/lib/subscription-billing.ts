import {
  PACKAGE_LABELS,
  PACKAGE_PRICE_INR,
  comparePackageTier,
  isPaidPackage,
  isTrialPackage,
  packageExpiresAt,
  type SubscriptionPackage,
} from "./roles";

export const SUBSCRIPTION_CHANGE_TYPES = [
  "no_change",
  "trial_conversion",
  "renewal",
  "upgrade",
  "blocked",
] as const;
export type SubscriptionChangeType = (typeof SUBSCRIPTION_CHANGE_TYPES)[number];

export type SubscriptionSnapshot = {
  package: string;
  startsAt: Date;
  expiresAt: Date;
  status: string;
};

export type SubscriptionChangeQuote = {
  allowed: boolean;
  changeType: SubscriptionChangeType;
  reason?: string;
  currentPackage: string;
  targetPackage: string;
  currentLabel: string;
  targetLabel: string;
  currentPriceInr: number;
  targetPriceInr: number;
  remainingDays: number;
  remainingMonths: number;
  totalTermDays: number;
  creditInr: number;
  chargeInr: number;
  listPriceInr: number;
  newExpiresAt: string;
  keepsExpiry: boolean;
  breakdown: string;
};

function daysBetween(from: Date, to: Date): number {
  return Math.max(0, Math.ceil((to.getTime() - from.getTime()) / 86400000));
}

function roundInr(amount: number): number {
  return Math.max(0, Math.round(amount));
}

export function quoteSubscriptionChange(
  current: SubscriptionSnapshot | null,
  targetPackage: SubscriptionPackage,
  now: Date = new Date()
): SubscriptionChangeQuote {
  const currentPackage = (current?.package ?? "trial_7d") as SubscriptionPackage;
  const targetLabel = PACKAGE_LABELS[targetPackage];
  const currentLabel = PACKAGE_LABELS[currentPackage] || currentPackage;
  const currentPriceInr = PACKAGE_PRICE_INR[currentPackage] ?? 0;
  const targetPriceInr = PACKAGE_PRICE_INR[targetPackage] ?? 0;

  const base = {
    currentPackage,
    targetPackage,
    currentLabel,
    targetLabel,
    currentPriceInr,
    targetPriceInr,
    listPriceInr: targetPriceInr,
    remainingDays: 0,
    remainingMonths: 0,
    totalTermDays: 365,
    creditInr: 0,
    chargeInr: 0,
    newExpiresAt: packageExpiresAt(targetPackage, now).toISOString(),
    keepsExpiry: false,
    breakdown: "",
  };

  if (currentPackage === targetPackage) {
    const expired = !current || current.expiresAt <= now;
    if (!expired) {
      return {
        ...base,
        allowed: false,
        changeType: "no_change",
        reason: `Already on ${currentLabel.split(" · ")[0]}. Plan is active until ${current.expiresAt.toLocaleDateString("en-IN")}. Renew after expiry.`,
        remainingDays: daysBetween(now, current.expiresAt),
        remainingMonths: Math.round((daysBetween(now, current.expiresAt) / 30) * 10) / 10,
        newExpiresAt: current.expiresAt.toISOString(),
      };
    }
    if (isTrialPackage(targetPackage)) {
      return {
        ...base,
        allowed: false,
        changeType: "blocked",
        reason: "Select a paid yearly plan to renew.",
      };
    }
    return {
      ...base,
      allowed: true,
      changeType: "renewal",
      chargeInr: targetPriceInr,
      breakdown: `Renew ${targetLabel} for a new 12-month term. Full yearly price applies.`,
      newExpiresAt: packageExpiresAt(targetPackage, now).toISOString(),
    };
  }

  if (isPaidPackage(currentPackage) && isTrialPackage(targetPackage)) {
    return {
      ...base,
      allowed: false,
      changeType: "blocked",
      reason: "Paid companies cannot be moved back to the 7-day free trial.",
    };
  }

  if (isTrialPackage(currentPackage) && isPaidPackage(targetPackage)) {
    return {
      ...base,
      allowed: true,
      changeType: "trial_conversion",
      chargeInr: targetPriceInr,
      breakdown: `Convert from trial to ${targetLabel}. Full yearly price · new 12-month term starts today.`,
      newExpiresAt: packageExpiresAt(targetPackage, now).toISOString(),
    };
  }

  if (!current) {
    if (isTrialPackage(targetPackage)) {
      return {
        ...base,
        allowed: true,
        changeType: "renewal",
        chargeInr: 0,
        breakdown: "Start 7-day free trial.",
        newExpiresAt: packageExpiresAt(targetPackage, now).toISOString(),
      };
    }
    return {
      ...base,
      allowed: true,
      changeType: "renewal",
      chargeInr: targetPriceInr,
      breakdown: `Assign ${targetLabel}. Full yearly price · 12-month term.`,
      newExpiresAt: packageExpiresAt(targetPackage, now).toISOString(),
    };
  }

  const expired = current.expiresAt <= now;

  if (isPaidPackage(currentPackage) && isPaidPackage(targetPackage)) {
    const tierCompare = comparePackageTier(currentPackage, targetPackage);

    if (tierCompare > 0 && !expired) {
      return {
        ...base,
        allowed: false,
        changeType: "blocked",
        reason: `Downgrade to a smaller plan is only allowed after the current plan expires on ${current.expiresAt.toLocaleDateString("en-IN")}.`,
        remainingDays: 0,
        newExpiresAt: current.expiresAt.toISOString(),
      };
    }

    if (expired) {
      return {
        ...base,
        allowed: true,
        changeType: "renewal",
        chargeInr: targetPriceInr,
        breakdown: `Plan expired. Renew with ${targetLabel}. Full yearly price · new 12-month term.`,
        newExpiresAt: packageExpiresAt(targetPackage, now).toISOString(),
      };
    }

    if (tierCompare < 0) {
      const totalTermDays = Math.max(1, daysBetween(current.startsAt, current.expiresAt));
      const remainingDays = daysBetween(now, current.expiresAt);
      const remainingMonths = Math.round((remainingDays / 30) * 10) / 10;
      const ratio = remainingDays / totalTermDays;
      const creditInr = roundInr(currentPriceInr * ratio);
      const newPlanRemainingValue = roundInr(targetPriceInr * ratio);
      const chargeInr = Math.max(0, newPlanRemainingValue - creditInr);

      return {
        ...base,
        allowed: true,
        changeType: "upgrade",
        remainingDays,
        remainingMonths,
        totalTermDays,
        creditInr,
        chargeInr,
        keepsExpiry: true,
        newExpiresAt: current.expiresAt.toISOString(),
        breakdown: `Upgrade for remaining ${remainingDays} days (~${remainingMonths} mo). Credit ₹${creditInr.toLocaleString("en-IN")} from current plan · pay ₹${chargeInr.toLocaleString("en-IN")} · expiry unchanged.`,
      };
    }
  }

  return {
    ...base,
    allowed: false,
    changeType: "blocked",
    reason: "This plan change is not allowed.",
  };
}

export function getAllowedTargetPackages(
  current: SubscriptionSnapshot | null,
  now: Date = new Date()
): Array<{ package: SubscriptionPackage; quote: SubscriptionChangeQuote }> {
  const packages = Object.keys(PACKAGE_PRICE_INR) as SubscriptionPackage[];
  return packages
    .map((pkg) => ({
      package: pkg,
      quote: quoteSubscriptionChange(current, pkg, now),
    }))
    .filter((row) => row.quote.allowed || row.quote.changeType === "no_change");
}
