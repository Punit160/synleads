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
import { importContactRows } from "../lib/contact-import";

const router = Router();

const contactSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  title: z.string().optional(),
  accountId: z.string().optional(),
  notes: z.string().optional(),
});

registerImportRoutes(router, "contacts", importContactRows);

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const contacts = await prisma.contact.findMany({
      where: { workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
      include: {
        account: { select: { id: true, name: true } },
        owner: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(contacts);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const contact = await prisma.contact.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
      include: {
        account: true,
        owner: { select: { id: true, name: true } },
        deals: { include: { stage: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 10 },
      },
    });
    if (!contact) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    res.json(contact);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const data = contactSchema.parse(req.body);
    const contact = await prisma.contact.create({
      data: {
        workspaceId: ctx.workspace.id,
        ownerId: ctx.session.userId,
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        title: data.title || null,
        accountId: data.accountId || null,
        notes: data.notes || null,
      },
    });
    res.status(201).json(contact);
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
    const data = contactSchema.partial().parse(req.body);
    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    requireRecordAccess(ctx, existing.ownerId);
    const contact = await prisma.contact.update({
      where: { id: req.params.id },
      data,
    });
    res.json(contact);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "delete");
    const existing = await prisma.contact.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id, ...getOwnerScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Contact not found" });
      return;
    }
    await prisma.contact.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
