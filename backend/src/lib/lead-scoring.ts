import { prisma } from "./prisma";
import type { Lead } from "@prisma/client";

export type ScoringLeadInput = Pick<
  Lead,
  | "source"
  | "priority"
  | "budget"
  | "city"
  | "state"
  | "industry"
  | "status"
  | "email"
  | "phone"
  | "company"
  | "requirement"
>;

function getFieldValue(lead: ScoringLeadInput, field: string): string | number | boolean | null {
  switch (field) {
    case "has_email":
      return Boolean(lead.email?.trim());
    case "has_phone":
      return Boolean(lead.phone?.trim());
    case "has_company":
      return Boolean(lead.company?.trim());
    case "budget":
      return lead.budget ?? 0;
    default:
      return (lead as Record<string, unknown>)[field] as string | null;
  }
}

function matchesRule(
  lead: ScoringLeadInput,
  rule: { field: string; operator: string; value: string | null }
): boolean {
  const raw = getFieldValue(lead, rule.field);
  const op = rule.operator;
  const expected = rule.value?.trim() ?? "";

  if (op === "exists") return Boolean(raw);
  if (op === "not_exists") return !raw;

  if (typeof raw === "boolean") {
    if (op === "equals") return raw === (expected === "true" || expected === "1");
    return false;
  }

  if (typeof raw === "number") {
    const num = parseFloat(expected);
    if (Number.isNaN(num)) return false;
    if (op === "gte") return raw >= num;
    if (op === "gt") return raw > num;
    if (op === "lte") return raw <= num;
    if (op === "lt") return raw < num;
    if (op === "equals") return raw === num;
    return false;
  }

  const hay = String(raw ?? "").toLowerCase();
  const needle = expected.toLowerCase();
  if (op === "equals") return hay === needle;
  if (op === "not_equals") return hay !== needle;
  if (op === "contains") return hay.includes(needle);
  return false;
}

export async function computeLeadScore(workspaceId: string, lead: ScoringLeadInput): Promise<number> {
  const rules = await prisma.leadScoringRule.findMany({
    where: { workspaceId, isActive: true },
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
  if (rules.length === 0) return lead.budget && lead.budget > 0 ? 10 : 0;

  let total = 0;
  for (const rule of rules) {
    if (matchesRule(lead, rule)) total += rule.points;
  }
  return Math.max(0, Math.min(100, total));
}

export async function applyLeadScore(workspaceId: string, leadId: string): Promise<number> {
  const lead = await prisma.lead.findFirst({ where: { id: leadId, workspaceId } });
  if (!lead) return 0;
  const score = await computeLeadScore(workspaceId, lead);
  if (score !== lead.score) {
    await prisma.lead.update({ where: { id: leadId }, data: { score } });
  }
  return score;
}
