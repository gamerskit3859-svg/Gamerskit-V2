import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import type { NextFunction, Request, Response } from "express";
import { env } from "../env.js";
import { UserModel } from "../models/User.js";

export type JwtPayload = {
  sub: string;
  email: string;
  role: "customer" | "staff" | "admin";
};

const AUTH_COOKIE = "gk_session";

function parseCookies(header = ""): Record<string, string> {
  return Object.fromEntries(
    header
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const index = part.indexOf("=");
        if (index === -1) return [part, ""];
        return [
          decodeURIComponent(part.slice(0, index)),
          decodeURIComponent(part.slice(index + 1)),
        ];
      }),
  );
}

export function setAuthCookie(res: Response, token: string): void {
  const isProduction = env.NODE_ENV === "production";
  res.cookie(AUTH_COOKIE, token, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res: Response): void {
  const isProduction = env.NODE_ENV === "production";
  res.clearCookie(AUTH_COOKIE, {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
    path: "/",
  });
}

function tokenFromRequest(req: Request): string | null {
  const cookies = parseCookies(req.header("cookie") ?? "");
  if (cookies[AUTH_COOKIE]) return cookies[AUTH_COOKIE];
  const header = req.header("authorization") ?? "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

export function authPayloadFromRequest(req: Request): JwtPayload | null {
  const token = tokenFromRequest(req);
  return token ? verifyToken(token) : null;
}

export function signToken(p: JwtPayload): string {
  return jwt.sign(p, env.JWT_SECRET, { expiresIn: "30d" });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, env.JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

export async function hashPassword(p: string): Promise<string> {
  return bcrypt.hash(p, 10);
}

export async function comparePassword(p: string, hash: string): Promise<boolean> {
  return bcrypt.compare(p, hash);
}

declare module "express-serve-static-core" {
  interface Request {
    user?: JwtPayload;
  }
}

export function authRequired(req: Request, res: Response, next: NextFunction): void {
  const token = tokenFromRequest(req);
  if (!token) {
    res.status(401).json({ error: "missing token" });
    return;
  }
  const payload = authPayloadFromRequest(req);
  if (!payload) {
    res.status(401).json({ error: "invalid token" });
    return;
  }
  req.user = payload;
  next();
}

export function adminRequired(req: Request, res: Response, next: NextFunction): void {
  authRequired(req, res, () => {
    if (req.user?.role !== "admin" && req.user?.role !== "staff") {
      res.status(403).json({ error: "admin only" });
      return;
    }
    next();
  });
}

export function staffRequired(req: Request, res: Response, next: NextFunction): void {
  authRequired(req, res, () => {
    if (req.user?.role !== "staff") {
      res.status(403).json({ error: "staff only" });
      return;
    }
    next();
  });
}

export function adminOnlyRequired(req: Request, res: Response, next: NextFunction): void {
  authRequired(req, res, () => {
    if (req.user?.role !== "admin") {
      res.status(403).json({ error: "admin only" });
      return;
    }
    next();
  });
}

export function roleRequired(allowedRoles: Array<"customer" | "staff" | "admin">) {
  return (req: Request, res: Response, next: NextFunction): void => {
    authRequired(req, res, () => {
      if (!req.user?.role || !allowedRoles.includes(req.user.role)) {
        res.status(403).json({ error: "insufficient permissions" });
        return;
      }
      next();
    });
  };
}

/**
 * Bootstrap admin user on first start using ADMIN_EMAIL / ADMIN_PASSWORD env vars.
 */
export async function ensureAdmin(): Promise<void> {
  const existing = await UserModel.findOne({ email: env.ADMIN_EMAIL }).lean();
  if (existing) return;
  const passwordHash = await hashPassword(env.ADMIN_PASSWORD);
  await UserModel.create({
    email: env.ADMIN_EMAIL,
    passwordHash,
    name: "Admin",
    role: "admin",
  });
  if (env.NODE_ENV !== "production") {
    console.info(`[auth] bootstrap admin created: ${env.ADMIN_EMAIL}`);
  }
}
