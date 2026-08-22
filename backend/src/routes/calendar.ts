import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getFollowUpScopeFilter,
  getTaskScopeFilter,
  canViewAllRecords,
} from "../lib/rbac";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

const eventSchema = z.object({
  title: z.string().min(1),
  type: z.enum(["meeting", "call", "followup", "task", "event"]).optional(),
  startAt: z.string(),
  endAt: z.string().optional().nullable(),
  allDay: z.boolean().optional(),
  location: z.string().optional(),
  description: z.string().optional(),
  leadId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
});

function eventScopeFilter(ctx: Awaited<ReturnType<typeof getAuthenticatedContext>>) {
  if (canViewAllRecords(ctx.membership.role)) return {};
  if (ctx.membership.role === "manager") {
    return { ownerId: { in: ctx.teamUserIds } };
  }
  return { ownerId: ctx.session.userId };
}

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const type = req.query.type as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const scope = eventScopeFilter(ctx);

    const events = await prisma.calendarEvent.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        ...scope,
        ...(type ? { type } : {}),
        ...(from && to ? { startAt: { gte: new Date(from), lte: new Date(to) } } : {}),
      },
      include: { owner: { select: { name: true } } },
      orderBy: { startAt: "asc" },
      take: 200,
    });

    const followUpScope = getFollowUpScopeFilter(ctx);
    const taskScope = getTaskScopeFilter(ctx);

    const [followUps, tasks] = await Promise.all([
      prisma.followUp.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          completed: false,
          ...followUpScope,
          ...(from && to ? { scheduledAt: { gte: new Date(from), lte: new Date(to) } } : {}),
        },
        include: { lead: { select: { firstName: true, lastName: true, leadNumber: true } }, owner: { select: { name: true } } },
        take: 50,
      }),
      prisma.task.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          status: { not: "completed" },
          dueDate: { not: null },
          ...taskScope,
          ...(from && to ? { dueDate: { gte: new Date(from), lte: new Date(to) } } : {}),
        },
        include: { assignee: { select: { name: true } } },
        take: 50,
      }),
    ]);

    const merged = [
      ...events.map((e) => ({ ...e, source: "event" as const })),
      ...followUps.map((f) => ({
        id: f.id,
        title: `${f.type} · ${f.lead.firstName} ${f.lead.lastName || ""}`,
        type: f.type === "call" ? "call" : f.type === "meeting" ? "meeting" : "followup",
        startAt: f.scheduledAt,
        endAt: null,
        allDay: false,
        location: null,
        description: f.notes,
        completed: f.completed,
        owner: f.owner,
        source: "followup" as const,
        leadId: f.leadId,
      })),
      ...tasks.map((t) => ({
        id: t.id,
        title: t.title,
        type: "task",
        startAt: t.dueDate!,
        endAt: null,
        allDay: false,
        location: null,
        description: t.description,
        completed: t.status === "completed",
        owner: t.assignee,
        source: "task" as const,
        priority: t.priority,
      })),
    ].sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

    res.json(merged);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const data = eventSchema.parse(req.body);
    const event = await prisma.calendarEvent.create({
      data: {
        workspaceId: ctx.workspace.id,
        ownerId: ctx.session.userId,
        title: data.title,
        type: data.type || "event",
        startAt: new Date(data.startAt),
        endAt: data.endAt ? new Date(data.endAt) : null,
        allDay: data.allDay ?? false,
        location: data.location || null,
        description: data.description || null,
        leadId: data.leadId || null,
        dealId: data.dealId || null,
      },
    });
    res.status(201).json(event);
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
    const scope = eventScopeFilter(ctx);
    const existing = await prisma.calendarEvent.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...scope },
    });
    if (!existing) {
      res.status(404).json({ error: "Event not found" });
      return;
    }
    const event = await prisma.calendarEvent.update({
      where: { id: existing.id },
      data: { completed: true },
    });
    res.json(event);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
