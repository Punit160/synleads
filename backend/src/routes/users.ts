import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  canManageTeamMembers,
  hasFullUserManagement,
  canEditMember,
  filterMembersForHierarchy,
} from "../lib/rbac";
import {
  ROLES,
  ROLE_LABELS,
  ROLE_PERMISSIONS,
  normalizeRole,
  hasPermission,
  packageMaxUsers,
  PACKAGE_LABELS,
  type SubscriptionPackage,
} from "../lib/roles";
import { hashPassword } from "../lib/auth";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function requireTeamAccess(ctx: Awaited<ReturnType<typeof getAuthenticatedContext>>) {
  if (!canManageTeamMembers(ctx)) {
    throw new Error("Forbidden");
  }
}

async function assertTeamCapacity(workspaceId: string) {
  const subscription = await prisma.subscription.findUnique({ where: { workspaceId } });
  if (!subscription) return;
  const maxUsers = packageMaxUsers(subscription.package);
  if (maxUsers === null) return;
  const activeCount = await prisma.workspaceMember.count({
    where: { workspaceId, status: "active" },
  });
  if (activeCount >= maxUsers) {
    const label = PACKAGE_LABELS[subscription.package as SubscriptionPackage] || subscription.package;
    throw new Error(
      `Team limit reached (${maxUsers} users on ${label}). Contact Synentrix to upgrade your plan.`
    );
  }
}

router.get("/roles", async (req, res) => {
  try {
    await getAuthenticatedContext(req);
    res.json({
      roles: ROLES.map((r) => ({ id: r, label: ROLE_LABELS[r], permissions: ROLE_PERMISSIONS[r] })),
      permissions: [
        "view",
        "add",
        "edit",
        "delete",
        "export",
        "import",
        "assign",
        "reports",
        "manage_users",
        "manage_team",
      ],
    });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

router.get("/assignable", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "assign");

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspace.id, status: "active" },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "asc" },
    });

    let filtered = members;
    if (ctx.membership.role === "manager") {
      filtered = members.filter((m) => ctx.teamUserIds.includes(m.userId));
    }

    res.json(
      filtered.map((m) => ({
        userId: m.user.id,
        name: m.user.name,
        email: m.user.email,
        role: normalizeRole(m.role),
      }))
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requireTeamAccess(ctx);

    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        managerUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });

    const fullAdmin = hasFullUserManagement(ctx);

    const visibleMembers = filterMembersForHierarchy(ctx, members);

    res.json(
      visibleMembers.map((m) => {
        const member = members.find((row) => row.userId === m.userId)!;
        return {
        id: member.id,
        role: normalizeRole(member.role),
        rawRole: member.role,
        roleLabel: ROLE_LABELS[normalizeRole(member.role)] || member.role,
        status: member.status,
        managerUserId: member.managerUserId,
        managerName: member.managerUser?.name || null,
        permissions: ROLE_PERMISSIONS[normalizeRole(member.role)] || ROLE_PERMISSIONS.viewer,
        user: member.user,
        canEdit: canEditMember(
          ctx,
          { userId: member.userId, role: member.role, managerUserId: member.managerUserId },
          ctx.workspace.userId
        ),
        canChangeRole: fullAdmin && member.userId !== ctx.workspace.userId,
        canChangeManager: fullAdmin && normalizeRole(member.role) === "employee",
      };
      })
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/invite", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requireTeamAccess(ctx);

    const fullAdmin = hasFullUserManagement(ctx);

    const data = z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(ROLES as unknown as [string, ...string[]]),
        managerUserId: z.string().optional().nullable(),
      })
      .parse(req.body);

    if (data.role === "owner") {
      res.status(400).json({ error: "Cannot assign owner role via invite" });
      return;
    }

    let role = data.role;
    let managerUserId = data.managerUserId || null;

    if (!fullAdmin) {
      if (role !== "employee") {
        res.status(403).json({ error: "Managers can only add sales executives" });
        return;
      }
      managerUserId = ctx.session.userId;
    } else if (role === "employee" && managerUserId) {
      const manager = await prisma.workspaceMember.findFirst({
        where: {
          workspaceId: ctx.workspace.id,
          userId: managerUserId,
          status: "active",
        },
      });
      if (!manager || !["manager", "admin", "owner"].includes(normalizeRole(manager.role))) {
        res.status(400).json({ error: "Invalid manager — assign a sales manager" });
        return;
      }
    } else if (role !== "employee") {
      managerUserId = null;
    }

    await assertTeamCapacity(ctx.workspace.id);

    let user = await prisma.user.findUnique({ where: { email: data.email } });
    if (user) {
      const existing = await prisma.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId: ctx.workspace.id, userId: user.id } },
      });
      if (existing) {
        res.status(400).json({ error: "User already in workspace" });
        return;
      }
    } else {
      user = await prisma.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: await hashPassword(data.password),
        },
      });
    }

    const member = await prisma.workspaceMember.create({
      data: {
        workspaceId: ctx.workspace.id,
        userId: user.id,
        role,
        managerUserId: role === "employee" ? managerUserId : null,
        status: "active",
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });

    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

router.patch("/:id/role", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requireTeamAccess(ctx);

    const fullAdmin = hasFullUserManagement(ctx);
    const { role, managerUserId } = z
      .object({
        role: z.enum(ROLES as unknown as [string, ...string[]]),
        managerUserId: z.string().optional().nullable(),
      })
      .parse(req.body);

    if (role === "owner") {
      res.status(400).json({ error: "Cannot change to owner role" });
      return;
    }

    const member = await prisma.workspaceMember.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id },
    });
    if (!member) {
      res.status(404).json({ error: "Member not found" });
      return;
    }

    if (!canEditMember(ctx, member, ctx.workspace.userId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    if (!fullAdmin) {
      res.status(403).json({ error: "Only admins can change roles" });
      return;
    }

    if (role === "employee" && managerUserId) {
      const manager = await prisma.workspaceMember.findFirst({
        where: { workspaceId: ctx.workspace.id, userId: managerUserId, status: "active" },
      });
      if (!manager || !["manager", "admin", "owner"].includes(normalizeRole(manager.role))) {
        res.status(400).json({ error: "Invalid manager" });
        return;
      }
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: member.id },
      data: {
        role,
        managerUserId: role === "employee" ? managerUserId || null : null,
      },
      include: { user: { select: { id: true, name: true, email: true } } },
    });
    res.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Invalid role";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

router.patch("/:id/manager", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requireTeamAccess(ctx);

    if (!hasFullUserManagement(ctx)) {
      res.status(403).json({ error: "Only admins can reassign managers" });
      return;
    }

    const { managerUserId } = z
      .object({ managerUserId: z.string().optional().nullable() })
      .parse(req.body);

    const member = await prisma.workspaceMember.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id },
    });
    if (!member || normalizeRole(member.role) !== "employee") {
      res.status(400).json({ error: "Can only assign managers to sales executives" });
      return;
    }

    if (managerUserId) {
      const manager = await prisma.workspaceMember.findFirst({
        where: { workspaceId: ctx.workspace.id, userId: managerUserId, status: "active" },
      });
      if (!manager || !["manager", "admin", "owner"].includes(normalizeRole(manager.role))) {
        res.status(400).json({ error: "Invalid manager" });
        return;
      }
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: member.id },
      data: { managerUserId: managerUserId || null },
      include: {
        user: { select: { id: true, name: true, email: true } },
        managerUser: { select: { id: true, name: true } },
      },
    });
    res.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

router.patch("/:id/availability", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requireTeamAccess(ctx);
    const data = z
      .object({
        isAvailable: z.boolean().optional(),
        maxLeadLimit: z.number().int().min(1).nullable().optional(),
      })
      .parse(req.body);
    const member = await prisma.workspaceMember.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id },
    });
    if (!member || !canEditMember(ctx, member, ctx.workspace.userId)) {
      res.status(400).json({ error: "Cannot update this member" });
      return;
    }
    const updated = await prisma.workspaceMember.update({
      where: { id: member.id },
      data: {
        ...(data.isAvailable !== undefined ? { isAvailable: data.isAvailable } : {}),
        ...(data.maxLeadLimit !== undefined ? { maxLeadLimit: data.maxLeadLimit } : {}),
      },
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

router.patch("/:id/status", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requireTeamAccess(ctx);

    const { status } = z.object({ status: z.enum(["active", "inactive"]) }).parse(req.body);
    const member = await prisma.workspaceMember.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id },
    });
    if (!member || !canEditMember(ctx, member, ctx.workspace.userId)) {
      res.status(400).json({ error: "Cannot update this member" });
      return;
    }

    const updated = await prisma.workspaceMember.update({
      where: { id: member.id },
      data: { status },
    });
    res.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

export default router;
