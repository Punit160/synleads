import { prisma } from "./prisma";
import { mapRowHeaders } from "./spreadsheet";

const ALIASES: Record<string, string> = {
  name: "name",
  customername: "name",
  email: "email",
  phone: "phone",
  company: "company",
  notes: "notes",
};

export async function importCustomerRows(
  workspaceId: string,
  rows: Record<string, string>[],
  _defaultOwnerId: string
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
    const existing = await prisma.customer.findFirst({
      where: {
        workspaceId,
        OR: [
          { name: row.name },
          ...(row.email ? [{ email: row.email }] : []),
          ...(row.phone ? [{ phone: row.phone }] : []),
        ],
      },
    });
    if (existing) {
      duplicates++;
      continue;
    }
    await prisma.customer.create({
      data: {
        workspaceId,
        name: row.name,
        email: row.email || null,
        phone: row.phone || null,
        company: row.company || row.name,
        notes: row.notes || null,
      },
    });
    imported++;
  }

  return { imported, duplicates, errors };
}
