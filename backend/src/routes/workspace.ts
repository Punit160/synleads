import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { getAuthenticatedWorkspace } from "../lib/workspace";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";
import { ensureWorkspaceLeadApiKey } from "../lib/workspace-lead-key";
import { PRODUCT_NAME, WEBHOOK_API_KEY_HEADER } from "../lib/brand";
import { ensureWorkspaceSlug } from "../lib/workspace-slug";
import { tenantPortalLoginUrl, companyWebhookUrl } from "../lib/tenant-url";

const router = Router();

const brandingDir = path.join(process.cwd(), "uploads", "branding");
if (!fs.existsSync(brandingDir)) fs.mkdirSync(brandingDir, { recursive: true });

const upload = multer({
  dest: brandingDir,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp|gif)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error("Only image files (PNG, JPG, WEBP) are allowed"));
  },
});

const profileSchema = z.object({
  name: z.string().min(2).optional(),
  companyLegalName: z.string().optional().nullable(),
  address: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  state: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  country: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  website: z.string().optional().nullable(),
  gstin: z.string().optional().nullable(),
  pan: z.string().optional().nullable(),
  authorizedSignatoryName: z.string().optional().nullable(),
  authorizedSignatoryTitle: z.string().optional().nullable(),
  quoteTerms: z.string().optional().nullable(),
});

function workspaceProfileSelect() {
  return {
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
    signaturePath: true,
    stampPath: true,
    authorizedSignatoryName: true,
    authorizedSignatoryTitle: true,
    quoteTerms: true,
  };
}

function brandingUrls(workspaceId: string, ws: {
  logoPath?: string | null;
  signaturePath?: string | null;
  stampPath?: string | null;
}) {
  return {
    logoUrl: ws.logoPath ? `/api/workspace/branding/logo` : null,
    signatureUrl: ws.signaturePath ? `/api/workspace/branding/signature` : null,
    stampUrl: ws.stampPath ? `/api/workspace/branding/stamp` : null,
  };
}

router.get("/", async (req, res) => {
  try {
    const { workspace } = await getAuthenticatedWorkspace(req);
    const ws = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      select: workspaceProfileSelect(),
    });
    if (!ws) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    res.json({ ...ws, ...brandingUrls(workspace.id, ws) });
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

router.get("/members", async (req, res) => {
  try {
    const { workspace } = await getAuthenticatedWorkspace(req);
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId: workspace.id },
      include: {
        user: { select: { id: true, name: true, email: true } },
        managerUser: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(
      members.map((m) => ({
        id: m.id,
        role: m.role,
        roleLabel: m.role === "manager" ? "Sales Manager" : m.role === "employee" ? "Sales Executive" : m.role,
        status: m.status,
        managerUserId: m.managerUserId,
        managerName: m.managerUser?.name || null,
        user: m.user,
      }))
    );
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

router.put("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");
    const data = profileSchema.parse(req.body);

    const updated = await prisma.workspace.update({
      where: { id: ctx.workspace.id },
      data: {
        ...(data.name !== undefined ? { name: data.name } : {}),
        companyLegalName: data.companyLegalName ?? undefined,
        address: data.address ?? undefined,
        city: data.city ?? undefined,
        state: data.state ?? undefined,
        pincode: data.pincode ?? undefined,
        country: data.country ?? undefined,
        phone: data.phone ?? undefined,
        email: data.email === "" ? null : data.email ?? undefined,
        website: data.website ?? undefined,
        gstin: data.gstin ?? undefined,
        pan: data.pan ?? undefined,
        authorizedSignatoryName: data.authorizedSignatoryName ?? undefined,
        authorizedSignatoryTitle: data.authorizedSignatoryTitle ?? undefined,
        quoteTerms: data.quoteTerms ?? undefined,
      },
      select: workspaceProfileSelect(),
    });
    res.json({ ...updated, ...brandingUrls(ctx.workspace.id, updated) });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

const BRAND_TYPES = ["logo", "signature", "stamp"] as const;
type BrandType = (typeof BRAND_TYPES)[number];

function brandField(type: BrandType): "logoPath" | "signaturePath" | "stampPath" {
  if (type === "logo") return "logoPath";
  if (type === "signature") return "signaturePath";
  return "stampPath";
}

router.post("/branding/:type", upload.single("file"), async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");

    const type = req.params.type as BrandType;
    if (!BRAND_TYPES.includes(type)) {
      res.status(400).json({ error: "Invalid type. Use logo, signature, or stamp" });
      return;
    }

    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }

    const ext = path.extname(file.originalname) || ".png";
    const destDir = path.join(brandingDir, ctx.workspace.id);
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });

    const destPath = path.join(destDir, `${type}${ext}`);
    fs.renameSync(file.path, destPath);

    const field = brandField(type);
    const existing = await prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: { logoPath: true, signaturePath: true, stampPath: true },
    });
    const oldPath = existing?.[field];
    if (oldPath && oldPath !== destPath && fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }

    await prisma.workspace.update({
      where: { id: ctx.workspace.id },
      data: { [field]: destPath },
    });

    res.json({ success: true, type, url: `/api/workspace/branding/${type}` });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Upload failed";
    res.status(msg === "Forbidden" ? 403 : 400).json({ error: msg });
  }
});

router.get("/branding/:type", async (req, res) => {
  try {
    const { workspace } = await getAuthenticatedWorkspace(req);
    const type = req.params.type as BrandType;
    if (!BRAND_TYPES.includes(type)) {
      res.status(400).json({ error: "Invalid type" });
      return;
    }

    const ws = await prisma.workspace.findUnique({
      where: { id: workspace.id },
      select: { logoPath: true, signaturePath: true, stampPath: true },
    });
    const filePath = ws?.[brandField(type)];
    if (!filePath || !fs.existsSync(filePath)) {
      res.status(404).json({ error: "Not found" });
      return;
    }

    res.sendFile(path.resolve(filePath));
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

router.delete("/branding/:type", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");
    const type = req.params.type as BrandType;
    if (!BRAND_TYPES.includes(type)) {
      res.status(400).json({ error: "Invalid type" });
      return;
    }

    const field = brandField(type);
    const ws = await prisma.workspace.findUnique({ where: { id: ctx.workspace.id } });
    const filePath = ws?.[field];
    if (filePath && fs.existsSync(filePath)) fs.unlinkSync(filePath);

    await prisma.workspace.update({
      where: { id: ctx.workspace.id },
      data: { [field]: null },
    });
    res.json({ success: true });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/stages", async (req, res) => {
  try {
    const { workspace } = await getAuthenticatedWorkspace(req);
    const stages = await prisma.pipelineStage.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { order: "asc" },
    });
    res.json(stages);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

router.get("/automation", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");
    const leadApiKey = await ensureWorkspaceLeadApiKey(ctx.workspace.id);
    const ws = await prisma.workspace.findUnique({
      where: { id: ctx.workspace.id },
      select: {
        autoAssignEnabled: true,
        autoAssignMode: true,
        name: true,
        id: true,
      },
    });
    if (!ws) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const workspaceSlug = await ensureWorkspaceSlug(ws.id, ws.name);
    res.json({
      workspaceId: ws.id,
      workspaceName: ws.name,
      workspaceSlug,
      autoAssignEnabled: ws.autoAssignEnabled,
      autoAssignMode: ws.autoAssignMode,
      leadApiKey,
      webhookUrl: companyWebhookUrl(workspaceSlug, "leads"),
      loginPath: tenantPortalLoginUrl(workspaceSlug),
      portalPath: `/${workspaceSlug}/dashboard`,
      webhookHeader: WEBHOOK_API_KEY_HEADER,
      webhookHint: `POST JSON with header ${WEBHOOK_API_KEY_HEADER} (firstName required). Legacy header X-LeadFlow-Key is also accepted.`,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.patch("/automation", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");
    const data = z
      .object({
        autoAssignEnabled: z.boolean().optional(),
        autoAssignMode: z.enum(["round_robin"]).optional(),
      })
      .parse(req.body);
    const ws = await prisma.workspace.update({
      where: { id: ctx.workspace.id },
      data,
      select: { autoAssignEnabled: true, autoAssignMode: true, leadApiKey: true },
    });
    res.json(ws);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/automation/regenerate-key", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_users");
    const { generateLeadApiKey } = await import("../lib/auto-assign");
    const key = generateLeadApiKey();
    await prisma.workspace.update({
      where: { id: ctx.workspace.id },
      data: { leadApiKey: key },
    });
    res.json({ leadApiKey: key });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Failed";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
