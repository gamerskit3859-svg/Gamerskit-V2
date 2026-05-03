import { Router } from "express";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { OrderModel } from "../models/Order.js";
import { authRequired, comparePassword, hashPassword, signToken } from "../lib/auth.js";

const router = Router();

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  phone: z.string().optional(),
});

router.post("/register", async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const exists = await UserModel.findOne({ email: parsed.data.email });
  if (exists) {
    res.status(409).json({ error: "email already in use" });
    return;
  }
  const passwordHash = await hashPassword(parsed.data.password);
  const user = await UserModel.create({
    email: parsed.data.email,
    passwordHash,
    role: "customer",
    name: parsed.data.name ?? "",
    phone: parsed.data.phone ?? "",
  });
  const token = signToken({ sub: String(user._id), email: user.email, role: user.role });
  res.status(201).json({
    token,
    user: { id: user._id, email: user.email, role: user.role, name: user.name },
  });
});

router.post("/login", async (req, res) => {
  const parsed = credSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const user = await UserModel.findOne({ email: parsed.data.email });
  if (!user || !(await comparePassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "invalid credentials" });
    return;
  }
  const token = signToken({ sub: String(user._id), email: user.email, role: user.role });
  res.json({
    token,
    user: { id: user._id, email: user.email, role: user.role, name: user.name },
  });
});

router.get("/me", authRequired, async (req, res) => {
  const user = await UserModel.findById(req.user?.sub).lean();
  if (!user) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({
    user: {
      id: user._id,
      email: user.email,
      role: user.role,
      name: user.name,
      phone: user.phone,
    },
  });
});

router.get("/orders", authRequired, async (req, res) => {
  const user = await UserModel.findById(req.user?.sub).lean();
  if (!user) {
    res.status(404).json({ error: "not found" });
    return;
  }
  // match by email or phone since orders aren't linked by user id today
  const filter: Record<string, unknown> = {
    $or: [
      { "customer.email": user.email },
      ...(user.phone ? [{ "customer.phone": user.phone }] : []),
    ],
  };
  const items = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ items });
});

export default router;
