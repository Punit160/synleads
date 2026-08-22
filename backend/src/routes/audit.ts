import { Router } from "express";
import { prisma } from "../lib/prisma";
import { getAuthenticatedContext, requirePermission } from "../lib/rbac";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "reports");
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 500);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const action = req.query.action as string | undefined;
    const entityType = req.query.entityType as string | undefined;
    const userId = req.query.userId as string | undefined;
    const from = req.query.from as string | undefined;
    const to = req.query.to as string | undefined;
    const q = req.query.q as string | undefined;

    const where = {
      workspaceId: ctx.workspace.id,
      ...(action ? { action } : {}),
      ...(entityType ? { entityType } : {}),
      ...(userId ? { userId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { action: { contains: q } },
              { entityType: { contains: q } },
              { details: { contains: q } },
            ],
          }
        : {}),
    };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.auditLog.count({ where }),
    ]);

    const userIds = [...new Set(logs.map((l) => l.userId).filter(Boolean))] as string[];
    const users =
      userIds.length > 0
        ? await prisma.user.findMany({
            where: { id: { in: userIds } },
            select: { id: true, name: true, email: true },
          })
        : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    res.json({
      logs: logs.map((l) => ({
        ...l,
        user: l.userId ? userMap.get(l.userId) ?? null : null,
      })),
      total,
      limit,
      offset,
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    if (msg === "Forbidden") res.status(403).json({ error: msg });
    else res.status(401).json({ error: "Unauthorized" });
  }
});

router.get("/export", async (req, res) => {
  try {
    const ctx = await getAuthenticatedContext(req);
    requirePermission(ctx, "reports");
    const logs = await prisma.auditLog.findMany({
      where: { workspaceId: ctx.workspace.id },
      orderBy: { createdAt: "desc" },
      take: 2000,
    });
    const header = "createdAt,action,entityType,entityId,userId,details";
    const rows = logs.map((l) =>
      [
        l.createdAt.toISOString(),
        l.action,
        l.entityType,
        l.entityId ?? "",
        l.userId ?? "",
        (l.details ?? "").replace(/"/g, '""'),
      ]
        .map((v) => (String(v).includes(",") ? `"${v}"` : v))
        .join(",")
    );
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=audit-log.csv");
    res.send([header, ...rows].join("\n"));
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unauthorized";
    if (msg === "Forbidden") res.status(403).json({ error: msg });
    else res.status(401).json({ error: "Unauthorized" });
  }
});

export default router;
