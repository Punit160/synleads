import { Router } from "express";
import { createNotification } from "../lib/notifications";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getQuotationScopeFilter,
} from "../lib/rbac";
import { calcQuoteTotals, calcLineNet } from "../lib/quotation-math";
import { renderQuotationPdfHtml } from "../lib/quotation-pdf";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

async function nextQuoteNumber(workspaceId: string): Promise<string> {
  const count = await prisma.quotation.count({ where: { workspaceId } });
  return `QT-${String(count + 1).padStart(5, "0")}`;
}

const itemSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().min(0.01).default(1),
  unitPrice: z.number().min(0),
  taxRate: z.number().min(0).default(18),
  discount: z.number().min(0).max(100).default(0),
});

const quoteSchema = z.object({
  leadId: z.string().optional().nullable(),
  dealId: z.string().optional().nullable(),
  contactId: z.string().optional().nullable(),
  status: z.enum(["draft", "sent", "approved", "rejected", "expired"]).optional(),
  taxRate: z.number().min(0).default(18),
  discount: z.number().min(0).max(100).default(0),
  validUntil: z.string().optional().nullable(),
  notes: z.string().optional(),
  items: z.array(itemSchema).min(1),
});

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const status = req.query.status as string | undefined;
    const quotes = await prisma.quotation.findMany({
      where: { workspaceId: ctx.workspace.id, ...getQuotationScopeFilter(ctx), ...(status ? { status } : {}) },
      include: {
        items: true,
        lead: { select: { id: true, leadNumber: true, firstName: true, lastName: true, company: true } },
        createdBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    res.json(quotes);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const quote = await prisma.quotation.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getQuotationScopeFilter(ctx) },
      include: {
        items: true,
        history: { orderBy: { createdAt: "desc" } },
        lead: true,
        deal: true,
        contact: true,
        createdBy: { select: { name: true, email: true } },
        approvedBy: { select: { name: true } },
      },
    });
    if (!quote) {
      res.status(404).json({ error: "Quotation not found" });
      return;
    }
    res.json(quote);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const data = quoteSchema.parse(req.body);
    const quoteNumber = await nextQuoteNumber(ctx.workspace.id);
    const { subtotal, taxAmount, total } = calcQuoteTotals(
      data.items,
      data.discount,
      data.taxRate
    );

    const quote = await prisma.quotation.create({
      data: {
        workspaceId: ctx.workspace.id,
        quoteNumber,
        createdById: ctx.session.userId,
        leadId: data.leadId || null,
        dealId: data.dealId || null,
        contactId: data.contactId || null,
        status: data.status || "draft",
        subtotal,
        taxRate: data.taxRate,
        taxAmount,
        discount: data.discount,
        total,
        validUntil: data.validUntil ? new Date(data.validUntil) : null,
        notes: data.notes || null,
        items: {
          create: data.items.map((i) => ({
            name: i.name,
            description: i.description || null,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            taxRate: i.taxRate,
            discount: i.discount,
            lineTotal: calcLineNet(i),
          })),
        },
        history: { create: { action: "created", notes: "Quotation created" } },
      },
      include: { items: true },
    });
    res.status(201).json(quote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.patch("/:id/approve", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    if (!["owner", "admin", "manager"].includes(ctx.membership.role)) {
      res.status(403).json({ error: "Only managers and admins can approve quotations" });
      return;
    }
    const existing = await prisma.quotation.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getQuotationScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Quotation not found" });
      return;
    }
    const quote = await prisma.quotation.update({
      where: { id: existing.id },
      data: { status: "approved", approvedById: ctx.session.userId, approvedAt: new Date() },
    });
    await prisma.quoteHistory.create({ data: { quotationId: quote.id, action: "approved", notes: "Quote approved" } });
    if (quote.createdById && quote.createdById !== ctx.session.userId) {
      await createNotification({
        workspaceId: ctx.workspace.id,
        userId: quote.createdById,
        type: "quote",
        title: "Quotation approved",
        message: `${quote.quoteNumber} was approved`,
      }).catch(() => {});
    }
    res.json(quote);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.patch("/:id/send", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const existing = await prisma.quotation.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getQuotationScopeFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const quote = await prisma.quotation.update({
      where: { id: param(req, "id") },
      data: { status: "sent", sentAt: new Date() },
    });
    await prisma.quoteHistory.create({ data: { quotationId: quote.id, action: "sent", notes: "Marked as sent" } });
    res.json({ ...quote, emailSent: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/:id/pdf", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const [workspace, quote] = await Promise.all([
      prisma.workspace.findUnique({ where: { id: ctx.workspace.id } }),
      prisma.quotation.findFirst({
        where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getQuotationScopeFilter(ctx) },
        include: {
          items: true,
          lead: true,
          contact: true,
          createdBy: { select: { name: true } },
        },
      }),
    ]);
    if (!workspace || !quote) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const html = renderQuotationPdfHtml(workspace, quote);
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(html);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
