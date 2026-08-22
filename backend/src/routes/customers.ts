import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getCustomerScopeFilter,
  getLeadOwnerFilter,
} from "../lib/rbac";
import { registerImportRoutes } from "../lib/import-routes";
import { importCustomerRows } from "../lib/customer-import";
import { seedCustomerConversionRecords } from "../lib/lead-conversion";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

registerImportRoutes(router, "customers", importCustomerRows);

const orderSchema = z.object({ orderNumber: z.string(), amount: z.number(), status: z.string().optional(), notes: z.string().optional() });
const invoiceSchema = z.object({ invoiceNumber: z.string(), amount: z.number(), dueDate: z.string().optional(), status: z.string().optional() });
const paymentSchema = z.object({ amount: z.number(), method: z.string().optional(), invoiceId: z.string().optional(), reference: z.string().optional() });
const serviceSchema = z.object({ title: z.string(), description: z.string().optional(), serviceDate: z.string().optional(), status: z.string().optional() });

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const q = req.query.q as string | undefined;
    const customers = await prisma.customer.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        ...getCustomerScopeFilter(ctx),
        ...(q ? {
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { company: { contains: q } },
          ],
        } : {}),
      },
      include: {
        _count: { select: { orders: true, invoices: true, payments: true, serviceHistory: true } },
      },
      orderBy: { convertedAt: "desc" },
    });
    res.json(customers);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const customer = await prisma.customer.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getCustomerScopeFilter(ctx) },
      include: {
        lead: { select: { id: true, leadNumber: true } },
        contact: true,
        account: true,
        orders: { orderBy: { orderDate: "desc" } },
        invoices: { orderBy: { createdAt: "desc" }, include: { payments: true } },
        payments: { orderBy: { paidAt: "desc" } },
        serviceHistory: { orderBy: { serviceDate: "desc" } },
        documents: { orderBy: { uploadedAt: "desc" } },
      },
    });
    if (!customer) {
      res.status(404).json({ error: "Customer not found" });
      return;
    }

    if (customer.leadId && customer.orders.length === 0) {
      const lead = await prisma.lead.findUnique({
        where: { id: customer.leadId },
        select: { leadNumber: true, budget: true },
      });
      if (lead) {
        await seedCustomerConversionRecords(customer.id, lead.leadNumber, lead.budget ?? 0);
        const refreshed = await prisma.customer.findFirst({
          where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getCustomerScopeFilter(ctx) },
          include: {
            lead: { select: { id: true, leadNumber: true } },
            contact: true,
            account: true,
            orders: { orderBy: { orderDate: "desc" } },
            invoices: { orderBy: { createdAt: "desc" }, include: { payments: true } },
            payments: { orderBy: { paidAt: "desc" } },
            serviceHistory: { orderBy: { serviceDate: "desc" } },
            documents: { orderBy: { uploadedAt: "desc" } },
          },
        });
        if (refreshed) {
          res.json(refreshed);
          return;
        }
      }
    }

    res.json(customer);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/from-lead/:leadId", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const lead = await prisma.lead.findFirst({
      where: { id: param(req, "leadId"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    const existing = await prisma.customer.findUnique({ where: { leadId: lead.id } });
    if (existing) {
      res.json(existing);
      return;
    }
    const customer = await prisma.customer.create({
      data: {
        workspaceId: ctx.workspace.id,
        leadId: lead.id,
        name: `${lead.firstName} ${lead.lastName || ""}`.trim(),
        email: lead.email,
        phone: lead.phone,
        company: lead.company,
      },
    });
    res.status(201).json(customer);
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

async function scopedCustomer(ctx: Awaited<ReturnType<typeof getAuthenticatedContext>>, id: string) {
  return prisma.customer.findFirst({
    where: { id, workspaceId: ctx.workspace.id, ...getCustomerScopeFilter(ctx) },
  });
}

router.post("/:id/orders", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const data = orderSchema.parse(req.body);
    const customer = await scopedCustomer(ctx, param(req, "id"));
    if (!customer) { res.status(404).json({ error: "Not found" }); return; }
    const order = await prisma.customerOrder.create({
      data: { customerId: customer.id, orderNumber: data.orderNumber, amount: data.amount, status: data.status || "pending", notes: data.notes || null },
    });
    res.status(201).json(order);
  } catch { res.status(400).json({ error: "Invalid data" }); }
});

router.post("/:id/invoices", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const data = invoiceSchema.parse(req.body);
    const customer = await scopedCustomer(ctx, param(req, "id"));
    if (!customer) { res.status(404).json({ error: "Not found" }); return; }
    const invoice = await prisma.customerInvoice.create({
      data: { customerId: customer.id, invoiceNumber: data.invoiceNumber, amount: data.amount, dueDate: data.dueDate ? new Date(data.dueDate) : null, status: data.status || "unpaid" },
    });
    res.status(201).json(invoice);
  } catch { res.status(400).json({ error: "Invalid data" }); }
});

router.post("/:id/payments", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const data = paymentSchema.parse(req.body);
    const customer = await scopedCustomer(ctx, param(req, "id"));
    if (!customer) { res.status(404).json({ error: "Not found" }); return; }
    const payment = await prisma.customerPayment.create({
      data: { customerId: customer.id, invoiceId: data.invoiceId || null, amount: data.amount, method: data.method || "bank_transfer", reference: data.reference || null },
    });
    if (data.invoiceId) {
      await prisma.customerInvoice.update({ where: { id: data.invoiceId }, data: { status: "paid", paidAt: new Date() } });
    }
    res.status(201).json(payment);
  } catch { res.status(400).json({ error: "Invalid data" }); }
});

router.post("/:id/services", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const data = serviceSchema.parse(req.body);
    const customer = await scopedCustomer(ctx, param(req, "id"));
    if (!customer) { res.status(404).json({ error: "Not found" }); return; }
    const record = await prisma.serviceHistory.create({
      data: { customerId: customer.id, title: data.title, description: data.description || null, serviceDate: data.serviceDate ? new Date(data.serviceDate) : new Date(), status: data.status || "completed" },
    });
    res.status(201).json(record);
  } catch { res.status(400).json({ error: "Invalid data" }); }
});

export default router;
