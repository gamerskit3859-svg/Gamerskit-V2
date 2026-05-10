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
  const header = req.header("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) {
    res.status(401).json({ error: "missing token" });
    return;
  }
  const payload = verifyToken(token);
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
  console.log(`[auth] bootstrap admin created: ${env.ADMIN_EMAIL}`);
}
