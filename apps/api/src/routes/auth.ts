import { Router } from "express";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { authRequired, comparePassword, hashPassword, signToken } from "../lib/auth.js";

const router = Router();

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
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
    name: req.body.name ?? "",
  });
  const token = signToken({ sub: String(user._id), email: user.email, role: user.role });
  res.status(201).json({ token, user: { id: user._id, email: user.email, role: user.role } });
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
    },
  });
});

export default router;
