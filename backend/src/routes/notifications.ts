import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";
import { checkOverdueFollowUpAlerts } from "../lib/reminder-jobs";
import { runSlaChecks } from "../lib/sla-engine";

const router = Router();

function param(req: { params: Record<string, string | string[] | undefined> }, key: string): string {
  const v = req.params[key];
  return Array.isArray(v) ? v[0] : (v ?? "");
}

router.get("/unread-count", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    await checkOverdueFollowUpAlerts(ctx.workspace.id, ctx.session.userId).catch(() => {});
    await runSlaChecks(ctx.workspace.id).catch(() => {});
    const count = await prisma.notification.count({
      where: { workspaceId: ctx.workspace.id, userId: ctx.session.userId, read: false },
    });
    res.json({ count });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const unreadOnly = req.query.unread === "true";
    const notifications = await prisma.notification.findMany({
      where: {
        workspaceId: ctx.workspace.id,
        userId: ctx.session.userId,
        ...(unreadOnly ? { read: false } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });
    res.json(notifications);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.get("/settings", (_req, res) => {
  res.json({
    channels: [
      { id: "email", label: "Email Alerts", enabled: true },
      { id: "whatsapp", label: "WhatsApp Notifications", enabled: false },
      { id: "sms", label: "SMS Alerts", enabled: false },
      { id: "browser", label: "Browser Notifications", enabled: true },
      { id: "follow_up", label: "Follow-up Reminders", enabled: true },
    ],
  });
});

router.patch("/:id/read", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    await prisma.notification.updateMany({
      where: { id: param(req, "id"), userId: ctx.session.userId },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.patch("/read-all", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    await prisma.notification.updateMany({
      where: { workspaceId: ctx.workspace.id, userId: ctx.session.userId, read: false },
      data: { read: true },
    });
    res.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

router.post("/seed-demo", async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "Not found" });
    return;
  }
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "view");
    const demos = [
      { type: "follow_up", title: "Follow-up Reminder", message: "Call scheduled with Priya Sharma at 3:00 PM", channel: "browser" },
      { type: "lead", title: "New Lead Assigned", message: "Lead LF-00004 assigned to you", channel: "email" },
      { type: "deal", title: "Deal Stage Changed", message: "TechNova deal moved to Proposal", channel: "browser" },
      { type: "quote", title: "Quote Approved", message: "Quotation QT-00001 approved by manager", channel: "email" },
    ];
    await prisma.notification.createMany({
      data: demos.map((d) => ({ workspaceId: ctx.workspace.id, userId: ctx.session.userId, ...d })),
    });
    res.json({ success: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unauthorized";
    res.status(msg === "Forbidden" ? 403 : 401).json({ error: msg });
  }
});

export default router;
