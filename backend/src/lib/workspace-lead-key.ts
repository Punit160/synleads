import { prisma } from "./prisma";
import { generateLeadApiKey } from "./auto-assign-key";

/** Each SaaS tenant gets a globally unique lead API key — inbound webhooks route to that workspace only. */
export async function ensureWorkspaceLeadApiKey(workspaceId: string): Promise<string> {
  const existing = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { leadApiKey: true },
  });
  if (existing?.leadApiKey) return existing.leadApiKey;

  for (let attempt = 0; attempt < 5; attempt++) {
    const key = generateLeadApiKey();
    try {
      const updated = await prisma.workspace.update({
        where: { id: workspaceId },
        data: { leadApiKey: key },
        select: { leadApiKey: true },
      });
      return updated.leadApiKey!;
    } catch {
      // Rare collision on unique constraint — retry
    }
  }
  throw new Error("Failed to generate unique lead API key");
}
