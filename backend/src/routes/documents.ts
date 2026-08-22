import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import multer from "multer";
import { prisma } from "../lib/prisma";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";

const router = Router();
const uploadsDir = path.join(process.cwd(), "uploads", "documents");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({ dest: uploadsDir, limits: { fileSize: 15 * 1024 * 1024 } });

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

const DOC_CATEGORIES = ["general", "agreement", "quotation", "image", "pdf", "contract"] as const;

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const category = req.query.category as string | undefined;
    const docs = await prisma.document.findMany({
      where: { workspaceId: ctx.workspace.id, ...(category ? { category } : {}) },
      include: { uploadedBy: { select: { name: true } } },
      orderBy: { uploadedAt: "desc" },
    });
    res.json(docs);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const file = req.file;
    if (!file) {
      res.status(400).json({ error: "No file uploaded" });
      return;
    }
    const category = (req.body.category as string) || "general";
    const doc = await prisma.document.create({
      data: {
        workspaceId: ctx.workspace.id,
        fileName: file.originalname,
        fileSize: file.size,
        mimeType: file.mimetype,
        filePath: file.path,
        category: DOC_CATEGORIES.includes(category as typeof DOC_CATEGORIES[number]) ? category : "general",
        leadId: req.body.leadId || null,
        dealId: req.body.dealId || null,
        accountId: req.body.accountId || null,
        contactId: req.body.contactId || null,
        customerId: req.body.customerId || null,
        uploadedById: ctx.session.userId,
      },
    });
    res.status(201).json(doc);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/:id/download", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const doc = await prisma.document.findFirst({ where: { id: param(req, "id"), workspaceId: ctx.workspace.id } });
    if (!doc || !fs.existsSync(doc.filePath)) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.download(doc.filePath, doc.fileName);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "delete");
    const doc = await prisma.document.findFirst({ where: { id: param(req, "id"), workspaceId: ctx.workspace.id } });
    if (!doc) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    if (fs.existsSync(doc.filePath)) fs.unlinkSync(doc.filePath);
    await prisma.document.delete({ where: { id: doc.id } });
    res.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
