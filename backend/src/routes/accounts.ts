import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getOwnerScopeFilter,
  requireRecordAccess,
} from "../lib/rbac";
import { registerImportRoutes } from "../lib/import-routes";
import { importAccountRows } from "../lib/account-import";

const router = Router();

const accountSchema = z.object({
  name: z.string().min(1),
  industry: z.string().optional(),
  website: z.string().optional(),
  phone: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  notes: z.string().optional(),
});

registerImportRoutes(router, "accounts", importAccountRows);

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const accounts = await prisma.account.findMany({
      where: { workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
      include: {
        owner: { select: { id: true, name: true } },
        _count: { select: { contacts: true, deals: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(accounts);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const account = await prisma.account.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
      include: {
        owner: { select: { id: true, name: true } },
        contacts: true,
        deals: { include: { stage: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!account) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    res.json(account);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const data = accountSchema.parse(req.body);
    const account = await prisma.account.create({
      data: {
        workspaceId: ctx.workspace.id,
        ownerId: ctx.session.userId,
        name: data.name,
        industry: data.industry || null,
        website: data.website || null,
        phone: data.phone || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || "India",
        notes: data.notes || null,
      },
    });
    res.status(201).json(account);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.put("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const data = accountSchema.partial().parse(req.body);
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    requireRecordAccess(ctx, existing.ownerId);
    const account = await prisma.account.update({
      where: { id: req.params.id },
      data,
    });
    res.json(account);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "delete");
    const existing = await prisma.account.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Account not found" });
      return;
    }
    await prisma.account.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
