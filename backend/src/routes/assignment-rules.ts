import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";
import { ASSIGNMENT_METHODS, LEAD_SOURCES } from "../lib/lead-constants";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

const ruleSchema = z.object({
  name: z.string().min(2),
  priority: z.number().int().min(0).max(1000).optional(),
  isActive: z.boolean().optional(),
  teamId: z.string().nullable().optional(),
  distributionMethod: z.enum(ASSIGNMENT_METHODS as unknown as [string, ...string[]]).optional(),
  sourceFilter: z.string().nullable().optional(),
  cityFilter: z.string().nullable().optional(),
  stateFilter: z.string().nullable().optional(),
  productFilter: z.string().nullable().optional(),
  maxLeadLimit: z.number().int().min(1).nullable().optional(),
  backupUserId: z.string().nullable().optional(),
  assigneeUserIds: z.array(z.string()).optional(),
});

router.get("/meta", async (_req, res) => {
  res.json({
    methods: ASSIGNMENT_METHODS,
    sources: LEAD_SOURCES,
  });
});

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const rules = await prisma.assignmentRule.findMany({
      where: { workspaceId: ctx.workspace.id },
      include: {
        team: { select: { id: true, name: true } },
        backupUser: { select: { id: true, name: true } },
      },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    res.json(
      rules.map((r) => ({
        ...r,
        assigneeUserIds: JSON.parse(r.assigneeUserIds || "[]") as string[],
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
    const data = ruleSchema.parse(req.body);
    const rule = await prisma.assignmentRule.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: data.name.trim(),
        priority: data.priority ?? 0,
        isActive: data.isActive ?? true,
        teamId: data.teamId ?? null,
        distributionMethod: data.distributionMethod ?? "round_robin",
        sourceFilter: data.sourceFilter ?? null,
        cityFilter: data.cityFilter ?? null,
        stateFilter: data.stateFilter ?? null,
        productFilter: data.productFilter ?? null,
        maxLeadLimit: data.maxLeadLimit ?? null,
        backupUserId: data.backupUserId ?? null,
        assigneeUserIds: JSON.stringify(data.assigneeUserIds ?? []),
      },
      include: {
        team: { select: { id: true, name: true } },
        backupUser: { select: { id: true, name: true } },
      },
    });
    res.status(201).json({ ...rule, assigneeUserIds: data.assigneeUserIds ?? [] });
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
    const data = ruleSchema.partial().parse(req.body);
    const existing = await prisma.assignmentRule.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }
    const updated = await prisma.assignmentRule.update({
      where: { id: existing.id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.priority !== undefined ? { priority: data.priority } : {}),
        ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
        ...(data.teamId !== undefined ? { teamId: data.teamId } : {}),
        ...(data.distributionMethod !== undefined ? { distributionMethod: data.distributionMethod } : {}),
        ...(data.sourceFilter !== undefined ? { sourceFilter: data.sourceFilter } : {}),
        ...(data.cityFilter !== undefined ? { cityFilter: data.cityFilter } : {}),
        ...(data.stateFilter !== undefined ? { stateFilter: data.stateFilter } : {}),
        ...(data.productFilter !== undefined ? { productFilter: data.productFilter } : {}),
        ...(data.maxLeadLimit !== undefined ? { maxLeadLimit: data.maxLeadLimit } : {}),
        ...(data.backupUserId !== undefined ? { backupUserId: data.backupUserId } : {}),
        ...(data.assigneeUserIds !== undefined ? { assigneeUserIds: JSON.stringify(data.assigneeUserIds) } : {}),
      },
      include: {
        team: { select: { id: true, name: true } },
        backupUser: { select: { id: true, name: true } },
      },
    });
    res.json({
      ...updated,
      assigneeUserIds: JSON.parse(updated.assigneeUserIds || "[]") as string[],
    });
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
    const existing = await prisma.assignmentRule.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Rule not found" });
      return;
    }
    await prisma.assignmentRule.delete({ where: { id: existing.id } });
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
