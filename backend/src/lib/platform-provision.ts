import { prisma } from "./prisma";
import { hashPassword } from "./auth";
import { createDefaultStages } from "./workspace";
import { createSubscription } from "./subscription";
import { generateLeadApiKey } from "./auto-assign-key";
import { ensureUniqueWorkspaceSlug } from "./workspace-slug";
import type { SubscriptionPackage } from "./roles";

export type CompanyProfileInput = {
  companyLegalName?: string;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  country?: string;
  phone?: string;
  email?: string;
  website?: string;
  gstin?: string;
  pan?: string;
  logoPath?: string;
};

export async function provisionCompany(input: {
  companyName: string;
  ownerName: string;
  ownerEmail: string;
  ownerPassword: string;
  package: SubscriptionPackage;
  provisionedByPlatformAdminId?: string;
  interestedPackage?: string;
  profile?: CompanyProfileInput;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.ownerEmail } });
  if (existing) {
    const hasWorkspace = await prisma.workspace.findFirst({
      where: { OR: [{ userId: existing.id }, { members: { some: { userId: existing.id } } }] },
    });
    if (hasWorkspace) {
      throw new Error("Email already registered to a company");
    }
  }

  const password = await hashPassword(input.ownerPassword);

  const user = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { name: input.ownerName, password },
      })
    : await prisma.user.create({
        data: {
          name: input.ownerName,
          email: input.ownerEmail,
          password,
        },
      });

  const profile = input.profile ?? {};
  const slug = await ensureUniqueWorkspaceSlug(input.companyName);

  const workspace = await prisma.workspace.create({
    data: {
      name: input.companyName,
      slug,
      userId: user.id,
      status: "active",
      leadApiKey: generateLeadApiKey(),
      provisionedByPlatformAdminId: input.provisionedByPlatformAdminId ?? null,
      interestedPackage: input.interestedPackage ?? null,
      companyLegalName: profile.companyLegalName || null,
      address: profile.address || null,
      city: profile.city || null,
      state: profile.state || null,
      pincode: profile.pincode || null,
      country: profile.country || "India",
      phone: profile.phone || null,
      email: profile.email || input.ownerEmail,
      website: profile.website || null,
      gstin: profile.gstin || null,
      pan: profile.pan || null,
      logoPath: profile.logoPath || null,
    },
  });

  await prisma.workspaceMember.create({
    data: {
      workspaceId: workspace.id,
      userId: user.id,
      role: "owner",
      status: "active",
    },
  });

  await createDefaultStages(workspace.id);
  await createSubscription(workspace.id, input.package);

  return { workspace, owner: user };
}

/** Platform-level stats only — no tenant CRM data (leads, deals, client revenue). */
export async function getPlatformOverviewStats() {
  const [companyCount, activeCompanies, totalMembers, expiringSoon] = await Promise.all([
    prisma.workspace.count(),
    prisma.workspace.count({ where: { status: "active" } }),
    prisma.workspaceMember.count({ where: { status: "active" } }),
    prisma.subscription.count({
      where: {
        status: "active",
        expiresAt: { lte: new Date(Date.now() + 30 * 86400000) },
      },
    }),
  ]);

  return {
    companyCount,
    activeCompanies,
    suspendedCompanies: companyCount - activeCompanies,
    totalMembers,
    expiringSoon,
  };
}
