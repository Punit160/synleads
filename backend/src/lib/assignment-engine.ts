import { prisma } from "./prisma";
import { ASSIGNMENT_METHODS, type AssignmentMethod } from "./lead-constants";

export type LeadAssignContext = {
  source?: string | null;
  city?: string | null;
  state?: string | null;
  industry?: string | null;
  requirement?: string | null;
};

function parseUserIds(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch {
    return [];
  }
}

function matchesFilter(value: string | null | undefined, filter: string | null | undefined): boolean {
  if (!filter?.trim()) return true;
  if (!value?.trim()) return false;
  return value.toLowerCase().includes(filter.trim().toLowerCase());
}

function ruleMatchesLead(
  rule: {
    sourceFilter: string | null;
    cityFilter: string | null;
    stateFilter: string | null;
    productFilter: string | null;
    distributionMethod: string;
  },
  lead: LeadAssignContext
): boolean {
  if (!matchesFilter(lead.source, rule.sourceFilter)) return false;
  if (!matchesFilter(lead.city, rule.cityFilter)) return false;
  if (!matchesFilter(lead.state, rule.stateFilter)) return false;
  const productHaystack = [lead.industry, lead.requirement].filter(Boolean).join(" ");
  if (!matchesFilter(productHaystack || null, rule.productFilter)) return false;

  if (rule.distributionMethod === "source_based" && !rule.sourceFilter?.trim()) return false;
  if (rule.distributionMethod === "location_based" && !rule.cityFilter?.trim() && !rule.stateFilter?.trim()) {
    return false;
  }
  if (rule.distributionMethod === "product_based" && !rule.productFilter?.trim()) return false;

  return true;
}

async function getEligiblePool(
  workspaceId: string,
  userIds: string[],
  maxLeadLimit?: number | null
): Promise<string[]> {
  if (userIds.length === 0) return [];

  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      userId: { in: userIds },
      status: "active",
      isAvailable: true,
      role: { in: ["employee", "manager", "sales_manager", "admin"] },
    },
    select: { userId: true, maxLeadLimit: true },
  });

  const eligible: string[] = [];
  for (const m of members) {
    const limit = m.maxLeadLimit ?? maxLeadLimit;
    if (limit == null) {
      eligible.push(m.userId);
      continue;
    }
    const openLeads = await prisma.lead.count({
      where: {
        workspaceId,
        ownerId: m.userId,
        archivedAt: null,
        status: { notIn: ["won", "lost"] },
      },
    });
    if (openLeads < limit) eligible.push(m.userId);
  }
  return eligible;
}

async function pickFromPool(
  workspaceId: string,
  pool: string[],
  method: AssignmentMethod,
  ruleId?: string,
  ruleIndex?: number,
  backupUserId?: string | null
): Promise<string | null> {
  if (pool.length === 0) return backupUserId ?? null;

  if (method === "load_based") {
    const counts = await Promise.all(
      pool.map(async (userId) => ({
        userId,
        count: await prisma.lead.count({
          where: {
            workspaceId,
            ownerId: userId,
            archivedAt: null,
            status: { notIn: ["won", "lost"] },
          },
        }),
      }))
    );
    counts.sort((a, b) => a.count - b.count);
    return counts[0]?.userId ?? backupUserId ?? null;
  }

  if (method === "round_robin" && ruleId != null) {
    const rule = await prisma.assignmentRule.findUnique({
      where: { id: ruleId },
      select: { roundRobinIndex: true },
    });
    const idx = (rule?.roundRobinIndex ?? ruleIndex ?? 0) % pool.length;
    await prisma.assignmentRule.update({
      where: { id: ruleId },
      data: { roundRobinIndex: idx + 1 },
    });
    return pool[idx];
  }

  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { autoAssignIndex: true },
  });
  const idx = (ws?.autoAssignIndex ?? 0) % pool.length;
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { autoAssignIndex: idx + 1 },
  });
  return pool[idx];
}

async function resolveRuleOwner(
  workspaceId: string,
  rule: {
    id: string;
    teamId: string | null;
    assigneeUserIds: string;
    distributionMethod: string;
    maxLeadLimit: number | null;
    backupUserId: string | null;
    roundRobinIndex: number;
  }
): Promise<string | null> {
  let userIds = parseUserIds(rule.assigneeUserIds);

  if (rule.teamId) {
    const teamMembers = await prisma.teamMember.findMany({
      where: { teamId: rule.teamId },
      select: { userId: true },
    });
    const teamIds = teamMembers.map((m) => m.userId);
    userIds = userIds.length > 0 ? userIds.filter((id) => teamIds.includes(id)) : teamIds;
  }

  const method = ASSIGNMENT_METHODS.includes(rule.distributionMethod as AssignmentMethod)
    ? (rule.distributionMethod as AssignmentMethod)
    : "round_robin";

  const pool = await getEligiblePool(workspaceId, userIds, rule.maxLeadLimit);
  return pickFromPool(workspaceId, pool, method, rule.id, rule.roundRobinIndex, rule.backupUserId);
}

async function resolveWorkspaceAutoAssign(workspaceId: string): Promise<string | null> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { autoAssignEnabled: true, autoAssignMode: true, userId: true },
  });
  if (!ws?.autoAssignEnabled) return null;

  const members = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      status: "active",
      isAvailable: true,
      role: { in: ["employee", "manager", "sales_manager"] },
    },
    orderBy: { createdAt: "asc" },
    select: { userId: true },
  });

  const pool = members.map((m) => m.userId);
  if (pool.length === 0) return ws.userId;

  const method = ASSIGNMENT_METHODS.includes(ws.autoAssignMode as AssignmentMethod)
    ? (ws.autoAssignMode as AssignmentMethod)
    : "round_robin";

  return pickFromPool(workspaceId, pool, method, undefined, undefined, ws.userId);
}

/** Resolve owner using assignment rules → workspace auto-assign → workspace owner */
export async function resolveAssignmentForLead(
  workspaceId: string,
  lead: LeadAssignContext = {}
): Promise<string | null> {
  const rules = await prisma.assignmentRule.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });

  for (const rule of rules) {
    if (!ruleMatchesLead(rule, lead)) continue;
    const ownerId = await resolveRuleOwner(workspaceId, rule);
    if (ownerId) return ownerId;
    if (rule.backupUserId) return rule.backupUserId;
  }

  const auto = await resolveWorkspaceAutoAssign(workspaceId);
  if (auto) return auto;

  const ws = await prisma.workspace.findUnique({ where: { id: workspaceId }, select: { userId: true } });
  return ws?.userId ?? null;
}

export async function getMemberWorkload(workspaceId: string) {
  const members = await prisma.workspaceMember.findMany({
    where: { workspaceId, status: "active" },
    include: { user: { select: { id: true, name: true, email: true } }, managerUser: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });

  const counts = await prisma.lead.groupBy({
    by: ["ownerId"],
    where: { workspaceId, archivedAt: null, ownerId: { not: null } },
    _count: { _all: true },
  });
  const openCounts = await prisma.lead.groupBy({
    by: ["ownerId"],
    where: {
      workspaceId,
      archivedAt: null,
      ownerId: { not: null },
      status: { notIn: ["won", "lost"] },
    },
    _count: { _all: true },
  });
  const countMap = new Map(counts.map((c) => [c.ownerId!, c._count._all]));
  const openMap = new Map(openCounts.map((c) => [c.ownerId!, c._count._all]));

  return members.map((m) => ({
    memberId: m.id,
    userId: m.userId,
    name: m.user.name,
    email: m.user.email,
    role: m.role,
    managerUserId: m.managerUserId,
    managerName: m.managerUser?.name ?? null,
    isAvailable: m.isAvailable,
    maxLeadLimit: m.maxLeadLimit,
    totalLeads: countMap.get(m.userId) ?? 0,
    openLeads: openMap.get(m.userId) ?? 0,
    atCapacity: m.maxLeadLimit != null && (openMap.get(m.userId) ?? 0) >= m.maxLeadLimit,
  }));
}
