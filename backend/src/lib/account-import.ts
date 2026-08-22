import { prisma } from "./prisma";
import { mapRowHeaders } from "./spreadsheet";

const ALIASES: Record<string, string> = {
  name: "name",
  accountname: "name",
  company: "name",
  industry: "industry",
  website: "website",
  phone: "phone",
  city: "city",
  state: "state",
  country: "country",
  notes: "notes",
};

export async function importAccountRows(
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
    const existing = await prisma.account.findFirst({
      where: { workspaceId, name: row.name },
    });
    if (existing) {
      duplicates++;
      continue;
    }
    await prisma.account.create({
      data: {
        workspaceId,
        ownerId: defaultOwnerId,
        name: row.name,
        industry: row.industry || null,
        website: row.website || null,
        phone: row.phone || null,
        city: row.city || null,
        state: row.state || null,
        country: row.country || "India",
        notes: row.notes || null,
      },
    });
    imported++;
  }

  return { imported, duplicates, errors };
}
