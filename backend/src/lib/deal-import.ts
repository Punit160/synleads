import { prisma } from "./prisma";
import { mapRowHeaders } from "./spreadsheet";

const ALIASES: Record<string, string> = {
  name: "name",
  dealname: "name",
  stagename: "stageName",
  stage: "stageName",
  amount: "amount",
  value: "amount",
  probability: "probability",
  accountname: "accountName",
  account: "accountName",
  contactemail: "contactEmail",
  email: "contactEmail",
  expectedclosedate: "expectedCloseDate",
  closedate: "expectedCloseDate",
  notes: "notes",
};

export async function importDealRows(
  workspaceId: string,
  rows: Record<string, string>[],
  defaultOwnerId: string
) {
  let imported = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (const raw of rows) {
    const row = mapRowHeaders(raw, ALIASES);
    if (!row.name) {
      errors.push("Skipped row: missing name");
      continue;
    }
    if (!row.stageName) {
      errors.push(`Skipped "${row.name}": missing stageName`);
      continue;
    }

    const stage = await prisma.pipelineStage.findFirst({
      where: { workspaceId, name: row.stageName },
    });
    if (!stage) {
      errors.push(`Skipped "${row.name}": stage "${row.stageName}" not found`);
      continue;
    }

    let accountId: string | null = null;
    if (row.accountName) {
      const account = await prisma.account.findFirst({
        where: { workspaceId, name: row.accountName },
      });
      if (account) accountId = account.id;
      else errors.push(`Deal "${row.name}": account "${row.accountName}" not found`);
    }

    let contactId: string | null = null;
    if (row.contactEmail) {
      const contact = await prisma.contact.findFirst({
        where: { workspaceId, email: row.contactEmail },
      });
      if (contact) contactId = contact.id;
      else errors.push(`Deal "${row.name}": contact "${row.contactEmail}" not found`);
    }

    const existing = await prisma.deal.findFirst({
      where: { workspaceId, name: row.name, ...(accountId ? { accountId } : {}) },
    });
    if (existing) {
      duplicates++;
      continue;
    }

    await prisma.deal.create({
      data: {
        workspaceId,
        ownerId: defaultOwnerId,
        stageId: stage.id,
        name: row.name,
        amount: row.amount ? parseFloat(row.amount) : 0,
        probability: row.probability ? parseInt(row.probability, 10) : stage.probability,
        accountId,
        contactId,
        expectedCloseDate: row.expectedCloseDate ? new Date(row.expectedCloseDate) : null,
        notes: row.notes || null,
      },
    });
    imported++;
  }

  return { imported, duplicates, errors };
}
