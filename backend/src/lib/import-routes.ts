import fs from "fs";
import path from "path";
import type { Router, Response } from "express";
import multer from "multer";
import { z } from "zod";
import { getAuthenticatedContext, requirePermission } from "./rbac";
import type { WorkspaceContext } from "./rbac";
import { parseCsv, parseExcelBuffer } from "./spreadsheet";
import { getImportTemplateBuffer, getImportTemplateFilename, type ImportEntity } from "./import-templates";

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});

type ImportResult = { imported: number; duplicates: number; errors: string[] };

function handleImportError(res: Response, error: unknown, fallback = "Import failed") {
  if (error instanceof z.ZodError) {
    res.status(400).json({ error: error.errors[0].message });
    return true;
  }
  const msg = error instanceof Error ? error.message : fallback;
  if (msg === "Forbidden") {
    res.status(403).json({ error: msg });
    return true;
  }
  if (msg === "Unauthorized" || msg === "No workspace") {
    res.status(401).json({ error: msg });
    return true;
  }
  return false;
}

export function registerImportRoutes(
  router: Router,
  entity: ImportEntity,
  importRows: (
    workspaceId: string,
    rows: Record<string, string>[],
    userId: string,
    options?: { ownerId?: string }
  ) => Promise<ImportResult>,
  options?: {
    validateOwnerId?: (ctx: WorkspaceContext, ownerId: string) => Promise<boolean>;
  }
) {
  router.get("/import-template", async (req, res) => {
    try {
      const ctx = await getAuthenticatedContext(req);
      requirePermission(ctx, "import");
      const buffer = getImportTemplateBuffer(entity);
      const filename = getImportTemplateFilename(entity);
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", `attachment; filename=${filename}`);
      res.send(buffer);
    } catch (error) {
      if (!handleImportError(res, error, "Unauthorized")) {
        res.status(400).json({ error: "Could not generate template" });
      }
    }
  });

  router.post("/import", async (req, res) => {
    try {
      const ctx = await getAuthenticatedContext(req);
      requirePermission(ctx, "import");
      const { csv, ownerId } = z
        .object({ csv: z.string().min(1), ownerId: z.string().optional() })
        .parse(req.body);
      if (ownerId && options?.validateOwnerId && !(await options.validateOwnerId(ctx, ownerId))) {
        res.status(403).json({ error: "Cannot assign to this user" });
        return;
      }
      const rows = parseCsv(csv);
      const result = await importRows(ctx.workspace.id, rows, ctx.session.userId, { ownerId });
      res.json(result);
    } catch (error) {
      if (!handleImportError(res, error)) {
        res.status(400).json({ error: "Import failed" });
      }
    }
  });

  router.post("/import-excel", upload.single("file"), async (req, res) => {
    try {
      const ctx = await getAuthenticatedContext(req);
      requirePermission(ctx, "import");
      if (!req.file) {
        res.status(400).json({ error: "File required" });
        return;
      }
      const ownerId = req.body.ownerId as string | undefined;
      if (ownerId && options?.validateOwnerId && !(await options.validateOwnerId(ctx, ownerId))) {
        if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
        res.status(403).json({ error: "Cannot assign to this user" });
        return;
      }
      const buffer = fs.readFileSync(req.file.path);
      fs.unlinkSync(req.file.path);
      const rows = parseExcelBuffer(buffer);
      const result = await importRows(ctx.workspace.id, rows, ctx.session.userId, { ownerId });
      res.json(result);
    } catch (error) {
      if (req.file?.path && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      if (!handleImportError(res, error)) {
        res.status(400).json({ error: "Import failed" });
      }
    }
  });
}
