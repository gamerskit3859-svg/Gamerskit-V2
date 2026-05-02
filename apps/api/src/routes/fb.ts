import { Router } from "express";
import { z } from "zod";
import { hashUserData, sendCapiEvent } from "../lib/fb.js";

const router = Router();

const eventSchema = z.object({
  event_name: z.string(),
  event_id: z.string(),
  event_source_url: z.string().optional(),
  user_data: z
    .object({
      email: z.string().optional(),
      phone: z.string().optional(),
      firstName: z.string().optional(),
      lastName: z.string().optional(),
      city: z.string().optional(),
      externalId: z.string().optional(),
      fbp: z.string().optional(),
      fbc: z.string().optional(),
    })
    .optional(),
  custom_data: z
    .object({
      currency: z.string().optional(),
      value: z.number().optional(),
      content_type: z.string().optional(),
      content_ids: z.array(z.string()).optional(),
      content_name: z.string().optional(),
      content_category: z.string().optional(),
      contents: z
        .array(
          z.object({
            id: z.string(),
            quantity: z.number(),
            item_price: z.number().optional(),
          }),
        )
        .optional(),
      num_items: z.number().optional(),
      order_id: z.string().optional(),
    })
    .optional(),
});

/**
 * Server-side proxy used by the storefront so we can include hashed user data,
 * IP, and User-Agent. The browser Pixel fires the same event_name with the
 * SAME event_id so Meta dedupes server + browser into a single event.
 */
router.post("/event", async (req, res) => {
  const parsed = eventSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const { event_name, event_id, event_source_url, user_data, custom_data } = parsed.data;
  const result = await sendCapiEvent({
    event_name,
    event_id,
    event_source_url,
    user_data: {
      ...hashUserData(user_data ?? {}),
      fbp: user_data?.fbp,
      fbc: user_data?.fbc,
      client_ip_address: (req.headers["x-forwarded-for"] as string) ?? req.ip,
      client_user_agent: req.headers["user-agent"],
    },
    custom_data: custom_data
      ? {
          ...custom_data,
          content_type: (custom_data.content_type as "product" | "product_group" | undefined) ?? "product",
        }
      : undefined,
  });
  res.json(result);
});

export default router;
