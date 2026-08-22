import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import {
  createSession,
  setSessionCookie,
  clearSessionCookie,
  verifyPassword,
  getSessionFromRequest,
} from "../lib/auth";
import { getAuthenticatedContext } from "../lib/rbac";
import { ensureWorkspaceSlug } from "../lib/workspace-slug";
import { tenantPortalLoginUrl } from "../lib/tenant-url";
import { normalizePhone, isEmailIdentifier } from "../lib/phone-utils";
import { respondWithError, handleAuthError } from "../lib/route-error";
import { ROLE_LABELS, normalizeRole, PACKAGE_LABELS, packageMaxUsers, packageCustomerLabel, type SubscriptionPackage } from "../lib/roles";

const router = Router();

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  workspaceSlug: z.string().min(1).optional(),
});

const resolvePortalSchema = z.object({
  identifier: z.string().min(3),
});

router.post("/resolve-portal", async (req, res) => {
  try {
    const { identifier } = resolvePortalSchema.parse(req.body);
    const trimmed = identifier.trim();
    const isEmail = isEmailIdentifier(trimmed);

    if (!isEmail) {
      const phone = normalizePhone(trimmed);
      if (phone.length < 10) {
        res.status(400).json({ error: "Enter a valid 10-digit mobile number" });
        return;
      }
    }

    const user = await prisma.user.findFirst({
      where: isEmail ? { email: trimmed.toLowerCase() } : { phone: normalizePhone(trimmed) },
      select: {
        id: true,
        email: true,
        name: true,
        memberships: {
          where: { status: "active", workspace: { status: "active" } },
          orderBy: { createdAt: "asc" },
          take: 1,
          select: {
            workspace: {
              select: {
                id: true,
                name: true,
                slug: true,
                status: true,
                companyLegalName: true,
              },
            },
          },
        },
      },
    });

    if (!user) {
      res.status(404).json({ error: "No account found with this email or mobile number" });
      return;
    }

    const membership = user.memberships[0];
    if (!membership?.workspace) {
      res.status(403).json({ error: "No active company workspace for this account" });
      return;
    }

    const ws = membership.workspace;
    const workspaceSlug = ws.slug || (await ensureWorkspaceSlug(ws.id, ws.name));
    const companyName = ws.companyLegalName || ws.name;

    res.json({
      workspaceSlug,
      companyName,
      email: user.email,
      userName: user.name,
      loginUrl: tenantPortalLoginUrl(workspaceSlug),
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    await respondWithError(req, res, error, { statusCode: 500 });
  }
});

router.post("/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email } });

    if (!user?.password || !(await verifyPassword(data.password, user.password))) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const membership = await prisma.workspaceMember.findFirst({
      where: { userId: user.id, status: "active" },
      include: { workspace: { select: { id: true, name: true, slug: true, status: true } } },
      orderBy: { createdAt: "asc" },
    });

    if (!membership?.workspace || membership.workspace.status !== "active") {
      res.status(403).json({ error: "No active company workspace for this account" });
      return;
    }

    const workspaceSlug = await ensureWorkspaceSlug(membership.workspace.id, membership.workspace.name);
    let sessionSlug = workspaceSlug;

    if (data.workspaceSlug) {
      const portal = await prisma.workspace.findFirst({
        where: { slug: data.workspaceSlug, status: "active" },
        select: { id: true, slug: true },
      });
      if (!portal) {
        res.status(404).json({ error: "Company portal not found" });
        return;
      }
      const portalMember = await prisma.workspaceMember.findFirst({
        where: { workspaceId: portal.id, userId: user.id, status: "active" },
      });
      if (!portalMember) {
        res.status(403).json({ error: "This account does not belong to this company portal" });
        return;
      }
      sessionSlug = portal.slug!;
    }

    const token = await createSession({
      userId: user.id,
      email: user.email,
      name: user.name,
      workspaceSlug: sessionSlug,
    });
    setSessionCookie(res, token, sessionSlug);
    res.json({
      user: { id: user.id, name: user.name, email: user.email },
      workspaceSlug: sessionSlug,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    await respondWithError(req, res, error, { statusCode: 500, userMessage: "Sign in failed. Please try again." });
  }
});

router.post("/register", (_req, res) => {
  res.status(403).json({
    error: "Self-registration is disabled. Your company workspace is provisioned by Synentrix. Contact us to get access.",
  });
});

router.post("/logout", (_req, res) => {
  clearSessionCookie(res);
  res.json({ success: true });
});

router.get("/me", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    const workspaceSlug = await ensureWorkspaceSlug(ctx.workspace.id, ctx.workspace.name);
    const subscription = await prisma.subscription.findUnique({
      where: { workspaceId: ctx.workspace.id },
    });
    const memberCount = await prisma.workspaceMember.count({
      where: { workspaceId: ctx.workspace.id, status: "active" },
    });
    const wsProfile = await prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: { logoPath: true },
    });

    res.json({
      user: {
        id: ctx.session.userId,
        email: ctx.session.email,
        name: ctx.session.name,
      },
      workspace: {
        id: ctx.workspace.id,
        name: ctx.workspace.name,
        slug: workspaceSlug,
        status: ctx.workspace.status,
        logoUrl: wsProfile?.logoPath ? `/api/workspace/branding/logo` : null,
      },
      membership: {
        role: ctx.membership.role,
        roleLabel: ROLE_LABELS[ctx.membership.role] || ctx.membership.role,
        managerUserId: ctx.membership.managerUserId,
      },
      permissions: ctx.permissions,
      subscription: subscription
        ? {
            package: subscription.package,
            packageLabel: packageCustomerLabel(subscription.package),
            packageAdminLabel: PACKAGE_LABELS[subscription.package as SubscriptionPackage] || subscription.package,
            status: subscription.status,
            expiresAt: subscription.expiresAt,
            maxUsers: packageMaxUsers(subscription.package),
            memberCount,
          }
        : null,
    });
  } catch (error) {
    const session = await getSessionFromRequest(req);
    if (!session) {
      res.json({ user: null });
      return;
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    if (msg.includes("expired") || msg.includes("suspended")) {
      res.status(403).json({ error: msg, user: { id: session.userId, email: session.email, name: session.name } });
      return;
    }
    res.json({ user: null });
  }
});

export default router;
