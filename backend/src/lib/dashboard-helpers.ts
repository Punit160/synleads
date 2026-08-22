import { prisma } from "./prisma";
import type { WorkspaceContext } from "./rbac";

export type DateRangeKey = "today" | "week" | "month" | "quarter" | "all";

export function parseDateRange(range: string | undefined): {
  key: DateRangeKey;
  start: Date | null;
  end: Date;
  prevStart: Date | null;
  prevEnd: Date | null;
} {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  const key = (["today", "week", "month", "quarter", "all"].includes(range || "")
    ? range
    : "month") as DateRangeKey;

  if (key === "all") {
    return { key, start: null, end, prevStart: null, prevEnd: null };
  }

  const start = new Date(now);
  start.setHours(0, 0, 0, 0);

  if (key === "today") {
    // start is today 00:00
  } else if (key === "week") {
    const day = start.getDay();
    const diff = day === 0 ? 6 : day - 1;
    start.setDate(start.getDate() - diff);
  } else if (key === "month") {
    start.setDate(1);
  } else if (key === "quarter") {
    const q = Math.floor(start.getMonth() / 3);
    start.setMonth(q * 3, 1);
  }

  const prevEnd = new Date(start);
  prevEnd.setMilliseconds(-1);
  const prevStart = new Date(prevEnd);
  if (key === "today") {
    prevStart.setHours(0, 0, 0, 0);
  } else if (key === "week") {
    prevStart.setDate(prevStart.getDate() - 6);
    prevStart.setHours(0, 0, 0, 0);
  } else if (key === "month") {
    prevStart.setDate(1);
    prevStart.setMonth(prevStart.getMonth() - 1);
    prevStart.setHours(0, 0, 0, 0);
  } else if (key === "quarter") {
    prevStart.setMonth(prevStart.getMonth() - 2, 1);
    prevStart.setHours(0, 0, 0, 0);
  }

  return { key, start, end, prevStart, prevEnd };
}

export function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

const FUNNEL_STATUSES = ["new", "contacted", "qualified", "proposal_sent", "negotiation", "won"] as const;

export function buildLeadFunnel(
  statusCounts: Map<string, number>
): Array<{ stage: string; label: string; count: number; conversionPct: number | null }> {
  const merged = new Map<string, number>();
  for (const [status, count] of statusCounts) {
    const s = status === "converted" ? "won" : status;
    merged.set(s, (merged.get(s) ?? 0) + count);
  }

  const stages = FUNNEL_STATUSES.map((stage) => ({
    stage,
    label: stage.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
    count: merged.get(stage) ?? 0,
    conversionPct: null as number | null,
  }));

  for (let i = 0; i < stages.length - 1; i++) {
    const from = stages[i].count;
    const to = stages[i + 1].count;
    stages[i].conversionPct = from > 0 ? Math.round((to / from) * 1000) / 10 : null;
  }

  return stages;
}

export async function buildDealsAtRisk(
  dealWhere: Record<string, unknown>,
  workspaceId: string,
  now: Date,
  inactiveDays = 5
) {
  const threshold = new Date(now);
  threshold.setDate(threshold.getDate() - inactiveDays);

  const openDeals = await prisma.deal.findMany({
    where: { ...dealWhere, status: "open" },
    include: {
      stage: { select: { name: true } },
      account: { select: { name: true } },
      activities: {
        orderBy: { updatedAt: "desc" },
        take: 1,
        select: { updatedAt: true, dueDate: true, completed: true },
      },
    },
    orderBy: { amount: "desc" },
    take: 20,
  });

  const risks: Array<{
    id: string;
    name: string;
    amount: number;
    stage: string;
    account: string | null;
    daysSinceActivity: number;
    reason: string;
  }> = [];

  for (const deal of openDeals) {
    const lastTouch = deal.activities[0]?.updatedAt ?? deal.updatedAt;
    const daysSince = Math.floor((now.getTime() - lastTouch.getTime()) / 86400000);
    const activity = deal.activities[0];
    const isOverdueActivity =
      activity?.dueDate && activity.dueDate < now && !activity.completed;

    if (daysSince >= inactiveDays) {
      risks.push({
        id: deal.id,
        name: deal.name,
        amount: deal.amount,
        stage: deal.stage.name,
        account: deal.account?.name ?? null,
        daysSinceActivity: daysSince,
        reason: `${daysSince} days without activity`,
      });
    } else if (isOverdueActivity) {
      risks.push({
        id: deal.id,
        name: deal.name,
        amount: deal.amount,
        stage: deal.stage.name,
        account: deal.account?.name ?? null,
        daysSinceActivity: daysSince,
        reason: "Follow-up overdue",
      });
    }
  }

  return risks.slice(0, 6);
}

export async function buildTodaysAgenda(
  workspaceId: string,
  ownerFilter: Record<string, unknown>,
  startOfDay: Date,
  endOfDay: Date
) {
  const [followUps, activities, events] = await Promise.all([
    prisma.followUp.findMany({
      where: {
        workspaceId,
        ...ownerFilter,
        completed: false,
        scheduledAt: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { scheduledAt: "asc" },
      take: 12,
      include: {
        lead: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            company: true,
            leadNumber: true,
          },
        },
      },
    }),
    prisma.activity.findMany({
      where: {
        workspaceId,
        ...ownerFilter,
        completed: false,
        dueDate: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { dueDate: "asc" },
      take: 12,
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, company: true } },
        deal: { select: { id: true, name: true, amount: true } },
      },
    }),
    prisma.calendarEvent.findMany({
      where: {
        workspaceId,
        startAt: { gte: startOfDay, lt: endOfDay },
      },
      orderBy: { startAt: "asc" },
      take: 8,
      select: { id: true, title: true, startAt: true, endAt: true, location: true },
    }),
  ]);

  type AgendaItem = {
    id: string;
    time: string;
    sortKey: number;
    title: string;
    subtitle: string;
    type: string;
    href: string;
  };

  const items: AgendaItem[] = [];

  for (const f of followUps) {
    const t = new Date(f.scheduledAt);
    items.push({
      id: `fu-${f.id}`,
      time: t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      sortKey: t.getTime(),
      title: `${f.lead.firstName} ${f.lead.lastName || ""}`.trim(),
      subtitle: f.lead.company || f.type,
      type: f.type,
      href: `/dashboard/leads/${f.lead.id}`,
    });
  }

  for (const a of activities) {
    if (!a.dueDate) continue;
    const t = new Date(a.dueDate);
    items.push({
      id: `act-${a.id}`,
      time: t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      sortKey: t.getTime(),
      title: a.subject,
      subtitle: a.deal
        ? `${a.deal.name} · ₹${(a.deal.amount / 100000).toFixed(1)}L`
        : a.lead?.company || a.type,
      type: a.type,
      href: a.deal
        ? `/dashboard/deals/${a.deal.id}`
        : a.lead
          ? `/dashboard/leads/${a.lead.id}`
          : "/dashboard/activities",
    });
  }

  for (const e of events) {
    const t = new Date(e.startAt);
    items.push({
      id: `cal-${e.id}`,
      time: t.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false }),
      sortKey: t.getTime(),
      title: e.title,
      subtitle: e.location || "Calendar event",
      type: "meeting",
      href: "/dashboard/calendar",
    });
  }

  return items.sort((a, b) => a.sortKey - b.sortKey).slice(0, 10);
}

export async function buildRevenueTrend(
  dealWhere: Record<string, unknown>,
  months = 6
) {
  const now = new Date();
  const points: Array<{ month: string; pipeline: number; won: number; forecast: number }> = [];

  for (let i = months - 1; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const end = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
    const label = start.toLocaleDateString("en-IN", { month: "short" });

    const [wonAgg, openInMonth] = await Promise.all([
      prisma.deal.aggregate({
        where: {
          ...dealWhere,
          status: "won",
          closedAt: { gte: start, lt: end },
        },
        _sum: { amount: true },
      }),
      prisma.deal.findMany({
        where: {
          ...dealWhere,
          status: "open",
          createdAt: { lt: end },
        },
        select: { amount: true, probability: true },
      }),
    ]);

    const won = wonAgg._sum.amount ?? 0;
    const pipeline = openInMonth.reduce((s, d) => s + d.amount, 0);
    const forecast = openInMonth.reduce(
      (s, d) => s + d.amount * ((d.probability ?? 0) / 100),
      0
    );

    points.push({ month: label, pipeline, won, forecast });
  }

  return points;
}

export async function buildSalesPerformance(
  ctx: WorkspaceContext,
  workspaceId: string,
  leadWhere: Record<string, unknown>,
  dealWhere: Record<string, unknown>
) {
  const role = ctx.membership.role;
  const memberWhere: { workspaceId: string; status: string; userId?: { in: string[] } } = {
    workspaceId,
    status: "active",
  };

  if (role === "employee") {
    memberWhere.userId = { in: [ctx.session.userId] };
  } else if (role === "manager") {
    memberWhere.userId = { in: ctx.teamUserIds };
  }

  const members = await prisma.workspaceMember.findMany({
    where: memberWhere,
    include: { user: { select: { id: true, name: true } } },
  });

  const userIds = members.map((m) => m.userId);
  if (userIds.length === 0) return [];

  const [leadsByOwner, qualifiedByOwner, dealsByOwner, wonByOwner] = await Promise.all([
    prisma.lead.groupBy({
      by: ["ownerId"],
      where: { ...leadWhere, ownerId: { in: userIds } },
      _count: true,
    }),
    prisma.lead.groupBy({
      by: ["ownerId"],
      where: { ...leadWhere, ownerId: { in: userIds }, status: "qualified" },
      _count: true,
    }),
    prisma.deal.groupBy({
      by: ["ownerId"],
      where: { ...dealWhere, ownerId: { in: userIds }, status: "open" },
      _count: true,
    }),
    prisma.deal.groupBy({
      by: ["ownerId"],
      where: { ...dealWhere, ownerId: { in: userIds }, status: "won" },
      _sum: { amount: true },
      _count: true,
    }),
  ]);

  return members
    .map((m) => ({
      userId: m.userId,
      name: m.user.name,
      role: m.role,
      leads: leadsByOwner.find((r) => r.ownerId === m.userId)?._count ?? 0,
      qualified: qualifiedByOwner.find((r) => r.ownerId === m.userId)?._count ?? 0,
      deals: dealsByOwner.find((r) => r.ownerId === m.userId)?._count ?? 0,
      won: wonByOwner.find((r) => r.ownerId === m.userId)?._count ?? 0,
      revenue: wonByOwner.find((r) => r.ownerId === m.userId)?._sum.amount ?? 0,
    }))
    .sort((a, b) => b.revenue - a.revenue);
}

export async function buildLeadSourcePerformance(leadWhere: Record<string, unknown>) {
  const leads = await prisma.lead.findMany({
    where: leadWhere,
    select: { source: true, status: true, budget: true },
  });

  const bySource = new Map<
    string,
    { leads: number; qualified: number; won: number; revenue: number }
  >();

  for (const lead of leads) {
    const source = lead.source || "Unknown";
    const row = bySource.get(source) || { leads: 0, qualified: 0, won: 0, revenue: 0 };
    row.leads += 1;
    if (lead.status === "qualified") row.qualified += 1;
    if (lead.status === "won" || lead.status === "converted") {
      row.won += 1;
      row.revenue += lead.budget ?? 0;
    }
    bySource.set(source, row);
  }

  return Array.from(bySource.entries())
    .map(([source, stats]) => ({ source, ...stats }))
    .sort((a, b) => b.revenue - a.revenue);
}

export function buildAiBrief(
  dealsAtRisk: Array<{
    id: string;
    name: string;
    amount: number;
    stage: string;
    daysSinceActivity: number;
    reason: string;
  }>
) {
  return dealsAtRisk.slice(0, 3).map((d) => ({
    dealId: d.id,
    dealName: d.name,
    amount: d.amount,
    stage: d.stage,
    message: `${d.name} — ${d.reason}.`,
    recommendation:
      d.daysSinceActivity >= 7
        ? "Schedule a follow-up call today."
        : "Send a check-in email or WhatsApp message.",
    action: "follow_up" as const,
  }));
}

export function buildSalesTarget(wonRevenue: number, range: DateRangeKey) {
  const multiplier = range === "month" ? 1 : range === "quarter" ? 3 : 1;
  const base = Math.max(wonRevenue * 1.4, 250000) * multiplier;
  const target = Math.round(base / 50000) * 50000;
  const achieved = wonRevenue;
  const pct = target > 0 ? Math.round((achieved / target) * 1000) / 10 : 0;
  return {
    target,
    achieved,
    pct,
    remaining: Math.max(0, target - achieved),
  };
}

export function buildForecast(
  pipelineValue: number,
  weightedForecast: number,
  wonRevenue: number,
  target: number
) {
  const commit = Math.round(weightedForecast * 0.55);
  const bestCase = Math.round(weightedForecast * 0.85);
  return {
    commit,
    bestCase,
    pipeline: pipelineValue,
    target,
    attainmentPct: target > 0 ? Math.round((commit / target) * 1000) / 10 : 0,
    won: wonRevenue,
  };
}
