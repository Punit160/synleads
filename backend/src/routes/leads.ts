import { Router } from "express";
import { z } from "zod";
import fs from "fs";
import path from "path";
import multer from "multer";
import { prisma } from "../lib/prisma";
import {
  getAuthenticatedContext,
  requirePermission,
  getLeadOwnerFilter,
  canAccessLead,
  canAssignToUser,
  canFilterByOwnerId,
} from "../lib/rbac";
import { LEAD_SOURCES, LEAD_STATUSES, LEAD_PRIORITIES } from "../lib/lead-constants";
import { generateLeadNumber, findDuplicateLeads, addTimelineEvent } from "../lib/lead-utils";
import { importLeadRows } from "../lib/lead-import";
import { registerImportRoutes } from "../lib/import-routes";
import { pickLeadOwner } from "../lib/auto-assign";
import { recordAuditLog } from "../lib/audit-log";
import { notifyLeadAssigned } from "../lib/reminder-jobs";
import { enrichLeadsForList } from "../lib/lead-list-enrich";
import { seedCustomerConversionRecords } from "../lib/lead-conversion";
import { onLeadCreated, onLeadUpdated } from "../lib/lead-automation";
import { saveCustomFieldsForEntity, attachCustomFieldsToLeads } from "../lib/custom-fields";
import { handleAuthError, respondWithError } from "../lib/route-error";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

function handleError(
  res: import("express").Response,
  req: import("express").Request,
  error: unknown,
  fallback = "Unauthorized"
): boolean {
  if (handleAuthError(res, error, fallback)) return true;
  respondWithError(req, res, error).catch(() => {
    if (!res.headersSent) res.status(500).json({ error: "Something went wrong. Our team has been notified." });
  });
  return true;
}

const uploadsDir = path.join(process.cwd(), "uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

const upload = multer({
  dest: uploadsDir,
  limits: { fileSize: 10 * 1024 * 1024 },
});

const leadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  alternatePhone: z.string().optional(),
  company: z.string().optional(),
  title: z.string().optional(),
  address: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  pinCode: z.string().optional(),
  industry: z.string().optional(),
  website: z.string().optional(),
  source: z.string().optional(),
  status: z.enum(LEAD_STATUSES as unknown as [string, ...string[]]).optional(),
  priority: z.enum(LEAD_PRIORITIES as unknown as [string, ...string[]]).optional(),
  budget: z.number().min(0).optional().nullable(),
  requirement: z.string().optional(),
  expectedClosingDate: z.string().optional().nullable(),
  remarks: z.string().optional(),
  score: z.number().min(0).max(100).optional(),
  notes: z.string().optional(),
  ownerId: z.string().optional().nullable(),
  customFields: z.record(z.string()).optional(),
});

function leadToCsvRow(lead: Record<string, unknown>): string {
  const fields = [
    "leadNumber", "firstName", "lastName", "email", "phone", "alternatePhone",
    "company", "address", "city", "state", "country", "pinCode", "industry",
    "website", "source", "status", "priority", "budget", "requirement",
    "expectedClosingDate", "remarks", "score",
  ];
  return fields.map((f) => {
    const v = lead[f];
    if (v == null) return "";
    const s = String(v).replace(/"/g, '""');
    return s.includes(",") || s.includes('"') ? `"${s}"` : s;
  }).join(",");
}

registerImportRoutes(router, "leads", importLeadRows, {
  validateOwnerId: canAssignToUser,
});

router.get("/meta", (_req, res) => {
  res.json({ sources: LEAD_SOURCES, statuses: LEAD_STATUSES, priorities: LEAD_PRIORITIES });
});

router.get("/export", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "export");
    const leads = await prisma.lead.findMany({
      where: { workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
      orderBy: { createdAt: "desc" },
    });
    const header = "leadNumber,firstName,lastName,email,phone,alternatePhone,company,address,city,state,country,pinCode,industry,website,source,status,priority,budget,requirement,expectedClosingDate,remarks,score";
    const rows = leads.map((l) => leadToCsvRow(l as unknown as Record<string, unknown>));
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=leads-export.csv");
    res.send([header, ...rows].join("\n"));
  } catch (error) {
    handleError(res, req, error);
  }
});

router.post("/check-duplicates", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const { email, phone, excludeId } = z.object({
      email: z.string().optional(),
      phone: z.string().optional(),
      excludeId: z.string().optional(),
    }).parse(req.body);
    const duplicates = await findDuplicateLeads(ctx.workspace.id, email, phone, excludeId);
    res.json({ duplicates, hasDuplicates: duplicates.length > 0 });
  } catch (error) {
    handleError(res, req, error);
  }
});

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const status = req.query.status as string | undefined;
    const source = req.query.source as string | undefined;
    const priority = req.query.priority as string | undefined;
    const ownerId = req.query.ownerId as string | undefined;
    const city = req.query.city as string | undefined;
    const q = (req.query.q as string | undefined)?.trim();
    const dateFrom = req.query.dateFrom as string | undefined;
    const dateTo = req.query.dateTo as string | undefined;
    const view = (req.query.view as string) || "active";
    const sortBy = (req.query.sortBy as string) || "createdAt";
    const sortDir = req.query.sortDir === "asc" ? "asc" : "desc";

    const sortFields = ["createdAt", "firstName", "status", "priority", "score", "city", "updatedAt"] as const;
    const orderField = sortFields.includes(sortBy as typeof sortFields[number]) ? sortBy : "createdAt";

    const scopeFilter = getLeadOwnerFilter(ctx);
    if (ownerId && !canFilterByOwnerId(ctx, ownerId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const leads = await prisma.lead.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        ...scopeFilter,
        ...(view === "archived" ? { archivedAt: { not: null } } : view === "all" ? {} : { archivedAt: null }),
        ...(status ? { status } : {}),
        ...(source ? { source } : {}),
        ...(priority ? { priority } : {}),
        ...(ownerId ? { ownerId } : {}),
        ...(city ? { city: { contains: city } } : {}),
        ...(dateFrom || dateTo ? {
          createdAt: {
            ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
            ...(dateTo ? { lte: new Date(dateTo) } : {}),
          },
        } : {}),
        ...(q ? {
          OR: [
            { firstName: { contains: q } },
            { lastName: { contains: q } },
            { email: { contains: q } },
            { phone: { contains: q } },
            { company: { contains: q } },
            { leadNumber: { contains: q } },
            { requirement: { contains: q } },
            { title: { contains: q } },
          ],
        } : {}),
      },
      include: { owner: { select: { id: true, name: true } } },
      orderBy: { [orderField]: sortDir } as { createdAt?: "asc" | "desc"; firstName?: "asc" | "desc"; status?: "asc" | "desc"; priority?: "asc" | "desc"; score?: "asc" | "desc"; city?: "asc" | "desc"; updatedAt?: "asc" | "desc" },
    });
    const enriched = await enrichLeadsForList(leads);
    const withCustom = await attachCustomFieldsToLeads(ctx.workspace.id, enriched);
    res.json(withCustom);
  } catch (error) {
    handleError(res, req, error);
  }
});

router.patch("/bulk", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const body = z
      .object({
        ids: z.array(z.string()).min(1).max(200),
        status: z.enum(LEAD_STATUSES as unknown as [string, ...string[]]).optional(),
        priority: z.enum(LEAD_PRIORITIES as unknown as [string, ...string[]]).optional(),
        ownerId: z.string().optional(),
        archive: z.boolean().optional(),
      })
      .parse(req.body);

    if (body.ownerId && !(await canAssignToUser(ctx, body.ownerId))) {
      res.status(403).json({ error: "Cannot assign to this user" });
      return;
    }

    const data: Record<string, unknown> = {};
    if (body.status) data.status = body.status;
    if (body.priority) data.priority = body.priority;
    if (body.ownerId) data.ownerId = body.ownerId;
    if (body.archive === true) data.archivedAt = new Date();
    if (body.archive === false) data.archivedAt = null;

    const result = await prisma.lead.updateMany({
      where: {
        id: { in: body.ids },
        workspaceId: ctx.workspace.id,
        ...getLeadOwnerFilter(ctx),
      },
      data,
    });

    await recordAuditLog({
      workspaceId: ctx.workspace.id,
      userId: ctx.session.userId,
      action: "lead_bulk_update",
      entityType: "lead",
      details: `${result.count} leads updated`,
    });

    res.json({ updated: result.count });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, req, error, "Bulk update failed");
  }
});

router.patch("/:id/assign", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "assign");
    const { ownerId } = z.object({ ownerId: z.string().min(1) }).parse(req.body);

    if (!(await canAssignToUser(ctx, ownerId))) {
      res.status(403).json({ error: "Cannot assign to this user" });
      return;
    }

    const existing = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
      include: { owner: { select: { name: true } } },
    });
    if (!existing) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    const assignee = await prisma.user.findUnique({ where: { id: ownerId } });
    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: {
        ownerId,
        ...(existing.status === "new" ? { status: "assigned" } : {}),
      },
      include: { owner: { select: { id: true, name: true } } },
    });

    await addTimelineEvent(
      lead.id,
      "assigned",
      "Lead assigned",
      `Assigned to ${assignee?.name || "team member"}`,
      ctx.session.userId
    );

    if (ownerId !== ctx.session.userId) {
      const assigner = await prisma.user.findUnique({ where: { id: ctx.session.userId } });
      await notifyLeadAssigned({
        workspaceId: ctx.workspace.id,
        assigneeId: ownerId,
        leadId: lead.id,
        leadNumber: lead.leadNumber,
        leadName: `${lead.firstName} ${lead.lastName || ""}`.trim(),
        assignedByName: assigner?.name || "Manager",
      });
    }

    await recordAuditLog({
      workspaceId: ctx.workspace.id,
      userId: ctx.session.userId,
      action: "lead_assign",
      entityType: "lead",
      entityId: lead.id,
      details: `Assigned to ${assignee?.name}`,
    });

    res.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, req, error);
  }
});

router.patch("/:id/archive", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const existing = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: { archivedAt: new Date() },
    });
    await addTimelineEvent(lead.id, "archived", "Lead archived", "Moved to archive", ctx.session.userId);
    res.json(lead);
  } catch (error) {
    handleError(res, req, error);
  }
});

router.patch("/:id/unarchive", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const existing = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    const lead = await prisma.lead.update({
      where: { id: existing.id },
      data: { archivedAt: null },
    });
    await addTimelineEvent(lead.id, "restored", "Lead restored", "Removed from archive", ctx.session.userId);
    res.json(lead);
  } catch (error) {
    handleError(res, req, error);
  }
});

router.get("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const lead = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
      include: {
        owner: { select: { id: true, name: true, email: true } },
        activities: { orderBy: { createdAt: "desc" }, take: 20 },
        followUps: { orderBy: { scheduledAt: "desc" }, include: { owner: { select: { name: true } } } },
        communications: { orderBy: { createdAt: "desc" }, include: { owner: { select: { name: true } } } },
        leadNotes: { orderBy: { createdAt: "desc" }, include: { author: { select: { name: true } } } },
        attachments: { orderBy: { uploadedAt: "desc" } },
        timeline: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } } },
      },
    });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    res.json(lead);
  } catch (error) {
    handleError(res, req, error);
  }
});

router.post("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const data = leadSchema.parse(req.body);
    const leadNumber = await generateLeadNumber(ctx.workspace.id);

    let ownerId = ctx.session.userId;
    if (data.ownerId) {
      if (!(await canAssignToUser(ctx, data.ownerId))) {
        res.status(403).json({ error: "Cannot assign to this user" });
        return;
      }
      ownerId = data.ownerId;
    } else {
      const autoOwner = await pickLeadOwner(ctx.workspace.id, null, {
        source: data.source,
        city: data.city,
        state: data.state,
        industry: data.industry,
        requirement: data.requirement,
      });
      if (autoOwner) ownerId = autoOwner;
    }

    const initialStatus = data.status || (ownerId && ownerId !== ctx.session.userId ? "assigned" : "new");

    const lead = await prisma.lead.create({
      data: {
        workspaceId: ctx.workspace.id,
        ownerId,
        leadNumber,
        firstName: data.firstName,
        lastName: data.lastName || null,
        email: data.email || null,
        phone: data.phone || null,
        alternatePhone: data.alternatePhone || null,
        company: data.company || null,
        title: data.title || null,
        address: data.address || null,
        city: data.city || null,
        state: data.state || null,
        country: data.country || "India",
        pinCode: data.pinCode || null,
        industry: data.industry || null,
        website: data.website || null,
        source: data.source || "Manual Entry",
        status: initialStatus,
        priority: data.priority || "medium",
        budget: data.budget ?? null,
        requirement: data.requirement || null,
        expectedClosingDate: data.expectedClosingDate ? new Date(data.expectedClosingDate) : null,
        remarks: data.remarks || null,
        score: data.score ?? 0,
        notes: data.notes || null,
      },
      include: { owner: { select: { id: true, name: true } } },
    });

    await addTimelineEvent(lead.id, "created", "Lead created", `Lead ${leadNumber} added`, ctx.session.userId);

    if (data.customFields) {
      await saveCustomFieldsForEntity(ctx.workspace.id, "lead", lead.id, data.customFields);
    }
    await onLeadCreated({
      workspaceId: ctx.workspace.id,
      leadId: lead.id,
      actorUserId: ctx.session.userId,
    });

    const refreshed = await prisma.lead.findUnique({
      where: { id: lead.id },
      include: { owner: { select: { id: true, name: true } } },
    });

    await recordAuditLog({
      workspaceId: ctx.workspace.id,
      userId: ctx.session.userId,
      action: "lead_create",
      entityType: "lead",
      entityId: lead.id,
      details: leadNumber,
    });

    const duplicates = await findDuplicateLeads(ctx.workspace.id, data.email, data.phone, lead.id);
    res.status(201).json({ lead: refreshed ?? lead, possibleDuplicates: duplicates });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, req, error);
  }
});

router.put("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const data = leadSchema.partial().parse(req.body);
    const existing = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    if (!canAccessLead(ctx, existing.ownerId)) {
      res.status(403).json({ error: "Forbidden" });
      return;
    }

    const { customFields, ...leadData } = data;
    const lead = await prisma.lead.update({
      where: { id: param(req, "id") },
      data: {
        ...leadData,
        email: leadData.email === "" ? null : leadData.email,
        expectedClosingDate: leadData.expectedClosingDate
          ? new Date(leadData.expectedClosingDate)
          : leadData.expectedClosingDate === null ? null : undefined,
      },
    });
    if (customFields) {
      await saveCustomFieldsForEntity(ctx.workspace.id, "lead", lead.id, customFields);
    }
    if (data.status && data.status !== existing.status) {
      await addTimelineEvent(lead.id, "status_change", `Status changed to ${data.status}`, undefined, ctx.session.userId);
    }
    await addTimelineEvent(lead.id, "updated", "Lead updated", undefined, ctx.session.userId);
    await onLeadUpdated({
      workspaceId: ctx.workspace.id,
      leadId: lead.id,
      previousStatus: existing.status,
      actorUserId: ctx.session.userId,
    });
    res.json(lead);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    handleError(res, req, error);
  }
});

router.post("/:id/duplicate", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "add");
    const existing = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    const leadNumber = await generateLeadNumber(ctx.workspace.id);
    const lead = await prisma.lead.create({
      data: {
        workspaceId: ctx.workspace.id,
        ownerId: ctx.session.userId,
        leadNumber,
        firstName: `${existing.firstName} (Copy)`,
        lastName: existing.lastName,
        email: existing.email,
        phone: existing.phone,
        alternatePhone: existing.alternatePhone,
        company: existing.company,
        title: existing.title,
        address: existing.address,
        city: existing.city,
        state: existing.state,
        country: existing.country,
        pinCode: existing.pinCode,
        industry: existing.industry,
        website: existing.website,
        source: existing.source,
        priority: existing.priority,
        budget: existing.budget,
        requirement: existing.requirement,
        remarks: existing.remarks,
        score: existing.score,
        notes: existing.notes,
        status: "new",
      },
    });
    await addTimelineEvent(lead.id, "created", "Lead duplicated", `Duplicated from ${existing.leadNumber}`, ctx.session.userId);
    res.status(201).json(lead);
  } catch (error) {
    handleError(res, req, error);
  }
});

router.post("/:id/notes", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const { content } = z.object({ content: z.string().min(1) }).parse(req.body);
    const lead = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    const note = await prisma.leadNote.create({
      data: { leadId: lead.id, authorId: ctx.session.userId, content },
      include: { author: { select: { name: true } } },
    });
    await addTimelineEvent(lead.id, "note", "Note added", content.slice(0, 100), ctx.session.userId);
    res.status(201).json(note);
  } catch (error) {
    handleError(res, req, error);
  }
});

router.post("/:id/attachments", upload.single("file"), async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const lead = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!lead || !req.file) {
      res.status(400).json({ error: "Lead or file not found" });
      return;
    }
    const attachment = await prisma.leadAttachment.create({
      data: {
        leadId: lead.id,
        fileName: req.file.originalname,
        fileSize: req.file.size,
        mimeType: req.file.mimetype,
        filePath: req.file.path,
      },
    });
    await addTimelineEvent(lead.id, "attachment", "File attached", req.file.originalname, ctx.session.userId);
    res.status(201).json(attachment);
  } catch (error) {
    handleError(res, req, error);
  }
});

router.get("/:id/attachments/:attachmentId/download", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const attachment = await prisma.leadAttachment.findFirst({
      where: {
        id: param(req, "attachmentId"),
        lead: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
      },
    });
    if (!attachment) {
      res.status(404).json({ error: "File not found" });
      return;
    }
    res.download(attachment.filePath, attachment.fileName);
  } catch (error) {
    handleError(res, req, error);
  }
});

router.post("/:id/convert", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "edit");
    const body = z.object({
      createDeal: z.boolean().optional(),
      dealName: z.string().optional(),
      dealAmount: z.number().min(0).optional(),
      stageId: z.string().optional(),
    }).parse(req.body ?? {});

    const lead = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    if (lead.status === "won") {
      res.status(400).json({ error: "Lead already won" });
      return;
    }

    let accountId: string | null = null;
    if (lead.company) {
      const existing = await prisma.account.findFirst({
        where: { workspaceId: ctx.workspace.id, name: lead.company },
      });
      accountId = existing?.id || (await prisma.account.create({
        data: { workspaceId: ctx.workspace.id, ownerId: ctx.session.userId, name: lead.company, industry: lead.industry },
      })).id;
    }

    const contact = await prisma.contact.create({
      data: {
        workspaceId: ctx.workspace.id,
        ownerId: lead.ownerId || ctx.session.userId,
        accountId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        title: lead.title,
        notes: lead.notes,
      },
    });

    let deal = null;
    const dealAmount = body.dealAmount ?? lead.budget ?? 0;
    const wonStage =
      (body.stageId
        ? await prisma.pipelineStage.findFirst({
            where: { id: body.stageId, workspaceId: ctx.workspace.id },
          })
        : null) ||
      (await prisma.pipelineStage.findFirst({
        where: { workspaceId: ctx.workspace.id, isWon: true },
        orderBy: { order: "asc" },
      }));

    if (body.createDeal !== false && wonStage) {
      deal = await prisma.deal.create({
        data: {
          workspaceId: ctx.workspace.id,
          ownerId: lead.ownerId || ctx.session.userId,
          stageId: wonStage.id,
          accountId,
          contactId: contact.id,
          name: body.dealName || `${lead.company || lead.firstName} — Won`,
          amount: dealAmount,
          probability: wonStage.isWon ? 100 : wonStage.probability,
          status: wonStage.isWon ? "won" : wonStage.isLost ? "lost" : "open",
          closedAt: wonStage.isWon || wonStage.isLost ? new Date() : null,
        },
      });
    }

    await prisma.lead.update({ where: { id: lead.id }, data: { status: "won" } });
    await addTimelineEvent(lead.id, "converted", "Lead converted to customer", undefined, ctx.session.userId);

    const existingCustomer = await prisma.customer.findUnique({ where: { leadId: lead.id } });
    const customer =
      existingCustomer ||
      (await prisma.customer.create({
        data: {
          workspaceId: ctx.workspace.id,
          leadId: lead.id,
          contactId: contact.id,
          accountId,
          name: `${lead.firstName} ${lead.lastName || ""}`.trim(),
          email: lead.email,
          phone: lead.phone,
          company: lead.company,
        },
      }));

    if (!existingCustomer) {
      await seedCustomerConversionRecords(customer.id, lead.leadNumber, dealAmount);
    }

    res.json({ contact, accountId, deal, customer });
  } catch (error) {
    handleError(res, req, error);
  }
});

router.delete("/:id", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "delete");
    const existing = await prisma.lead.findFirst({
      where: { id: param(req, "id"), workspaceId: ctx.workspace.id, ...getLeadOwnerFilter(ctx) },
    });
    if (!existing) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }
    await prisma.lead.delete({ where: { id: param(req, "id") } });
    res.json({ success: true });
  } catch (error) {
    handleError(res, req, error);
  }
});

export default router;
