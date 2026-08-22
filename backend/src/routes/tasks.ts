import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getTaskScopeFilter,
  canAccessTask,
  canAssignTaskTo,
} from "../lib/rbac";
import { TASK_PRIORITIES, TASK_STATUSES } from "../lib/task-constants";
import { registerImportRoutes } from "../lib/import-routes";
import { importTaskRows } from "../lib/task-import";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

const taskSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  assigneeId: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  priority: z.enum(TASK_PRIORITIES as unknown as [string, ...string[]]).optional(),
  status: z.enum(TASK_STATUSES as unknown as [string, ...string[]]).optional(),
  reminderAt: z.string().optional().nullable(),
  leadId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
});

registerImportRoutes(router, "tasks", importTaskRows);

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const status = req.query.status as string | undefined;
    const priority = req.query.priority as string | undefined;
    const assigneeId = req.query.assigneeId as string | undefined;
    const due = req.query.due as string | undefined;

    if (assigneeId && !(await canAssignTaskTo(ctx, assigneeId))) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const tasks = await prisma.task.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        ...getTaskScopeFilter(ctx),
        ...(status ? { status } : {}),
        ...(priority ? { priority } : {}),
        ...(assigneeId ? { assigneeId } : {}),
        ...(due === "today" ? { dueDate: { gte: startOfDay, lt: endOfDay } } : {}),
        ...(due === "overdue" ? { dueDate: { lt: startOfDay }, status: { not: "completed" } } : {}),
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        createdBy: { select: { id: true, name: true } },
        lead: { select: { id: true, leadNumber: true, firstName: true, lastName: true } },
        deal: { select: { id: true, name: true } },
      },
      orderBy: [{ dueDate: "asc" }, { priority: "desc" }],
      take: 100,
    });
    res.json(tasks);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const data = taskSchema.parse(req.body);
    const assigneeId = data.assigneeId || ctx.session.userId;
    if (!(await canAssignTaskTo(ctx, assigneeId))) {
      res.status(403).json({ error: "Cannot assign task to this user" });
      return;
    }
    const task = await prisma.task.create({
      data: {
        workspaceId: ctx.workspace.id,
        createdById: ctx.session.userId,
        title: data.title,
        description: data.description || null,
        assigneeId,
        dueDate: data.dueDate ? new Date(data.dueDate) : null,
        priority: data.priority || "medium",
        status: data.status || "pending",
        reminderAt: data.reminderAt ? new Date(data.reminderAt) : null,
        leadId: data.leadId || null,
        dealId: data.dealId || null,
        contactId: data.contactId || null,
      },
      include: {
        assignee: { select: { id: true, name: true } },
        lead: { select: { id: true, leadNumber: true, firstName: true, lastName: true } },
      },
    });
    res.status(201).json(task);
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
    const data = taskSchema.partial().parse(req.body);
    const existing = await prisma.task.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getTaskScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    if (data.assigneeId && !(await canAssignTaskTo(ctx, data.assigneeId))) {
      res.status(403).json({ error: "Cannot assign task to this user" });
      return;
    }
    const task = await prisma.task.update({
      where: { id: param(req, "id") },
      data: {
        ...data,
        dueDate: data.dueDate !== undefined ? (data.dueDate ? new Date(data.dueDate) : null) : undefined,
        reminderAt: data.reminderAt !== undefined ? (data.reminderAt ? new Date(data.reminderAt) : null) : undefined,
      },
    });
    res.json(task);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.patch("/:id/complete", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const existing = await prisma.task.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getTaskScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    if (!canAccessTask(ctx, existing.assigneeId, existing.createdById)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }
    const task = await prisma.task.update({
      where: { id: param(req, "id") },
      data: { status: "completed", completedAt: new Date() },
    });
    res.json(task);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "delete");
    const existing = await prisma.task.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getTaskScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Task not found" });
      return;
    }
    await prisma.task.delete({ where: { id: param(req, "id") } });
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
