import type { Request, Response, NextFunction } from "express";
import { respondWithError } from "../lib/route-error";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ error: "Not found" });
}

export function globalErrorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
) {
  respondWithError(req, res, err).catch(() => {
    if (!res.headersSent) {
      res.status(500).json({
        error: "Something went wrong. Our team has been notified.",
        reference: "ERR-FALLBACK",
      });
    }
  });
}
