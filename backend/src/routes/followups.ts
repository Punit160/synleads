import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getFollowUpScopeFilter,
  getLeadOwnerFilter,
  requireRecordAccess,
} from "../lib/rbac";
import { FOLLOWUP_TYPES } from "../lib/lead-constants";
import { addTimelineEvent } from "../lib/lead-utils";

const router = Router();

const followUpSchema = z.object({
  leadId: z.string(),
  type: z.enum(FOLLOWUP_TYPES as unknown as [string, ...string[]]),
  scheduledAt: z.string(),
  reminderAt: z.string().optional().nullable(),
  notes: z.string().optional(),
  nextFollowUpDate: z.string().optional().nullable(),
});

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const bucket = typeof req.query.bucket === "string" ? req.query.bucket : "";
    const today = req.query.today === "true" || bucket === "today";
    const leadId = req.query.leadId as string | undefined;
    const summary = req.query.summary === "true" || req.query.summary === "1";

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);
    const startTomorrow = new Date(endOfDay);
    const endTomorrow = new Date(startTomorrow);
    endTomorrow.setDate(endTomorrow.getDate() + 1);
    const now = new Date();

    const scheduledFilter =
      bucket === "overdue"
        ? { completed: false as const, scheduledAt: { lt: now } }
        : today
          ? { completed: false as const, scheduledAt: { gte: startOfDay, lt: endOfDay } }
          : bucket === "tomorrow"
            ? { completed: false as const, scheduledAt: { gte: startTomorrow, lt: endTomorrow } }
            : bucket === "upcoming"
              ? { completed: false as const, scheduledAt: { gte: endTomorrow } }
              : {};

    const baseWhere = {
      workspaceId: ctx.workspace.id,
      ...getFollowUpScopeFilter(ctx),
      ...(leadId ? { leadId } : {}),
    };

    if (summary) {
      const [overdue, dueToday, tomorrow, upcoming] = await Promise.all([
        prisma.followUp.count({ where: { ...baseWhere, completed: false, scheduledAt: { lt: now } } }),
        prisma.followUp.count({ where: { ...baseWhere, completed: false, scheduledAt: { gte: startOfDay, lt: endOfDay } } }),
        prisma.followUp.count({ where: { ...baseWhere, completed: false, scheduledAt: { gte: startTomorrow, lt: endTomorrow } } }),
        prisma.followUp.count({ where: { ...baseWhere, completed: false, scheduledAt: { gte: endTomorrow } } }),
      ]);
      res.json({ overdue, today: dueToday, tomorrow, upcoming });
      return;
    }

    const followUps = await prisma.followUp.findMany({
      where: {
        ...baseWhere,
        ...scheduledFilter,
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, company: true, phone: true, email: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 100,
    });
    res.json(followUps);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const data = followUpSchema.parse(req.body);

    const lead = await prisma.lead.findFirst({
      where: { id: data.leadId, workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    requireRecordAccess(ctx, lead.ownerId);

    const followUp = await prisma.followUp.create({
      data: {
        workspaceId: ctx.workspace.id,
        leadId: data.leadId,
        ownerId: ctx.session.userId,
        type: data.type,
        scheduledAt: new Date(data.scheduledAt),
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
        notes: data.notes || null,
        nextFollowUpDate: data.nextFollowUpDate ? new Date(data.nextFollowUpDate) : null,
      },
      include: {
        lead: { select: { firstName: true, lastName: true } },
        owner: { select: { name: true } },
      },
    });

    await addTimelineEvent(
      data.leadId,
      "follow_up",
      `${data.type} follow-up scheduled`,
      data.notes,
      ctx.session.userId
    );

    if (lead.status === "new") {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "follow_up" } });
    }

    res.status(201).json(followUp);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.patch("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const body = z
      .object({
        type: z.enum(FOLLOWUP_TYPES as unknown as [string, ...string[]]).optional(),
        scheduledAt: z.string().optional(),
        notes: z.string().optional().nullable(),
        ownerId: z.string().optional().nullable(),
      })
      .parse(req.body || {});
    const existing = await prisma.followUp.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getFollowUpScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Follow-up not found" });
      return;
    }
    const followUp = await prisma.followUp.update({
      where: { id: existing.id },
      data: {
        ...(body.type ? { type: body.type } : {}),
        ...(body.scheduledAt ? { scheduledAt: new Date(body.scheduledAt) } : {}),
        ...(body.notes !== undefined ? { notes: body.notes } : {}),
        ...(body.ownerId !== undefined ? { ownerId: body.ownerId } : {}),
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, company: true, phone: true, email: true } },
        owner: { select: { id: true, name: true } },
      },
    });
    await addTimelineEvent(existing.leadId, "follow_up", "Follow-up updated", body.notes || existing.type, ctx.session.userId);
    res.json(followUp);
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
    const existing = await prisma.followUp.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getFollowUpScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Follow-up not found" });
      return;
    }
    const body = z
      .object({
        next: z
          .object({
            type: z.enum(FOLLOWUP_TYPES as unknown as [string, ...string[]]),
            scheduledAt: z.string(),
            notes: z.string().optional(),
          })
          .optional(),
      })
      .parse(req.body && typeof req.body === "object" ? req.body : {});
    const followUp = await prisma.followUp.update({
      where: { id: existing.id },
      data: { completed: true },
    });
    await addTimelineEvent(existing.leadId, "follow_up", "Follow-up completed", existing.type, ctx.session.userId);
    if (body.next) {
      await prisma.followUp.create({
        data: {
          workspaceId: ctx.workspace.id,
          leadId: existing.leadId,
          ownerId: ctx.session.userId,
          type: body.next.type,
          scheduledAt: new Date(body.next.scheduledAt),
          notes: body.next.notes || null,
        },
      });
      await addTimelineEvent(
        existing.leadId,
        "follow_up",
        `${body.next.type} follow-up scheduled`,
        body.next.notes,
        ctx.session.userId
      );
    }
    res.json(followUp);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
