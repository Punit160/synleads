import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getAuthenticatedContext, getLeadOwnerFilter, getOwnerIdFilter, requirePermission, type WorkspaceContext } from "../lib/rbac";
import { INTEGRATION_CATALOG, isIntegrationConnected, type IntegrationId } from "../lib/integration-catalog";
import { computeWonRevenueMetrics } from "../lib/lead-conversion";
import { normalizeRole } from "../lib/roles";
import {
  buildAiBrief,
  buildDealsAtRisk,
  buildForecast,
  buildLeadFunnel,
  buildLeadSourcePerformance,
  buildRevenueTrend,
  buildSalesPerformance,
  buildSalesTarget,
  buildTodaysAgenda,
  parseDateRange,
  pctChange,
} from "../lib/dashboard-helpers";

const router = Router();

function normalizeLeadsByStatus(rows: Array<{ status: string; _count: number }>) {
  const merged = new Map<string, number>();
  for (const row of rows) {
    const status = row.status === "converted" ? "won" : row.status;
    merged.set(status, (merged.get(status) ?? 0) + row._count);
  }
  return Array.from(merged.entries()).map(([status, count]) => ({ status, count }));
}

async function buildTeamWorkingReport(
  ctx: WorkspaceContext,
  workspaceId: string,
  leadWhere: Record<string, unknown>,
  startOfDay: Date,
  endOfDay: Date,
  now: Date
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

  const [leadsByOwner, activitiesToday, followUpsDue, followUpsOverdue, commsToday] = await Promise.all([
    prisma.lead.groupBy({
      by: ["ownerId"],
      where: { ...leadWhere, ownerId: { in: userIds } },
      _count: true,
    }),
    prisma.leadTimelineEvent.groupBy({
      by: ["userId"],
      where: {
        userId: { in: userIds },
        createdAt: { gte: startOfDay, lt: endOfDay },
        lead: { workspaceId },
      },
      _count: true,
    }),
    prisma.followUp.groupBy({
      by: ["ownerId"],
      where: {
        workspaceId,
        ownerId: { in: userIds },
        completed: false,
        scheduledAt: { gte: startOfDay, lt: endOfDay },
      },
      _count: true,
    }),
    prisma.followUp.groupBy({
      by: ["ownerId"],
      where: {
        workspaceId,
        ownerId: { in: userIds },
        completed: false,
        scheduledAt: { lt: now },
      },
      _count: true,
    }),
    prisma.communication.groupBy({
      by: ["ownerId"],
      where: {
        workspaceId,
        ownerId: { in: userIds },
        createdAt: { gte: startOfDay, lt: endOfDay },
      },
      _count: true,
    }),
  ]);

  return members
    .map((m) => ({
      userId: m.userId,
      name: m.user.name,
      role: normalizeRole(m.role),
      leadCount: leadsByOwner.find((r) => r.ownerId === m.userId)?._count ?? 0,
      activitiesToday: activitiesToday.find((r) => r.userId === m.userId)?._count ?? 0,
      followUpsDue: followUpsDue.find((r) => r.ownerId === m.userId)?._count ?? 0,
      followUpsOverdue: followUpsOverdue.find((r) => r.ownerId === m.userId)?._count ?? 0,
      communicationsToday: commsToday.find((r) => r.ownerId === m.userId)?._count ?? 0,
    }))
    .sort((a, b) => {
      const score = (r: typeof a) => r.activitiesToday + r.communicationsToday + r.followUpsDue - r.followUpsOverdue * 2;
      return score(b) - score(a);
    });
}

router.get("/stats", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const workspace = ctx.workspace;
    const range = parseDateRange(typeof req.query.range === "string" ? req.query.range : "month");
    const ownerIdFilter =
      typeof req.query.ownerId === "string" && req.query.ownerId !== "all"
        ? req.query.ownerId
        : null;

    let leadWhere = { workspaceId: workspace.id, ...getLeadOwnerFilter(ctx) } as Record<string, unknown>;
    let ownerFilter = getOwnerIdFilter(ctx) as Record<string, unknown>;
    let dealWhere = { workspaceId: workspace.id, ...ownerFilter } as Record<string, unknown>;

    if (ownerIdFilter) {
      leadWhere = { ...leadWhere, ownerId: ownerIdFilter };
      ownerFilter = { ...ownerFilter, ownerId: ownerIdFilter };
      dealWhere = { ...dealWhere, ownerId: ownerIdFilter };
    }

    if (range.start) {
      leadWhere = { ...leadWhere, createdAt: { gte: range.start, lte: range.end } };
    }

    const scopedFollowUp = { workspaceId: workspace.id, ...ownerFilter };
    const scopedComm = { workspaceId: workspace.id, ...ownerFilter };

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const now = new Date();

    const [
      totalLeads,
      newLeadsToday,
      followUpsDueToday,
      followUpsOverdue,
      convertedLeads,
      lostLeads,
      onHoldLeads,
      qualifiedLeads,
      contactCount,
      accountCount,
      openDeals,
      wonDeals,
      lostDealsAgg,
      communicationsTotal,
      communicationsToday,
      recentActivities,
      leadsBySource,
      leadsByStatus,
      leadsByPriority,
      stages,
      recentLeads,
      recentDeals,
      upcomingFollowUps,
    ] = await Promise.all([
      prisma.lead.count({ where: leadWhere }),
      prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: startOfDay, lt: endOfDay } } }),
      prisma.followUp.count({ where: { ...scopedFollowUp, completed: false, scheduledAt: { gte: startOfDay, lt: endOfDay } } }),
      prisma.followUp.count({ where: { ...scopedFollowUp, completed: false, scheduledAt: { lt: now } } }),
      prisma.lead.count({ where: { ...leadWhere, status: { in: ["won", "converted"] } } }),
      prisma.lead.count({ where: { ...leadWhere, status: "lost" } }),
      prisma.lead.count({ where: { ...leadWhere, status: "on_hold" } }),
      prisma.lead.count({ where: { ...leadWhere, status: "qualified" } }),
      prisma.contact.count({ where: { workspaceId: workspace.id } }),
      prisma.account.count({ where: { workspaceId: workspace.id } }),
      prisma.deal.findMany({
        where: { ...dealWhere, status: "open" },
        select: { id: true, name: true, amount: true, probability: true, updatedAt: true, stage: { select: { name: true } }, account: { select: { name: true } } },
        orderBy: { amount: "desc" },
        take: 10,
      }),
      prisma.deal.aggregate({ where: { ...dealWhere, status: "won" }, _sum: { amount: true }, _count: true }),
      prisma.deal.aggregate({ where: { ...dealWhere, status: "lost" }, _sum: { amount: true }, _count: true }),
      prisma.communication.count({ where: scopedComm }),
      prisma.communication.count({ where: { ...scopedComm, createdAt: { gte: startOfDay, lt: endOfDay } } }),
      prisma.leadTimelineEvent.findMany({
        where: { lead: leadWhere },
        include: {
          lead: { select: { id: true, firstName: true, lastName: true, leadNumber: true, company: true } },
          user: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
        take: 15,
      }),
      prisma.lead.groupBy({ by: ["source"], where: leadWhere, _count: true }),
      prisma.lead.groupBy({ by: ["status"], where: leadWhere, _count: true }),
      prisma.lead.groupBy({ by: ["priority"], where: leadWhere, _count: true }),
      prisma.pipelineStage.findMany({
        where: { workspaceId: workspace.id, isWon: false, isLost: false },
        orderBy: { order: "asc" },
        include: { deals: { where: { status: "open", ...ownerFilter }, select: { amount: true } } },
      }),
      prisma.lead.findMany({
        where: leadWhere,
        orderBy: { updatedAt: "desc" },
        take: 10,
        select: {
          id: true, leadNumber: true, firstName: true, lastName: true, company: true,
          status: true, source: true, score: true, priority: true, phone: true, updatedAt: true,
        },
      }),
      prisma.deal.findMany({
        where: { ...dealWhere, status: "open" },
        orderBy: { updatedAt: "desc" },
        take: 8,
        select: {
          id: true, name: true, amount: true, probability: true, updatedAt: true,
          stage: { select: { name: true } },
          account: { select: { name: true } },
          contact: { select: { firstName: true, lastName: true } },
        },
      }),
      prisma.followUp.findMany({
        where: { ...scopedFollowUp, completed: false, scheduledAt: { gte: now } },
        orderBy: { scheduledAt: "asc" },
        take: 8,
        include: {
          lead: { select: { id: true, leadNumber: true, firstName: true, lastName: true, company: true, phone: true } },
          owner: { select: { name: true } },
        },
      }),
    ]);

    const tomorrowEnd = new Date(endOfDay);
    tomorrowEnd.setDate(tomorrowEnd.getDate() + 1);

    const [unassignedLeads, myLeads, activeLeads, followUpsTomorrow, followUpsUpcoming, leadValueAgg] = await Promise.all([
      prisma.lead.count({ where: { ...leadWhere, ownerId: null } }),
      prisma.lead.count({ where: { ...leadWhere, ownerId: ctx.session.userId } }),
      prisma.lead.count({ where: { ...leadWhere, status: { notIn: ["won", "lost", "converted"] } } }),
      prisma.followUp.count({
        where: { ...scopedFollowUp, completed: false, scheduledAt: { gte: endOfDay, lt: tomorrowEnd } },
      }),
      prisma.followUp.count({
        where: { ...scopedFollowUp, completed: false, scheduledAt: { gte: endOfDay } },
      }),
      prisma.lead.aggregate({
        where: { ...leadWhere, status: { notIn: ["won", "lost", "converted"] } },
        _sum: { budget: true },
      }),
    ]);

    const pipelineValue = openDeals.reduce((s, d) => s + d.amount, 0);
    const weightedForecast = openDeals.reduce((s, d) => s + d.amount * ((d.probability ?? 0) / 100), 0);
    const avgDealSize = openDeals.length > 0 ? pipelineValue / openDeals.length : 0;
    const leadPipelineValue = leadValueAgg._sum.budget ?? 0;

    const pipelineByStage = stages.map((s) => ({
      id: s.id,
      name: s.name,
      dealCount: s.deals.length,
      totalValue: s.deals.reduce((sum, d) => sum + d.amount, 0),
      probability: s.probability,
    }));

    const sourceTotal = leadsBySource.reduce((s, r) => s + r._count, 0) || 1;

    const wonMetrics = await computeWonRevenueMetrics(workspace.id, leadWhere, dealWhere);
    const teamWorkingReport = await buildTeamWorkingReport(ctx, workspace.id, leadWhere, startOfDay, endOfDay, now);

    const statusMap = new Map(leadsByStatus.map((r) => [r.status === "converted" ? "won" : r.status, r._count]));
    const leadFunnel = buildLeadFunnel(statusMap);
    const funnelTotal = leadFunnel[0]?.count ?? 0;
    const funnelWon = statusMap.get("won") ?? 0;
    const overallFunnelConversion =
      funnelTotal > 0 ? Math.round((funnelWon / funnelTotal) * 1000) / 10 : 0;

    const [
      dealsAtRisk,
      todaysAgenda,
      revenueTrend,
      salesPerformance,
      leadSourcePerformance,
      filterOwners,
    ] = await Promise.all([
      buildDealsAtRisk(dealWhere, workspace.id, now),
      buildTodaysAgenda(workspace.id, ownerFilter, startOfDay, endOfDay),
      buildRevenueTrend(dealWhere),
      buildSalesPerformance(ctx, workspace.id, leadWhere, dealWhere),
      buildLeadSourcePerformance(leadWhere),
      prisma.workspaceMember.findMany({
        where: { workspaceId: workspace.id, status: "active" },
        include: { user: { select: { id: true, name: true } } },
      }),
    ]);

    const salesTarget = buildSalesTarget(wonMetrics.wonRevenue, range.key);
    const forecast = buildForecast(
      pipelineValue,
      weightedForecast,
      wonMetrics.wonRevenue,
      salesTarget.target
    );
    const aiBrief = buildAiBrief(dealsAtRisk);

    let prevPipeline = pipelineValue;
    let prevWon = wonMetrics.wonRevenue;
    if (range.prevStart && range.prevEnd) {
      const [prevOpen, prevWonAgg] = await Promise.all([
        prisma.deal.findMany({
          where: {
            ...dealWhere,
            status: "open",
            createdAt: { gte: range.prevStart, lte: range.prevEnd },
          },
          select: { amount: true },
        }),
        prisma.deal.aggregate({
          where: {
            ...dealWhere,
            status: "won",
            closedAt: { gte: range.prevStart, lte: range.prevEnd },
          },
          _sum: { amount: true },
        }),
      ]);
      prevPipeline = prevOpen.reduce((s, d) => s + d.amount, 0);
      prevWon = prevWonAgg._sum.amount ?? 0;
    }

    const topPerformer = salesPerformance[0]
      ? { name: salesPerformance[0].name, revenue: salesPerformance[0].revenue }
      : null;
    const bestSource = leadSourcePerformance[0]?.source ?? null;
    const user = await prisma.user.findUnique({
      where: { id: ctx.session.userId },
      select: { name: true },
    });

    res.json({
      userName: user?.name ?? "there",
      userRole: normalizeRole(ctx.membership.role),
      dateRange: range.key,
      attention: {
        followUpsDue: followUpsDueToday,
        followUpsOverdue,
        followUpsUpcoming,
        followUpsTomorrow,
        pipelineValue,
        weightedPipeline: weightedForecast,
        dealsAtRiskCount: dealsAtRisk.length,
      },
      kpiTrends: {
        pipelineChangePct: pctChange(pipelineValue, prevPipeline),
        wonChangePct: pctChange(wonMetrics.wonRevenue, prevWon),
        conversionChangePct: null,
        forecastChangePct: pctChange(weightedForecast, prevPipeline * 0.7),
      },
      salesTarget,
      forecast,
      dealsAtRisk,
      todaysAgenda,
      revenueTrend,
      leadFunnel,
      overallFunnelConversion,
      salesPerformance,
      topPerformer,
      leadSourcePerformance,
      bestSource,
      aiBrief,
      filterOptions: {
        owners: filterOwners
          .map((m) => ({ id: m.userId, name: m.user.name }))
          .sort((a, b) => a.name.localeCompare(b.name)),
      },
      avgSalesCycleDays: 23,
      totalLeads,
      newLeadsToday,
      newLeads: statusMap.get("new") ?? 0,
      activeLeads,
      unassignedLeads,
      myLeads,
      teamLeads: totalLeads,
      followUpsDueToday,
      followUpsOverdue,
      followUpsTomorrow,
      followUpsUpcoming,
      convertedLeads,
      lostLeads,
      onHoldLeads,
      qualifiedLeads,
      proposalLeads: statusMap.get("proposal_sent") ?? 0,
      negotiationLeads: statusMap.get("negotiation") ?? 0,
      leadPipelineValue,
      contactCount,
      accountCount,
      pipelineValue,
      weightedForecast,
      avgDealSize,
      wonRevenue: wonMetrics.wonRevenue,
      wonDealCount: wonMetrics.wonDealCount,
      lostDealValue: lostDealsAgg._sum.amount ?? 0,
      lostDealCount: lostDealsAgg._count,
      openDealCount: openDeals.length,
      communicationsTotal,
      communicationsToday,
      conversionRate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0,
      winRate: (convertedLeads + lostLeads) > 0 ? Math.round((convertedLeads / (convertedLeads + lostLeads)) * 1000) / 10 : 0,
      recentLeads,
      recentDeals,
      upcomingFollowUps,
      recentActivities,
      leadsBySource: leadsBySource
        .map((r) => ({
          source: r.source || "Unknown",
          count: r._count,
          pct: Math.round((r._count / sourceTotal) * 1000) / 10,
        }))
        .sort((a, b) => b.count - a.count),
      leadsByStatus: normalizeLeadsByStatus(leadsByStatus),
      leadsByPriority: leadsByPriority.map((r) => ({ priority: r.priority, count: r._count })),
      pipelineByStage,
      topDeals: openDeals.slice(0, 5),
      teamWorkingReport,
    });
  } catch (e) {
    console.error("Dashboard stats error:", e);
    const msg = e instanceof Error ? e.message : "Failed to load dashboard";
    if (msg === "Unauthorized" || msg.includes("session")) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }
    if (msg === "Forbidden") {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    res.status(500).json({ error: msg });
  }
});

router.get("/connections", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    const [rows, workspace] = await Promise.all([
      prisma.workspaceIntegration.findMany({ where: { workspaceId: ctx.workspace.id } }),
      prisma.workspace.findUnique({ where: { id: ctx.workspace.id }, select: { leadApiKey: true } }),
    ]);
    const byId = new Map(rows.map((r) => [r.integrationId, r]));
    const hasLeadApiKey = !!workspace?.leadApiKey;
    res.json(
      INTEGRATION_CATALOG.map((item) => {
        const row = byId.get(item.id);
        const config = (row?.config as Record<string, unknown>) || {};
        const connected = isIntegrationConnected(item.id as IntegrationId, config, { hasLeadApiKey });
        return {
          id: item.id,
          name: item.name,
          category: item.category,
          status: connected ? "connected" : "disconnected",
          lastSync: row?.lastSyncAt?.toISOString() ?? null,
        };
      })
    );
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

router.get("/reports", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "reports");
    const workspace = ctx.workspace;
    const leadWhere = { workspaceId: workspace.id, ...getLeadOwnerFilter(ctx) };
    const ownerFilter = getOwnerIdFilter(ctx);
    const dealWhere = { workspaceId: workspace.id, ...ownerFilter };
    const scopedFollowUp = { workspaceId: workspace.id, ...ownerFilter };
    const startOfMonth = new Date();
    startOfMonth.setDate(1);
    startOfMonth.setHours(0, 0, 0, 0);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const [
      leadsByStatus, leadsBySource, stages, lostDeals,
      lostLeads, convertedLeads, totalLeads,
      followUpsToday, followUpsOverdue, followUpsCompleted,
      monthlyLeads, monthlyDeals, dailyActivities,
      members, dealsByOwner, wonLeadsByOwner,
      leadsByOwner, unassignedLeads, assignedLeads,
      wonLeads, lostLeadsCount, followUpsByOwner,
      assignmentEvents,
    ] = await Promise.all([
      prisma.lead.groupBy({ by: ["status"], where: leadWhere, _count: true }),
      prisma.lead.groupBy({ by: ["source"], where: leadWhere, _count: true }),
      prisma.pipelineStage.findMany({
        where: { workspaceId: workspace.id },
        orderBy: { order: "asc" },
        include: { deals: { where: { status: "open", ...ownerFilter }, select: { amount: true, status: true } } },
      }),
      prisma.deal.aggregate({ where: { ...dealWhere, status: "lost" }, _sum: { amount: true }, _count: true }),
      prisma.lead.findMany({ where: { ...leadWhere, status: "lost" }, select: { id: true, firstName: true, lastName: true, company: true, source: true, updatedAt: true }, orderBy: { updatedAt: "desc" }, take: 20 }),
      prisma.lead.count({ where: { ...leadWhere, status: { in: ["won", "converted"] } } }),
      prisma.lead.count({ where: leadWhere }),
      prisma.followUp.count({ where: { ...scopedFollowUp, completed: false, scheduledAt: { gte: startOfDay, lt: endOfDay } } }),
      prisma.followUp.count({ where: { ...scopedFollowUp, completed: false, scheduledAt: { lt: startOfDay } } }),
      prisma.followUp.count({ where: { ...scopedFollowUp, completed: true } }),
      prisma.lead.count({ where: { ...leadWhere, createdAt: { gte: startOfMonth } } }),
      prisma.deal.findMany({ where: { ...dealWhere, createdAt: { gte: startOfMonth } }, select: { amount: true, status: true } }),
      prisma.leadTimelineEvent.findMany({ where: { lead: leadWhere, createdAt: { gte: startOfDay, lt: endOfDay } }, include: { user: { select: { name: true } }, lead: { select: { leadNumber: true } } }, orderBy: { createdAt: "desc" }, take: 30 }),
      prisma.workspaceMember.findMany({ where: { workspaceId: workspace.id }, include: { user: { select: { id: true, name: true } }, managerUser: { select: { id: true, name: true } } } }),
      prisma.deal.groupBy({ by: ["ownerId"], where: { ...dealWhere, status: "won" }, _sum: { amount: true }, _count: true }),
      prisma.lead.groupBy({
        by: ["ownerId"],
        where: { ...leadWhere, status: { in: ["won", "converted"] } },
        _sum: { budget: true },
        _count: true,
      }),
      prisma.lead.groupBy({ by: ["ownerId"], where: { ...leadWhere, ownerId: { not: null } }, _count: true }),
      prisma.lead.count({ where: { ...leadWhere, ownerId: null } }),
      prisma.lead.count({ where: { ...leadWhere, ownerId: { not: null } } }),
      prisma.lead.count({ where: { ...leadWhere, status: { in: ["won", "converted"] } } }),
      prisma.lead.count({ where: { ...leadWhere, status: "lost" } }),
      prisma.followUp.groupBy({
        by: ["ownerId"],
        where: scopedFollowUp,
        _count: true,
      }),
      prisma.leadTimelineEvent.count({
        where: { lead: leadWhere, type: "assigned", createdAt: { gte: startOfMonth } },
      }),
    ]);

    const wonMetrics = await computeWonRevenueMetrics(workspace.id, leadWhere, dealWhere);
    const monthlyRevenue = monthlyDeals.filter((d) => d.status === "won").reduce((s, d) => s + d.amount, 0);
    const openPipelineDeals = stages
      .filter((s) => !s.isWon && !s.isLost)
      .flatMap((s) => s.deals);

    const memberMap = new Map(members.map((m) => [m.userId, m]));
    const employeeLeadReport = leadsByOwner.map((row) => {
      const member = row.ownerId ? memberMap.get(row.ownerId) : undefined;
      return {
        userId: row.ownerId,
        name: member?.user.name ?? "Unknown",
        role: member?.role ?? "—",
        managerName: member?.managerUser?.name ?? null,
        leadCount: row._count,
      };
    }).sort((a, b) => b.leadCount - a.leadCount);

    const teamLeadMap = new Map<string, { managerId: string; managerName: string; leadCount: number; members: number }>();
    for (const row of leadsByOwner) {
      if (!row.ownerId) continue;
      const member = memberMap.get(row.ownerId);
      const managerId = member?.managerUserId || member?.userId || "unassigned";
      const managerName = member?.managerUser?.name || member?.user.name || "Direct";
      const existing = teamLeadMap.get(managerId) || { managerId, managerName, leadCount: 0, members: 0 };
      existing.leadCount += row._count;
      teamLeadMap.set(managerId, existing);
    }
    for (const m of members) {
      if (!m.managerUserId) continue;
      const entry = teamLeadMap.get(m.managerUserId);
      if (entry) entry.members += 1;
    }

    const followUpByEmployee = followUpsByOwner.map((row) => {
      const member = row.ownerId ? memberMap.get(row.ownerId) : undefined;
      return {
        userId: row.ownerId,
        name: member?.user.name ?? "Unassigned",
        followUpCount: row._count,
      };
    }).sort((a, b) => b.followUpCount - a.followUpCount);

    res.json({
      leadsByStatus: normalizeLeadsByStatus(leadsByStatus),
      leadsBySource: leadsBySource.map((r) => ({ source: r.source || "Unknown", count: r._count })),
      pipelineByStage: stages.map((s) => ({
        id: s.id,
        name: s.name,
        dealCount: s.deals.length,
        totalValue: s.deals.reduce((sum, d) => sum + d.amount, 0),
        isWon: s.isWon,
        isLost: s.isLost,
      })),
      won: {
        count: wonMetrics.wonDealCount,
        leadCount: wonLeads,
        revenue: wonMetrics.wonRevenue,
      },
      lost: { count: lostDeals._count, value: lostDeals._sum.amount ?? 0 },
      conversionReport: {
        totalLeads,
        converted: convertedLeads,
        rate: totalLeads > 0 ? Math.round((convertedLeads / totalLeads) * 1000) / 10 : 0,
        bySource: leadsBySource.map((r) => ({ source: r.source || "Unknown", count: r._count })),
      },
      salesReport: {
        pipelineValue: openPipelineDeals.reduce((sum, d) => sum + d.amount, 0),
        wonRevenue: wonMetrics.wonRevenue,
        lostValue: lostDeals._sum.amount ?? 0,
        openDeals: openPipelineDeals.length,
      },
      executivePerformance: members.map((m) => {
        const perf = dealsByOwner.find((d) => d.ownerId === m.userId);
        const leadPerf = leadsByOwner.find((d) => d.ownerId === m.userId);
        const wonLeadPerf = wonLeadsByOwner.find((d) => d.ownerId === m.userId);
        const dealRevenue = perf?._sum.amount ?? 0;
        const budgetRevenue = wonLeadPerf?._sum.budget ?? 0;
        return {
          userId: m.userId,
          name: m.user.name,
          role: m.role,
          wonDeals: perf?._count ?? 0,
          wonLeads: wonLeadPerf?._count ?? 0,
          wonRevenue: Math.max(dealRevenue, budgetRevenue),
          leadCount: leadPerf?._count ?? 0,
        };
      }),
      lostLeadReport: lostLeads,
      revenueReport: {
        total: wonMetrics.wonRevenue,
        monthly: monthlyRevenue,
        wonCount: Math.max(wonMetrics.wonDealCount, wonLeads),
      },
      monthlyReport: {
        newLeads: monthlyLeads,
        dealsCreated: monthlyDeals.length,
        revenue: monthlyRevenue,
        month: startOfMonth.toISOString().slice(0, 7),
      },
      dailyActivityReport: dailyActivities.map((a) => ({
        id: a.id,
        title: a.title,
        user: a.user?.name,
        lead: a.lead?.leadNumber,
        createdAt: a.createdAt,
      })),
      employeeLeadReport,
      teamLeadReport: Array.from(teamLeadMap.values()).sort((a, b) => b.leadCount - a.leadCount),
      assignmentReport: {
        totalLeads,
        assigned: assignedLeads,
        unassigned: unassignedLeads,
        assignmentsThisMonth: assignmentEvents,
        assignmentRate: totalLeads > 0 ? Math.round((assignedLeads / totalLeads) * 1000) / 10 : 0,
      },
      followUpReport: {
        dueToday: followUpsToday,
        overdue: followUpsOverdue,
        completed: followUpsCompleted,
        byEmployee: followUpByEmployee,
      },
      wonLostAnalysis: {
        won: wonLeads,
        lost: lostLeadsCount,
        winRate: wonLeads + lostLeadsCount > 0 ? Math.round((wonLeads / (wonLeads + lostLeadsCount)) * 1000) / 10 : 0,
        dealWon: wonMetrics.wonDealCount,
        dealLost: lostDeals._count,
        dealWinRate: wonMetrics.wonDealCount + lostDeals._count > 0
          ? Math.round((wonMetrics.wonDealCount / (wonMetrics.wonDealCount + lostDeals._count)) * 1000) / 10
          : 0,
      },
    });
  } catch (e) {
    console.error("Reports error:", e);
    const msg = e instanceof Error ? e.message : "";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg || "Unauthorized" });
  }
});

export default router;
