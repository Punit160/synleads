import { prisma } from "./prisma";
import type { Prisma } from "@prisma/client";

const WON_LEAD_STATUSES = ["won", "converted"] as const;

function resolveAmount(primary: number | null | undefined, fallback: number | null | undefined): number {
  if (typeof primary === "number" && primary > 0) return primary;
  if (typeof fallback === "number" && fallback > 0) return fallback;
  return 0;
}

/** Create order / invoice / payment records when a lead is converted to a customer. */
export async function seedCustomerConversionRecords(
  customerId: string,
  leadNumber: string,
  amount: number
): Promise<void> {
  const existingOrders = await prisma.customerOrder.count({ where: { customerId } });
  if (existingOrders > 0) return;

  const orderNumber = `ORD-${leadNumber}`;
  const invoiceNumber = `INV-${leadNumber}`;
  const value = Number.isFinite(amount) && amount > 0 ? amount : 0;

  await prisma.customerOrder.create({
    data: {
      customerId,
      orderNumber,
      amount: value,
      status: value > 0 ? "confirmed" : "pending",
      notes: "Created from lead conversion",
    },
  });

  const invoice = await prisma.customerInvoice.create({
    data: {
      customerId,
      invoiceNumber,
      amount: value,
      status: value > 0 ? "paid" : "unpaid",
      dueDate: new Date(),
      paidAt: value > 0 ? new Date() : null,
    },
  });

  if (value > 0) {
    await prisma.customerPayment.create({
      data: {
        customerId,
        invoiceId: invoice.id,
        amount: value,
        method: "bank_transfer",
        reference: `Conversion ${leadNumber}`,
      },
    });
  }

  await prisma.serviceHistory.create({
    data: {
      customerId,
      title: "Lead converted to customer",
      description: `Converted from lead ${leadNumber}`,
      status: "completed",
    },
  });
}

/** Repair deals / customer records for leads already marked won (pre-fix conversions). */
export async function syncWonLeadCommercialData(workspaceId: string): Promise<void> {
  const wonStage = await prisma.pipelineStage.findFirst({
    where: { workspaceId, isWon: true },
    orderBy: { order: "asc" },
  });
  if (!wonStage) return;

  const wonLeads = await prisma.lead.findMany({
    where: { workspaceId, status: { in: [...WON_LEAD_STATUSES] } },
    include: {
      customer: {
        include: {
          orders: true,
          invoices: true,
          payments: true,
        },
      },
    },
  });

  for (const lead of wonLeads) {
    const amount = resolveAmount(lead.budget, null);
    const customer = lead.customer;

    if (customer) {
      if (customer.orders.length === 0) {
        await seedCustomerConversionRecords(customer.id, lead.leadNumber, amount);
      } else if (amount > 0) {
        for (const order of customer.orders) {
          if (order.amount <= 0) {
            await prisma.customerOrder.update({
              where: { id: order.id },
              data: { amount, status: "confirmed" },
            });
          }
        }
        for (const invoice of customer.invoices) {
          if (invoice.amount <= 0) {
            await prisma.customerInvoice.update({
              where: { id: invoice.id },
              data: { amount, status: "paid", paidAt: new Date() },
            });
          }
        }
        if (customer.payments.length === 0 && customer.invoices.length > 0) {
          const invoice = customer.invoices[0];
          await prisma.customerPayment.create({
            data: {
              customerId: customer.id,
              invoiceId: invoice.id,
              amount,
              method: "bank_transfer",
              reference: `Conversion ${lead.leadNumber}`,
            },
          });
        }
      }

      if (customer.contactId) {
        const deal = await prisma.deal.findFirst({
          where: { workspaceId, contactId: customer.contactId },
          orderBy: { updatedAt: "desc" },
        });

        if (deal) {
          if (deal.status !== "won") {
            await prisma.deal.update({
              where: { id: deal.id },
              data: {
                status: "won",
                stageId: wonStage.id,
                probability: 100,
                closedAt: new Date(),
                amount: resolveAmount(deal.amount, amount),
              },
            });
          } else if (deal.amount <= 0 && amount > 0) {
            await prisma.deal.update({
              where: { id: deal.id },
              data: { amount },
            });
          }
        } else if (amount > 0) {
          await prisma.deal.create({
            data: {
              workspaceId,
              ownerId: lead.ownerId,
              stageId: wonStage.id,
              accountId: customer.accountId,
              contactId: customer.contactId,
              name: `${lead.company || lead.firstName} — Won`,
              amount,
              probability: 100,
              status: "won",
              closedAt: new Date(),
            },
          });
        }
      }
    }
  }
}

export async function computeWonRevenueMetrics(
  workspaceId: string,
  leadWhere: Prisma.LeadWhereInput,
  dealWhere: Prisma.DealWhereInput = { workspaceId }
) {
  await syncWonLeadCommercialData(workspaceId);

  const wonLeadFilter = { ...leadWhere, status: { in: [...WON_LEAD_STATUSES] } };

  const [wonDeals, wonLeadBudgets, wonCustomerOrders] = await Promise.all([
    prisma.deal.aggregate({
      where: { ...dealWhere, status: "won" },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.lead.aggregate({
      where: wonLeadFilter,
      _sum: { budget: true },
    }),
    prisma.customerOrder.aggregate({
      where: {
        customer: {
          workspaceId,
          lead: { is: wonLeadFilter },
        },
      },
      _sum: { amount: true },
    }),
  ]);

  const dealRevenue = wonDeals._sum.amount ?? 0;
  const orderRevenue = wonCustomerOrders._sum.amount ?? 0;
  const budgetRevenue = wonLeadBudgets._sum.budget ?? 0;

  const wonRevenue = Math.max(dealRevenue, orderRevenue, budgetRevenue);

  return { wonRevenue, wonDealCount: wonDeals._count, dealRevenue, orderRevenue, budgetRevenue };
}
