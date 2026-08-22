import { Router } from "express";
import fs from "fs";
import path from "path";
import { prisma } from "../lib/prisma";
import { ensureWorkspaceSlug } from "../lib/workspace-slug";
import { tenantPortalLoginUrl } from "../lib/tenant-url";

const router = Router();

/** Public company portal info for branded login pages — no auth required */
router.get("/tenants/:slug", async (req, res) => {
  try {
    const slug = req.params.slug;
    const workspace = await prisma.workspace.findFirst({
      where: { slug, status: "active" },
      select: {
        id: true,
        name: true,
        slug: true,
        companyLegalName: true,
        logoPath: true,
      },
    });
    if (!workspace) {
      res.status(404).json({ error: "Company portal not found" });
      return;
    }
    const resolvedSlug = workspace.slug || (await ensureWorkspaceSlug(workspace.id, workspace.name));
    res.json({
      slug: resolvedSlug,
      name: workspace.name,
      companyLegalName: workspace.companyLegalName,
      logoUrl: workspace.logoPath ? `/api/public/tenants/${resolvedSlug}/logo` : null,
      loginPath: tenantPortalLoginUrl(resolvedSlug),
      portalPath: tenantPortalLoginUrl(resolvedSlug).replace(/\/login$/, "/dashboard"),
    });
  } catch {
    res.status(500).json({ error: "Failed to load company portal" });
  }
});

router.get("/tenants/:slug/logo", async (req, res) => {
  try {
    const workspace = await prisma.workspace.findFirst({
      where: { slug: req.params.slug, status: "active" },
      select: { logoPath: true },
    });
    if (!workspace?.logoPath || !fs.existsSync(workspace.logoPath)) {
      res.status(404).end();
      return;
    }
    res.sendFile(path.resolve(workspace.logoPath));
  } catch {
    res.status(404).end();
  }
});

export default router;
