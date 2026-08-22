import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthenticatedWorkspace } from "../lib/workspace";
import { COMMUNICATION_CHANNELS } from "../lib/lead-constants";
import { addTimelineEvent } from "../lib/lead-utils";
import { markLeadFirstResponse } from "../lib/sla-engine";

const router = Router();

const commSchema = z.object({
  leadId: z.string(),
  channel: z.enum(COMMUNICATION_CHANNELS as unknown as [string, ...string[]]),
  direction: z.enum(["inbound", "outbound"]).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  phoneNumber: z.string().optional(),
});

router.get("/", async (req, res) => {
  try {
    const { workspace } = await getAuthenticatedWorkspace(req);
    const leadId = req.query.leadId as string | undefined;

    const communications = await prisma.communication.findMany({
      where: {
        workspaceId: workspace.id,
        ...(leadId ? { leadId } : {}),
      },
      include: {
        lead: { select: { id: true, firstName: true, lastName: true, phone: true, email: true } },
        owner: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(communications);
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { session, workspace } = await getAuthenticatedWorkspace(req);
    const data = commSchema.parse(req.body);

    const lead = await prisma.lead.findFirst({
      where: { id: data.leadId, workspaceId: workspace.id },
    });
    if (!lead) {
      res.status(404).json({ error: "Lead not found" });
      return;
    }

    const communication = await prisma.communication.create({
      data: {
        workspaceId: workspace.id,
        leadId: data.leadId,
        ownerId: session.userId,
        channel: data.channel,
        direction: data.direction || "outbound",
        subject: data.subject || null,
        body: data.body || null,
        phoneNumber: data.phoneNumber || lead.phone || null,
      },
      include: {
        lead: { select: { firstName: true, lastName: true } },
        owner: { select: { name: true } },
      },
    });

    await addTimelineEvent(
      data.leadId,
      "communication",
      `${data.channel} ${data.direction || "outbound"}`,
      data.subject || data.body?.slice(0, 80),
      session.userId
    );

    if (lead.status === "new" && data.channel === "call") {
      await prisma.lead.update({ where: { id: lead.id }, data: { status: "contacted" } });
    }

    if ((data.direction || "outbound") === "outbound") {
      await markLeadFirstResponse(workspace.id, data.leadId);
    }

    res.status(201).json(communication);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
