import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";
import { getMemberWorkload } from "../lib/assignment-engine";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const teams = await prisma.team.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        leader: { select: { id: true, name: true, email: true } },
        members: { include: { user: { select: { id: true, name: true, email: true } } } },
        _count: { select: { rules: true } },
      },
      orderBy: { name: "asc" },
    });
    res.json(
      teams.map((t) => ({
        id: t.id,
        name: t.name,
        description: t.description,
        leader: t.leader,
        memberCount: t.members.length,
        members: t.members.map((m) => m.user),
        rulesCount: t._count.rules,
        createdAt: t.createdAt,
      }))
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const data = z
      .object({
        name: z.string().min(2),
        description: z.string().optional(),
        leaderId: z.string().optional().nullable(),
        memberUserIds: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const team = await prisma.team.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        leaderId: data.leaderId || null,
        members: data.memberUserIds?.length
          ? { create: data.memberUserIds.map((userId) => ({ userId })) }
          : undefined,
      },
      include: {
        leader: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
      },
    });
    res.status(201).json(team);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const data = z
      .object({
        name: z.string().min(2).optional(),
        description: z.string().nullable().optional(),
        leaderId: z.string().nullable().optional(),
        memberUserIds: z.array(z.string()).optional(),
      })
      .parse(req.body);

    const teamId = param(req, "id");
    const existing = await prisma.team.findFirst({
      where: { id: teamId, workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Team not found" });
      return;
    }

    if (data.memberUserIds) {
      await prisma.teamMember.deleteMany({ where: { teamId } });
      if (data.memberUserIds.length > 0) {
        await prisma.teamMember.createMany({
          data: data.memberUserIds.map((userId) => ({ teamId, userId })),
        });
      }
    }

    const updated = await prisma.team.update({
      where: { id: teamId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.leaderId !== undefined ? { leaderId: data.leaderId } : {}),
      },
      include: {
        leader: { select: { id: true, name: true } },
        members: { include: { user: { select: { id: true, name: true } } } },
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

router.delete("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const existing = await prisma.team.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Team not found" });
      return;
    }
    await prisma.team.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/workload/members", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const workload = await getMemberWorkload(ctx.workspace.id);
    res.json(workload);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
