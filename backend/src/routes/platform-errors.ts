import { Router } from "express";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { getPlatformContext, requirePlatformPermission } from "../lib/platform-auth";
import { respondWithError, handleAuthError } from "../lib/route-error";

const router = Router();

const updateSchema = z.object({
  status: z.enum(["open", "investigating", "resolved", "ignored"]).optional(),
  resolutionNotes: z.string().max(2000).optional().nullable(),
});

router.get("/", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_errors");

    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);
    const status = req.query.status as string | undefined;
    const source = req.query.source as string | undefined;
    const q = req.query.q as string | undefined;

    const where = {
      ...(status ? { status } : {}),
      ...(source ? { source } : {}),
      ...(q
        ? {
            OR: [
              { reference: { contains: q } },
              { message: { contains: q } },
              { route: { contains: q } },
              { userEmail: { contains: q } },
            ],
          }
        : {}),
    };

    const [errors, total, openCount] = await Promise.all([
      prisma.systemError.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          workspace: { select: { id: true, name: true, slug: true } },
        },
      }),
      prisma.systemError.count({ where }),
      prisma.systemError.count({ where: { status: "open" } }),
    ]);

    res.json({ errors, total, openCount, limit, offset });
  } catch (error) {
    if (handleAuthError(res, error)) return;
    await respondWithError(req, res, error);
  }
});

router.get("/:reference", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_errors");

    const err = await prisma.systemError.findFirst({
      where: { reference: req.params.reference },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
    });
    if (!err) {
      res.status(404).json({ error: "Error record not found" });
      return;
    }
    res.json(err);
  } catch (error) {
    if (handleAuthError(res, error)) return;
    await respondWithError(req, res, error);
  }
});

router.patch("/:reference", async (req, res) => {
  try {
    const ctx = await getPlatformContext(req);
    requirePlatformPermission(ctx, "manage_errors");
    const data = updateSchema.parse(req.body);

    const existing = await prisma.systemError.findFirst({
      where: { reference: req.params.reference },
    });
    if (!existing) {
      res.status(404).json({ error: "Error record not found" });
      return;
    }

    const updated = await prisma.systemError.update({
      where: { id: existing.id },
      data: {
        ...(data.status != null ? { status: data.status } : {}),
        ...(data.resolutionNotes !== undefined ? { resolutionNotes: data.resolutionNotes } : {}),
        ...(data.status === "resolved" || data.status === "ignored"
          ? { resolvedAt: new Date(), resolvedById: ctx.adminId }
          : data.status === "open" || data.status === "investigating"
            ? { resolvedAt: null, resolvedById: null }
            : {}),
      },
      include: {
        workspace: { select: { id: true, name: true, slug: true } },
      },
    });

    res.json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ error: error.errors[0].message });
      return;
    }
    if (handleAuthError(res, error)) return;
    await respondWithError(req, res, error);
  }
});

export default router;
