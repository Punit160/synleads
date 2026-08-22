import type { Request } from "express";
import type { Prisma } from "@prisma/client";
import { prisma } from "./prisma";
import { requireSession, type SessionPayload } from "./auth";
import {
  canManageTeam as roleCanManageTeam,
  canViewAllLeads,
  hasPermission,
  normalizeRole,
  type Permission,
  type Role,
} from "./roles";

export type WorkspaceContext = {
  session: SessionPayload;
  workspace: { id: string; name: string; userId: string; status: string };
  membership: {
    id: string;
    role: Role;
    rawRole: string;
    managerUserId: string | null;
    userId: string;
  };
  permissions: Permission[];
  teamUserIds: string[];
};

export async function getWorkspaceMembership(userId: string, workspaceId: string) {
  const membership = await prisma.workspaceMember.findUnique({
    where: { workspaceId_userId: { workspaceId, userId } },
  });
  if (membership) return membership;

  const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
  if (workspace?.userId === userId) {
    return prisma.workspaceMember.upsert({
      where: { workspaceId_userId: { workspaceId, userId } },
      create: { workspaceId, userId, role: "owner", status: "active" },
      update: {},
    });
  }
  return null;
}

export async function getTeamUserIds(workspaceId: string, managerUserId: string): Promise<string[]> {
  const reports = await prisma.workspaceMember.findMany({
    where: { workspaceId, managerUserId, status: "active" },
    select: { userId: true },
  });
  return [managerUserId, ...reports.map((r) => r.userId)];
}

export async function getAuthenticatedContext(req: Request): Promise<WorkspaceContext> {
  const session = await requireSession(req);

  const membershipRow = await prisma.workspaceMember.findFirst({
    where: { userId: session.userId, status: "active" },
    include: { workspace: { include: { subscription: true } } },
    orderBy: { createdAt: "asc" },
  });

  let workspace = membershipRow?.workspace;

  if (!workspace) {
    const owned = await prisma.workspace.findUnique({
      where: { userId: session.userId },
      include: { subscription: true },
    });
    if (!owned) {
      throw new Error("No workspace");
    }
    workspace = owned;
  }

  if (workspace.status === "suspended") {
    throw new Error("Workspace suspended");
  }

  const sub = workspace.subscription;
  if (sub && sub.status === "expired") {
    throw new Error("Subscription expired");
  }
  if (sub && sub.expiresAt < new Date() && sub.status === "active") {
    await prisma.subscription.update({
      where: { id: sub.id },
      data: { status: "expired" },
    });
    throw new Error("Subscription expired");
  }

  const membership = await getWorkspaceMembership(session.userId, workspace.id);
  if (!membership || membership.status !== "active") {
    throw new Error("Unauthorized");
  }

  const role = normalizeRole(membership.role);
  const permissions = (
    ["view", "add", "edit", "delete", "export", "import", "assign", "reports", "manage_users", "manage_team"] as Permission[]
  ).filter((p) => hasPermission(role, p));

  const teamUserIds =
    role === "manager"
      ? await getTeamUserIds(workspace.id, session.userId)
      : role === "employee"
        ? [session.userId]
        : [];

  return {
    session,
    workspace: {
      id: workspace.id,
      name: workspace.name,
      userId: workspace.userId,
      status: workspace.status,
    },
    membership: {
      id: membership.id,
      role,
      rawRole: membership.role,
      managerUserId: membership.managerUserId,
      userId: session.userId,
    },
    permissions,
    teamUserIds,
  };
}

export function requirePermission(ctx: WorkspaceContext, permission: Permission) {
  if (!hasPermission(ctx.membership.role, permission)) {
    throw new Error("Forbidden");
  }
}

/** Owner/Admin/Viewer — workspace-wide read scope */
export function canViewAllRecords(role: string): boolean {
  return canViewAllLeads(role);
}

function isAdminRole(ctx: WorkspaceContext): boolean {
  return ctx.membership.role === "owner" || ctx.membership.role === "admin";
}

export type OwnerScopeWhere = {
  OR?: Array<{ ownerId: null } | { ownerId: { in: string[] } }>;
  ownerId?: string;
};

/** Hierarchy: Admin → Manager (team + unassigned) → Executive (own only) */
export function getOwnerScopeFilter(ctx: WorkspaceContext): OwnerScopeWhere {
  if (canViewAllRecords(ctx.membership.role)) return {};
  if (ctx.membership.role === "manager") {
    return {
      OR: [{ ownerId: null }, { ownerId: { in: ctx.teamUserIds } }],
    };
  }
  return { ownerId: ctx.session.userId };
}

export function getLeadOwnerFilter(ctx: WorkspaceContext): Prisma.LeadWhereInput {
  return getOwnerScopeFilter(ctx) as Prisma.LeadWhereInput;
}

export function getOwnerIdFilter(ctx: WorkspaceContext): { ownerId?: string | { in: string[] } } {
  const scope = getOwnerScopeFilter(ctx);
  if ("ownerId" in scope && scope.ownerId !== undefined) {
    return { ownerId: scope.ownerId };
  }
  return {};
}

export function canAccessByOwner(ctx: WorkspaceContext, ownerId: string | null): boolean {
  if (canViewAllRecords(ctx.membership.role)) return true;
  if (!ownerId) return ctx.membership.role === "manager" || isAdminRole(ctx);
  if (ctx.membership.role === "manager") {
    return ctx.teamUserIds.includes(ownerId);
  }
  return ownerId === ctx.session.userId;
}

export function canAccessLead(ctx: WorkspaceContext, ownerId: string | null): boolean {
  return canAccessByOwner(ctx, ownerId);
}

export function requireRecordAccess(ctx: WorkspaceContext, ownerId: string | null) {
  if (!canAccessByOwner(ctx, ownerId)) {
    throw new Error("Forbidden");
  }
}

export function canFilterByOwnerId(ctx: WorkspaceContext, ownerId: string): boolean {
  if (canViewAllRecords(ctx.membership.role)) return true;
  if (ctx.membership.role === "manager") {
    return ctx.teamUserIds.includes(ownerId);
  }
  return ownerId === ctx.session.userId;
}

export async function canAssignToUser(
  ctx: WorkspaceContext,
  targetUserId: string
): Promise<boolean> {
  if (!hasPermission(ctx.membership.role, "assign")) return false;
  if (isAdminRole(ctx)) return true;
  if (ctx.membership.role === "manager") {
    return ctx.teamUserIds.includes(targetUserId);
  }
  return false;
}

export async function canAssignTaskTo(ctx: WorkspaceContext, assigneeId: string): Promise<boolean> {
  if (isAdminRole(ctx)) return true;
  if (ctx.membership.role === "manager") {
    return ctx.teamUserIds.includes(assigneeId);
  }
  return assigneeId === ctx.session.userId;
}

export function getTaskScopeFilter(ctx: WorkspaceContext): Prisma.TaskWhereInput {
  if (canViewAllRecords(ctx.membership.role)) return {};
  if (ctx.membership.role === "manager") {
    return {
      OR: [
        { assigneeId: { in: ctx.teamUserIds } },
        { createdById: { in: ctx.teamUserIds } },
      ],
    };
  }
  return {
    OR: [
      { assigneeId: ctx.session.userId },
      { createdById: ctx.session.userId },
    ],
  };
}

export function canAccessTask(
  ctx: WorkspaceContext,
  assigneeId: string | null,
  createdById: string | null
): boolean {
  if (canViewAllRecords(ctx.membership.role)) return true;
  if (ctx.membership.role === "manager") {
    return (
      (assigneeId != null && ctx.teamUserIds.includes(assigneeId)) ||
      (createdById != null && ctx.teamUserIds.includes(createdById))
    );
  }
  return assigneeId === ctx.session.userId || createdById === ctx.session.userId;
}

export function getFollowUpScopeFilter(ctx: WorkspaceContext): Prisma.FollowUpWhereInput {
  if (canViewAllRecords(ctx.membership.role)) return {};
  const leadScope = getLeadOwnerFilter(ctx);
  if (ctx.membership.role === "manager") {
    return {
      OR: [{ ownerId: { in: ctx.teamUserIds } }, { lead: leadScope }],
    };
  }
  return {
    OR: [{ ownerId: ctx.session.userId }, { lead: { ownerId: ctx.session.userId } }],
  };
}

export function getActivityScopeFilter(ctx: WorkspaceContext): Prisma.ActivityWhereInput {
  return getOwnerScopeFilter(ctx) as Prisma.ActivityWhereInput;
}

export function getCustomerScopeFilter(ctx: WorkspaceContext): Prisma.CustomerWhereInput {
  if (canViewAllRecords(ctx.membership.role)) return {};
  if (ctx.membership.role === "manager") {
    return {
      OR: [{ lead: { is: getLeadOwnerFilter(ctx) } }, { leadId: null }],
    };
  }
  return { lead: { is: { ownerId: ctx.session.userId } } };
}

export function getQuotationScopeFilter(ctx: WorkspaceContext): Prisma.QuotationWhereInput {
  if (canViewAllRecords(ctx.membership.role)) return {};
  if (ctx.membership.role === "manager") {
    return {
      OR: [
        { createdById: { in: ctx.teamUserIds } },
        { lead: { is: getLeadOwnerFilter(ctx) } },
      ],
    };
  }
  return {
    OR: [
      { createdById: ctx.session.userId },
      { lead: { is: { ownerId: ctx.session.userId } } },
    ],
  };
}

export function ctxCanManageTeam(ctx: WorkspaceContext): boolean {
  return roleCanManageTeam(ctx.membership.role);
}

export function canManageTeamMembers(ctx: WorkspaceContext): boolean {
  return hasPermission(ctx.membership.role, "manage_users") || hasPermission(ctx.membership.role, "manage_team");
}

export function hasFullUserManagement(ctx: WorkspaceContext): boolean {
  return hasPermission(ctx.membership.role, "manage_users");
}

export function canEditMember(
  ctx: WorkspaceContext,
  member: { userId: string; role: string; managerUserId: string | null },
  workspaceOwnerId: string
): boolean {
  if (member.userId === workspaceOwnerId) return false;
  if (hasFullUserManagement(ctx)) return true;
  if (!hasPermission(ctx.membership.role, "manage_team")) return false;
  return normalizeRole(member.role) === "employee" && member.managerUserId === ctx.session.userId;
}

/** Managers see their team; admins see everyone */
export function filterMembersForHierarchy(
  ctx: WorkspaceContext,
  members: Array<{ userId: string; role: string }>
) {
  if (hasFullUserManagement(ctx)) return members;
  if (ctx.membership.role === "manager") {
    return members.filter(
      (m) =>
        ctx.teamUserIds.includes(m.userId) ||
        ["owner", "admin", "manager"].includes(normalizeRole(m.role))
    );
  }
  return members.filter((m) => m.userId === ctx.session.userId);
}
