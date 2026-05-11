import { Router } from "express";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { OrderModel } from "../models/Order.js";
import { authRequired, comparePassword, hashPassword, signToken, adminOnlyRequired } from "../lib/auth.js";

const router = Router();

const credSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().optional(),
  phone: z.string().optional(),
});

const oauthSchema = z.object({
  email: z.string().email(),
  name: z.string(),
  avatar: z.string().optional(),
  provider: z.enum(["google", "facebook"]),
  providerId: z.string(),
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
  if (!user || !user.passwordHash || !(await comparePassword(parsed.data.password, user.passwordHash))) {
    res.status(401).json({ error: "invalid credentials" });
    return;
  }
  const token = signToken({ sub: String(user._id), email: user.email, role: user.role });
  res.json({
    token,
    user: { id: user._id, email: user.email, role: user.role, name: user.name },
  });
});

// OAuth endpoints
router.post("/oauth/google", async (req, res) => {
  const parsed = oauthSchema.safeParse({ ...req.body, provider: "google" });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  let user = await UserModel.findOne({ googleId: parsed.data.providerId });
  
  if (!user) {
    // Try to find by email
    user = await UserModel.findOne({ email: parsed.data.email });
    if (user) {
      // Link Google account to existing user
      user.googleId = parsed.data.providerId;
      if (!user.avatar) user.avatar = parsed.data.avatar ?? "";
      await user.save();
    } else {
      // Create new user
      user = await UserModel.create({
        email: parsed.data.email,
        name: parsed.data.name,
        avatar: parsed.data.avatar ?? "",
        googleId: parsed.data.providerId,
        role: "customer",
      });
    }
  }

  const token = signToken({ sub: String(user._id), email: user.email, role: user.role });
  res.json({
    token,
    user: { id: user._id, email: user.email, role: user.role, name: user.name },
  });
});

router.post("/oauth/facebook", async (req, res) => {
  const parsed = oauthSchema.safeParse({ ...req.body, provider: "facebook" });
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  let user = await UserModel.findOne({ facebookId: parsed.data.providerId });
  
  if (!user) {
    // Try to find by email
    user = await UserModel.findOne({ email: parsed.data.email });
    if (user) {
      // Link Facebook account to existing user
      user.facebookId = parsed.data.providerId;
      if (!user.avatar) user.avatar = parsed.data.avatar ?? "";
      await user.save();
    } else {
      // Create new user
      user = await UserModel.create({
        email: parsed.data.email,
        name: parsed.data.name,
        avatar: parsed.data.avatar ?? "",
        facebookId: parsed.data.providerId,
        role: "customer",
      });
    }
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
      avatar: user.avatar,
    },
  });
});

router.get("/orders", authRequired, async (req, res) => {
  const user = await UserModel.findById(req.user?.sub).lean();
  if (!user) {
    res.status(404).json({ error: "not found" });
    return;
  }
  // Match on userId first (orders placed while signed in are linked directly),
  // then fall back to email/phone for guest orders that share contact details.
  const filter: Record<string, unknown> = {
    $or: [
      { userId: user._id },
      { "customer.email": user.email },
      ...(user.phone ? [{ "customer.phone": user.phone }] : []),
    ],
  };
  const items = await OrderModel.find(filter).sort({ createdAt: -1 }).limit(50).lean();
  res.json({ items });
});

export default router;
