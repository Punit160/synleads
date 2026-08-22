import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";
import { getCustomFieldsForEntity, saveCustomFieldsForEntity } from "../lib/custom-fields";
import { recordAuditLog } from "../lib/audit-log";

const router = Router();

const defSchema = z.object({
  entityType: z.enum(["lead", "deal", "contact"]).optional(),
  key: z.string().min(1).max(64).regex(/^[a-z0-9_]+$/),
  label: z.string().min(1),
  fieldType: z.enum(["text", "number", "date", "select", "boolean"]),
  options: z.array(z.string()).optional(),
  required: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

function handleError(res: import("express").Response, error: unknown) {
  const msg = error instanceof Error ? error.message : "Unauthorized";
  if (msg === "Forbidden") return res.status(403).json({ error: msg });
  return res.status(401).json({ error: msg });
}

router.get("/definitions", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const entityType = (req.query.entityType as string) || "lead";
    const defs = await prisma.customFieldDefinition.findMany({
      where: { workspaceId: ctx.workspace.id, entityType },
      orderBy: { sortOrder: "asc" },
    });
    res.json(
      defs.map((d) => ({
        ...d,
        options: d.options ? JSON.parse(d.options) : [],
      }))
    );
  } catch (error) {
    handleError(res, error);
  }
});

router.post("/definitions", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const data = defSchema.parse(req.body);
    const def = await prisma.customFieldDefinition.create({
      data: {
        workspaceId: ctx.workspace.id,
        entityType: data.entityType || "lead",
        key: data.key,
        label: data.label,
        fieldType: data.fieldType,
        options: data.options?.length ? JSON.stringify(data.options) : null,
        required: data.required ?? false,
        sortOrder: data.sortOrder ?? 0,
      },
    });
    await recordAuditLog({
      workspaceId: ctx.workspace.id,
      userId: ctx.session.userId,
      action: "custom_field_create",
      entityType: "custom_field",
      entityId: def.id,
      details: def.label,
    });
    res.status(201).json({ ...def, options: data.options ?? [] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

router.put("/definitions/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const data = defSchema.partial().parse(req.body);
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    const def = await prisma.customFieldDefinition.update({
      where: { id: existing.id },
      data: {
        ...(data.label != null ? { label: data.label } : {}),
        ...(data.fieldType != null ? { fieldType: data.fieldType } : {}),
        ...(data.options != null ? { options: JSON.stringify(data.options) } : {}),
        ...(data.required != null ? { required: data.required } : {}),
        ...(data.sortOrder != null ? { sortOrder: data.sortOrder } : {}),
      },
    });
    res.json({ ...def, options: def.options ? JSON.parse(def.options) : [] });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

router.delete("/definitions/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "manage_team");
    const existing = await prisma.customFieldDefinition.findFirst({
      where: { id: req.params.id, workspaceId: ctx.workspace.id },
    });
    if (!existing) {
      res.status(404).json({ error: "Not found" });
      return;
    }
    await prisma.customFieldDefinition.delete({ where: { id: existing.id } });
    res.json({ ok: true });
  } catch (error) {
    handleError(res, error);
  }
});

router.get("/values/:entityType/:entityId", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const fields = await getCustomFieldsForEntity(
      ctx.workspace.id,
      req.params.entityType,
      req.params.entityId
    );
    res.json(fields);
  } catch (error) {
    handleError(res, error);
  }
});

router.put("/values/:entityType/:entityId", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const body = z.record(z.string()).parse(req.body);
    await saveCustomFieldsForEntity(
      ctx.workspace.id,
      req.params.entityType,
      req.params.entityId,
      body
    );
    const fields = await getCustomFieldsForEntity(
      ctx.workspace.id,
      req.params.entityType,
      req.params.entityId
    );
    res.json(fields);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, error);
  }
});

export default router;
