import { prisma } from "./prisma";
import { mapRowHeaders } from "./spreadsheet";

const ALIASES: Record<string, string> = {
  firstname: "firstName",
  lastname: "lastName",
  email: "email",
  phone: "phone",
  title: "title",
  jobtitle: "title",
  accountname: "accountName",
  account: "accountName",
  notes: "notes",
};

async function findAccountByName(workspaceId: string, name: string) {
  return prisma.account.findFirst({
    where: { workspaceId, name: { equals: name } },
    select: { id: true },
  });
}

export async function importContactRows(
  workspaceId: string,
  rows: Record<string, string>[],
  defaultOwnerId: string
) {
  let imported = 0;
  let duplicates = 0;
  const errors: string[] = [];

  for (const raw of rows) {
    const row = mapRowHeaders(raw, ALIASES);
    if (!row.firstName) {
      errors.push("Skipped row: missing firstName");
      continue;
    }
    if (row.email || row.phone) {
      const existing = await prisma.contact.findFirst({
        where: {
          workspaceId,
          OR: [
            ...(row.email ? [{ email: row.email }] : []),
            ...(row.phone ? [{ phone: row.phone }] : []),
          ],
        },
      });
      if (existing) {
        duplicates++;
        continue;
      }
    }
    let accountId: string | null = null;
    if (row.accountName) {
      const account = await findAccountByName(workspaceId, row.accountName);
      if (account) accountId = account.id;
      else errors.push(`Row "${row.firstName}": account "${row.accountName}" not found — contact created without account`);
    }
    await prisma.contact.create({
      data: {
        workspaceId,
        ownerId: defaultOwnerId,
        firstName: row.firstName,
        lastName: row.lastName || null,
        email: row.email || null,
        phone: row.phone || null,
        title: row.title || null,
        accountId,
        notes: row.notes || null,
      },
    });
    imported++;
  }

  return { imported, duplicates, errors };
}
