import { prisma } from "./prisma";

export const RESERVED_WORKSPACE_SLUGS = new Set([
  "login",
  "register",
  "dashboard",
  "api",
  "health",
  "platform",
  "admin",
  "www",
  "app",
  "static",
  "_next",
]);

export function slugifyCompanyName(name: string): string {
  const base = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return base && !RESERVED_WORKSPACE_SLUGS.has(base) ? base : "company";
}

export async function ensureUniqueWorkspaceSlug(baseName: string, excludeWorkspaceId?: string): Promise<string> {
  let root = slugifyCompanyName(baseName);
  if (RESERVED_WORKSPACE_SLUGS.has(root)) root = `${root}-portal`;

  let candidate = root;
  let n = 2;
  while (true) {
    const existing = await prisma.workspace.findFirst({
      where: {
        slug: candidate,
        ...(excludeWorkspaceId ? { NOT: { id: excludeWorkspaceId } } : {}),
      },
      select: { id: true },
    });
    if (!existing) return candidate;
    candidate = `${root}-${n++}`;
  }
}

/** Backfill slug for workspaces created before slug field existed. */
export async function ensureWorkspaceSlug(workspaceId: string, name: string): Promise<string> {
  const ws = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  });
  if (ws?.slug) return ws.slug;

  const slug = await ensureUniqueWorkspaceSlug(name, workspaceId);
  await prisma.workspace.update({
    where: { id: workspaceId },
    data: { slug },
  });
  return slug;
}
