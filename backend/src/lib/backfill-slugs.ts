import { prisma } from "./prisma";
import { ensureWorkspaceSlug } from "./workspace-slug";

/** Ensure every workspace has a URL slug (for /{slug}/login routing). */
export async function backfillWorkspaceSlugs(): Promise<number> {
  const rows = await prisma.workspace.findMany({
    where: { OR: [{ slug: null }, { slug: "" }] },
    select: { id: true, name: true },
    take: 500,
  });
  let count = 0;
  for (const ws of rows) {
    await ensureWorkspaceSlug(ws.id, ws.name);
    count++;
  }
  return count;
}
