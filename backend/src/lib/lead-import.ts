import { mapRowHeaders } from "./spreadsheet";
import { LEAD_STATUSES, LEAD_PRIORITIES } from "./lead-constants";
import { generateLeadNumber, findDuplicateLeads, addTimelineEvent } from "./lead-utils";
import { pickLeadOwner } from "./auto-assign";
import { prisma } from "./prisma";

export { parseCsv } from "./spreadsheet";

const ALIASES: Record<string, string> = {
  firstname: "firstName",
  fname: "firstName",
  lastname: "lastName",
  lname: "lastName",
  mobileno: "phone",
  mobile: "phone",
  phoneno: "phone",
  phone: "phone",
  emailid: "email",
  email: "email",
  companyname: "company",
  company: "company",
  city: "city",
  state: "state",
  source: "source",
  status: "status",
  priority: "priority",
  budget: "budget",
  requirement: "requirement",
  remarks: "remarks",
  score: "score",
  pincode: "pinCode",
  industry: "industry",
  website: "website",
  address: "address",
  country: "country",
  alternatephone: "alternatePhone",
};

export async function importLeadRows(
  workspaceId: string,
  rows: Record<string, string>[],
  defaultOwnerId: string,
  options?: { ownerId?: string }
) {
  let imported = 0;
  let duplicates = 0;
  const errors: string[] = [];
  const assignOwnerId = options?.ownerId;

  for (const raw of rows) {
    const row = mapRowHeaders(raw, ALIASES);
    if (!row.firstName) {
      errors.push("Skipped row: missing firstName");
      continue;
    }
    const dups = await findDuplicateLeads(workspaceId, row.email, row.phone);
    if (dups.length > 0) {
      duplicates++;
      continue;
    }
    const leadNumber = await generateLeadNumber(workspaceId);
    const ownerId = assignOwnerId || (await pickLeadOwner(workspaceId, null, {
      source: row.source,
      city: row.city,
      state: row.state,
      industry: row.industry,
      requirement: row.requirement,
    })) || defaultOwnerId;
    const lead = await prisma.lead.create({
      data: {
        workspaceId,
        ownerId,
        leadNumber,
        firstName: row.firstName,
        lastName: row.lastName || null,
        email: row.email || null,
        phone: row.phone || null,
        alternatePhone: row.alternatePhone || null,
        company: row.company || null,
        address: row.address || null,
        city: row.city || null,
        state: row.state || null,
        country: row.country || "India",
        pinCode: row.pinCode || null,
        industry: row.industry || null,
        website: row.website || null,
        source: row.source || "Excel Import",
        status: LEAD_STATUSES.includes(row.status as typeof LEAD_STATUSES[number])
          ? row.status
          : ownerId
            ? "assigned"
            : "new",
        priority: LEAD_PRIORITIES.includes(row.priority as typeof LEAD_PRIORITIES[number]) ? row.priority : "medium",
        budget: row.budget ? parseFloat(row.budget) : null,
        requirement: row.requirement || null,
        expectedClosingDate: row.expectedClosingDate ? new Date(row.expectedClosingDate) : null,
        remarks: row.remarks || null,
        score: row.score ? parseInt(row.score, 10) : 0,
      },
    });
    await addTimelineEvent(lead.id, "created", "Lead imported", `Lead ${leadNumber} imported`, ownerId);
    imported++;
  }

  return { imported, duplicates, errors };
}
