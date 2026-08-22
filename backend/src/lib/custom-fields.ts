import { prisma } from "./prisma";

export async function getCustomFieldsForEntity(
  workspaceId: string,
  entityType: string,
  entityId: string
): Promise<Record<string, string>> {
  const defs = await prisma.customFieldDefinition.findMany({
    where: { workspaceId, entityType },
    orderBy: { sortOrder: "asc" },
  });
  if (defs.length === 0) return {};

  const values = await prisma.customFieldValue.findMany({
    where: { workspaceId, entityType, entityId, fieldId: { in: defs.map((d) => d.id) } },
  });
  const byField = new Map(values.map((v) => [v.fieldId, v.value ?? ""]));
  const out: Record<string, string> = {};
  for (const def of defs) {
    out[def.key] = byField.get(def.id) ?? "";
  }
  return out;
}

export async function saveCustomFieldsForEntity(
  workspaceId: string,
  entityType: string,
  entityId: string,
  fields: Record<string, string | undefined | null>
): Promise<void> {
  const keys = Object.keys(fields);
  if (keys.length === 0) return;

  const defs = await prisma.customFieldDefinition.findMany({
    where: { workspaceId, entityType, key: { in: keys } },
  });

  for (const def of defs) {
    const raw = fields[def.key];
    const value = raw == null ? null : String(raw);
    await prisma.customFieldValue.upsert({
      where: { fieldId_entityId: { fieldId: def.id, entityId } },
      create: {
        workspaceId,
        fieldId: def.id,
        entityType,
        entityId,
        value,
      },
      update: { value },
    });
  }
}

export async function attachCustomFieldsToLeads<T extends { id: string }>(
  workspaceId: string,
  leads: T[]
): Promise<Array<T & { customFields: Record<string, string> }>> {
  if (leads.length === 0) return [];

  const defs = await prisma.customFieldDefinition.findMany({
    where: { workspaceId, entityType: "lead" },
    orderBy: { sortOrder: "asc" },
  });
  if (defs.length === 0) return leads.map((l) => ({ ...l, customFields: {} }));

  const values = await prisma.customFieldValue.findMany({
    where: {
      workspaceId,
      entityType: "lead",
      entityId: { in: leads.map((l) => l.id) },
    },
  });

  const byEntity = new Map<string, Map<string, string>>();
  for (const v of values) {
    const def = defs.find((d) => d.id === v.fieldId);
    if (!def) continue;
    if (!byEntity.has(v.entityId)) byEntity.set(v.entityId, new Map());
    byEntity.get(v.entityId)!.set(def.key, v.value ?? "");
  }

  return leads.map((lead) => {
    const map = byEntity.get(lead.id);
    const customFields: Record<string, string> = {};
    for (const def of defs) {
      customFields[def.key] = map?.get(def.key) ?? "";
    }
    return { ...lead, customFields };
  });
}
