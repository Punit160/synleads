import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import multer from "multer";
import { prisma } from "../lib/prisma";
import {
  createPlatformSession,
  hashPassword,
  setPlatformSessionCookie,
  clearPlatformSessionCookie,
  verifyPassword,
} from "../lib/auth";
import {
  getPlatformContext,
  requirePlatformPermission,
} from "../lib/platform-auth";
import { provisionCompany, getPlatformOverviewStats } from "../lib/platform-provision";
import { getPlatformAnalytics } from "../lib/platform-analytics";
import { recordPlatformSale, getUpgradeStats } from "../lib/platform-sales";
import { applySubscriptionChange, getSubscriptionChangeQuote } from "../lib/subscription";
import { quoteSubscriptionChange } from "../lib/subscription-billing";
import { maybeClearPackageInterest, clearPackageInterest } from "../lib/workspace-interest";
import { ensureWorkspaceSlug } from "../lib/workspace-slug";
import { tenantPortalLoginUrl } from "../lib/tenant-url";
import { getPlatformUsageReport } from "../lib/platform-usage";
import {
  PACKAGE_LABELS,
  PACKAGE_PRICE_INR,
  SUBSCRIPTION_PACKAGES,
  packageMaxUsers,
  type SubscriptionPackage,
} from "../lib/roles";
import {
  PLATFORM_ROLES,
  PLATFORM_ROLE_LABELS,
  PLATFORM_ROLE_PERMISSIONS,
  normalizePlatformRole,
  canProvisionCompanies,
  canManageCompanySettings,
} from "../lib/platform-roles";
import { brandingDir, saveWorkspaceBrandFile, removeBrandFile } from "../lib/workspace-branding";
import { respondWithError, handleAuthError } from "../lib/route-error";

const router = Router();

const upload = multer({
  dest: brandingDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files (PNG, JPG, WEBP) are allowed"));
  },
});

function trimOptional(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

const provisionBodySchema = z.object({
  companyName: z.string().min(2),
  companyLegalName: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  pincode: z.string().optional(),
  country: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().optional(),
  website: z.string().optional(),
  gstin: z.string().optional(),
  pan: z.string().optional(),
  ownerName: z.string().min(2),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(6),
  package: z.enum(SUBSCRIPTION_PACKAGES as unknown as [string, ...string[]]).default("trial_7d"),
  interestedPackage: z.string().optional(),
});

const companyProfileUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  companyLegalName: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  pincode: z.string().nullable().optional(),
  country: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email().nullable().optional().or(z.literal("")),
  website: z.string().nullable().optional(),
  gstin: z.string().nullable().optional(),
  pan: z.string().nullable().optional(),
});

function companyProfileResponse(id: string, ws: {
  name: string;
  companyLegalName: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  gstin: string | null;
  pan: string | null;
  logoPath: string | null;
}) {
  return {
    name: ws.name,
    companyLegalName: ws.companyLegalName,
    address: ws.address,
    city: ws.city,
    state: ws.state,
    pincode: ws.pincode,
    country: ws.country,
    phone: ws.phone,
    email: ws.email,
    website: ws.website,
    gstin: ws.gstin,
    pan: ws.pan,
    hasLogo: !!ws.logoPath,
    logoUrl: ws.logoPath ? `/api/platform/companies/${id}/logo` : null,
  };
}

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function handlePlatformError(res: import("express").Response, req: import("express").Request, error: unknown) {
  if (handleAuthError(res, error)) return;
  respondWithError(req, res, error, { statusCode: 400 }).catch(() => {
    if (!res.headersSent) res.status(400).json({ error: "Request failed" });
  });
}

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Auth ──

router.post("/auth/login", async (req, res) => {
  try {
    const data = loginSchema.parse(req.body);
    const admin = await prisma.platformAdmin.findUnique({ where: { email: data.email } });
    if (!admin || admin.status !== "active" || !(await verifyPassword(data.password, admin.password))) {
      res.status(401).json({ error: "Invalid credentials" });
      return;
    }
    const token = await createPlatformSession({
      adminId: admin.id,
      email: admin.email,
      name: admin.name,
    });
    setPlatformSessionCookie(res, token);
    const role = normalizePlatformRole(admin.role);
    res.json({
      admin: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role,
        roleLabel: PLATFORM_ROLE_LABELS[role],
        permissions: PLATFORM_ROLE_PERMISSIONS[role],
      },
    });
  } catch {
    res.status(400).json({ error: "Login failed" });
  }
});

router.post("/auth/logout", (_req, res) => {
  clearPlatformSessionCookie(res);
  res.json({ success: true });
});

router.get("/auth/me", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    res.json({
      admin: {
        id: ctx.adminId,
        name: ctx.name,
        email: ctx.email,
        role: ctx.role,
        roleLabel: PLATFORM_ROLE_LABELS[ctx.role],
        permissions: ctx.permissions,
      },
    });
  } catch {
    res.json({ admin: null });
  }
});

// ── Overview ──

router.get("/overview", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "view_overview");
    const [stats, analytics] = await Promise.all([
      getPlatformOverviewStats(),
      getPlatformAnalytics(),
    ]);

    const recentCompanies = await prisma.workspace.findMany({
      take: 5,
      orderBy: { createdAt: "desc" },
      include: {
        owner: { select: { name: true, email: true } },
        subscription: true,
        provisionedBy: { select: { name: true } },
        _count: { select: { members: true } },
      },
    });

    res.json({
      stats: { ...stats, ...analytics.stats },
      analytics,
      recentCompanies: recentCompanies.map((c) => ({
        id: c.id,
        name: c.name,
        status: c.status,
        owner: c.owner,
        memberCount: c._count.members,
        createdAt: c.createdAt,
        subscription: c.subscription,
        provisionedBy: c.provisionedBy,
      })),
    });
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

// ── Tenant usage (counts only — no CRM content) ──

router.get("/usage", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "view_overview");
    const report = await getPlatformUsageReport();
    res.json(report);
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

// ── Platform team ──

router.get("/team", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_team");
    const team = await prisma.platformAdmin.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        status: true,
        createdAt: true,
      },
    });
    res.json(
      team.map((m) => ({
        ...m,
        role: normalizePlatformRole(m.role),
        roleLabel: PLATFORM_ROLE_LABELS[normalizePlatformRole(m.role)],
        canEdit: m.id !== ctx.adminId,
      }))
    );
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.get("/team/roles", async (req, res) => {
  try {
    await getPlatformContext(req);
    res.json({
      roles: PLATFORM_ROLES.map((r) => ({
        id: r,
        label: PLATFORM_ROLE_LABELS[r],
        permissions: PLATFORM_ROLE_PERMISSIONS[r],
      })),
    });
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.post("/team", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_team");
    const data = z
      .object({
        name: z.string().min(2),
        email: z.string().email(),
        password: z.string().min(6),
        role: z.enum(PLATFORM_ROLES as unknown as [string, ...string[]]),
      })
      .parse(req.body);

    if (await prisma.platformAdmin.findUnique({ where: { email: data.email } })) {
      res.status(400).json({ error: "Email already in use" });
      return;
    }

    const member = await prisma.platformAdmin.create({
      data: {
        name: data.name,
        email: data.email,
        password: await hashPassword(data.password),
        role: data.role,
        status: "active",
        createdById: ctx.adminId,
      },
      select: { id: true, name: true, email: true, role: true, status: true, createdAt: true },
    });
    res.status(201).json(member);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handlePlatformError(res, req, error);
  }
});

router.patch("/team/:id", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_team");
    const data = z
      .object({
        role: z.enum(PLATFORM_ROLES as unknown as [string, ...string[]]).optional(),
        status: z.enum(["active", "inactive"]).optional(),
        password: z.string().min(6).optional(),
      })
      .parse(req.body);

    if (param(req, "id") === ctx.adminId && data.status === "inactive") {
      res.status(400).json({ error: "Cannot deactivate your own account" });
      return;
    }

    const updated = await prisma.platformAdmin.update({
      where: { id: param(req, "id") },
      data: {
        ...(data.role ? { role: data.role } : {}),
        ...(data.status ? { status: data.status } : {}),
        ...(data.password ? { password: await hashPassword(data.password) } : {}),
      },
      select: { id: true, name: true, email: true, role: true, status: true },
    });
    res.json(updated);
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

// ── Companies ──

router.get("/companies", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    if (!canProvisionCompanies(ctx.role) && !canManageCompanySettings(ctx.role)) {
      requirePlatformPermission(ctx, "provision_companies");
    }
    const companies = await prisma.workspace.findMany({
      include: {
        owner: { select: { id: true, name: true, email: true } },
        subscription: true,
        provisionedBy: { select: { id: true, name: true, email: true } },
        members: { where: { status: "active" }, select: { id: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    const salesAgg = await prisma.platformSale.groupBy({
      by: ["workspaceId"],
      _sum: { amountInr: true },
      _count: true,
    });
    const salesByWorkspace = new Map(
      salesAgg.map((s) => [s.workspaceId, { revenue: s._sum.amountInr ?? 0, count: s._count }])
    );

    const rows = await Promise.all(
      companies.map(async (c) => {
        const platformSales = salesByWorkspace.get(c.id);
        const slug = c.slug || (await ensureWorkspaceSlug(c.id, c.name));
        return {
          id: c.id,
          name: c.name,
          slug,
          portalLoginPath: tenantPortalLoginUrl(slug),
        status: c.status,
        createdAt: c.createdAt,
        hasLogo: !!c.logoPath,
        logoUrl: c.logoPath ? `/api/platform/companies/${c.id}/logo` : null,
        owner: c.owner,
        interestedPackage: c.interestedPackage,
        provisionedBy: c.provisionedBy,
        memberCount: c.members.length,
        platformRevenue: platformSales?.revenue ?? 0,
        platformSalesCount: platformSales?.count ?? 0,
        subscription: c.subscription
          ? {
              package: c.subscription.package,
              packageLabel: PACKAGE_LABELS[c.subscription.package as SubscriptionPackage] || c.subscription.package,
              status: c.subscription.status,
              startsAt: c.subscription.startsAt,
              expiresAt: c.subscription.expiresAt,
            }
          : null,
        };
      })
    );

    res.json(rows);
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.post("/companies", upload.single("logo"), async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    if (!canProvisionCompanies(ctx.role)) {
      requirePlatformPermission(ctx, "manage_companies");
    }
    const parsed = provisionBodySchema.parse(req.body);
    const interestedRaw = trimOptional(parsed.interestedPackage);
    const interestedPackage =
      interestedRaw && SUBSCRIPTION_PACKAGES.includes(interestedRaw as SubscriptionPackage)
        ? (interestedRaw as SubscriptionPackage)
        : undefined;

    const companyEmail = trimOptional(parsed.email);
    if (companyEmail && !z.string().email().safeParse(companyEmail).success) {
      res.status(400).json({ error: "Invalid company email" });
      return;
    }

    const profile = {
      companyLegalName: trimOptional(parsed.companyLegalName),
      address: trimOptional(parsed.address),
      city: trimOptional(parsed.city),
      state: trimOptional(parsed.state),
      pincode: trimOptional(parsed.pincode),
      country: trimOptional(parsed.country) || "India",
      phone: trimOptional(parsed.phone),
      email: companyEmail,
      website: trimOptional(parsed.website),
      gstin: trimOptional(parsed.gstin),
      pan: trimOptional(parsed.pan),
    };

    const result = await provisionCompany({
      companyName: parsed.companyName.trim(),
      ownerName: parsed.ownerName.trim(),
      ownerEmail: parsed.ownerEmail.trim(),
      ownerPassword: parsed.ownerPassword,
      package: parsed.package as SubscriptionPackage,
      provisionedByPlatformAdminId: ctx.adminId,
      interestedPackage,
      profile,
    });

    if (req.file) {
      const logoPath = saveWorkspaceBrandFile(result.workspace.id, "logo", req.file);
      await prisma.workspace.update({
        where: { id: result.workspace.id },
        data: { logoPath },
      });
    }

    if (parsed.package !== "trial_7d") {
      await recordPlatformSale({
        workspaceId: result.workspace.id,
        package: parsed.package as SubscriptionPackage,
        changeType: "initial",
        amountInr: PACKAGE_PRICE_INR[parsed.package as SubscriptionPackage],
        listPriceInr: PACKAGE_PRICE_INR[parsed.package as SubscriptionPackage],
        soldByPlatformAdminId: ctx.adminId,
        notes: "Initial provision",
      });
    }

    const interestResult = await maybeClearPackageInterest(
      result.workspace.id,
      parsed.package as SubscriptionPackage
    );

    res.status(201).json({
      id: result.workspace.id,
      name: result.workspace.name,
      slug: result.workspace.slug,
      portalLoginPath: result.workspace.slug ? tenantPortalLoginUrl(result.workspace.slug) : null,
      owner: { id: result.owner.id, name: result.owner.name, email: result.owner.email },
      hasLogo: !!req.file,
      logoUrl: req.file ? `/api/platform/companies/${result.workspace.id}/logo` : null,
      interestCleared: interestResult.cleared,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Request failed";
    if (msg.includes("image files")) {
      res.status(400).json({ error: msg });
      return;
    }
    handlePlatformError(res, req, error);
  }
});

router.get("/companies/:id/logo", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    if (!canProvisionCompanies(ctx.role) && !canManageCompanySettings(ctx.role)) {
      requirePlatformPermission(ctx, "provision_companies");
    }
    const company = await prisma.workspace.findUnique({
      where: { id: param(req, "id") },
      select: { logoPath: true },
    });
    if (!company?.logoPath || !fs.existsSync(company.logoPath)) {
      res.status(404).json({ error: "Logo not found" });
      return;
    }
    res.sendFile(path.resolve(company.logoPath));
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.post("/companies/:id/logo", upload.single("logo"), async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_companies");
    const workspaceId = param(req, "id");
    if (!req.file) {
      res.status(400).json({ error: "No logo file uploaded" });
      return;
    }

    const existing = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { logoPath: true },
    });
    if (!existing) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    const logoPath = saveWorkspaceBrandFile(workspaceId, "logo", req.file);
    if (existing.logoPath && existing.logoPath !== logoPath) {
      removeBrandFile(existing.logoPath);
    }

    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { logoPath },
    });

    res.json({
      success: true,
      hasLogo: true,
      logoUrl: `/api/platform/companies/${workspaceId}/logo`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    if (msg.includes("image files")) {
      res.status(400).json({ error: msg });
      return;
    }
    handlePlatformError(res, req, error);
  }
});

router.delete("/companies/:id/logo", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_companies");
    const workspaceId = param(req, "id");
    const ws = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { logoPath: true },
    });
    if (!ws) {
      res.status(404).json({ error: "Company not found" });
      return;
    }
    removeBrandFile(ws.logoPath);
    await prisma.workspace.update({
      where: { id: workspaceId },
      data: { logoPath: null },
    });
    res.json({ success: true, hasLogo: false, logoUrl: null });
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.get("/companies/:id", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    if (!canProvisionCompanies(ctx.role) && !canManageCompanySettings(ctx.role)) {
      requirePlatformPermission(ctx, "provision_companies");
    }
    const company = await prisma.workspace.findUnique({
      where: { id: param(req, "id") },
      include: {
        owner: { select: { id: true, name: true, email: true, createdAt: true } },
        subscription: true,
        provisionedBy: { select: { id: true, name: true, email: true } },
        members: { where: { status: "active" }, select: { id: true } },
      },
    });
    if (!company) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    const platformSales = await prisma.platformSale.findMany({
      where: { workspaceId: company.id },
      orderBy: { createdAt: "desc" },
      include: { soldBy: { select: { name: true } } },
    });
    const platformRevenue = platformSales.reduce((s, sale) => s + sale.amountInr, 0);

    const slug = company.slug || (await ensureWorkspaceSlug(company.id, company.name));

    res.json({
      id: company.id,
      name: company.name,
      slug,
      portalLoginPath: tenantPortalLoginUrl(slug),
      status: company.status,
      createdAt: company.createdAt,
      interestedPackage: company.interestedPackage,
      salesNotes: company.salesNotes,
      hasLogo: !!company.logoPath,
      logoUrl: company.logoPath ? `/api/platform/companies/${company.id}/logo` : null,
      companyLegalName: company.companyLegalName,
      address: company.address,
      city: company.city,
      state: company.state,
      pincode: company.pincode,
      country: company.country,
      phone: company.phone,
      email: company.email,
      website: company.website,
      gstin: company.gstin,
      pan: company.pan,
      owner: company.owner,
      provisionedBy: company.provisionedBy,
      subscription: company.subscription,
      memberCount: company.members.length,
      platformRevenue,
      platformSalesCount: platformSales.length,
      platformSales: platformSales.map((s) => ({
        id: s.id,
        package: s.package,
        packageLabel: PACKAGE_LABELS[s.package as SubscriptionPackage] || s.package,
        changeType: s.changeType,
        amountInr: s.amountInr,
        creditInr: s.creditInr,
        soldBy: s.soldBy?.name ?? null,
        createdAt: s.createdAt,
      })),
    });
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.patch("/companies/:id", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_companies");
    const workspaceId = param(req, "id");
    const data = companyProfileUpdateSchema.parse(req.body);

    const updated = await prisma.workspace.update({
      where: { id: workspaceId },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.companyLegalName !== undefined ? { companyLegalName: data.companyLegalName || null } : {}),
        ...(data.address !== undefined ? { address: data.address || null } : {}),
        ...(data.city !== undefined ? { city: data.city || null } : {}),
        ...(data.state !== undefined ? { state: data.state || null } : {}),
        ...(data.pincode !== undefined ? { pincode: data.pincode || null } : {}),
        ...(data.country !== undefined ? { country: data.country || null } : {}),
        ...(data.phone !== undefined ? { phone: data.phone || null } : {}),
        ...(data.email !== undefined ? { email: data.email === "" ? null : data.email } : {}),
        ...(data.website !== undefined ? { website: data.website || null } : {}),
        ...(data.gstin !== undefined ? { gstin: data.gstin || null } : {}),
        ...(data.pan !== undefined ? { pan: data.pan || null } : {}),
      },
      select: {
        id: true,
        name: true,
        companyLegalName: true,
        address: true,
        city: true,
        state: true,
        pincode: true,
        country: true,
        phone: true,
        email: true,
        website: true,
        gstin: true,
        pan: true,
        logoPath: true,
      },
    });
    res.json(companyProfileResponse(updated.id, updated));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handlePlatformError(res, req, error);
  }
});

router.patch("/companies/:id/owner", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_companies");
    const data = z
      .object({
        ownerName: z.string().min(2).optional(),
        ownerPassword: z.string().min(6).optional(),
      })
      .parse(req.body);

    const workspace = await prisma.workspace.findUnique({
      where: { id: param(req, "id") },
      select: { userId: true },
    });
    if (!workspace) {
      res.status(404).json({ error: "Company not found" });
      return;
    }

    await prisma.user.update({
      where: { id: workspace.userId },
      data: {
        ...(data.ownerName ? { name: data.ownerName } : {}),
        ...(data.ownerPassword ? { password: await hashPassword(data.ownerPassword) } : {}),
      },
    });
    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handlePlatformError(res, req, error);
  }
});

router.patch("/companies/:id/status", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_companies");
    const { status } = z.object({ status: z.enum(["active", "suspended"]) }).parse(req.body);
    const updated = await prisma.workspace.update({
      where: { id: param(req, "id") },
      data: { status },
    });
    res.json(updated);
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.patch("/companies/:id/interest", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    if (!canProvisionCompanies(ctx.role)) {
      requirePlatformPermission(ctx, "provision_companies");
    }
    const data = z
      .object({
        interestedPackage: z.enum(SUBSCRIPTION_PACKAGES as unknown as [string, ...string[]]).nullable().optional(),
        salesNotes: z.string().max(2000).nullable().optional(),
        clearInterest: z.boolean().optional(),
      })
      .parse(req.body);

    if (data.clearInterest) {
      const result = await clearPackageInterest(param(req, "id"));
      const workspace = await prisma.workspace.findUnique({
        where: { id: param(req, "id") },
        select: { id: true, interestedPackage: true, salesNotes: true },
      });
      res.json({ ...workspace, interestCleared: result.cleared, previousInterest: result.previousInterest });
      return;
    }

    const updated = await prisma.workspace.update({
      where: { id: param(req, "id") },
      data: {
        ...(data.interestedPackage !== undefined ? { interestedPackage: data.interestedPackage } : {}),
        ...(data.salesNotes !== undefined ? { salesNotes: data.salesNotes } : {}),
      },
      select: {
        id: true,
        interestedPackage: true,
        salesNotes: true,
      },
    });
    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handlePlatformError(res, req, error);
  }
});

router.get("/companies/:id/subscription/quote", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_subscriptions");
    const target = z
      .object({
        package: z.enum(SUBSCRIPTION_PACKAGES as unknown as [string, ...string[]]),
      })
      .parse({ package: req.query.package });

    const quote = await getSubscriptionChangeQuote(param(req, "id"), target.package as SubscriptionPackage);
    res.json(quote);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handlePlatformError(res, req, error);
  }
});

router.get("/companies/:id/subscription/options", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_subscriptions");
    const current = await prisma.subscription.findUnique({ where: { workspaceId: param(req, "id") } });
    const snapshot = current
      ? {
          package: current.package,
          startsAt: current.startsAt,
          expiresAt: current.expiresAt,
          status: current.status,
        }
      : null;
    const options = SUBSCRIPTION_PACKAGES.map((pkg) => {
      const quote = quoteSubscriptionChange(snapshot, pkg);
      return {
        package: pkg,
        label: PACKAGE_LABELS[pkg],
        allowed: quote.allowed,
        changeType: quote.changeType,
        chargeInr: quote.chargeInr,
        creditInr: quote.creditInr,
        remainingDays: quote.remainingDays,
        reason: quote.reason,
        breakdown: quote.breakdown,
      };
    });
    res.json({
      current: current
        ? {
            package: current.package,
            label: PACKAGE_LABELS[current.package as SubscriptionPackage] || current.package,
            startsAt: current.startsAt,
            expiresAt: current.expiresAt,
            expired: current.expiresAt < new Date(),
          }
        : null,
      options,
    });
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.put("/companies/:id/subscription", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_subscriptions");
    const { package: pkg } = z
      .object({ package: z.enum(SUBSCRIPTION_PACKAGES as unknown as [string, ...string[]]) })
      .parse(req.body);
    const workspaceId = param(req, "id");
    const existing = await prisma.subscription.findUnique({ where: { workspaceId } });

    const { subscription, quote } = await applySubscriptionChange(workspaceId, pkg as SubscriptionPackage);

    if (
      quote.chargeInr > 0 ||
      quote.changeType === "upgrade" ||
      quote.changeType === "trial_conversion" ||
      quote.changeType === "renewal"
    ) {
      await recordPlatformSale({
        workspaceId,
        package: pkg as SubscriptionPackage,
        previousPackage: existing?.package ?? null,
        changeType: quote.changeType === "no_change" ? "renewal" : quote.changeType,
        amountInr: quote.chargeInr,
        listPriceInr: quote.listPriceInr,
        creditInr: quote.creditInr,
        remainingDays: quote.remainingDays,
        soldByPlatformAdminId: ctx.adminId,
        notes: quote.breakdown,
      });
    }

    const interestResult = await maybeClearPackageInterest(workspaceId, pkg as SubscriptionPackage);

    res.json({
      subscription,
      quote,
      interestCleared: interestResult.cleared,
      previousInterest: interestResult.previousInterest,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    if (error instanceof Error && error.message.includes("not allowed")) {
      res.status(400).json({ error: error.message });
      return;
    }
    handlePlatformError(res, req, error);
  }
});

router.get("/subscriptions/upgrades", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_subscriptions");
    const stats = await getUpgradeStats();
    res.json(stats);
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.get("/subscriptions/expiring", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_subscriptions");
    const days = Number(req.query.days) || 30;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() + days);

    const subs = await prisma.subscription.findMany({
      where: {
        status: "active",
        expiresAt: { lte: cutoff },
      },
      include: {
        workspace: {
          select: {
            id: true,
            name: true,
            status: true,
            owner: { select: { name: true, email: true } },
            members: { where: { status: "active" }, select: { id: true } },
          },
        },
      },
      orderBy: { expiresAt: "asc" },
    });

    res.json(
      subs.map((s) => ({
        workspaceId: s.workspaceId,
        companyName: s.workspace.name,
        companyStatus: s.workspace.status,
        owner: s.workspace.owner,
        memberCount: s.workspace.members.length,
        package: s.package,
        packageLabel: PACKAGE_LABELS[s.package as SubscriptionPackage] || s.package,
        maxUsers: packageMaxUsers(s.package),
        status: s.status,
        expiresAt: s.expiresAt,
        expired: s.expiresAt < new Date(),
      }))
    );
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

router.get("/packages", async (req, res) => {
  try {
    await getPlatformContext(req);
    res.json(
      SUBSCRIPTION_PACKAGES.map((p) => ({
        id: p,
        label: PACKAGE_LABELS[p],
        maxUsers: packageMaxUsers(p),
        priceInr: PACKAGE_PRICE_INR[p] ?? null,
      }))
    );
  } catch (error) {
    handlePlatformError(res, req, error);
  }
});

// ── Cross-tenant sales ──

router.get("/sales", async (_req, res) => {
  res.status(403).json({
    error: "Tenant CRM data is not available on the platform portal for security reasons.",
  });
});

export default router;
