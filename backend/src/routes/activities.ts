import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getActivityScopeFilter,
  requireRecordAccess,
} from "../lib/rbac";
import { ACTIVITY_TYPES } from "../lib/lead-constants";
import { markLeadFirstResponse } from "../lib/sla-engine";

const router = Router();

const activitySchema = z.object({
  type: z.enum(ACTIVITY_TYPES as unknown as [string, ...string[]]),
  subject: z.string().min(1),
  description: z.string().optional(),
  dueDate: z.string().optional().nullable(),
  completed: z.boolean().optional(),
  leadId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  accountId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
});

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const upcoming = req.query.upcoming === "true";
    const activities = await prisma.activity.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        ...getActivityScopeFilter(ctx),
        ...(upcoming ? { completed: false, dueDate: { not: null } } : {}),
      },
      include: {
        owner: { select: { id: true, name: true } },
        lead: { select: { id: true, firstName: true, lastName: true } },
        deal: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 50,
    });
    res.json(activities);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const data = activitySchema.parse(req.body);
    const activity = await prisma.activity.create({
      data: {
        workspaceId: ctx.workspace.id,
        ownerId: ctx.session.userId,
        type: data.type,
        subject: data.subject,
        description: data.description || null,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        completed: data.completed ?? false,
        leadId: data.leadId || null,
        contactId: data.contactId || null,
        accountId: data.accountId || null,
        dealId: data.dealId || null,
      },
    });
    if (data.leadId) {
      await markLeadFirstResponse(ctx.workspace.id, data.leadId);
    }
    res.status(201).json(activity);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.patch("/:id/complete", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const existing = await prisma.activity.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getActivityScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Activity not found" });
      return;
    }
    requireRecordAccess(ctx, existing.ownerId);
    const activity = await prisma.activity.update({
      where: { id: req.params.id },
      data: { completed: true },
    });
    res.json(activity);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
