import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import type { Prisma } from "@prisma/client";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";

const router = Router();

const viewSchema = z.object({
  name: z.string().min(1),
  entityType: z.enum(["lead"]).optional(),
  filters: z.record(z.unknown()),
  isShared: z.boolean().optional(),
});

function handleError(res: import("express").Response, error: unknown) {
  const msg = error instanceof Error ? error.message : "Unauthorized";
  if (msg === "Forbidden") return res.status(403).json({ error: msg });
  return res.status(401).json({ error: msg });
}

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const entityType = (req.query.entityType as string) || "lead";
    const views = await prisma.savedView.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        entityType,
        OR: [{ isShared: true }, { userId: ctx.session.userId }],
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(views);
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const data = viewSchema.parse(req.body);
    const view = await prisma.savedView.create({
      data: {
        workspaceId: ctx.workspace.id,
        userId: data.isShared ? null : ctx.session.userId,
        name: data.name,
        entityType: data.entityType || "lead",
        filters: data.filters as Prisma.InputJsonValue,
        isShared: data.isShared ?? false,
      },
    });
    res.status(201).json(view);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const data = viewSchema.partial().parse(req.body);
    const existing = await prisma.savedView.findFirst({
      where: {
        id: req.params.id,
        workspaceId: ctx.workspace.id,
        OR: [{ userId: ctx.session.userId }, { isShared: true }],
      },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (existing.isShared) {
      try {
        requirePermission(ctx, "manage_team");
      } catch {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    const view = await prisma.savedView.update({
      where: { id: existing.id },
      data: {
        ...(data.name != null ? { name: data.name } : {}),
        ...(data.filters != null ? { filters: data.filters as Prisma.InputJsonValue } : {}),
        ...(data.isShared != null ? { isShared: data.isShared, userId: data.isShared ? null : ctx.session.userId } : {}),
      },
    });
    res.json(view);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const existing = await prisma.savedView.findMany({
      where: {
        id: req.params.id,
        workspaceId: ctx.workspace.id,
        OR: [{ userId: ctx.session.userId }, { isShared: true }],
      },
    });
    const view = existing[0];
    if (!view) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (view.isShared && view.userId !== ctx.session.userId) {
      try {
        requirePermission(ctx, "manage_team");
      } catch {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    await prisma.savedView.delete({ where: { id: view.id } });
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

export default router;
