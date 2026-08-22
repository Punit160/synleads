import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { generateLeadNumber, findDuplicateLeads, addTimelineEvent } from "../lib/lead-utils";
import { pickLeadOwner } from "../lib/auto-assign";
import { recordAuditLog } from "../lib/audit-log";
import { notifyLeadAssigned } from "../lib/reminder-jobs";
import { onLeadCreated } from "../lib/lead-automation";
import { LEAD_SOURCES } from "../lib/lead-constants";
import { ensureWorkspaceSlug } from "../lib/workspace-slug";
import { readWebhookApiKey } from "../lib/brand";

const router = Router();

const publicLeadSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().optional(),
  email: z.string().email().optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  source: z.string().optional(),
  requirement: z.string().optional(),
  budget: z.number().optional(),
  remarks: z.string().optional(),
});

async function resolveWorkspaceByApiKey(apiKey: string | undefined) {
  if (!apiKey) return null;
  return prisma.workspace.findFirst({
    where: { leadApiKey: apiKey, status: "active" },
    select: { id: true, userId: true, name: true, slug: true },
  });
}

async function resolveWorkspaceBySlug(slug: string) {
  const ws = await prisma.workspace.findFirst({
    where: { slug, status: "active" },
    select: { id: true, userId: true, name: true, slug: true, leadApiKey: true },
  });
  if (!ws) return null;
  if (!ws.slug) {
    const resolved = await ensureWorkspaceSlug(ws.id, ws.name);
    return { ...ws, slug: resolved };
  }
  return ws;
}

async function createInboundLead(
  workspace: { id: string; userId: string; name: string },
  data: z.infer<typeof publicLeadSchema>,
  sourceDefault: string
) {
  const dups = await findDuplicateLeads(workspace.id, data.email, data.phone);
  if (dups.length > 0) {
    return { error: "duplicate" as const, duplicateId: dups[0].id };
  }

  const ownerId = await pickLeadOwner(workspace.id, null, {
    source: data.source || sourceDefault,
    city: data.city,
    state: data.state,
    requirement: data.requirement,
  });
  const leadNumber = await generateLeadNumber(workspace.id);
  const source =
    data.source && LEAD_SOURCES.includes(data.source as (typeof LEAD_SOURCES)[number])
      ? data.source
      : sourceDefault;

  const lead = await prisma.lead.create({
    data: {
      workspaceId: workspace.id,
      ownerId,
      leadNumber,
      firstName: data.firstName,
      lastName: data.lastName || null,
      email: data.email || null,
      phone: data.phone || null,
      company: data.company || null,
      city: data.city || null,
      state: data.state || null,
      source,
      requirement: data.requirement || null,
      budget: data.budget ?? null,
      remarks: data.remarks || null,
      status: ownerId ? "assigned" : "new",
    },
  });

  await addTimelineEvent(
    lead.id,
    "created",
    "Lead captured",
    `Inbound from ${source} (webhook)`,
    ownerId ?? undefined
  );
  await recordAuditLog({
    workspaceId: workspace.id,
    userId: null,
    action: "lead_webhook_create",
    entityType: "lead",
    entityId: lead.id,
    details: `Source: ${source}`,
  });

  if (ownerId) {
    await notifyLeadAssigned({
      workspaceId: workspace.id,
      assigneeId: ownerId,
      leadId: lead.id,
      leadNumber,
      leadName: `${data.firstName} ${data.lastName || ""}`.trim(),
      assignedByName: "Inbound integration",
    });
  }

  await onLeadCreated({ workspaceId: workspace.id, leadId: lead.id, actorUserId: ownerId });

  return { lead, leadNumber, ownerId, source };
}

function readApiKey(req: { headers: Record<string, unknown>; query: Record<string, unknown> }) {
  return readWebhookApiKey(req.headers, req.query.key);
}

/** Website / form webhook — POST with header X-Synentrix-Flow-Key (legacy X-LeadFlow-Key also accepted) */
router.post("/leads", async (req, res) => {
  try {
    const apiKey = readApiKey(req);
    const workspace = await resolveWorkspaceByApiKey(apiKey);
    if (!workspace) {
      res.status(401).json({ error: "Invalid or missing API key" });
      return;
    }

    const data = publicLeadSchema.parse(req.body);
    const result = await createInboundLead(workspace, data, "API");
    if ("error" in result && result.error === "duplicate") {
      res.status(409).json({ error: "Duplicate lead", duplicateId: result.duplicateId });
      return;
    }

    res.status(201).json({
      id: result.lead!.id,
      leadNumber: result.leadNumber,
      ownerId: result.ownerId,
      workspaceSlug: workspace.slug,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    res.status(500).json({ error: "Failed to create lead" });
  }
});

/** Company-scoped webhook — POST /api/public/:slug/leads (+ X-Synentrix-Flow-Key must match that company) */
router.post("/:slug/leads", async (req, res) => {
  try {
    const workspace = await resolveWorkspaceBySlug(req.params.slug);
    if (!workspace) {
      res.status(404).json({ error: "Company portal not found" });
      return;
    }

    const apiKey = readApiKey(req);
    if (!apiKey || apiKey !== workspace.leadApiKey) {
      res.status(401).json({ error: "Invalid or missing API key for this company portal" });
      return;
    }

    const data = publicLeadSchema.parse(req.body);
    const result = await createInboundLead(workspace, data, "API");
    if ("error" in result && result.error === "duplicate") {
      res.status(409).json({ error: "Duplicate lead", duplicateId: result.duplicateId });
      return;
    }

    res.status(201).json({
      id: result.lead!.id,
      leadNumber: result.leadNumber,
      ownerId: result.ownerId,
      workspaceSlug: workspace.slug,
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    res.status(500).json({ error: "Failed to create lead" });
  }
});

export default router;
