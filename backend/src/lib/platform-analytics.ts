import { prisma } from "./prisma";
import {
  PACKAGE_LABELS,
  PACKAGE_PRICE_INR,
  SUBSCRIPTION_PACKAGES,
  type SubscriptionPackage,
} from "./roles";
import { getUpgradeStats } from "./platform-sales";

function monthKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-IN", { month: "short", year: "2-digit" });
}

export async function getPlatformAnalytics() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const expiringCutoff = new Date();
  expiringCutoff.setDate(expiringCutoff.getDate() + 30);

  const [
    companyCount,
    activeCompanies,
    totalMembers,
    trialCount,
    paidCount,
    subscriptionsByPackage,
    interestGroups,
    revenueAgg,
    revenueThisMonth,
    allSales,
    expiringSubs,
    trialCompanies,
    interestCompanies,
    teamMembers,
  ] = await Promise.all([
    prisma.workspace.count(),
    prisma.workspace.count({ where: { status: "active" } }),
    prisma.workspaceMember.count({ where: { status: "active" } }),
    prisma.subscription.count({ where: { package: "trial_7d", status: "active" } }),
    prisma.subscription.count({ where: { package: { not: "trial_7d" }, status: "active" } }),
    prisma.subscription.groupBy({
      by: ["package"],
      where: { status: "active" },
      _count: true,
    }),
    prisma.workspace.groupBy({
      by: ["interestedPackage"],
      where: { interestedPackage: { not: null } },
      _count: true,
    }),
    prisma.platformSale.aggregate({ _sum: { amountInr: true }, _count: true }),
    prisma.platformSale.aggregate({
      where: { createdAt: { gte: monthStart } },
      _sum: { amountInr: true },
      _count: true,
    }),
    prisma.platformSale.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: {
        workspace: { select: { id: true, name: true } },
        soldBy: { select: { id: true, name: true, email: true } },
      },
    }),
    prisma.subscription.findMany({
      where: { status: "active", expiresAt: { lte: expiringCutoff } },
      orderBy: { expiresAt: "asc" },
      take: 10,
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            status: true,
            interestedPackage: true,
            owner: { select: { email: true } },
            members: { where: { status: "active" }, select: { id: true } },
          },
        },
      },
    }),
    prisma.workspace.findMany({
      where: { subscription: { package: "trial_7d", status: "active" } },
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        owner: { select: { name: true, email: true } },
        subscription: true,
        provisionedBy: { select: { id: true, name: true } },
        _count: { select: { members: true } },
      },
    }),
    prisma.workspace.findMany({
      where: { interestedPackage: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 10,
      include: {
        owner: { select: { email: true } },
        subscription: true,
        provisionedBy: { select: { name: true } },
      },
    }),
    prisma.platformAdmin.findMany({
      where: { status: "active" },
      select: { id: true, name: true, email: true, role: true },
    }),
  ]);

  const salesByAdmin = await prisma.platformSale.groupBy({
    by: ["soldByPlatformAdminId"],
    _sum: { amountInr: true },
    _count: true,
  });

  const provisionedByAdmin = await prisma.workspace.groupBy({
    by: ["provisionedByPlatformAdminId"],
    _count: true,
  });

  const sixMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const recentSalesForChart = await prisma.platformSale.findMany({
    where: { createdAt: { gte: sixMonthsAgo } },
    select: { amountInr: true, createdAt: true },
  });

  const revenueByMonthMap = new Map<string, { revenue: number; sales: number }>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    revenueByMonthMap.set(monthKey(d), { revenue: 0, sales: 0 });
  }
  for (const sale of recentSalesForChart) {
    const key = monthKey(sale.createdAt);
    const bucket = revenueByMonthMap.get(key);
    if (bucket) {
      bucket.revenue += sale.amountInr;
      bucket.sales += 1;
    }
  }
  const revenueByMonth = Array.from(revenueByMonthMap.entries()).map(([key, v]) => ({
    month: monthLabel(key),
    revenue: v.revenue,
    sales: v.sales,
  }));

  const maxMonthlyRevenue = Math.max(...revenueByMonth.map((m) => m.revenue), 1);

  const packageDistribution = SUBSCRIPTION_PACKAGES.map((pkg) => {
    const row = subscriptionsByPackage.find((s) => s.package === pkg);
    return {
      package: pkg,
      label: PACKAGE_LABELS[pkg],
      count: row?._count ?? 0,
    };
  }).filter((p) => p.count > 0);

  const totalActiveSubs = packageDistribution.reduce((s, p) => s + p.count, 0);
  const packageChart = packageDistribution.map((p) => ({
    ...p,
    pct: totalActiveSubs > 0 ? (p.count / totalActiveSubs) * 100 : 0,
  }));

  const interestTotal = interestGroups.reduce((s, g) => s + g._count, 0);
  const packageInterest = interestGroups
    .filter((g) => g.interestedPackage)
    .map((g) => {
      const pkg = g.interestedPackage as SubscriptionPackage;
      return {
        package: g.interestedPackage,
        label: PACKAGE_LABELS[pkg] || g.interestedPackage,
        count: g._count,
        pct: interestTotal > 0 ? (g._count / interestTotal) * 100 : 0,
        potentialRevenue: (PACKAGE_PRICE_INR[pkg] ?? 0) * g._count,
      };
    })
    .sort((a, b) => b.count - a.count);

  const memberPerformance = teamMembers.map((admin) => {
    const salesRow = salesByAdmin.find((s) => s.soldByPlatformAdminId === admin.id);
    const provRow = provisionedByAdmin.find((p) => p.provisionedByPlatformAdminId === admin.id);
    return {
      id: admin.id,
      name: admin.name,
      email: admin.email,
      role: admin.role,
      companiesAdded: provRow?._count ?? 0,
      salesCount: salesRow?._count ?? 0,
      revenue: salesRow?._sum.amountInr ?? 0,
    };
  }).sort((a, b) => b.revenue - a.revenue);

  const expiringSoon = expiringSubs.length;
  const upgradeStats = await getUpgradeStats();

  return {
    stats: {
      companyCount,
      activeCompanies,
      suspendedCompanies: companyCount - activeCompanies,
      totalMembers,
      trialCount,
      paidCount,
      platformRevenue: revenueAgg._sum.amountInr ?? 0,
      totalSales: revenueAgg._count,
      revenueThisMonth: revenueThisMonth._sum.amountInr ?? 0,
      salesThisMonth: revenueThisMonth._count,
      expiringSoon,
      interestedCount: interestTotal,
    },
    charts: {
      packageDistribution: packageChart,
      packageInterest,
      revenueByMonth,
      maxMonthlyRevenue,
      subscriptionMix: [
        { label: "Free trial (7 days)", count: trialCount, pct: companyCount > 0 ? (trialCount / companyCount) * 100 : 0, color: "bg-amber-400" },
        { label: "Paid yearly", count: paidCount, pct: companyCount > 0 ? (paidCount / companyCount) * 100 : 0, color: "bg-emerald-500" },
      ],
    },
    memberPerformance,
    recentPlatformSales: allSales.map((s) => ({
      id: s.id,
      companyId: s.workspace.id,
      companyName: s.workspace.name,
      package: s.package,
      previousPackage: s.previousPackage,
      changeType: s.changeType,
      packageLabel: PACKAGE_LABELS[s.package as SubscriptionPackage] || s.package,
      amountInr: s.amountInr,
      creditInr: s.creditInr,
      soldBy: s.soldBy,
      createdAt: s.createdAt,
    })),
    upgradeStats,
    trialCompanies: trialCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      owner: c.owner,
      memberCount: c._count.members,
      expiresAt: c.subscription?.expiresAt,
      interestedPackage: c.interestedPackage,
      provisionedBy: c.provisionedBy,
      createdAt: c.createdAt,
    })),
    packageInterestList: interestCompanies.map((c) => ({
      id: c.id,
      name: c.name,
      ownerEmail: c.owner.email,
      currentPackage: c.subscription?.package,
      interestedPackage: c.interestedPackage,
      interestedLabel: c.interestedPackage
        ? PACKAGE_LABELS[c.interestedPackage as SubscriptionPackage] || c.interestedPackage
        : null,
      provisionedBy: c.provisionedBy,
    })),
    expiringCompanies: expiringSubs.map((s) => ({
      id: s.workspace.id,
      name: s.workspace.name,
      status: s.workspace.status,
      ownerEmail: s.workspace.owner.email,
      package: s.package,
      packageLabel: PACKAGE_LABELS[s.package as SubscriptionPackage] || s.package,
      expiresAt: s.expiresAt,
      memberCount: s.workspace.members.length,
      interestedPackage: s.workspace.interestedPackage,
      daysLeft: Math.ceil((s.expiresAt.getTime() - now.getTime()) / 86400000),
    })),
  };
}
