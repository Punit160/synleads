import { resolveAssignmentForLead, type LeadAssignContext } from "./assignment-engine";

/** @deprecated use resolveAssignmentForLead */
export async function resolveAutoAssignOwner(workspaceId: string): Promise<string | null> {
  return resolveAssignmentForLead(workspaceId);
}

export async function pickLeadOwner(
  workspaceId: string,
  explicitOwnerId?: string | null,
  lead?: LeadAssignContext
): Promise<string | null> {
  if (explicitOwnerId) return explicitOwnerId;
  return resolveAssignmentForLead(workspaceId, lead ?? {});
}

export { generateLeadApiKey } from "./auto-assign-key";
