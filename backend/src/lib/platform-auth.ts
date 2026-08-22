import type { Request } from "express";
import { prisma } from "./prisma";
import { requirePlatformSession, type PlatformSessionPayload } from "./auth";
import {
  normalizePlatformRole,
  platformHasPermission,
  type PlatformPermission,
  type PlatformRole,
} from "./platform-roles";

export type PlatformContext = PlatformSessionPayload & {
  role: PlatformRole;
  permissions: PlatformPermission[];
};

export async function getPlatformContext(req: Request): Promise<PlatformContext> {
  const session = await requirePlatformSession(req);
  const admin = await prisma.platformAdmin.findUnique({ where: { id: session.adminId } });
  if (!admin || admin.status !== "active") {
    throw new Error("Unauthorized");
  }
  const role = normalizePlatformRole(admin.role);
  const permissions = (["view_overview", "manage_companies", "manage_sales", "manage_subscriptions", "manage_team"] as PlatformPermission[]).filter(
    (p) => platformHasPermission(role, p)
  );
  return { ...session, role, permissions };
}

export function requirePlatformPermission(ctx: PlatformContext, permission: PlatformPermission) {
  if (!platformHasPermission(ctx.role, permission)) {
    throw new Error("Forbidden");
  }
}
