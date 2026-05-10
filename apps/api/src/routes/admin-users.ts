import { Router } from "express";
import { z } from "zod";
import { UserModel } from "../models/User.js";
import { adminOnlyRequired, authRequired } from "../lib/auth.js";

const router = Router();

// List all users (admin only)
router.get("/", adminOnlyRequired, async (req, res) => {
  const page = Math.max(1, Number(req.query.page) || 1);
  const limit = Math.min(100, Number(req.query.limit) || 20);
  const skip = (page - 1) * limit;
  
  const total = await UserModel.countDocuments();
  const items = await UserModel.find()
    .select("-passwordHash")
    .sort({ createdAt: -1 })
    .skip(skip)
    .limit(limit)
    .lean();

  res.json({
    items: items.map((u) => ({
      id: u._id,
      email: u.email,
      name: u.name,
      role: u.role,
      avatar: u.avatar,
      createdAt: u.createdAt,
    })),
    total,
    page,
    limit,
  });
});

// Get single user (admin only)
router.get("/:id", adminOnlyRequired, async (req, res) => {
  const user = await UserModel.findById(req.params.id).select("-passwordHash").lean();
  if (!user) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
      phone: user.phone,
      avatar: user.avatar,
      createdAt: user.createdAt,
    },
  });
});

// Update user role (admin only)
router.patch("/:id/role", adminOnlyRequired, async (req, res) => {
  const schema = z.object({
    role: z.enum(["customer", "staff", "admin"]),
  });

  const parsed = schema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }

  const user = await UserModel.findById(req.params.id);
  if (!user) {
    res.status(404).json({ error: "not found" });
    return;
  }

  user.role = parsed.data.role;
  await user.save();

  res.json({
    user: {
      id: user._id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
});

// Delete user (admin only)
router.delete("/:id", adminOnlyRequired, async (req, res) => {
  const user = await UserModel.findByIdAndDelete(req.params.id);
  if (!user) {
    res.status(404).json({ error: "not found" });
    return;
  }
  res.status(204).send();
});

export default router;
