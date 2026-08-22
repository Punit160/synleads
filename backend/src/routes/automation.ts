import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";
import { getOrCreateSlaPolicy, runSlaChecks } from "../lib/sla-engine";
import { recordAuditLog } from "../lib/audit-log";

const router = Router();

function handleError(res: import("express").Response, error: unknown) {
  const msg = error instanceof Error ? error.message : "Unauthorized";
  if (msg === "Forbidden") return res.status(403).json({ error: msg });
  return res.status(401).json({ error: msg });
}

const conditionSchema = z.object({
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.string().optional(),
});

const actionSchema = z.object({
  type: z.string().min(1),
}).passthrough();

const workflowSchema = z.object({
  name: z.string().min(1),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
  trigger: z.enum(["lead.created", "lead.status_changed"]),
  conditions: z.array(conditionSchema).optional(),
  actions: z.array(actionSchema).min(1),
});

const scoringRuleSchema = z.object({
  name: z.string().min(1),
  field: z.string().min(1),
  operator: z.string().min(1),
  value: z.string().optional().nullable(),
  points: z.number().int().min(-50).max(50),
  isActive: z.boolean().optional(),
  priority: z.number().int().optional(),
});

const slaSchema = z.object({
  enabled: z.boolean().optional(),
  firstResponseHours: z.number().int().min(1).max(720).optional(),
  escalateAfterHours: z.number().int().min(1).max(720).optional(),
  escalateToManager: z.boolean().optional(),
  notifyOnBreach: z.boolean().optional(),
});

// ── Workflows ──
router.get("/workflows", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const rules = await prisma.workflowRule.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    res.json(rules);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/workflows", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const data = workflowSchema.parse(req.body);
    const rule = await prisma.workflowRule.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: data.name,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
        trigger: data.trigger,
        conditions: (data.conditions ?? []) as Prisma.InputJsonValue,
        actions: data.actions as Prisma.InputJsonValue,
      },
    });
    await recordAuditLog({
      workspaceId: ctx.workspace.id,
      userId: ctx.session.userId,
      action: "workflow_create",
      entityType: "workflow_rule",
      entityId: rule.id,
      details: rule.name,
    });
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

router.put("/workflows/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const data = workflowSchema.partial().parse(req.body);
    const existing = await prisma.workflowRule.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rule = await prisma.workflowRule.update({
      where: { id: existing.id },
      data: {
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.isActive != null ? { isActive: data.isActive } : {}),
        ...(data.priority != null ? { priority: data.priority } : {}),
        ...(data.trigger != null ? { trigger: data.trigger } : {}),
        ...(data.conditions != null ? { conditions: data.conditions as Prisma.InputJsonValue } : {}),
        ...(data.actions != null ? { actions: data.actions as Prisma.InputJsonValue } : {}),
      },
    });
    res.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

router.delete("/workflows/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const existing = await prisma.workflowRule.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await prisma.workflowRule.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

// ── Lead scoring ──
router.get("/scoring-rules", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const rules = await prisma.leadScoringRule.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
    });
    res.json(rules);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/scoring-rules", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const data = scoringRuleSchema.parse(req.body);
    const rule = await prisma.leadScoringRule.create({
      data: {
        workspaceId: ctx.workspace.id,
        name: data.name,
        field: data.field,
        operator: data.operator,
        value: data.value ?? null,
        points: data.points,
        isActive: data.isActive ?? true,
        priority: data.priority ?? 0,
      },
    });
    res.status(201).json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

router.put("/scoring-rules/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const data = scoringRuleSchema.partial().parse(req.body);
    const existing = await prisma.leadScoringRule.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const rule = await prisma.leadScoringRule.update({
      where: { id: existing.id },
      data,
    });
    res.json(rule);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

router.delete("/scoring-rules/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const existing = await prisma.leadScoringRule.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await prisma.leadScoringRule.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/scoring-rules/recalculate", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const { applyLeadScore } = await import("../lib/lead-scoring");
    const leads = await prisma.lead.findMany({
      where: { workspaceId: ctx.workspace.id, archivedAt: null },
      select: { id: true },
      take: 500,
    });
    let updated = 0;
    for (const l of leads) {
      const score = await applyLeadScore(ctx.workspace.id, l.id);
      if (score >= 0) updated += 1;
    }
    res.json({ recalculated: updated });
  } catch (error) {
    handleError(res, error);
  }
});

// ── SLA ──
router.get("/sla", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const policy = await getOrCreateSlaPolicy(ctx.workspace.id);
    res.json(policy);
  } catch (error) {
    handleError(res, error);
  }
});

router.put("/sla", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const data = slaSchema.parse(req.body);
    const policy = await getOrCreateSlaPolicy(ctx.workspace.id);
    const updated = await prisma.slaPolicy.update({
      where: { id: policy.id },
      data,
    });
    await recordAuditLog({
      workspaceId: ctx.workspace.id,
      userId: ctx.session.userId,
      action: "sla_policy_update",
      entityType: "sla_policy",
      entityId: updated.id,
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

router.get("/sla/stats", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const [open, breached, escalated, met] = await Promise.all([
      prisma.lead.count({
        where: { workspaceId: ctx.workspace.id, archivedAt: null, firstResponseAt: null },
      }),
      prisma.lead.count({
        where: { workspaceId: ctx.workspace.id, slaBreached: true, archivedAt: null },
      }),
      prisma.lead.count({
        where: { workspaceId: ctx.workspace.id, slaEscalatedAt: { not: null }, archivedAt: null },
      }),
      prisma.lead.count({
        where: {
          workspaceId: ctx.workspace.id,
          firstResponseAt: { not: null },
          slaBreached: false,
          archivedAt: null,
        },
      }),
    ]);
    res.json({ open, breached, escalated, met });
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/sla/run-checks", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const result = await runSlaChecks(ctx.workspace.id);
    res.json(result);
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
