import { randomBytes } from "crypto";
import type { Request } from "express";
import { prisma } from "./prisma";

export type ErrorLogInput = {
  error: unknown;
  req?: Request;
  source?: "api" | "frontend" | "system";
  statusCode?: number;
  userMessage?: string;
  workspaceId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  metadata?: Record<string, unknown>;
};

export function generateErrorReference(): string {
  return `ERR-${randomBytes(3).toString("hex").toUpperCase()}`;
}

function extractTechnical(error: unknown): string {
  if (error instanceof Error) {
    return [error.message, error.stack].filter(Boolean).join("\n");
  }
  return String(error);
}

function isTechnicalMessage(msg: string): boolean {
  const lower = msg.toLowerCase();
  return (
    lower.includes("prisma") ||
    lower.includes("unique constraint") ||
    lower.includes("foreign key") ||
    lower.includes("econnrefused") ||
    lower.includes("syntax error") ||
    lower.includes("cannot read propert") ||
    lower.includes("undefined is not") ||
    lower.includes("invalid `") ||
    msg.includes(" at ") ||
    msg.length > 200
  );
}

export function defaultUserMessage(statusCode: number): string {
  if (statusCode === 503) return "The service is temporarily unavailable. Please try again shortly.";
  if (statusCode === 404) return "The requested resource was not found.";
  return "Something went wrong on our end. Our team has been notified and will look into it.";
}

export async function logSystemError(input: ErrorLogInput): Promise<{
  reference: string;
  userMessage: string;
}> {
  const reference = generateErrorReference();
  const technical = extractTechnical(input.error);
  const statusCode = input.statusCode ?? 500;

  let userMessage = input.userMessage || defaultUserMessage(statusCode);
  if (!input.userMessage && input.error instanceof Error && !isTechnicalMessage(input.error.message)) {
    if (statusCode < 500) userMessage = input.error.message;
  }

  const req = input.req;
  const route = req ? `${req.baseUrl || ""}${req.path || req.url || ""}` : undefined;

  try {
    await prisma.systemError.create({
      data: {
        reference,
        severity: statusCode >= 500 ? "error" : "warning",
        status: "open",
        source: input.source || "api",
        message: userMessage,
        technical,
        route,
        method: req?.method,
        statusCode,
        workspaceId: input.workspaceId ?? undefined,
        userId: input.userId ?? undefined,
        userEmail: input.userEmail ?? undefined,
        userAgent: req?.headers["user-agent"]?.slice(0, 512),
        ip: (req?.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() || req?.socket?.remoteAddress,
        metadata: input.metadata ? (input.metadata as object) : undefined,
      },
    });
  } catch (logErr) {
    console.error("[SystemError] Failed to persist error log:", logErr);
    console.error("[SystemError]", reference, technical);
  }

  return { reference, userMessage };
}

export async function tryResolveSession(req?: Request): Promise<{
  workspaceId?: string;
  userId?: string;
  userEmail?: string;
}> {
  if (!req) return {};
  try {
    const { getSessionFromRequest } = await import("./auth");
    const session = await getSessionFromRequest(req);
    if (!session) return {};
    const member = await prisma.workspaceMember.findFirst({
      where: { userId: session.userId, status: "active" },
      select: { workspaceId: true },
      orderBy: { createdAt: "asc" },
    });
    return {
      userId: session.userId,
      userEmail: session.email,
      workspaceId: member?.workspaceId,
    };
  } catch {
    return {};
  }
}
