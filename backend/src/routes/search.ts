import { Router } from "express";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getLeadOwnerFilter,
  getOwnerScopeFilter,
  getCustomerScopeFilter,
} from "../lib/rbac";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const q = (req.query.q as string)?.trim();
    if (!q || q.length < 2) {
      res.json({ leads: [], contacts: [], accounts: [], deals: [], customers: [] });
      return;
    }

    const leadScope = getLeadOwnerFilter(ctx);
    const ownerScope = getOwnerScopeFilter(ctx);
    const customerScope = getCustomerScopeFilter(ctx);

    const [leads, contacts, accounts, deals, customers] = await Promise.all([
      prisma.lead.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          ...leadScope,
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { company: { contains: q } },
            { leadNumber: { contains: q } },
          ],
        },
        take: 8,
        select: { id: true, firstName: true, lastName: true, company: true, status: true, phone: true },
      }),
      prisma.contact.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          ...ownerScope,
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
          ],
        },
        take: 8,
        select: { id: true, firstName: true, lastName: true, email: true },
      }),
      prisma.account.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          ...ownerScope,
          OR: [{ name: { contains: q } }, { industry: { contains: q } }],
        },
        take: 8,
        select: { id: true, name: true, industry: true },
      }),
      prisma.deal.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          ...ownerScope,
          name: { contains: q },
        },
        take: 8,
        select: { id: true, name: true, amount: true, status: true },
      }),
      prisma.customer.findMany({
        where: {
          workspaceId: ctx.workspace.id,
          ...customerScope,
          OR: [
            { name: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { company: { contains: q } },
          ],
        },
        take: 8,
        select: { id: true, name: true, company: true, email: true, phone: true },
      }),
    ]);

    res.json({ leads, contacts, accounts, deals, customers });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
