import { SignJWT, jwtVerify } from "jose";
import type { Request, Response } from "express";
import bcrypt from "bcryptjs";

const JWT_SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || "fallback-secret-change-me"
);

export interface SessionPayload {
  userId: string;
  email: string;
  name: string;
  workspaceSlug?: string;
}

export interface PlatformSessionPayload {
  adminId: string;
  email: string;
  name: string;
  type: "platform";
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function createPlatformSession(payload: Omit<PlatformSessionPayload, "type">): Promise<string> {
  return new SignJWT({ ...payload, type: "platform" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("7d")
    .sign(JWT_SECRET);
}

export async function getSessionFromRequest(req: Request): Promise<SessionPayload | null> {
  const token = req.cookies?.session;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if ((payload as { type?: string }).type === "platform") return null;
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function getPlatformSessionFromRequest(req: Request): Promise<PlatformSessionPayload | null> {
  const token = req.cookies?.platform_session;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET);
    if ((payload as { type?: string }).type !== "platform") return null;
    return payload as unknown as PlatformSessionPayload;
  } catch {
    return null;
  }
}

export async function requireSession(req: Request): Promise<SessionPayload> {
  const session = await getSessionFromRequest(req);
  if (!session) throw new Error("Unauthorized");
  return session;
}

export async function requirePlatformSession(req: Request): Promise<PlatformSessionPayload> {
  const session = await getPlatformSessionFromRequest(req);
  if (!session) throw new Error("Unauthorized");
  return session;
}

export function setSessionCookie(res: Response, token: string, workspaceSlug?: string) {
  res.cookie("session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7 * 1000,
    path: "/",
  });
  if (workspaceSlug) {
    res.cookie("tenant_slug", workspaceSlug, {
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7 * 1000,
      path: "/",
    });
  }
}

export function setPlatformSessionCookie(res: Response, token: string) {
  res.cookie("platform_session", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7 * 1000,
    path: "/",
  });
}

export function clearSessionCookie(res: Response) {
  res.clearCookie("session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
  res.clearCookie("tenant_slug", {
    httpOnly: false,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}

export function clearPlatformSessionCookie(res: Response) {
  res.clearCookie("platform_session", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });
}
