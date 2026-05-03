import { Router } from "express";
import { CouponModel } from "../models/Coupon.js";

const router = Router();

router.post("/validate", async (req, res) => {
  const code = String(req.body?.code ?? "").toUpperCase();
  const subtotal = Number(req.body?.subtotal ?? 0);
  if (!code) {
    res.status(400).json({ error: "code required" });
    return;
  }
  const coupon = await CouponModel.findOne({ code, active: true }).lean();
  if (!coupon) {
    res.status(404).json({ error: "coupon not found or inactive" });
    return;
  }
  const now = Date.now();
  if (coupon.startsAt && new Date(coupon.startsAt).getTime() > now) {
    res.status(400).json({ error: "coupon not yet active" });
    return;
  }
  if (coupon.endsAt && new Date(coupon.endsAt).getTime() < now) {
    res.status(400).json({ error: "coupon expired" });
    return;
  }
  if (coupon.maxRedemptions && coupon.redeemed >= coupon.maxRedemptions) {
    res.status(400).json({ error: "coupon limit reached" });
    return;
  }
  if (coupon.minOrder && subtotal < coupon.minOrder) {
    res.status(400).json({ error: `Minimum order ৳${coupon.minOrder.toLocaleString()}` });
    return;
  }
  const discount =
    coupon.type === "percent"
      ? Math.round((subtotal * coupon.value) / 100)
      : Math.min(coupon.value, subtotal);
  res.json({
    coupon: {
      code: coupon.code,
      type: coupon.type,
      value: coupon.value,
      discount,
    },
  });
});

export default router;
