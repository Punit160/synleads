import { Router } from "express";
import { createNotification } from "../lib/notifications";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getOwnerScopeFilter,
  requireRecordAccess,
} from "../lib/rbac";
import { registerImportRoutes } from "../lib/import-routes";
import { importDealRows } from "../lib/deal-import";

const router = Router();

const dealSchema = z.object({
  name: z.string().min(1),
  stageId: z.string(),
  amount: z.number().min(0).optional(),
  probability: z.number().min(0).max(100).optional(),
  accountId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  expectedCloseDate: z.string().optional().nullable(),
  notes: z.string().optional(),
});

registerImportRoutes(router, "deals", importDealRows);

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const status = (req.query.status as string) || "open";
    const deals = await prisma.deal.findMany({
      where: { workspaceId: ctx.workspace.id, status, ...getOwnerScopeFilter(ctx) },
      include: {
        stage: true,
        account: { select: { id: true, name: true } },
        contact: { select: { id: true, firstName: true, lastName: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "desc" },
    });
    res.json(deals);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/pipeline", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const ownerScope = getOwnerScopeFilter(ctx);
    const stages = await prisma.pipelineStage.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { order: "asc" },
      include: {
        deals: {
          where: { status: "open", ...ownerScope },
          include: {
            account: { select: { id: true, name: true, industry: true } },
            contact: { select: { id: true, firstName: true, lastName: true } },
            owner: { select: { id: true, name: true } },
            _count: { select: { activities: true } },
          },
          orderBy: { updatedAt: "desc" },
        },
      },
    });
    res.json(stages);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
      include: {
        stage: true,
        account: true,
        contact: true,
        owner: { select: { id: true, name: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!deal) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    res.json(deal);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const data = dealSchema.parse(req.body);

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: data.stageId, workspaceId: ctx.workspace.id },
    });
    if (!stage) {
      res.status(400).json({ error: "Invalid pipeline stage" });
      return;
    }

    const deal = await prisma.deal.create({
      data: {
        workspaceId: ctx.workspace.id,
        ownerId: ctx.session.userId,
        name: data.name,
        stageId: data.stageId,
        amount: data.amount ?? 0,
        probability: data.probability ?? stage.probability,
        accountId: data.accountId || null,
        contactId: data.contactId || null,
        expectedCloseDate: data.expectedCloseDate ? new Date(data.expectedCloseDate) : null,
        notes: data.notes || null,
        status: stage.isWon ? "won" : stage.isLost ? "lost" : "open",
        closedAt: stage.isWon || stage.isLost ? new Date() : null,
      },
      include: { stage: true },
    });
    res.status(201).json(deal);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.patch("/:id/stage", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const { stageId } = z.object({ stageId: z.string() }).parse(req.body);

    const deal = await prisma.deal.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
    });
    if (!deal) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }

    const stage = await prisma.pipelineStage.findFirst({
      where: { id: stageId, workspaceId: ctx.workspace.id },
    });
    if (!stage) {
      res.status(400).json({ error: "Invalid stage" });
      return;
    }

    const updated = await prisma.deal.update({
      where: { id: deal.id },
      data: {
        stageId,
        probability: stage.probability,
        status: stage.isWon ? "won" : stage.isLost ? "lost" : "open",
        closedAt: stage.isWon || stage.isLost ? new Date() : null,
      },
      include: { stage: true, account: true, contact: true, owner: { select: { id: true } } },
    });
    if (updated.ownerId) {
      await createNotification({
        workspaceId: ctx.workspace.id,
        userId: updated.ownerId,
        type: "deal",
        title: "Deal stage changed",
        message: `"${updated.name}" moved to ${stage.name}`,
      }).catch(() => {});
    }
    res.json(updated);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const data = dealSchema.partial().parse(req.body);
    const existing = await prisma.deal.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    const deal = await prisma.deal.update({
      where: { id: req.params.id },
      data: {
        ...data,
        expectedCloseDate: data.expectedCloseDate
          ? new Date(data.expectedCloseDate)
          : data.expectedCloseDate === null
            ? null
            : undefined,
      },
      include: { stage: true },
    });
    res.json(deal);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "delete");
    const existing = await prisma.deal.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Deal not found" });
      return;
    }
    await prisma.deal.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
