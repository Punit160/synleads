import type { Request } from "express";
import { prisma } from "./prisma";
import { requireSession } from "./auth";
import { generateLeadApiKey } from "./auto-assign-key";
import { ensureUniqueWorkspaceSlug } from "./workspace-slug";

const DEFAULT_STAGES = [
  { name: "New", order: 0, probability: 5 },
  { name: "Assigned", order: 1, probability: 10 },
  { name: "Contacted", order: 2, probability: 20 },
  { name: "Qualified", order: 3, probability: 35 },
  { name: "Proposal / Quotation", order: 4, probability: 55 },
  { name: "Negotiation", order: 5, probability: 75 },
  { name: "Won", order: 6, probability: 100, isWon: true },
  { name: "Lost", order: 7, probability: 0, isLost: true },
];

export async function createDefaultStages(workspaceId: string) {
  await prisma.pipelineStage.createMany({
    data: DEFAULT_STAGES.map((s) => ({
      workspaceId,
      name: s.name,
      order: s.order,
      probability: s.probability,
      isWon: s.isWon ?? false,
      isLost: s.isLost ?? false,
    })),
  });
}

export async function getWorkspaceForUser(userId: string) {
  const membership = await prisma.workspaceMember.findFirst({
    where: { userId, status: "active" },
    include: { workspace: true },
  });

  if (membership) return membership.workspace;

  let workspace = await prisma.workspace.findUnique({ where: { userId } });

  if (!workspace) {
    const slug = await ensureUniqueWorkspaceSlug("My Workspace");
    workspace = await prisma.workspace.create({
      data: {
        userId,
        name: "My Workspace",
        slug,
        leadApiKey: generateLeadApiKey(),
        members: {
          create: { userId, role: "owner", status: "active" },
        },
      },
    });
    await createDefaultStages(workspace.id);
  } else {
    const memberCount = await prisma.workspaceMember.count({
      where: { workspaceId: workspace.id },
    });
    if (memberCount === 0) {
      await prisma.workspaceMember.create({
        data: { workspaceId: workspace.id, userId, role: "owner", status: "active" },
      });
    }
    const stageCount = await prisma.pipelineStage.count({
      where: { workspaceId: workspace.id },
    });
    if (stageCount === 0) await createDefaultStages(workspace.id);
  }

  return workspace;
}

export async function getAuthenticatedWorkspace(req: Request) {
  const session = await requireSession(req);
  const workspace = await getWorkspaceForUser(session.userId);
  return { session, workspace };
}
