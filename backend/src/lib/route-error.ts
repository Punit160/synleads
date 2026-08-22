import type { Request, Response } from "express";
import { ZodError } from "zod";
import { logSystemError, defaultUserMessage, tryResolveSession } from "./error-tracker";

const AUTH_MESSAGES = new Set(["Forbidden", "Unauthorized", "No workspace"]);

function safeClientMessage(message: string): boolean {
  if (AUTH_MESSAGES.has(message)) return true;
  if (message.includes("expired") || message.includes("suspended")) return true;
  const lower = message.toLowerCase();
  if (
    lower.includes("prisma") ||
    lower.includes("constraint") ||
    lower.includes("econnrefused") ||
    lower.includes("invalid `") ||
    message.includes("\n") ||
    message.length > 180
  ) {
    return false;
  }
  return true;
}

/** Handle auth/permission errors — returns true if response was sent. */
export function handleAuthError(res: Response, error: unknown, fallback = "Unauthorized"): boolean {
  const msg = error instanceof Error ? error.message : fallback;
  if (msg === "Forbidden") {
    res.status(403).json({ error: msg });
    return true;
  }
  if (msg.includes("expired") || msg.includes("suspended")) {
    res.status(403).json({ error: msg });
    return true;
  }
  if (msg === "Unauthorized" || msg === "No workspace") {
    res.status(401).json({ error: msg });
    return true;
  }
  return false;
}

export async function respondWithError(
  req: Request,
  res: Response,
  error: unknown,
  options?: {
    statusCode?: number;
    userMessage?: string;
    skipLog?: boolean;
  }
): Promise<void> {
  if (res.headersSent) return;

  if (error instanceof ZodError) {
    res.status(400).json({ error: error.errors[0]?.message || "Invalid input" });
    return;
  }

  if (handleAuthError(res, error)) return;

  const rawMsg = error instanceof Error ? error.message : "Request failed";
  const statusCode = options?.statusCode ?? (safeClientMessage(rawMsg) ? 400 : 500);

  if (statusCode < 500 && safeClientMessage(rawMsg)) {
    res.status(statusCode).json({ error: rawMsg });
    return;
  }

  if (options?.skipLog && statusCode < 500) {
    res.status(statusCode).json({ error: options.userMessage || rawMsg });
    return;
  }

  const session = await tryResolveSession(req);
  const logged = await logSystemError({
    error,
    req,
    statusCode: statusCode >= 500 ? statusCode : 500,
    userMessage: options?.userMessage || (statusCode < 500 ? rawMsg : defaultUserMessage(500)),
    ...session,
  });

  res.status(statusCode >= 500 ? statusCode : 500).json({
    error: `${logged.userMessage} Reference: ${logged.reference}`,
    reference: logged.reference,
  });
}

export function respondWithErrorSync(
  res: Response,
  error: unknown,
  fallbackStatus = 400
): boolean {
  if (res.headersSent) return true;
  if (error instanceof ZodError) {
    res.status(400).json({ error: error.errors[0]?.message || "Invalid input" });
    return true;
  }
  if (handleAuthError(res, error)) return true;
  return false;
}
