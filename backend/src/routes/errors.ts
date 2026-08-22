import { Router } from "express";
import { z } from "zod";
import { logSystemError, tryResolveSession } from "../lib/error-tracker";
import { respondWithError, handleAuthError } from "../lib/route-error";

const router = Router();

const reportSchema = z.object({
  message: z.string().min(1).max(2000),
  stack: z.string().max(8000).optional(),
  url: z.string().max(500).optional(),
  component: z.string().max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

router.post("/report", async (req, res) => {
  try {
    const data = reportSchema.parse(req.body);
    const session = await tryResolveSession(req);

    const logged = await logSystemError({
      error: new Error(data.message),
      req,
      source: "frontend",
      statusCode: 500,
      userMessage: data.message.slice(0, 500),
      metadata: {
        url: data.url,
        component: data.component,
        stack: data.stack?.slice(0, 4000),
        ...data.metadata,
      },
      ...session,
    });

    res.status(201).json({
      ok: true,
      reference: logged.reference,
      message: `Error reported. Reference: ${logged.reference}`,
    });
  } catch (error) {
    if (handleAuthError(res, error)) return;
    await respondWithError(req, res, error, { statusCode: 400 });
  }
});

export default router;
